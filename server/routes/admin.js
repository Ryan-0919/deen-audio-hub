import { Router } from "express";
import multer from "multer";
import { extname } from "node:path";
import { prisma } from "../lib/prisma.js";
import { ok, fail } from "../lib/response.js";
import { requireAdminAuth } from "../middleware/auth.js";
import { serializeAudio, serializeCourse, serializeDevice, serializeFolder, serializeTag, serializeUser } from "../lib/serializers.js";
import { formatDateTime } from "../lib/time.js";
import { hashPassword } from "../lib/auth.js";
import { getAudioDuration } from "../lib/audio.js";
import { cleanupObjectIfReplaced, cleanupObjectIfUnused } from "../lib/assets.js";
import { writeAdminAuditLog } from "../lib/audit.js";
import { extractPhonesFromExcel } from "../lib/excel.js";
import {
  buildAudioUploadCompletedMarkdown,
  buildAudioUploadFailedMarkdown,
  buildBatchImportCompletedMarkdown,
  buildCourseCreatedMarkdown,
  buildCourseManualCloseMarkdown,
  buildCourseManualOpenMarkdown,
  buildUserCreatedMarkdown,
  buildUserPermissionAddedMarkdown,
  notifyMarkdownSafely,
  sendTestWebhookMessage,
} from "../lib/notifications.js";
import { extractScriptFromFile } from "../lib/script-file.js";
import { isValidPhone, normalizePhone, validatePasswordOrThrow, validatePhoneOrThrow } from "../lib/security.js";
import { extractObjectKeyFromUrl, getReadableObjectUrl, uploadBuffer } from "../lib/upload.js";
import { getDisplayNameFromUpload } from "../lib/text.js";

const DEFAULT_USER_PASSWORD = "den2024";
const DEVICE_LIMIT = 5;
const MB = 1024 * 1024;
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]);
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]);
const SCRIPT_EXTENSIONS = new Set([".txt", ".text", ".md", ".srt", ".lrc", ".doc", ".docx"]);
const SCRIPT_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const EXCEL_EXTENSIONS = new Set([".xls", ".xlsx"]);
const EXCEL_MIME_TYPES = new Set([
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".aac", ".ogg", ".oga", ".flac", ".mpga"]);
const AUDIO_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mpga",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/ogg",
  "audio/flac",
]);

const buildUploadValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const createUploadMiddleware = ({ maxFileSize, maxFileCount, allowedExtensions, allowedMimeTypes, fileLabel }) =>
  multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxFileSize,
      files: maxFileCount,
    },
    fileFilter(_req, file, callback) {
      const extension = extname(file.originalname).toLowerCase();
      const mimeType = `${file.mimetype ?? ""}`.toLowerCase();
      const extensionAllowed = allowedExtensions.has(extension);
      const mimeAllowed = allowedMimeTypes.has(mimeType) || (!mimeType || mimeType === "application/octet-stream");

      if (extensionAllowed && mimeAllowed) {
        callback(null, true);
        return;
      }

      callback(buildUploadValidationError(`${fileLabel}格式不支持，请重新选择后上传`));
    },
  });

const uploadImage = createUploadMiddleware({
  maxFileSize: 5 * MB,
  maxFileCount: 1,
  allowedExtensions: IMAGE_EXTENSIONS,
  allowedMimeTypes: IMAGE_MIME_TYPES,
  fileLabel: "图片文件",
});

const uploadScript = createUploadMiddleware({
  maxFileSize: 10 * MB,
  maxFileCount: 1,
  allowedExtensions: SCRIPT_EXTENSIONS,
  allowedMimeTypes: SCRIPT_MIME_TYPES,
  fileLabel: "文案文件",
});

const uploadExcel = createUploadMiddleware({
  maxFileSize: 10 * MB,
  maxFileCount: 1,
  allowedExtensions: EXCEL_EXTENSIONS,
  allowedMimeTypes: EXCEL_MIME_TYPES,
  fileLabel: "Excel 文件",
});

const uploadLibraryAudio = createUploadMiddleware({
  maxFileSize: 200 * MB,
  maxFileCount: 50,
  allowedExtensions: AUDIO_EXTENSIONS,
  allowedMimeTypes: AUDIO_MIME_TYPES,
  fileLabel: "音频文件",
});

const uploadCourseAudio = createUploadMiddleware({
  maxFileSize: 200 * MB,
  maxFileCount: 1,
  allowedExtensions: AUDIO_EXTENSIONS,
  allowedMimeTypes: AUDIO_MIME_TYPES,
  fileLabel: "音频文件",
});

export const adminRouter = Router();

adminRouter.use(requireAdminAuth);

const serializeProgress = (progress) => ({
  userId: progress.userId,
  courseId: progress.courseId,
  audioId: progress.audioId,
  progress: progress.progress,
  completed: progress.completed,
  lastUpdated: formatDateTime(progress.lastUpdated),
});

const serializeAdminAccount = (admin) => ({
  id: admin.id,
  account: admin.account,
  name: admin.name,
  createdAt: formatDateTime(admin.createdAt),
  updatedAt: formatDateTime(admin.updatedAt),
});

const toDate = (value) => {
  if (!value) return new Date();
  return value instanceof Date ? value : new Date(value);
};

const serializeSystemConfig = (config) => ({
  webhookUrl: config?.webhookUrl ?? "",
  customerServiceUrl: config?.customerServiceUrl ?? "",
  brandLogoUrl: getReadableObjectUrl({
    objectKey: config?.brandLogoObjectKey ?? "",
    fallbackUrl: config?.brandLogoUrl ?? "",
  }),
  brandLogoObjectKey: config?.brandLogoObjectKey ?? "",
  playerDiscImageUrl: getReadableObjectUrl({
    objectKey: config?.playerDiscImageObjectKey ?? "",
    fallbackUrl: config?.playerDiscImageUrl ?? "",
  }),
  playerDiscImageObjectKey: config?.playerDiscImageObjectKey ?? "",
});

