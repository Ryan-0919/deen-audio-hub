import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ok, fail } from "../lib/response.js";
import { serializeAudio, serializeCourse, serializeTag } from "../lib/serializers.js";
import { formatDateTime } from "../lib/time.js";
import { requireUserAuth } from "../middleware/auth.js";
import { syncScheduledCourses } from "../lib/scheduler.js";

export const userRouter = Router();

userRouter.use(requireUserAuth);

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
          courseAudios: true,
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
          courseAudios: true,
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

userRouter.get("/courses/:courseId/detail", async (req, res) => {
  try {
    const course = await assertCoursePermission(req.auth.userId, req.params.courseId);
    const tags = await prisma.tag.findMany({
      where: { courseId: course.id },
      orderBy: { order: "asc" },
    });

    return ok(res, {
      course: serializeCourse(course, course.courseAudios.length),
      tags: tags.map(serializeTag),
    });
  } catch (error) {
    return fail(res, error.message || "课程不存在", 404);
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

  const audioIds = tag.courseAudios.map((item) => item.audioId);
  const progressList = await prisma.userProgress.findMany({
    where: {
      userId: req.auth.userId,
      courseId: tag.courseId,
      audioId: { in: audioIds },
    },
  });

  return ok(res, {
    audios: tag.courseAudios.map((item) => serializeAudio(item.audio)),
    progress: progressList.map(serializeProgress),
  });
});

userRouter.get("/courses/:courseId/audios/:audioId/detail", async (req, res) => {
  try {
    const course = await assertCoursePermission(req.auth.userId, req.params.courseId);
    const relation = await prisma.courseAudio.findFirst({
      where: {
        courseId: course.id,
        audioId: req.params.audioId,
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

    return ok(res, {
      audio: serializeAudio(relation.audio),
      tag: serializeTag(relation.tag),
      course: serializeCourse(course, course.courseAudios.length),
      prev: prev ? serializeAudio(prev) : undefined,
      next: next ? serializeAudio(next) : undefined,
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
    },
  });

  if (!relation) return fail(res, "课程音频不存在", 404);

  const record = await prisma.userProgress.upsert({
    where: {
      userId_courseId_audioId: {
        userId: req.auth.userId,
        courseId,
        audioId,
      },
    },
    update: {
      progress: Math.max(0, Math.floor(progress)),
      lastUpdated: new Date(),
    },
    create: {
      userId: req.auth.userId,
      courseId,
      audioId,
      progress: Math.max(0, Math.floor(progress)),
      lastUpdated: new Date(),
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
    },
  });

  if (!relation) return fail(res, "课程音频不存在", 404);

  const record = await prisma.userProgress.upsert({
    where: {
      userId_courseId_audioId: {
        userId: req.auth.userId,
        courseId,
        audioId,
      },
    },
    update: {
      completed: true,
      progress: typeof progress === "number" ? Math.max(0, Math.floor(progress)) : undefined,
      lastUpdated: new Date(),
    },
    create: {
      userId: req.auth.userId,
      courseId,
      audioId,
      progress: typeof progress === "number" ? Math.max(0, Math.floor(progress)) : 0,
      completed: true,
      lastUpdated: new Date(),
    },
  });

  return ok(res, serializeProgress(record), "已标记学完");
});
