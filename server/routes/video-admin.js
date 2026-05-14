import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import multer from "multer";
import { Router } from "express";
import { cleanupObjectIfReplaced, cleanupObjectIfUnused } from "../lib/assets.js";
import { getAdminTagVideos, getVideoFoldersWithCounts, getVideoLibraryItems, getVideoLibraryMeta } from "../lib/course-content.js";
import { prisma } from "../lib/prisma.js";
import { ok, fail } from "../lib/response.js";
import { serializeVideo, serializeVideoFolder } from "../lib/serializers.js";
import { extractScriptFromFile } from "../lib/script-file.js";
import { extractObjectKeyFromUrl, uploadBuffer } from "../lib/upload.js";
import { getDisplayNameFromUpload } from "../lib/text.js";
import { getVideoDuration } from "../lib/video.js";
import { requireAdminAuth, requireAdminRoles } from "../middleware/auth.js";
import { writeAdminAuditLog } from "../lib/audit.js";

const MB = 1024 * 1024;
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".m4v", ".webm", ".avi", ".mkv"]);
const VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/webm",
]);
const VIDEO_UPLOAD_TEMP_ROOT = join(tmpdir(), "denlaw-video-upload");
const LIBRARY_VIDEO_OBJECT_FOLDER = "videos/library";
const DIRECT_VIDEO_OBJECT_FOLDER = "videos/course-direct";
const DIRECT_UPLOAD_FOLDER_NAME = "课程直传视频";

const buildUploadValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const ensureVideoUploadRoot = () => {
  fs.mkdirSync(VIDEO_UPLOAD_TEMP_ROOT, { recursive: true });
  return VIDEO_UPLOAD_TEMP_ROOT;
};

const createVideoUploadMiddleware = ({ maxFileSize, maxFileCount }) =>
  multer({
    storage: multer.diskStorage({
      destination(_req, _file, callback) {
        callback(null, ensureVideoUploadRoot());
      },
      filename(_req, file, callback) {
        callback(null, `${Date.now()}-${randomUUID()}${extname(file.originalname).toLowerCase()}`);
      },
    }),
    limits: {
      fileSize: maxFileSize,
      files: maxFileCount,
    },
    fileFilter(_req, file, callback) {
      const extension = extname(file.originalname).toLowerCase();
      const mimeType = `${file.mimetype ?? ""}`.toLowerCase();
      const extensionAllowed = VIDEO_EXTENSIONS.has(extension);
      const mimeAllowed = VIDEO_MIME_TYPES.has(mimeType) || !mimeType || mimeType === "application/octet-stream";

      if (extensionAllowed && mimeAllowed) {
        callback(null, true);
        return;
      }

      callback(buildUploadValidationError("视频文件格式不支持，请重新选择后上传"));
    },
  });

const uploadLibraryVideo = createVideoUploadMiddleware({
  maxFileSize: 500 * MB,
  maxFileCount: 20,
});

const uploadCourseVideo = createVideoUploadMiddleware({
  maxFileSize: 500 * MB,
  maxFileCount: 1,
});

