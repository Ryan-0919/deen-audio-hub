import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ok, fail } from "../lib/response.js";
import { syncScheduledCourses } from "../lib/scheduler.js";
import { serializeVideoProgress } from "../lib/course-content.js";
import { requireUserAuth } from "../middleware/auth.js";

const isUniqueConstraintError = (error) => error && typeof error === "object" && error.code === "P2002";

const saveUserVideoProgressRecord = async ({ userId, courseId, videoId, updateData, createData }) => {
  const where = { userId, courseId, videoId };

  const updated = await prisma.userVideoProgress.updateMany({
    where,
    data: updateData,
  });

  if (updated.count === 0) {
    try {
      return await prisma.userVideoProgress.create({
        data: {
          userId,
          courseId,
          videoId,
          ...createData,
        },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      await prisma.userVideoProgress.updateMany({
        where,
        data: updateData,
      });
    }
  }

  return prisma.userVideoProgress.findUnique({
    where: {
      userId_courseId_videoId: where,
    },
  });
};

const assertCoursePermission = async (userId, courseId) => {
  await syncScheduledCourses();

  const permission = await prisma.userCoursePermission.findFirst({
    where: {
      userId,
      courseId,
    },
    include: {
      course: true,
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

export const videoUserRouter = Router();

videoUserRouter.use(requireUserAuth);

videoUserRouter.post("/video-progress", async (req, res) => {
  const { courseId, videoId, progress = 0 } = req.body ?? {};
  if (!courseId || !videoId) return fail(res, "缺少进度参数", 400);

  try {
    await assertCoursePermission(req.auth.userId, courseId);
  } catch (error) {
    return fail(res, error.message || "无权保存该课程进度", 403);
  }

  const relation = await prisma.courseVideo.findFirst({
    where: {
      courseId,
      videoId,
    },
  });

  if (!relation) return fail(res, "课程视频不存在", 404);

  const normalizedProgress = Math.max(0, Math.floor(progress));
  const timestamp = new Date();
  const record = await saveUserVideoProgressRecord({
    userId: req.auth.userId,
    courseId,
    videoId,
    updateData: {
      progress: normalizedProgress,
      lastUpdated: timestamp,
    },
    createData: {
      progress: normalizedProgress,
      lastUpdated: timestamp,
    },
  });

  return ok(res, serializeVideoProgress(record), "进度已保存");
});

videoUserRouter.post("/video-progress/complete", async (req, res) => {
  const { courseId, videoId, progress } = req.body ?? {};
  if (!courseId || !videoId) return fail(res, "缺少完成参数", 400);

  try {
    await assertCoursePermission(req.auth.userId, courseId);
  } catch (error) {
    return fail(res, error.message || "无权更新该课程进度", 403);
  }

  const relation = await prisma.courseVideo.findFirst({
    where: {
      courseId,
      videoId,
    },
  });

  if (!relation) return fail(res, "课程视频不存在", 404);

  const normalizedProgress = typeof progress === "number" ? Math.max(0, Math.floor(progress)) : undefined;
  const timestamp = new Date();
  const record = await saveUserVideoProgressRecord({
    userId: req.auth.userId,
    courseId,
    videoId,
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

  return ok(res, serializeVideoProgress(record), "已标记学完");
});