const toStringArray = (value) =>
  [...new Set((Array.isArray(value) ? value : value ? [value] : []).map((item) => `${item}`.trim()).filter(Boolean))];

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(`${value ?? ""}`, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const isUniqueConstraintError = (error) => Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");

const getOperatorName = (req) => req.auth?.admin?.name || req.auth?.admin?.account || "系统";

const recordAdminAction = (req, payload) => {
  void writeAdminAuditLog(req, payload).catch((error) => {
    console.error("Audit log write failed:", error);
  });
};

const cleanupRemovedObject = (objectKey) => {
  void cleanupObjectIfUnused(objectKey).catch((error) => {
    console.error("OSS cleanup failed:", error);
  });
};

const cleanupReplacedObject = ({ previousObjectKey, nextObjectKey }) => {
  void cleanupObjectIfReplaced({ previousObjectKey, nextObjectKey }).catch((error) => {
    console.error("OSS replacement cleanup failed:", error);
  });
};

const serializeAuditLogItem = (item) => ({
  id: item.id,
  operatorName: item.operatorName || item.operatorAccount || "-",
  operatorAccount: item.operatorAccount || "",
  action: item.action,
  entityType: item.entityType,
  entityId: item.entityId || "",
  entityName: item.entityName || "",
  detail: item.detail || "",
  createdAt: formatDateTime(item.createdAt),
});

const serializeWebhookLogItem = (item) => ({
  id: item.id,
  scene: item.scene,
  status: item.status,
  title: item.title || "",
  webhookUrl: item.webhookUrl || "",
  messagePreview: item.messagePreview || "",
  responseCode: item.responseCode ?? null,
  errorMessage: item.errorMessage || "",
  relatedEntityType: item.relatedEntityType || "",
  relatedEntityId: item.relatedEntityId || "",
  createdAt: formatDateTime(item.createdAt),
});

const readPagination = (query = {}, defaultPageSize = 20, maxPageSize = 100) => {
  const page = toPositiveInt(query.page, 1);
  const pageSize = Math.min(toPositiveInt(query.pageSize, defaultPageSize), maxPageSize);
  return { page, pageSize };
};

const getCourseNamesByIds = async (courseIds = []) => {
  const normalizedIds = toStringArray(courseIds);
  if (normalizedIds.length === 0) return [];

  const courses = await prisma.course.findMany({
    where: { id: { in: normalizedIds } },
    select: { id: true, name: true },
  });

  const courseMap = new Map(courses.map((course) => [course.id, course.name]));
  return normalizedIds.map((courseId) => courseMap.get(courseId)).filter(Boolean);
};

const getCourseList = async () => {
  const courses = await prisma.course.findMany({
    include: {
      _count: {
        select: {
          courseAudios: true,
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return courses.map((course) => serializeCourse(course, course._count.courseAudios));
};

const getCourseDetailForAdmin = async (courseId) => {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      tags: {
        orderBy: { order: "asc" },
      },
      _count: {
        select: {
          courseAudios: true,
        },
      },
    },
  });

  if (!course) return null;

  return {
    course: serializeCourse(course, course._count.courseAudios),
    tags: course.tags.map(serializeTag),
  };
};

const getAudioLibraryMeta = async () => {
  const [totalAudioCount, referencedCount, pendingScriptCount, tagOptions] = await Promise.all([
    prisma.audio.count(),
    prisma.audio.count({
      where: {
        courseAudios: {
          some: {},
        },
      },
    }),
    prisma.audio.count({
      where: {
        scriptText: null,
      },
    }),
    prisma.tag.findMany({
      where: {
        courseAudios: {
          some: {},
        },
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  return {
    totalAudioCount,
    referencedCount,
    pendingScriptCount,
    tagOptions,
  };
};

const getAudioLibraryItems = async (query = {}) => {
  const folderId = `${query.folderId ?? ""}`.trim();
  const keyword = `${query.keyword ?? ""}`.trim();
  const courseId = `${query.courseId ?? ""}`.trim();
  const tagId = `${query.tagId ?? ""}`.trim();
  const excludeCourseId = `${query.excludeCourseId ?? ""}`.trim();
  const searchScope = `${query.searchScope ?? "current"}`.trim() === "all" ? "all" : "current";
  const refFilter = `${query.refFilter ?? "all"}`.trim();
  const scriptFilter = `${query.scriptFilter ?? "all"}`.trim();
  const sortMode = `${query.sortMode ?? "uploaded-desc"}`.trim();
  const page = toPositiveInt(query.page, 1);
  const pageSize = Math.min(toPositiveInt(query.pageSize, 15), 50);
  const relationFilter = {
    ...(courseId ? { courseId } : {}),
    ...(tagId ? { tagId } : {}),
  };
  const courseAudioConditions = [];

  const noCurrentFolderSelected = searchScope === "current" && !folderId;
  const impossibleFilter = noCurrentFolderSelected || (refFilter === "unreferenced" && (courseId || tagId));
  if (refFilter === "unreferenced") {
    courseAudioConditions.push({
      courseAudios: {
        none: {},
      },
    });
  } else if (refFilter === "referenced" || courseId || tagId) {
    courseAudioConditions.push({
      courseAudios: {
        some: relationFilter,
      },
    });
  }

  if (excludeCourseId) {
    courseAudioConditions.push({
      courseAudios: {
        none: {
          courseId: excludeCourseId,
        },
      },
    });
  }

  const where = impossibleFilter
    ? { id: "__empty__" }
    : {
        ...(searchScope === "current" && folderId ? { folderId } : {}),
        ...(keyword
          ? {
              name: {
                contains: keyword,
              },
            }
          : {}),
        ...(scriptFilter === "scripted"
          ? {
              scriptText: {
                not: null,
              },
            }
          : {}),
        ...(scriptFilter === "unscripted"
          ? {
              scriptText: null,
            }
          : {}),
        ...(courseAudioConditions.length === 1
          ? courseAudioConditions[0]
          : courseAudioConditions.length > 1
            ? {
                AND: courseAudioConditions,
              }
            : {}),
      };

  const total = await prisma.audio.count({ where });
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const currentPage = Math.min(page, totalPages);
  const audios =
    total === 0
      ? []
      : await prisma.audio.findMany({
          where,
          select: {
            id: true,
            name: true,
            folderId: true,
            duration: true,
            scriptText: true,
            objectKey: true,
            objectUrl: true,
            uploadedAt: true,
            folder: {
              select: {
                name: true,
              },
            },
            courseAudios: {
              select: {
                courseId: true,
                tagId: true,
                course: {
                  select: {
                    name: true,
                  },
                },
                tag: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
          orderBy:
            sortMode === "name-asc"
              ? [{ name: "asc" }, { uploadedAt: "desc" }]
              : [{ uploadedAt: "desc" }, { id: "desc" }],
          skip: (currentPage - 1) * pageSize,
          take: pageSize,
        });

  return {
    items: audios.map((audio) => ({
      ...serializeAudio(audio),
      folderName: audio.folder.name,
      courseRefs: audio.courseAudios.map((item) => ({
        courseId: item.courseId,
        courseName: item.course.name,
        tagId: item.tagId,
        tagName: item.tag.name,
      })),
    })),
    total,
    page: currentPage,
    pageSize,
    totalPages,
  };
};

const getFolders = async () => {
  const folders = await prisma.audioFolder.findMany({
    include: {
      _count: {
        select: {
          audios: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return folders.map((folder) => serializeFolder(folder, folder._count.audios));
};

const getTagAudiosForAdmin = async (tagId) => {
  const tag = await prisma.tag.findUnique({
    where: { id: tagId },
    include: {
      courseAudios: {
        orderBy: { order: "asc" },
        include: {
          audio: true,
        },
      },
    },
  });

  if (!tag) return null;

  return {
    audios: tag.courseAudios.map((item) => serializeAudio(item.audio)),
    progress: [],
  };
};

const createCoursePermissionLinks = async (userId, courseIds) => {
  const normalizedCourseIds = toStringArray(courseIds);
  if (normalizedCourseIds.length === 0) return;

  await prisma.userCoursePermission.createMany({
    data: normalizedCourseIds.map((courseId) => ({
      userId,
      courseId,
    })),
    skipDuplicates: true,
  });
};

const createOrAppendUser = async (phone, courseIds, defaultPasswordHash) => {
  const normalizedPhone = validatePhoneOrThrow(phone);
  const existed = await prisma.user.findUnique({
    where: { phone: normalizedPhone },
  });

  if (existed) {
    await createCoursePermissionLinks(existed.id, courseIds);
    return { isNew: false, userId: existed.id, phone: existed.phone };
  }

  const user = await prisma.user.create({
    data: {
      phone: normalizedPhone,
      passwordHash: defaultPasswordHash ?? (await hashPassword(DEFAULT_USER_PASSWORD)),
      status: "active",
    },
  });
  await createCoursePermissionLinks(user.id, courseIds);
  return { isNew: true, userId: user.id, phone: user.phone };
};

const batchCreateOrAppendUsers = async (phones, courseIds) => {
  const normalizedCourseIds = toStringArray(courseIds);
  const uniquePhones = [...new Set((Array.isArray(phones) ? phones : [phones]).map((item) => normalizePhone(item)).filter(Boolean))];
  const failed = [];
  const validPhones = [];

  for (const phone of uniquePhones) {
    if (!isValidPhone(phone)) {
      failed.push(phone);
      continue;
    }
    validPhones.push(phone);
  }

  if (validPhones.length === 0) {
    return {
      createdCount: 0,
      appendedCount: 0,
      failed,
    };
  }

  const existingUsers = await prisma.user.findMany({
    where: {
      phone: {
        in: validPhones,
      },
    },
    select: {
      id: true,
      phone: true,
    },
  });

  const existingUserMap = new Map(existingUsers.map((user) => [user.phone, user]));
  const newPhones = validPhones.filter((phone) => !existingUserMap.has(phone));
  let createdUsers = [];

  if (newPhones.length > 0) {
    const defaultPasswordHash = await hashPassword(DEFAULT_USER_PASSWORD);

    await prisma.user.createMany({
      data: newPhones.map((phone) => ({
        phone,
        passwordHash: defaultPasswordHash,
        status: "active",
      })),
      skipDuplicates: true,
    });

    createdUsers = await prisma.user.findMany({
      where: {
        phone: {
          in: newPhones,
        },
      },
      select: {
        id: true,
        phone: true,
      },
    });
  }

  const allUsers = [...existingUsers];
  const knownPhones = new Set(existingUsers.map((user) => user.phone));

  for (const user of createdUsers) {
    if (knownPhones.has(user.phone)) continue;
    knownPhones.add(user.phone);
    allUsers.push(user);
  }

  if (normalizedCourseIds.length > 0 && allUsers.length > 0) {
    await prisma.userCoursePermission.createMany({
      data: allUsers.flatMap((user) =>
        normalizedCourseIds.map((courseId) => ({
          userId: user.id,
          courseId,
        })),
      ),
      skipDuplicates: true,
    });
  }

  for (const phone of newPhones) {
    if (!knownPhones.has(phone)) {
      failed.push(phone);
    }
  }

  return {
    createdCount: newPhones.filter((phone) => knownPhones.has(phone)).length,
    appendedCount: existingUsers.length,
    failed,
  };
};

adminRouter.get("/admins", async (_req, res) => {
  const admins = await prisma.admin.findMany({
    orderBy: { createdAt: "desc" },
  });

  return ok(res, admins.map(serializeAdminAccount));
});

adminRouter.post("/admins", async (req, res) => {
  const account = `${req.body?.account ?? ""}`.trim();
  const name = `${req.body?.name ?? ""}`.trim();
  const password = `${req.body?.password ?? ""}`.trim();

  if (!account || !name || !password) {
    return fail(res, "请填写管理员账号、姓名和密码", 400);
  }

  try {
    const validatedPassword = validatePasswordOrThrow(password, "管理员密码");
    const admin = await prisma.admin.create({
      data: {
        account,
        name,
        passwordHash: await hashPassword(validatedPassword),
      },
    });

    recordAdminAction(req, {
      action: "admin.create",
      entityType: "admin",
      entityId: admin.id,
      entityName: admin.account,
      detail: {
        name: admin.name,
      },
    });

    return ok(res, serializeAdminAccount(admin), "管理员账号已创建");
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return fail(res, "管理员账号已存在，请更换后重试", 400);
    }

    throw error;
  }
});

adminRouter.patch("/admins/:adminId", async (req, res) => {
  const { adminId } = req.params;
  const account = `${req.body?.account ?? ""}`.trim();
  const name = `${req.body?.name ?? ""}`.trim();

  if (!account || !name) {
    return fail(res, "请填写管理员账号和姓名", 400);
  }

  try {
    const admin = await prisma.admin.update({
      where: { id: adminId },
      data: {
        account,
        name,
      },
    });

    recordAdminAction(req, {
      action: "admin.update",
      entityType: "admin",
      entityId: admin.id,
      entityName: admin.account,
      detail: {
        name: admin.name,
      },
    });

    return ok(res, serializeAdminAccount(admin), "管理员信息已更新");
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return fail(res, "管理员账号已存在，请更换后重试", 400);
    }

    throw error;
  }
});

adminRouter.patch("/admins/:adminId/password", async (req, res) => {
  const { adminId } = req.params;
  const password = `${req.body?.password ?? ""}`.trim();

  if (!password) {
    return fail(res, "请输入新的管理员密码", 400);
  }

  const validatedPassword = validatePasswordOrThrow(password, "管理员密码");

  const targetAdmin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { id: true, account: true },
  });

  await prisma.admin.update({
    where: { id: adminId },
    data: {
      passwordHash: await hashPassword(validatedPassword),
    },
  });

  recordAdminAction(req, {
    action: "admin.password.reset",
    entityType: "admin",
    entityId: targetAdmin?.id ?? adminId,
    entityName: targetAdmin?.account ?? "",
  });

  return ok(res, { success: true }, "管理员密码已更新");
});

adminRouter.delete("/admins/:adminId", async (req, res) => {
  const { adminId } = req.params;

  if (req.auth?.adminId === adminId) {
    return fail(res, "当前登录的管理员账号不能删除", 400);
  }

  const adminCount = await prisma.admin.count();
  if (adminCount <= 1) {
    return fail(res, "系统至少需要保留一个管理员账号", 400);
  }

  const targetAdmin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { id: true, account: true, name: true },
  });

  await prisma.admin.delete({
    where: { id: adminId },
  });

  recordAdminAction(req, {
    action: "admin.delete",
    entityType: "admin",
    entityId: targetAdmin?.id ?? adminId,
    entityName: targetAdmin?.account ?? "",
    detail: {
      name: targetAdmin?.name ?? "",
    },
  });

  return ok(res, { success: true }, "管理员账号已删除");
});

adminRouter.get("/users/summary", async (_req, res) => {
  const [total, active, disabled, usersWithDeviceCount] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "active" } }),
    prisma.user.count({ where: { status: "disabled" } }),
    prisma.user.findMany({
      select: {
        id: true,
        _count: {
          select: {
            devices: true,
          },
        },
      },
    }),
  ]);

  return ok(res, {
    total,
    active,
    disabled,
    fullDevices: usersWithDeviceCount.filter((user) => user._count.devices >= DEVICE_LIMIT).length,
  });
});

adminRouter.get("/logs/summary", async (_req, res) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [auditTotal, auditToday, webhookSuccess, webhookFailed, webhookSkipped] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.count({
      where: {
        createdAt: {
          gte: todayStart,
        },
      },
    }),
    prisma.webhookLog.count({ where: { status: "success" } }),
    prisma.webhookLog.count({ where: { status: "failed" } }),
    prisma.webhookLog.count({ where: { status: "skipped" } }),
  ]);

  return ok(res, {
    auditTotal,
    auditToday,
    webhookSuccess,
    webhookFailed,
    webhookSkipped,
  });
});

adminRouter.get("/logs/audit", async (req, res) => {
  const keyword = `${req.query?.keyword ?? ""}`.trim();
  const entityType = `${req.query?.entityType ?? ""}`.trim();
  const { page, pageSize } = readPagination(req.query, 20, 50);
  const where = {
    ...(entityType && entityType !== "all" ? { entityType } : {}),
    ...(keyword
      ? {
          OR: [
            { operatorName: { contains: keyword } },
            { operatorAccount: { contains: keyword } },
            { action: { contains: keyword } },
            { entityName: { contains: keyword } },
            { detail: { contains: keyword } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return ok(res, {
    items: items.map(serializeAuditLogItem),
    total,
    page,
    pageSize,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
  });
});

adminRouter.get("/logs/webhooks", async (req, res) => {
  const keyword = `${req.query?.keyword ?? ""}`.trim();
  const status = `${req.query?.status ?? ""}`.trim();
  const { page, pageSize } = readPagination(req.query, 20, 50);
  const where = {
    ...(status && status !== "all" ? { status } : {}),
    ...(keyword
      ? {
          OR: [
            { scene: { contains: keyword } },
            { title: { contains: keyword } },
            { errorMessage: { contains: keyword } },
            { messagePreview: { contains: keyword } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.webhookLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.webhookLog.count({ where }),
  ]);

  return ok(res, {
    items: items.map(serializeWebhookLogItem),
    total,
    page,
    pageSize,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
  });
});

adminRouter.get("/users", async (req, res) => {
  const keyword = `${req.query?.keyword ?? ""}`.trim();
  const status = `${req.query?.status ?? "all"}`.trim();
  const courseId = `${req.query?.courseId ?? ""}`.trim();
  const page = toPositiveInt(req.query?.page, 1);
  const pageSize = toPositiveInt(req.query?.pageSize, 20);
  const where = {
    ...(keyword
      ? {
          phone: {
            contains: keyword,
          },
        }
      : {}),
    ...(status === "active" || status === "disabled" ? { status } : {}),
    ...(courseId
      ? {
          permissions: {
            some: {
              courseId,
            },
          },
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        permissions: true,
        _count: {
          select: {
            devices: true,
          },
        },
      },
      orderBy: { registeredAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return ok(res, {
    items: users.map(serializeUser),
    total,
    page,
    pageSize,
    totalPages,
  });
});

adminRouter.post("/users", async (req, res) => {
  const { phone, courseIds = [] } = req.body ?? {};
  if (!phone) return fail(res, "请输入手机号", 400);

  const normalizedCourseIds = toStringArray(courseIds);
  const normalizedPhone = validatePhoneOrThrow(phone);
  const result = await createOrAppendUser(normalizedPhone, normalizedCourseIds);
  const courseNames = await getCourseNamesByIds(normalizedCourseIds);

  void notifyMarkdownSafely(
    `user-create:${result.userId}`,
    result.isNew
      ? buildUserCreatedMarkdown({
          phone: result.phone,
          courseNames,
          operatorName: getOperatorName(req),
          eventTime: new Date(),
        })
      : buildUserPermissionAddedMarkdown({
          phone: result.phone,
          courseNames,
          operatorName: getOperatorName(req),
          eventTime: new Date(),
        }),
  );
  recordAdminAction(req, {
    action: result.isNew ? "user.create" : "user.permission.append",
    entityType: "user",
    entityId: result.userId,
    entityName: result.phone,
    detail: {
      courseNames,
    },
  });
  return ok(res, result, result.isNew ? "用户已新增" : "已为现有用户追加课程权限");
});

adminRouter.post("/users/batch-import", async (req, res) => {
  const { phones = [], courseIds = [] } = req.body ?? {};
  const normalizedPhones = [...new Set((phones || []).map((item) => `${item}`.trim()).filter(Boolean))];
  const normalizedCourseIds = toStringArray(courseIds);
  const { createdCount, appendedCount, failed } = await batchCreateOrAppendUsers(normalizedPhones, normalizedCourseIds);

  void notifyMarkdownSafely(
    "user-batch-import",
    buildBatchImportCompletedMarkdown({
      courseNames: await getCourseNamesByIds(normalizedCourseIds),
      parsedCount: normalizedPhones.length,
      createdCount,
      appendedCount,
      failedPhones: failed,
      operatorName: getOperatorName(req),
      eventTime: new Date(),
    }),
  );
  recordAdminAction(req, {
    action: "user.batch_import",
    entityType: "user",
    entityName: `批量导入 ${normalizedPhones.length} 人`,
    detail: {
      createdCount,
      appendedCount,
      failedCount: failed.length,
      courseNames: await getCourseNamesByIds(normalizedCourseIds),
    },
  });

  return ok(res, { createdCount, appendedCount, failed });
});

adminRouter.post("/users/batch-import-excel", uploadExcel.single("file"), async (req, res) => {
  const file = req.file;
  const { courseIds = [] } = req.body ?? {};
  const normalizedCourseIds = toStringArray(courseIds);
  if (!file) return fail(res, "请选择 Excel 文件", 400);

  let normalizedPhones = [];
  try {
    normalizedPhones = await extractPhonesFromExcel({
      fileName: file.originalname,
      buffer: file.buffer,
    });
  } catch (error) {
    return fail(res, error.message || "Excel 解析失败", 400);
  }

  if (!normalizedPhones.length) {
    return fail(res, "Excel 中未读取到手机号", 400);
  }

  const { createdCount, appendedCount, failed } = await batchCreateOrAppendUsers(normalizedPhones, normalizedCourseIds);

  void notifyMarkdownSafely(
    "user-batch-import-excel",
    buildBatchImportCompletedMarkdown({
      courseNames: await getCourseNamesByIds(normalizedCourseIds),
      parsedCount: normalizedPhones.length,
      createdCount,
      appendedCount,
      failedPhones: failed,
      operatorName: getOperatorName(req),
      eventTime: new Date(),
    }),
  );
  recordAdminAction(req, {
    action: "user.batch_import_excel",
    entityType: "user",
    entityName: file.originalname,
    detail: {
      parsedCount: normalizedPhones.length,
      createdCount,
      appendedCount,
      failedCount: failed.length,
      courseNames: await getCourseNamesByIds(normalizedCourseIds),
    },
  });

  return ok(res, { createdCount, appendedCount, failed, parsedCount: normalizedPhones.length });
});

adminRouter.patch("/users/:userId/permissions", async (req, res) => {
  const { addCourses = [], removeCourses = [] } = req.body ?? {};
  const { userId } = req.params;
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, phone: true },
  });

  await createCoursePermissionLinks(userId, addCourses);
  if (removeCourses.length > 0) {
    await prisma.userCoursePermission.deleteMany({
      where: {
        userId,
        courseId: { in: removeCourses },
      },
    });
  }

  recordAdminAction(req, {
    action: "user.permission.update",
    entityType: "user",
    entityId: targetUser?.id ?? userId,
    entityName: targetUser?.phone ?? "",
    detail: {
      addedCourses: await getCourseNamesByIds(addCourses),
      removedCourses: await getCourseNamesByIds(removeCourses),
    },
  });

  return ok(res, { success: true }, "课程权限已更新");
});

adminRouter.post("/users/batch-permissions", async (req, res) => {
  const { userIds = [], courseIds = [] } = req.body ?? {};
  const normalizedUserIds = toStringArray(userIds);
  const normalizedCourseIds = toStringArray(courseIds);

  if (normalizedUserIds.length > 0 && normalizedCourseIds.length > 0) {
    await prisma.userCoursePermission.createMany({
      data: normalizedUserIds.flatMap((userId) =>
        normalizedCourseIds.map((courseId) => ({
          userId,
          courseId,
        })),
      ),
      skipDuplicates: true,
    });
  }
  recordAdminAction(req, {
    action: "user.permission.batch_add",
    entityType: "user",
    entityName: `批量用户 ${normalizedUserIds.length} 人`,
    detail: {
      userCount: normalizedUserIds.length,
      courseNames: await getCourseNamesByIds(normalizedCourseIds),
    },
  });
  return ok(res, { success: true }, "批量加课完成");
});

adminRouter.patch("/users/:userId/password", async (req, res) => {
  const { password } = req.body ?? {};
  if (!password) return fail(res, "请输入新密码", 400);
  const validatedPassword = validatePasswordOrThrow(password, "用户密码");
  const targetUser = await prisma.user.findUnique({
    where: { id: req.params.userId },
    select: { id: true, phone: true },
  });

  await prisma.user.update({
    where: { id: req.params.userId },
    data: {
      passwordHash: await hashPassword(validatedPassword),
    },
  });

  recordAdminAction(req, {
    action: "user.password.update",
    entityType: "user",
    entityId: targetUser?.id ?? req.params.userId,
    entityName: targetUser?.phone ?? "",
  });

  return ok(res, { success: true }, "密码已修改");
});

adminRouter.patch("/users/:userId/status", async (req, res) => {
  const { status } = req.body ?? {};
  const targetUser = await prisma.user.findUnique({
    where: { id: req.params.userId },
    select: { id: true, phone: true },
  });
  await prisma.user.update({
    where: { id: req.params.userId },
    data: { status },
  });
  recordAdminAction(req, {
    action: "user.status.update",
    entityType: "user",
    entityId: targetUser?.id ?? req.params.userId,
    entityName: targetUser?.phone ?? "",
    detail: {
      status,
    },
  });
  return ok(res, { success: true }, "状态已更新");
});

adminRouter.post("/users/batch-status", async (req, res) => {
  const { userIds = [], status } = req.body ?? {};
  await prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: { status },
  });
  recordAdminAction(req, {
    action: "user.status.batch_update",
    entityType: "user",
    entityName: `批量用户 ${userIds.length} 人`,
    detail: {
      status,
      userCount: userIds.length,
    },
  });
  return ok(res, { success: true }, "批量状态更新完成");
});

adminRouter.delete("/users/:userId", async (req, res) => {
  const targetUser = await prisma.user.findUnique({
    where: { id: req.params.userId },
    select: { id: true, phone: true },
  });
  await prisma.user.delete({
    where: { id: req.params.userId },
  });
  recordAdminAction(req, {
    action: "user.delete",
    entityType: "user",
    entityId: targetUser?.id ?? req.params.userId,
    entityName: targetUser?.phone ?? "",
  });
  return ok(res, { success: true }, "用户已删除");
});

adminRouter.post("/users/batch-delete", async (req, res) => {
  const { userIds = [] } = req.body ?? {};
  await prisma.user.deleteMany({
    where: { id: { in: userIds } },
  });
  recordAdminAction(req, {
    action: "user.batch_delete",
    entityType: "user",
    entityName: `批量删除 ${userIds.length} 人`,
    detail: {
      userCount: userIds.length,
    },
  });
  return ok(res, { success: true }, "批量删除完成");
});

adminRouter.get("/users/:userId/devices", async (req, res) => {
  const list = await prisma.userDevice.findMany({
    where: { userId: req.params.userId },
    orderBy: { loginAt: "desc" },
  });
  return ok(res, list.map(serializeDevice));
});

adminRouter.delete("/devices/:deviceId", async (req, res) => {
  const device = await prisma.userDevice.findUnique({
    where: { id: req.params.deviceId },
    include: {
      user: {
        select: { phone: true },
      },
    },
  });
  await prisma.userDevice.delete({
    where: { id: req.params.deviceId },
  });
  recordAdminAction(req, {
    action: "user.device.remove",
    entityType: "user",
    entityId: device?.userId ?? "",
    entityName: device?.user?.phone ?? "",
    detail: {
      deviceType: device?.type ?? "",
      deviceModel: device?.model ?? "",
      ip: device?.ip ?? "",
    },
  });
  return ok(res, { success: true }, "设备已退出");
});

adminRouter.delete("/users/:userId/devices", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.userId },
    select: { id: true, phone: true },
  });
  await prisma.userDevice.deleteMany({
    where: { userId: req.params.userId },
  });
  recordAdminAction(req, {
    action: "user.device.clear",
    entityType: "user",
    entityId: user?.id ?? req.params.userId,
    entityName: user?.phone ?? "",
  });
  return ok(res, { success: true }, "设备已清空");
});

adminRouter.get("/courses", async (_req, res) => {
  return ok(res, await getCourseList());
});

adminRouter.get("/courses/:courseId/detail", async (req, res) => {
  const detail = await getCourseDetailForAdmin(req.params.courseId);
  if (!detail) return fail(res, "课程不存在", 404);
  return ok(res, detail);
});

adminRouter.post("/courses", async (req, res) => {
  const { name, cover, coverObjectKey, description, status, openTime, tags = [] } = req.body ?? {};
  if (!name || !cover || !description) return fail(res, "请填写完整的课程信息", 400);
  const resolvedCoverObjectKey = coverObjectKey || extractObjectKeyFromUrl(cover) || null;

  const lastCourse = await prisma.course.findFirst({
    orderBy: { sortOrder: "desc" },
  });

  const course = await prisma.course.create({
    data: {
      name,
      coverUrl: cover,
      coverObjectKey: resolvedCoverObjectKey,
      description,
      status,
      openTime: toDate(openTime),
      sortOrder: (lastCourse?.sortOrder ?? -1) + 1,
      openedAt: status === "open" ? new Date() : null,
      webhookNotifiedAt: status === "scheduled" ? null : undefined,
      tags: {
        create: tags.map((tag, index) => ({
          name: `${tag}`.trim(),
          order: index,
        })),
      },
    },
  });
  void notifyMarkdownSafely(
    `course-create:${course.id}`,
    buildCourseCreatedMarkdown({
      courseName: course.name,
      tagNames: tags,
      operatorName: getOperatorName(req),
      eventTime: new Date(),
    }),
    "",
    {
      relatedEntityType: "course",
      relatedEntityId: course.id,
    },
  );
  recordAdminAction(req, {
    action: "course.create",
    entityType: "course",
    entityId: course.id,
    entityName: course.name,
    detail: {
      status: course.status,
      tags: tags.map((tag) => `${tag}`.trim()).filter(Boolean),
    },
  });

  return ok(res, serializeCourse(course, 0), "课程已创建");
});
adminRouter.patch("/courses/order", async (req, res) => {
  const { items = [] } = req.body ?? {};
  await prisma.$transaction(
    items.map((item) =>
      prisma.course.update({
        where: { id: item.id },
        data: { sortOrder: item.order },
      }),
    ),
  );

  recordAdminAction(req, {
    action: "course.order.update",
    entityType: "course",
    entityName: `排序数量 ${items.length}`,
    detail: {
      itemCount: items.length,
    },
  });

  return ok(res, { success: true }, "课程顺序已更新");
});

adminRouter.patch("/courses/:courseId", async (req, res) => {
  const previousCourse = await prisma.course.findUnique({
    where: { id: req.params.courseId },
    select: { id: true, name: true, status: true, coverObjectKey: true, openTime: true },
  });

  const payload = { ...req.body };
  if (payload.openTime) payload.openTime = toDate(payload.openTime);
  if (payload.cover) payload.coverUrl = payload.cover;
  if (payload.coverObjectKey !== undefined || payload.cover) {
    payload.coverObjectKey = payload.coverObjectKey || extractObjectKeyFromUrl(payload.cover || "") || null;
  }

  delete payload.cover;

  if (payload.status === "open") {
    payload.openedAt = new Date();
  }
  if (payload.status === "scheduled") {
    payload.webhookNotifiedAt = null;
  }

  const course = await prisma.course.update({
    where: { id: req.params.courseId },
    data: payload,
    include: {
      _count: {
        select: {
          courseAudios: true,
        },
      },
    },
  });
  if (previousCourse?.status !== "open" && course.status === "open") {
    void notifyMarkdownSafely(
      `course-open-manual:${course.id}`,
      buildCourseManualOpenMarkdown({
        courseName: course.name,
        operatorName: getOperatorName(req),
        eventTime: new Date(),
      }),
      "",
      {
        relatedEntityType: "course",
        relatedEntityId: course.id,
      },
    );
  } else if (previousCourse?.status !== "closed" && course.status === "closed") {
    void notifyMarkdownSafely(
      `course-close-manual:${course.id}`,
      buildCourseManualCloseMarkdown({
        courseName: course.name,
        operatorName: getOperatorName(req),
        eventTime: new Date(),
      }),
      "",
      {
        relatedEntityType: "course",
        relatedEntityId: course.id,
      },
    );
  }
  cleanupReplacedObject({
    previousObjectKey: previousCourse?.coverObjectKey ?? "",
    nextObjectKey: course.coverObjectKey ?? "",
  });
  recordAdminAction(req, {
    action: "course.update",
    entityType: "course",
    entityId: course.id,
    entityName: course.name,
    detail: {
      status: course.status,
      previousStatus: previousCourse?.status ?? "",
      openTime: course.openTime,
    },
  });

  return ok(res, serializeCourse(course, course._count.courseAudios), "课程已更新");
});

adminRouter.delete("/courses/:courseId", async (req, res) => {
  const targetCourse = await prisma.course.findUnique({
    where: { id: req.params.courseId },
    select: { id: true, name: true, coverObjectKey: true },
  });
  await prisma.$transaction([
    prisma.userProgress.deleteMany({
      where: { courseId: req.params.courseId },
    }),
    prisma.course.delete({
      where: { id: req.params.courseId },
    }),
  ]);
  cleanupRemovedObject(targetCourse?.coverObjectKey ?? "");
  recordAdminAction(req, {
    action: "course.delete",
    entityType: "course",
    entityId: targetCourse?.id ?? req.params.courseId,
    entityName: targetCourse?.name ?? "",
  });

  return ok(res, { success: true }, "课程已删除");
});

adminRouter.post("/courses/:courseId/tags", async (req, res) => {
  const { name } = req.body ?? {};
  if (!name) return fail(res, "请输入标签名称", 400);

  const lastTag = await prisma.tag.findFirst({
    where: { courseId: req.params.courseId },
    orderBy: { order: "desc" },
  });

  const tag = await prisma.tag.create({
    data: {
      courseId: req.params.courseId,
      name,
      order: (lastTag?.order ?? -1) + 1,
    },
  });

  recordAdminAction(req, {
    action: "tag.create",
    entityType: "tag",
    entityId: tag.id,
    entityName: tag.name,
    detail: {
      courseId: tag.courseId,
    },
  });

  return ok(res, serializeTag(tag), "标签已新增");
});

adminRouter.patch("/tags/:tagId", async (req, res) => {
  const { name } = req.body ?? {};
  const previousTag = await prisma.tag.findUnique({
    where: { id: req.params.tagId },
    select: { id: true, name: true, courseId: true },
  });
  const tag = await prisma.tag.update({
    where: { id: req.params.tagId },
    data: { name },
  });
  recordAdminAction(req, {
    action: "tag.update",
    entityType: "tag",
    entityId: tag.id,
    entityName: tag.name,
    detail: {
      previousName: previousTag?.name ?? "",
      courseId: tag.courseId,
    },
  });
  return ok(res, serializeTag(tag), "标签已更新");
});

adminRouter.delete("/tags/:tagId", async (req, res) => {
  const tag = await prisma.tag.findUnique({
    where: { id: req.params.tagId },
    select: { id: true, name: true, courseId: true },
  });
  await prisma.tag.delete({
    where: { id: req.params.tagId },
  });
  recordAdminAction(req, {
    action: "tag.delete",
    entityType: "tag",
    entityId: tag?.id ?? req.params.tagId,
    entityName: tag?.name ?? "",
    detail: {
      courseId: tag?.courseId ?? "",
    },
  });
  return ok(res, { success: true }, "标签已删除");
});

adminRouter.patch("/courses/:courseId/tags/order", async (req, res) => {
  const { items = [] } = req.body ?? {};
  await prisma.$transaction(
    items.map((item) =>
      prisma.tag.update({
        where: { id: item.id },
        data: { order: item.order },
      }),
    ),
  );

  recordAdminAction(req, {
    action: "tag.order.update",
    entityType: "tag",
    entityName: `课程 ${req.params.courseId}`,
    detail: {
      itemCount: items.length,
      courseId: req.params.courseId,
    },
  });

  return ok(res, { success: true }, "标签顺序已更新");
});

adminRouter.get("/tags/:tagId/audios", async (req, res) => {
  const detail = await getTagAudiosForAdmin(req.params.tagId);
  if (!detail) return fail(res, "标签不存在", 404);
  return ok(res, detail);
});

adminRouter.patch("/courses/:courseId/tags/:tagId/audios/order", async (req, res) => {
  const { items = [] } = req.body ?? {};
  await prisma.$transaction(
    items.map((item) =>
      prisma.courseAudio.updateMany({
        where: {
          courseId: req.params.courseId,
          tagId: req.params.tagId,
          audioId: item.id,
        },
        data: { order: item.order },
      }),
    ),
  );

  recordAdminAction(req, {
    action: "course.audio.order.update",
    entityType: "course",
    entityId: req.params.courseId,
    entityName: req.params.tagId,
    detail: {
      tagId: req.params.tagId,
      itemCount: items.length,
    },
  });

  return ok(res, { success: true }, "音频顺序已更新");
});

adminRouter.patch("/courses/:courseId/audios/:audioId/tag", async (req, res) => {
  const { tagId } = req.body ?? {};
  const targetTag = await prisma.tag.findFirst({
    where: {
      id: tagId,
      courseId: req.params.courseId,
    },
  });

  if (!targetTag) return fail(res, "目标标签不存在", 404);

  const lastItem = await prisma.courseAudio.findFirst({
    where: { tagId },
    orderBy: { order: "desc" },
  });

  await prisma.courseAudio.updateMany({
    where: {
      courseId: req.params.courseId,
      audioId: req.params.audioId,
    },
    data: {
      tagId,
      order: (lastItem?.order ?? -1) + 1,
    },
  });

  recordAdminAction(req, {
    action: "course.audio.tag.update",
    entityType: "course",
    entityId: req.params.courseId,
    entityName: req.params.audioId,
    detail: {
      audioId: req.params.audioId,
      tagId,
    },
  });

  return ok(res, { success: true }, "音频标签已更新");
});

adminRouter.delete("/courses/:courseId/audios/:audioId", async (req, res) => {
  await prisma.courseAudio.deleteMany({
    where: {
      courseId: req.params.courseId,
      audioId: req.params.audioId,
    },
  });
  recordAdminAction(req, {
    action: "course.audio.remove",
    entityType: "course",
    entityId: req.params.courseId,
    entityName: req.params.audioId,
    detail: {
      audioId: req.params.audioId,
    },
  });
  return ok(res, { success: true }, "已从课程中移除音频");
});

adminRouter.post("/courses/:courseId/tags/:tagId/audios/reference", async (req, res) => {
  const { audioIds = [] } = req.body ?? {};
  const normalizedAudioIds = toStringArray(audioIds);
  const tag = await prisma.tag.findFirst({
    where: {
      id: req.params.tagId,
      courseId: req.params.courseId,
    },
  });

  if (!tag) return fail(res, "标签不存在", 404);

  const lastRelation = await prisma.courseAudio.findFirst({
    where: {
      courseId: req.params.courseId,
      tagId: req.params.tagId,
    },
    orderBy: { order: "desc" },
  });

  let order = (lastRelation?.order ?? -1) + 1;
  const [audios, existingRelations] = await Promise.all([
    prisma.audio.findMany({
      where: {
        id: {
          in: normalizedAudioIds,
        },
      },
      select: {
        id: true,
        scriptText: true,
      },
    }),
    prisma.courseAudio.findMany({
      where: {
        courseId: req.params.courseId,
        audioId: {
          in: normalizedAudioIds,
        },
      },
      select: {
        audioId: true,
      },
    }),
  ]);

  const audioMap = new Map(audios.map((audio) => [audio.id, audio]));
  const existingAudioIds = new Set(existingRelations.map((item) => item.audioId));
  const relationsToCreate = [];

  for (const audioId of normalizedAudioIds) {
    const audio = audioMap.get(audioId);
    if (!audio) continue;
    if (!audio.scriptText?.trim()) return fail(res, "无文案音频不能被课程引用", 400);

    if (existingAudioIds.has(audioId)) continue;

    relationsToCreate.push({
      courseId: req.params.courseId,
      tagId: req.params.tagId,
      audioId,
      order,
    });

    order += 1;
  }

  if (relationsToCreate.length > 0) {
    await prisma.courseAudio.createMany({
      data: relationsToCreate,
      skipDuplicates: true,
    });
  }

  recordAdminAction(req, {
    action: "course.audio.reference",
    entityType: "course",
    entityId: req.params.courseId,
    entityName: req.params.tagId,
    detail: {
      tagId: req.params.tagId,
      referencedCount: relationsToCreate.length,
    },
  });

  return ok(res, { success: true }, "音频已引用到课程");
});

adminRouter.get("/library/folders", async (_req, res) => {
  return ok(res, await getFolders());
});

adminRouter.post("/library/folders", async (req, res) => {
  const { name } = req.body ?? {};
  if (!name) return fail(res, "请输入文件夹名称", 400);

  const folder = await prisma.audioFolder.create({
    data: { name },
  });

  recordAdminAction(req, {
    action: "library.folder.create",
    entityType: "audio_folder",
    entityId: folder.id,
    entityName: folder.name,
  });

  return ok(res, serializeFolder(folder, 0), "文件夹已创建");
});

adminRouter.patch("/library/folders/:folderId", async (req, res) => {
  const { name } = req.body ?? {};
  const previousFolder = await prisma.audioFolder.findUnique({
    where: { id: req.params.folderId },
    select: { id: true, name: true },
  });
  const folder = await prisma.audioFolder.update({
    where: { id: req.params.folderId },
    data: { name },
  });
  recordAdminAction(req, {
    action: "library.folder.update",
    entityType: "audio_folder",
    entityId: folder.id,
    entityName: folder.name,
    detail: {
      previousName: previousFolder?.name ?? "",
    },
  });
  return ok(res, serializeFolder(folder, 0), "文件夹已更新");
});

adminRouter.delete("/library/folders/:folderId", async (req, res) => {
  const folder = await prisma.audioFolder.findUnique({
    where: { id: req.params.folderId },
    select: { id: true, name: true },
  });
  const count = await prisma.audio.count({
    where: { folderId: req.params.folderId },
  });
  if (count > 0) return fail(res, "非空文件夹不能删除", 400);

  await prisma.audioFolder.delete({
    where: { id: req.params.folderId },
  });

  recordAdminAction(req, {
    action: "library.folder.delete",
    entityType: "audio_folder",
    entityId: folder?.id ?? req.params.folderId,
    entityName: folder?.name ?? "",
  });

  return ok(res, { success: true }, "文件夹已删除");
});

adminRouter.get("/library/meta", async (_req, res) => {
  return ok(res, await getAudioLibraryMeta());
});

adminRouter.get("/library/audios", async (req, res) => {
  return ok(res, await getAudioLibraryItems(req.query));
});

adminRouter.patch("/library/audios/:audioId/name", async (req, res) => {
  const { name } = req.body ?? {};
  const previousAudio = await prisma.audio.findUnique({
    where: { id: req.params.audioId },
    select: { id: true, name: true },
  });
  const audio = await prisma.audio.update({
    where: { id: req.params.audioId },
    data: { name },
  });
  recordAdminAction(req, {
    action: "audio.name.update",
    entityType: "audio",
    entityId: audio.id,
    entityName: audio.name,
    detail: {
      previousName: previousAudio?.name ?? "",
    },
  });
  return ok(res, serializeAudio(audio), "音频名称已更新");
});

adminRouter.patch("/library/audios/:audioId/script", async (req, res) => {
  const { script } = req.body ?? {};
  const previousAudio = await prisma.audio.findUnique({
    where: { id: req.params.audioId },
    select: { id: true, name: true, scriptText: true },
  });
  const audio = await prisma.audio.update({
    where: { id: req.params.audioId },
    data: {
      scriptText: script?.trim() ? script : null,
    },
  });
  recordAdminAction(req, {
    action: "audio.script.update",
    entityType: "audio",
    entityId: audio.id,
    entityName: audio.name,
    detail: {
      hadScriptBefore: Boolean(previousAudio?.scriptText?.trim()),
      hasScriptNow: Boolean(audio.scriptText?.trim()),
    },
  });
  return ok(res, serializeAudio(audio), "文案已保存");
});

adminRouter.post("/library/audios/move-folder", async (req, res) => {
  const { audioIds = [], folderId } = req.body ?? {};
  await prisma.audio.updateMany({
    where: {
      id: { in: audioIds },
    },
    data: { folderId },
  });
  recordAdminAction(req, {
    action: "audio.folder.move",
    entityType: "audio",
    entityName: `音频 ${audioIds.length} 条`,
    detail: {
      folderId,
      audioCount: audioIds.length,
    },
  });
  return ok(res, { success: true }, "音频已移动到新文件夹");
});

adminRouter.delete("/library/audios/:audioId", async (req, res) => {
  const targetAudio = await prisma.audio.findUnique({
    where: { id: req.params.audioId },
    select: { id: true, name: true, objectKey: true },
  });
  const refCount = await prisma.courseAudio.count({
    where: { audioId: req.params.audioId },
  });
  if (refCount > 0) return fail(res, "该音频已被课程引用，请先取消引用后再删除", 400);

  await prisma.audio.delete({
    where: { id: req.params.audioId },
  });
  cleanupRemovedObject(targetAudio?.objectKey ?? "");
  recordAdminAction(req, {
    action: "audio.delete",
    entityType: "audio",
    entityId: targetAudio?.id ?? req.params.audioId,
    entityName: targetAudio?.name ?? "",
  });
  return ok(res, { success: true }, "音频已删除");
});

adminRouter.get("/system-config", async (_req, res) => {
  const config = await prisma.systemConfig.findUnique({
    where: { id: 1 },
  });

  return ok(res, serializeSystemConfig(config));
});

adminRouter.patch("/system-config", async (req, res) => {
  const { webhookUrl, customerServiceUrl, brandLogoUrl, brandLogoObjectKey, playerDiscImageUrl, playerDiscImageObjectKey } = req.body ?? {};
  const current = await prisma.systemConfig.findUnique({
    where: { id: 1 },
  });

  const config = await prisma.systemConfig.upsert({
    where: { id: 1 },
    update: {
      webhookUrl: webhookUrl !== undefined ? webhookUrl : current?.webhookUrl ?? "",
      customerServiceUrl: customerServiceUrl !== undefined ? customerServiceUrl || null : current?.customerServiceUrl ?? null,
      brandLogoUrl: brandLogoUrl !== undefined ? brandLogoUrl || null : current?.brandLogoUrl ?? null,
      brandLogoObjectKey: brandLogoObjectKey !== undefined ? brandLogoObjectKey || null : current?.brandLogoObjectKey ?? null,
      playerDiscImageUrl: playerDiscImageUrl !== undefined ? playerDiscImageUrl || null : current?.playerDiscImageUrl ?? null,
      playerDiscImageObjectKey:
        playerDiscImageObjectKey !== undefined ? playerDiscImageObjectKey || null : current?.playerDiscImageObjectKey ?? null,
    },
    create: {
      id: 1,
      webhookUrl: webhookUrl ?? "",
      customerServiceUrl: customerServiceUrl || null,
      brandLogoUrl: brandLogoUrl || null,
      brandLogoObjectKey: brandLogoObjectKey || null,
      playerDiscImageUrl: playerDiscImageUrl || null,
      playerDiscImageObjectKey: playerDiscImageObjectKey || null,
    },
  });

  cleanupReplacedObject({
    previousObjectKey: current?.brandLogoObjectKey ?? "",
    nextObjectKey: config.brandLogoObjectKey ?? "",
  });
  cleanupReplacedObject({
    previousObjectKey: current?.playerDiscImageObjectKey ?? "",
    nextObjectKey: config.playerDiscImageObjectKey ?? "",
  });
  recordAdminAction(req, {
    action: "system.config.update",
    entityType: "system_config",
    entityId: "1",
    entityName: "system-config",
    detail: {
      customerServiceUrl: config.customerServiceUrl ?? "",
      hasWebhookUrl: Boolean(config.webhookUrl),
      hasBrandLogo: Boolean(config.brandLogoObjectKey || config.brandLogoUrl),
      hasPlayerDiscImage: Boolean(config.playerDiscImageObjectKey || config.playerDiscImageUrl),
    },
  });

  return ok(res, serializeSystemConfig(config), "配置已保存");
});

adminRouter.post("/system-config/test-webhook", async (req, res) => {
  const inputWebhookUrl = `${req.body?.webhookUrl ?? ""}`.trim();
  const current = await prisma.systemConfig.findUnique({
    where: { id: 1 },
  });
  const webhookUrl = inputWebhookUrl || `${current?.webhookUrl ?? ""}`.trim();

  if (!webhookUrl) {
    return fail(res, "请先填写企业微信 Webhook 地址", 400);
  }

  try {
    await sendTestWebhookMessage(webhookUrl);
    recordAdminAction(req, {
      action: "system.webhook.test",
      entityType: "system_config",
      entityId: "1",
      entityName: "system-config",
    });
    return ok(res, { success: true }, "测试通知已发送");
  } catch (error) {
    return fail(res, error.message || "测试通知发送失败", 500);
  }
});

adminRouter.post("/uploads/script-file", uploadScript.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return fail(res, "请选择文案文件", 400);

  try {
    const text = await extractScriptFromFile({
      fileName: file.originalname,
      buffer: file.buffer,
    });

    return ok(
      res,
      {
        text,
      },
      "文案文件解析成功",
    );
  } catch (error) {
    return fail(res, error.message || "文案文件解析失败", 400);
  }
});

adminRouter.post("/uploads/course-cover", uploadImage.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return fail(res, "请选择封面文件", 400);

  const uploaded = await uploadBuffer({
    fileName: file.originalname,
    buffer: file.buffer,
    mimeType: file.mimetype,
    folder: "course-covers",
  });

  return ok(res, uploaded, "封面上传成功");
});

adminRouter.post("/uploads/system-image", uploadImage.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return fail(res, "请选择图片文件", 400);

  const uploaded = await uploadBuffer({
    fileName: file.originalname,
    buffer: file.buffer,
    mimeType: file.mimetype,
    folder: "system-images",
  });

  return ok(res, uploaded, "系统图片上传成功");
});

adminRouter.post("/library/audios/upload", uploadLibraryAudio.array("files"), async (req, res) => {
  const files = req.files;
  const { folderId, script = "" } = req.body ?? {};
  if (!Array.isArray(files) || files.length === 0 || !folderId) {
    return fail(res, "请选择文件夹和音频文件", 400);
  }

  const folder = await prisma.audioFolder.findUnique({
    where: { id: folderId },
    select: { name: true },
  });
  const created = [];

  try {
    for (const [index, file] of files.entries()) {
      const [uploaded, duration] = await Promise.all([
        uploadBuffer({
          fileName: file.originalname,
          buffer: file.buffer,
          mimeType: file.mimetype,
          folder: "audios/library",
        }),
        getAudioDuration(file),
      ]);

      try {
        const audio = await prisma.audio.create({
          data: {
            name: getDisplayNameFromUpload(file.originalname, "未命名音频"),
            folderId,
            duration,
            scriptText: files.length === 1 ? script || null : index === 0 && script ? script : null,
            objectKey: uploaded.objectKey,
            objectUrl: uploaded.url,
            mimeType: file.mimetype,
          },
        });

        created.push(serializeAudio(audio));
      } catch (error) {
        cleanupRemovedObject(uploaded.objectKey);
        throw error;
      }
    }

    void notifyMarkdownSafely(
      "audio-library-upload",
      buildAudioUploadCompletedMarkdown({
        folderName: folder?.name ?? "音频库",
        courseName: "音频库",
        tagName: "-",
        totalCount: files.length,
        successCount: created.length,
        failedNames: [],
        operatorName: getOperatorName(req),
        eventTime: new Date(),
      }),
    );
    recordAdminAction(req, {
      action: "audio.upload.library",
      entityType: "audio",
      entityName: folder?.name ?? "音频库",
      detail: {
        folderId,
        uploadedCount: created.length,
      },
    });

    return ok(res, created, "音频上传成功");
  } catch (error) {
    void notifyMarkdownSafely(
      "audio-library-upload-failed",
      buildAudioUploadFailedMarkdown({
        folderName: folder?.name ?? "音频库",
        courseName: "音频库",
        tagName: "-",
        fileNames: files.map((file) => file.originalname),
        errorMessage: error instanceof Error ? error.message : "音频上传失败",
        operatorName: getOperatorName(req),
        eventTime: new Date(),
      }),
    );
    return fail(res, error.message || "音频上传失败", 500);
  }
});

adminRouter.post("/courses/:courseId/tags/:tagId/audios/upload", uploadCourseAudio.array("files"), async (req, res) => {
  const files = req.files;
  const { script = "" } = req.body ?? {};
  const { courseId, tagId } = req.params;

  if (!Array.isArray(files) || files.length !== 1) {
    return fail(res, "课程内直传当前仅支持单条上传", 400);
  }
  if (!script.trim()) {
    return fail(res, "课程内直传音频时，请同步填写文案", 400);
  }

  const folder = await prisma.audioFolder.findUnique({
    where: { name: "课程直传" },
  });

  if (!folder) return fail(res, "课程直传文件夹不存在", 400);

  const lastRelation = await prisma.courseAudio.findFirst({
    where: { courseId, tagId },
    orderBy: { order: "desc" },
  });

  const file = files[0];
  try {
    const uploaded = await uploadBuffer({
      fileName: file.originalname,
      buffer: file.buffer,
      mimeType: file.mimetype,
      folder: "audios/course-direct",
    });

    let audio;
    try {
      audio = await prisma.audio.create({
        data: {
          name: getDisplayNameFromUpload(file.originalname, "未命名音频"),
          folderId: folder.id,
          duration: await getAudioDuration(file),
          scriptText: script,
          objectKey: uploaded.objectKey,
          objectUrl: uploaded.url,
          mimeType: file.mimetype,
        },
      });
    } catch (error) {
      cleanupRemovedObject(uploaded.objectKey);
      throw error;
    }

    await prisma.courseAudio.create({
      data: {
        courseId,
        tagId,
        audioId: audio.id,
        order: (lastRelation?.order ?? -1) + 1,
      },
    });

    recordAdminAction(req, {
      action: "audio.upload.course_direct",
      entityType: "course",
      entityId: courseId,
      entityName: tagId,
      detail: {
        audioId: audio.id,
        audioName: audio.name,
      },
    });

    return ok(res, serializeAudio(audio), "课程直传音频成功");
  } catch (error) {
    return fail(res, error.message || "课程直传音频失败", 500);
  }
});

adminRouter.get("/progress/:audioId", async (req, res) => {
  const list = await prisma.userProgress.findMany({
    where: { audioId: req.params.audioId },
  });
  return ok(res, list.map(serializeProgress));
});