const toStringArray = (value) =>
  [...new Set((Array.isArray(value) ? value : value ? [value] : []).map((item) => `${item}`.trim()).filter(Boolean))];

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(`${value ?? ""}`, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

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

const cleanupTempFile = async (filePath = "") => {
  if (!filePath) return;
  await rm(filePath, { force: true }).catch(() => {});
};

const createVideoRecord = async ({ fileName, folderId, scriptText, mimeType, duration, objectKey, objectUrl }) =>
  prisma.video.create({
    data: {
      name: getDisplayNameFromUpload(fileName, "未命名视频"),
      folderId,
      duration: duration ?? 0,
      scriptText: scriptText?.trim() ? scriptText : null,
      mimeType: mimeType || null,
      objectKey: objectKey || null,
      objectUrl: objectUrl || null,
    },
  });

const uploadVideoFileAndCreateRecord = async ({ file, folderId, scriptText, objectFolder }) => {
  const buffer = await readFile(file.path);
  const duration = await getVideoDuration({
    buffer,
    mimeType: file.mimetype,
    size: buffer.length,
  });
  const uploaded = await uploadBuffer({
    fileName: file.originalname,
    buffer,
    mimeType: file.mimetype,
    folder: objectFolder,
  });

  try {
    return await createVideoRecord({
      fileName: file.originalname,
      folderId,
      scriptText,
      mimeType: file.mimetype,
      duration,
      objectKey: uploaded.objectKey,
      objectUrl: uploaded.url,
    });
  } catch (error) {
    cleanupRemovedObject(uploaded.objectKey);
    throw error;
  }
};

export const videoAdminRouter = Router();

videoAdminRouter.use(requireAdminAuth);
videoAdminRouter.use(requireAdminRoles("super_admin", "operations_admin"));

videoAdminRouter.get("/video-library/folders", async (_req, res) => {
  return ok(res, await getVideoFoldersWithCounts());
});

videoAdminRouter.post("/video-library/folders", async (req, res) => {
  const name = `${req.body?.name ?? ""}`.trim();
  if (!name) return fail(res, "请输入文件夹名称", 400);

  const folder = await prisma.videoFolder.create({
    data: { name },
  });

  recordAdminAction(req, {
    action: "video.folder.create",
    entityType: "video_folder",
    entityId: folder.id,
    entityName: folder.name,
  });

  return ok(res, serializeVideoFolder(folder, 0), "视频文件夹已创建");
});

videoAdminRouter.patch("/video-library/folders/:folderId", async (req, res) => {
  const name = `${req.body?.name ?? ""}`.trim();
  if (!name) return fail(res, "请输入文件夹名称", 400);

  const previousFolder = await prisma.videoFolder.findUnique({
    where: { id: req.params.folderId },
    select: { id: true, name: true },
  });
  const folder = await prisma.videoFolder.update({
    where: { id: req.params.folderId },
    data: { name },
  });

  recordAdminAction(req, {
    action: "video.folder.update",
    entityType: "video_folder",
    entityId: folder.id,
    entityName: folder.name,
    detail: {
      previousName: previousFolder?.name ?? "",
    },
  });

  return ok(res, serializeVideoFolder(folder, 0), "视频文件夹已更新");
});

videoAdminRouter.delete("/video-library/folders/:folderId", async (req, res) => {
  const folder = await prisma.videoFolder.findUnique({
    where: { id: req.params.folderId },
    select: { id: true, name: true },
  });
  const count = await prisma.video.count({
    where: { folderId: req.params.folderId },
  });
  if (count > 0) return fail(res, "非空文件夹不能删除", 400);

  await prisma.videoFolder.delete({
    where: { id: req.params.folderId },
  });

  recordAdminAction(req, {
    action: "video.folder.delete",
    entityType: "video_folder",
    entityId: folder?.id ?? req.params.folderId,
    entityName: folder?.name ?? "",
  });

  return ok(res, { success: true }, "视频文件夹已删除");
});

videoAdminRouter.get("/video-library/meta", async (_req, res) => {
  return ok(res, await getVideoLibraryMeta());
});

videoAdminRouter.get("/video-library/videos", async (req, res) => {
  return ok(res, await getVideoLibraryItems(req.query));
});

videoAdminRouter.patch("/video-library/videos/:videoId/name", async (req, res) => {
  const name = `${req.body?.name ?? ""}`.trim();
  if (!name) return fail(res, "请输入视频名称", 400);

  const previousVideo = await prisma.video.findUnique({
    where: { id: req.params.videoId },
    select: { id: true, name: true },
  });
  const video = await prisma.video.update({
    where: { id: req.params.videoId },
    data: { name },
  });

  recordAdminAction(req, {
    action: "video.name.update",
    entityType: "video",
    entityId: video.id,
    entityName: video.name,
    detail: {
      previousName: previousVideo?.name ?? "",
    },
  });

  return ok(res, serializeVideo(video), "视频名称已更新");
});

videoAdminRouter.patch("/video-library/videos/:videoId/script", async (req, res) => {
  const script = `${req.body?.script ?? ""}`;
  const previousVideo = await prisma.video.findUnique({
    where: { id: req.params.videoId },
    select: { id: true, name: true, scriptText: true },
  });
  const video = await prisma.video.update({
    where: { id: req.params.videoId },
    data: {
      scriptText: script.trim() ? script : null,
    },
  });

  recordAdminAction(req, {
    action: "video.script.update",
    entityType: "video",
    entityId: video.id,
    entityName: video.name,
    detail: {
      hadScriptBefore: Boolean(previousVideo?.scriptText?.trim()),
      hasScriptNow: Boolean(video.scriptText?.trim()),
    },
  });

  return ok(res, serializeVideo(video), "视频文稿已保存");
});

videoAdminRouter.patch("/video-library/videos/:videoId/handout", async (req, res) => {
  const previousVideo = await prisma.video.findUnique({
    where: { id: req.params.videoId },
    select: { id: true, name: true, handoutUrl: true, handoutObjectKey: true, handoutName: true },
  });

  const handoutUrl = `${req.body?.handoutUrl ?? ""}`.trim() || null;
  const handoutName = `${req.body?.handoutName ?? ""}`.trim() || null;
  const handoutObjectKey = req.body?.handoutObjectKey || extractObjectKeyFromUrl(handoutUrl || "") || null;

  const video = await prisma.video.update({
    where: { id: req.params.videoId },
    data: {
      handoutUrl,
      handoutObjectKey,
      handoutName,
    },
  });

  cleanupReplacedObject({
    previousObjectKey: previousVideo?.handoutObjectKey ?? "",
    nextObjectKey: video.handoutObjectKey ?? "",
  });

  recordAdminAction(req, {
    action: "video.handout.update",
    entityType: "video",
    entityId: video.id,
    entityName: video.name,
    detail: {
      hadHandoutBefore: Boolean(previousVideo?.handoutObjectKey || previousVideo?.handoutUrl),
      hasHandoutNow: Boolean(video.handoutObjectKey || video.handoutUrl),
      handoutName: video.handoutName ?? "",
    },
  });

  return ok(res, serializeVideo(video), "视频讲义已更新");
});

videoAdminRouter.post("/video-library/videos/move-folder", async (req, res) => {
  const videoIds = toStringArray(req.body?.videoIds);
  const folderId = `${req.body?.folderId ?? ""}`.trim();
  if (videoIds.length === 0 || !folderId) return fail(res, "请选择视频和目标文件夹", 400);

  await prisma.video.updateMany({
    where: {
      id: { in: videoIds },
    },
    data: { folderId },
  });

  recordAdminAction(req, {
    action: "video.folder.move",
    entityType: "video",
    entityName: `视频 ${videoIds.length} 条`,
    detail: {
      folderId,
      videoCount: videoIds.length,
    },
  });

  return ok(res, { success: true }, "视频已移动到新文件夹");
});

videoAdminRouter.delete("/video-library/videos/:videoId", async (req, res) => {
  const targetVideo = await prisma.video.findUnique({
    where: { id: req.params.videoId },
    select: { id: true, name: true, objectKey: true, handoutObjectKey: true },
  });
  const refCount = await prisma.courseVideo.count({
    where: { videoId: req.params.videoId },
  });
  if (refCount > 0) return fail(res, "该视频已被课程引用，请先取消引用后再删除", 400);

  await prisma.video.delete({
    where: { id: req.params.videoId },
  });

  cleanupRemovedObject(targetVideo?.objectKey ?? "");
  cleanupRemovedObject(targetVideo?.handoutObjectKey ?? "");
  recordAdminAction(req, {
    action: "video.delete",
    entityType: "video",
    entityId: targetVideo?.id ?? req.params.videoId,
    entityName: targetVideo?.name ?? "",
  });

  return ok(res, { success: true }, "视频已删除");
});

videoAdminRouter.post("/video-library/videos/upload", uploadLibraryVideo.array("files"), async (req, res) => {
  const files = req.files;
  const folderId = `${req.body?.folderId ?? ""}`.trim();
  const script = `${req.body?.script ?? ""}`;
  if (!Array.isArray(files) || files.length === 0 || !folderId) {
    return fail(res, "请选择文件夹和视频文件", 400);
  }

  const folder = await prisma.videoFolder.findUnique({
    where: { id: folderId },
    select: { id: true, name: true },
  });
  if (!folder) return fail(res, "视频文件夹不存在", 400);

  const created = [];
  try {
    for (const [index, file] of files.entries()) {
      const video = await uploadVideoFileAndCreateRecord({
        file,
        folderId,
        scriptText: files.length === 1 ? script : index === 0 ? script : "",
        objectFolder: LIBRARY_VIDEO_OBJECT_FOLDER,
      });
      created.push(serializeVideo(video));
      await cleanupTempFile(file.path);
    }
  } catch (error) {
    for (const file of files) {
      await cleanupTempFile(file.path);
    }
    return fail(res, error.message || "视频上传失败", 500);
  }

  recordAdminAction(req, {
    action: "video.upload.library",
    entityType: "video",
    entityName: folder.name,
    detail: {
      folderId,
      uploadedCount: created.length,
    },
  });

  return ok(res, created, "视频已上传到视频库");
});

videoAdminRouter.get("/tags/:tagId/videos", async (req, res) => {
  const detail = await getAdminTagVideos(req.params.tagId);
  if (!detail) return fail(res, "标签不存在", 404);
  return ok(res, detail);
});

videoAdminRouter.patch("/courses/:courseId/tags/:tagId/videos/order", async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  await prisma.$transaction(
    items.map((item) =>
      prisma.courseVideo.updateMany({
        where: {
          courseId: req.params.courseId,
          tagId: req.params.tagId,
          videoId: item.id,
        },
        data: { order: item.order },
      }),
    ),
  );

  recordAdminAction(req, {
    action: "course.video.order.update",
    entityType: "course",
    entityId: req.params.courseId,
    entityName: req.params.tagId,
    detail: {
      tagId: req.params.tagId,
      itemCount: items.length,
    },
  });

  return ok(res, { success: true }, "视频顺序已更新");
});

