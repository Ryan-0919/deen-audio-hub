import { Router } from "express";
import { Readable } from "node:stream";
import { prisma } from "../lib/prisma.js";
import { ok, fail } from "../lib/response.js";
import { serializeAudio, serializeAudioListItem, serializeCourse, serializeTag } from "../lib/serializers.js";
import { formatDateTime } from "../lib/time.js";
import { requireUserAuth } from "../middleware/auth.js";
import { syncScheduledCourses } from "../lib/scheduler.js";
import { getReadableObjectUrl } from "../lib/upload.js";
import { serializeMockExamPaperSummary } from "../lib/mock-exam.js";

export const userRouter = Router();

userRouter.use(requireUserAuth);

const isUniqueConstraintError = (error) => error && typeof error === "object" && error.code === "P2002";
const readyAudioRelationWhere = {
  audio: {
    is: {
      processStatus: "ready",
    },
  },
};

const saveUserProgressRecord = async ({ userId, courseId, audioId, updateData, createData }) => {
  const where = { userId, courseId, audioId };

  const updated = await prisma.userProgress.updateMany({
    where,
    data: updateData,
  });

  if (updated.count === 0) {
    try {
      return await prisma.userProgress.create({
        data: {
          userId,
          courseId,
          audioId,
          ...createData,
        },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      await prisma.userProgress.updateMany({
        where,
        data: updateData,
      });
    }
  }

  return prisma.userProgress.findUnique({
    where: {
      userId_courseId_audioId: where,
    },
  });
};

const serializeProgress = (progress) =>
  progress
    ? {
        userId: progress.userId,
        courseId: progress.courseId,
        audioId: progress.audioId,
        progress: progress.progress,
        completed: progress.completed,
        lastUpdated: formatDateTime(progress.lastUpdated),
      }
    : undefined;

const buildProgressMap = (progressList) => new Map(progressList.map((item) => [item.audioId, serializeProgress(item)]));

const buildTagContent = (courseAudios, progressMap) => {
  return {
    audios: courseAudios.map((item) => serializeAudioListItem(item.audio)),
    progress: courseAudios.map((item) => progressMap.get(item.audioId)).filter(Boolean),
  };
};

const sanitizeDownloadFileName = (value, fallback = "course-handout") => {
  const normalized = `${value ?? ""}`.trim().replace(/[\\/:*?"<>|]+/g, "-");
  return normalized || fallback;
};

const encodeContentDispositionFileName = (fileName) =>
  encodeURIComponent(fileName).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

const buildAttachmentDisposition = (fileName) => {
  const normalized = sanitizeDownloadFileName(fileName);
  const asciiFallback = normalized.replace(/[^\x20-\x7E]+/g, "_");
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeContentDispositionFileName(normalized)}`;
};

const getTagAudiosWithProgress = async ({ tagId, userId, courseId, courseAudios }) => {
  const resolvedCourseAudios =
    courseAudios ??
    (
      await prisma.tag.findUnique({
        where: { id: tagId },
        include: {
          courseAudios: {
            where: readyAudioRelationWhere,
            orderBy: { order: "asc" },
            include: {
              audio: true,
            },
          },
        },
      })
    )?.courseAudios;

  if (!resolvedCourseAudios) {
    return null;
  }

  const audioIds = resolvedCourseAudios.map((item) => item.audioId);
  const progressList =
    audioIds.length === 0
      ? []
        : await prisma.userProgress.findMany({
            where: {
              userId,
              courseId,
              audioId: { in: audioIds },
            },
          });

  return buildTagContent(resolvedCourseAudios, buildProgressMap(progressList));
};

const assertCoursePermission = async (userId, courseId) => {
  await syncScheduledCourses();

  const permission = await prisma.userCoursePermission.findFirst({
    where: {
      userId,
      courseId,
    },
    include: {
      course: {
        include: {
          tags: {
            orderBy: { order: "asc" },
          },
          courseAudios: {
            where: readyAudioRelationWhere,
          },
        },
      },
    },
  });

  if (!permission) {
    throw new Error("无权访问该课程");
  }

  if (permission.course.status !== "open") {
    throw new Error("课程尚未开放");
  }

  return permission.course;
};

const getOrderedCourseAudios = async (courseId) => {
  const tags = await prisma.tag.findMany({
    where: { courseId },
    orderBy: { order: "asc" },
    include: {
      courseAudios: {
        where: readyAudioRelationWhere,
        orderBy: { order: "asc" },
        include: { audio: true },
      },
    },
  });

  return tags.flatMap((tag) =>
    tag.courseAudios.map((item) => ({
      tag,
      courseAudio: item,
      audio: item.audio,
    })),
  );
};

userRouter.get("/courses", async (req, res) => {
  await syncScheduledCourses();

  const permissions = await prisma.userCoursePermission.findMany({
    where: { userId: req.auth.userId },
    include: {
      course: {
        include: {
          courseAudios: {
            where: readyAudioRelationWhere,
          },
        },
      },
    },
    orderBy: {
      course: {
        openTime: "desc",
      },
    },
  });

  const list = permissions
    .map((item) => item.course)
    .filter((course) => course.status === "open")
    .sort((a, b) => new Date(b.openTime).getTime() - new Date(a.openTime).getTime())
    .map((course) => serializeCourse(course, course.courseAudios.length));

  return ok(res, list);
});

userRouter.get("/home-overview", async (req, res) => {
  await syncScheduledCourses();

  const recentProgress = await prisma.userProgress.findFirst({
    where: {
      userId: req.auth.userId,
    },
    orderBy: {
      lastUpdated: "desc",
    },
    include: {
      audio: true,
    },
  });

  let recentCourseProgress = null;
  if (recentProgress?.audio) {
    const course = await prisma.course.findFirst({
      where: {
        id: recentProgress.courseId,
      },
      include: {
        permissions: {
          where: {
            userId: req.auth.userId,
          },
        },
        tags: {
          orderBy: {
            order: "asc",
          },
        },
        courseAudios: {
          where: {
            audioId: recentProgress.audioId,
          },
          include: {
            tag: true,
          },
          take: 1,
        },
      },
    });

    if (course?.status === "open" && (course.permissions?.length ?? 0) > 0) {
      const tagName = course.courseAudios[0]?.tag?.name ?? course.tags[0]?.name ?? "";
      const durationSeconds = Math.max(0, Number(recentProgress.audio.duration ?? 0));
      const progressSeconds = Math.max(0, Number(recentProgress.progress ?? 0));

      recentCourseProgress = {
        courseId: course.id,
        courseName: course.name,
        audioId: recentProgress.audioId,
        audioName: recentProgress.audio.name,
        tagName,
        progressSeconds,
        durationSeconds,
        progressPercent: durationSeconds > 0 ? Math.min(100, Math.round((progressSeconds / durationSeconds) * 100)) : 0,
        completed: Boolean(recentProgress.completed),
        lastUpdated: formatDateTime(recentProgress.lastUpdated),
      };
    }
  }

  const recentRecordRaw = await prisma.mockExamRecord.findFirst({
    where: {
      userId: req.auth.userId,
    },
    orderBy: [
      { updatedAt: "desc" },
      { createdAt: "desc" },
    ],
    include: {
      paper: {
        include: {
          questions: {
            where: {
              isActive: true,
            },
            select: {
              id: true,
              type: true,
              score: true,
            },
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
      },
    },
  });

  let recentMockExam = null;
  if (recentRecordRaw?.paper) {
    const summary = serializeMockExamPaperSummary({
      paper: recentRecordRaw.paper,
      activeRecord: recentRecordRaw.status === "in_progress" ? recentRecordRaw : null,
      latestRecord: recentRecordRaw.status === "submitted" ? recentRecordRaw : null,
    });
    const targetRecord = summary.activeRecord ?? summary.latestRecord;

    if (targetRecord) {
      recentMockExam = {
        paperId: recentRecordRaw.paper.id,
        paperTitle: recentRecordRaw.paper.title,
        paperSubtitle: recentRecordRaw.paper.subtitle ?? "",
        recordId: targetRecord.id,
        status: targetRecord.status,
        totalScore: targetRecord.totalScore,
        answeredCount: targetRecord.answeredCount,
        questionCount: targetRecord.questionCount,
        canResume: targetRecord.canResume,
        startedAt: targetRecord.startedAt,
        submittedAt: targetRecord.submittedAt,
      };
    }
  }

  return ok(res, {
    recentCourseProgress,
    recentMockExam,
  });
});

userRouter.get("/courses/:courseId/detail", async (req, res) => {
  try {
    const course = await assertCoursePermission(req.auth.userId, req.params.courseId);
    const tags = course.tags ?? [];
    const selectedTagId = tags[0]?.id ?? "";
    const tagDetails =
      tags.length === 0
        ? []
        : await prisma.tag.findMany({
            where: { courseId: course.id },
            orderBy: { order: "asc" },
            include: {
              courseAudios: {
                where: readyAudioRelationWhere,
                orderBy: { order: "asc" },
                include: {
                  audio: true,
                },
              },
            },
          });

    const audioIds = tagDetails.flatMap((tag) => tag.courseAudios.map((item) => item.audioId));
    const progressList =
      audioIds.length === 0
        ? []
        : await prisma.userProgress.findMany({
            where: {
              userId: req.auth.userId,
              courseId: course.id,
              audioId: { in: audioIds },
            },
          });
    const progressMap = buildProgressMap(progressList);

    const tagContents = tagDetails.map((tag) => ({
      tagId: tag.id,
      ...buildTagContent(tag.courseAudios, progressMap),
    }));
    const initialTagContent = tagContents.find((item) => item.tagId === selectedTagId) ?? null;

    return ok(res, {
      course: serializeCourse(course, course.courseAudios.length),
      tags: tags.map(serializeTag),
      selectedTagId,
      tagContents,
      initialAudios: initialTagContent?.audios ?? [],
      initialProgress: initialTagContent?.progress ?? [],
    });
  } catch (error) {
    return fail(res, error.message || "课程不存在", 404);
  }
});

userRouter.get("/courses/:courseId/audios/:audioId/handout/download", async (req, res) => {
  try {
    const course = await assertCoursePermission(req.auth.userId, req.params.courseId);
    const relation = await prisma.courseAudio.findFirst({
      where: {
        courseId: course.id,
        audioId: req.params.audioId,
        ...readyAudioRelationWhere,
      },
      include: {
        audio: true,
      },
    });

    if (!relation) {
      return fail(res, "音频不存在", 404);
    }

    const handoutUrl = getReadableObjectUrl({
      objectKey: relation.audio.handoutObjectKey ?? "",
      fallbackUrl: relation.audio.handoutUrl ?? "",
    });

    if (!handoutUrl) {
      return fail(res, "褰撳墠璇剧▼鏆傛棤璁蹭箟", 404);
    }

    const upstream = await fetch(handoutUrl);
    if (!upstream.ok || !upstream.body) {
      return fail(res, "璁蹭箟涓嬭浇澶辫触", 502);
    }

    const fileName = sanitizeDownloadFileName(relation.audio.handoutName || `${relation.audio.name}-讲义`, "audio-handout");
    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const contentLength = upstream.headers.get("content-length");

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", buildAttachmentDisposition(fileName));
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }

    const stream = Readable.fromWeb(upstream.body);
    stream.on("error", (error) => {
      console.error("Audio handout stream failed:", error);
      if (!res.headersSent) {
        res.status(500).end();
      } else {
        res.destroy(error);
      }
    });
    stream.pipe(res);
  } catch (error) {
    return fail(res, error.message || "璁蹭箟涓嬭浇澶辫触", 500);
  }
});

userRouter.get("/tags/:tagId/audios", async (req, res) => {
  await syncScheduledCourses();

  const tag = await prisma.tag.findUnique({
    where: { id: req.params.tagId },
    include: {
      course: {
        include: {
          permissions: true,
        },
      },
      courseAudios: {
        where: readyAudioRelationWhere,
        orderBy: { order: "asc" },
        include: {
          audio: true,
        },
      },
    },
  });

  if (!tag) return fail(res, "标签不存在", 404);

  const hasPermission = tag.course.permissions.some((item) => item.userId === req.auth.userId);
  if (!hasPermission || tag.course.status !== "open") {
    return fail(res, "无权访问该标签内容", 403);
  }

  const payload = await getTagAudiosWithProgress({
    tagId: tag.id,
    userId: req.auth.userId,
    courseId: tag.courseId,
    courseAudios: tag.courseAudios,
  });

  return ok(res, {
    audios: payload?.audios ?? [],
    progress: payload?.progress ?? [],
  });
});

userRouter.get("/courses/:courseId/audios/:audioId/detail", async (req, res) => {
  try {
    const course = await assertCoursePermission(req.auth.userId, req.params.courseId);
    const relation = await prisma.courseAudio.findFirst({
      where: {
        courseId: course.id,
        audioId: req.params.audioId,
        ...readyAudioRelationWhere,
      },
      include: {
        audio: true,
        tag: true,
      },
    });

    if (!relation) return fail(res, "音频不存在", 404);

    const ordered = await getOrderedCourseAudios(course.id);
    const currentIndex = ordered.findIndex((item) => item.audio.id === req.params.audioId);
    const prev = currentIndex > 0 ? ordered[currentIndex - 1].audio : undefined;
    const next = currentIndex >= 0 && currentIndex < ordered.length - 1 ? ordered[currentIndex + 1].audio : undefined;
    const first = ordered.length > 0 ? ordered[0].audio : undefined;
    const last = ordered.length > 0 ? ordered[ordered.length - 1].audio : undefined;

    return ok(res, {
      audio: serializeAudio(relation.audio),
      tag: serializeTag(relation.tag),
      course: serializeCourse(course, course.courseAudios.length),
      prev: prev ? serializeAudio(prev) : undefined,
      next: next ? serializeAudio(next) : undefined,
      first: first ? serializeAudio(first) : undefined,
      last: last ? serializeAudio(last) : undefined,
    });
  } catch (error) {
    return fail(res, error.message || "音频不存在", 404);
  }
});

userRouter.get("/audios/:audioId/progress", async (req, res) => {
  const courseId = req.query?.courseId ? `${req.query.courseId}` : undefined;
  if (courseId) {
    try {
      await assertCoursePermission(req.auth.userId, courseId);
    } catch (error) {
      return fail(res, error.message || "无权访问该课程进度", 403);
    }
  }

  const record = await prisma.userProgress.findFirst({
    where: {
      userId: req.auth.userId,
      audioId: req.params.audioId,
      ...(courseId ? { courseId } : {}),
    },
    orderBy: {
      lastUpdated: "desc",
    },
  });

  return ok(res, serializeProgress(record));
});

userRouter.post("/progress", async (req, res) => {
  const { courseId, audioId, progress = 0 } = req.body ?? {};
  if (!courseId || !audioId) return fail(res, "缺少进度参数", 400);

  try {
    await assertCoursePermission(req.auth.userId, courseId);
  } catch (error) {
    return fail(res, error.message || "无权保存该课程进度", 403);
  }

  const relation = await prisma.courseAudio.findFirst({
    where: {
      courseId,
      audioId,
      ...readyAudioRelationWhere,
    },
  });

  if (!relation) return fail(res, "课程音频不存在", 404);

  const normalizedProgress = Math.max(0, Math.floor(progress));
  const timestamp = new Date();
  const record = await saveUserProgressRecord({
    userId: req.auth.userId,
    courseId,
    audioId,
    updateData: {
      progress: normalizedProgress,
      lastUpdated: timestamp,
    },
    createData: {
      progress: normalizedProgress,
      lastUpdated: timestamp,
    },
  });

  return ok(res, serializeProgress(record), "进度已保存");
});

userRouter.post("/progress/complete", async (req, res) => {
  const { courseId, audioId, progress } = req.body ?? {};
  if (!courseId || !audioId) return fail(res, "缺少完成参数", 400);

  try {
    await assertCoursePermission(req.auth.userId, courseId);
  } catch (error) {
    return fail(res, error.message || "无权更新该课程进度", 403);
  }

  const relation = await prisma.courseAudio.findFirst({
    where: {
      courseId,
      audioId,
      ...readyAudioRelationWhere,
    },
  });

  if (!relation) return fail(res, "课程音频不存在", 404);

  const normalizedProgress = typeof progress === "number" ? Math.max(0, Math.floor(progress)) : undefined;
  const timestamp = new Date();
  const record = await saveUserProgressRecord({
    userId: req.auth.userId,
    courseId,
    audioId,
    updateData: {
      completed: true,
      ...(normalizedProgress !== undefined ? { progress: normalizedProgress } : {}),
      lastUpdated: timestamp,
    },
    createData: {
      progress: normalizedProgress ?? 0,
      completed: true,
      lastUpdated: timestamp,
    },
  });

  return ok(res, serializeProgress(record), "已标记学完");
});