videoAdminRouter.patch("/courses/:courseId/videos/:videoId/tag", async (req, res) => {
  const tagId = `${req.body?.tagId ?? ""}`.trim();
  if (!tagId) return fail(res, "请选择目标标签", 400);

  const targetTag = await prisma.tag.findFirst({
    where: {
      id: tagId,
      courseId: req.params.courseId,
    },
  });
  if (!targetTag) return fail(res, "目标标签不存在", 404);

  const lastItem = await prisma.courseVideo.findFirst({
    where: { tagId },
    orderBy: { order: "desc" },
  });

  await prisma.courseVideo.updateMany({
    where: {
      courseId: req.params.courseId,
      videoId: req.params.videoId,
    },
    data: {
      tagId,
      order: (lastItem?.order ?? -1) + 1,
    },
  });

  recordAdminAction(req, {
    action: "course.video.tag.update",
    entityType: "course",
    entityId: req.params.courseId,
    entityName: req.params.videoId,
    detail: {
      videoId: req.params.videoId,
      tagId,
    },
  });

  return ok(res, { success: true }, "视频标签已更新");
});

videoAdminRouter.delete("/courses/:courseId/videos/:videoId", async (req, res) => {
  await prisma.courseVideo.deleteMany({
    where: {
      courseId: req.params.courseId,
      videoId: req.params.videoId,
    },
  });

  recordAdminAction(req, {
    action: "course.video.remove",
    entityType: "course",
    entityId: req.params.courseId,
    entityName: req.params.videoId,
    detail: {
      videoId: req.params.videoId,
    },
  });

  return ok(res, { success: true }, "已从课程中移除视频");
});

videoAdminRouter.post("/courses/:courseId/tags/:tagId/videos/reference", async (req, res) => {
  const videoIds = toStringArray(req.body?.videoIds);
  const tag = await prisma.tag.findFirst({
    where: {
      id: req.params.tagId,
      courseId: req.params.courseId,
    },
  });
  if (!tag) return fail(res, "标签不存在", 404);

  const lastRelation = await prisma.courseVideo.findFirst({
    where: {
      courseId: req.params.courseId,
      tagId: req.params.tagId,
    },
    orderBy: { order: "desc" },
  });

  let order = (lastRelation?.order ?? -1) + 1;
  const [videos, existingRelations] = await Promise.all([
    prisma.video.findMany({
      where: {
        id: {
          in: videoIds,
        },
      },
      select: {
        id: true,
      },
    }),
    prisma.courseVideo.findMany({
      where: {
        courseId: req.params.courseId,
        videoId: {
          in: videoIds,
        },
      },
      select: {
        videoId: true,
      },
    }),
  ]);

  const videoMap = new Map(videos.map((video) => [video.id, video]));
  const existingVideoIds = new Set(existingRelations.map((item) => item.videoId));
  const relationsToCreate = [];

  for (const videoId of videoIds) {
    if (!videoMap.has(videoId)) continue;
    if (existingVideoIds.has(videoId)) continue;

    relationsToCreate.push({
      courseId: req.params.courseId,
      tagId: req.params.tagId,
      videoId,
      order,
    });
    order += 1;
  }

  if (relationsToCreate.length > 0) {
    await prisma.courseVideo.createMany({
      data: relationsToCreate,
      skipDuplicates: true,
    });
  }

  recordAdminAction(req, {
    action: "course.video.reference",
    entityType: "course",
    entityId: req.params.courseId,
    entityName: req.params.tagId,
    detail: {
      tagId: req.params.tagId,
      referencedCount: relationsToCreate.length,
    },
  });

  return ok(res, { success: true }, "视频已引用到课程");
});

videoAdminRouter.post("/courses/:courseId/tags/:tagId/videos/upload", uploadCourseVideo.array("files"), async (req, res) => {
  const files = req.files;
  const script = `${req.body?.script ?? ""}`;
  const { courseId, tagId } = req.params;

  if (!Array.isArray(files) || files.length !== 1) {
    return fail(res, "课程内直传当前仅支持单条上传", 400);
  }

  const folder = await prisma.videoFolder.upsert({
    where: { name: DIRECT_UPLOAD_FOLDER_NAME },
    update: {},
    create: { name: DIRECT_UPLOAD_FOLDER_NAME },
  });

  const lastRelation = await prisma.courseVideo.findFirst({
    where: { courseId, tagId },
    orderBy: { order: "desc" },
  });

  const file = files[0];
  try {
    const video = await uploadVideoFileAndCreateRecord({
      file,
      folderId: folder.id,
      scriptText: script,
      objectFolder: DIRECT_VIDEO_OBJECT_FOLDER,
    });

    await prisma.courseVideo.create({
      data: {
        courseId,
        tagId,
        videoId: video.id,
        order: (lastRelation?.order ?? -1) + 1,
      },
    });

    await cleanupTempFile(file.path);

    recordAdminAction(req, {
      action: "video.upload.course_direct",
      entityType: "course",
      entityId: courseId,
      entityName: tagId,
      detail: {
        videoId: video.id,
        videoName: video.name,
      },
    });

    return ok(res, serializeVideo(video), "视频已加入课程");
  } catch (error) {
    await cleanupTempFile(file.path);
    return fail(res, error.message || "课程直传视频失败", 500);
  }
});
