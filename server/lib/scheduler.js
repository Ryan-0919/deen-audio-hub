import { prisma } from "./prisma.js";
import { writeSystemAuditLog } from "./audit.js";
import { formatDate } from "./time.js";
import {
  buildCourseAutoOpenFailureMarkdown,
  buildCourseAutoOpenSuccessMarkdown,
  buildDailyActiveSummaryMarkdown,
  notifyMarkdownSafely,
} from "./notifications.js";

let runningSyncPromise = null;

const DAILY_SUMMARY_HOUR = 20;
const DAILY_SUMMARY_MINUTE = 0;
const DAILY_SUMMARY_SECOND = 0;

const getDayBounds = (value = new Date()) => {
  const start = new Date(value);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
};

const getDateKey = (value = new Date()) => formatDate(value);

const getNextDailySummaryTime = (value = new Date()) => {
  const next = new Date(value);
  next.setHours(DAILY_SUMMARY_HOUR, DAILY_SUMMARY_MINUTE, DAILY_SUMMARY_SECOND, 0);

  if (next <= value) {
    next.setDate(next.getDate() + 1);
  }

  return next;
};

const syncScheduledCoursesInternal = async () => {
  const dueCourses = await prisma.course.findMany({
    where: {
      status: "scheduled",
      openTime: {
        lte: new Date(),
      },
    },
    orderBy: {
      openTime: "asc",
    },
  });

  if (dueCourses.length === 0) {
    return {
      openedCount: 0,
      notifiedCount: 0,
      failedCourseIds: [],
    };
  }

  const systemConfig = await prisma.systemConfig.findUnique({
    where: { id: 1 },
    select: { webhookUrl: true },
  });

  const webhookUrl = `${systemConfig?.webhookUrl ?? ""}`.trim();
  const result = {
    openedCount: 0,
    notifiedCount: 0,
    failedCourseIds: [],
  };

  for (const course of dueCourses) {
    try {
      await prisma.course.update({
        where: { id: course.id },
        data: {
          status: "open",
          openedAt: new Date(),
        },
      });
      result.openedCount += 1;

      if (!course.webhookNotifiedAt && webhookUrl) {
        const notified = await notifyMarkdownSafely(
          `course-auto-open:${course.id}`,
          buildCourseAutoOpenSuccessMarkdown({
            courseName: course.name,
            scheduledOpenTime: course.openTime,
            eventTime: new Date(),
          }),
          webhookUrl,
          {
            relatedEntityType: "course",
            relatedEntityId: course.id,
          },
        );

        if (notified) {
          await prisma.course.update({
            where: { id: course.id },
            data: {
              webhookNotifiedAt: new Date(),
            },
          });
          result.notifiedCount += 1;
        } else {
          result.failedCourseIds.push(course.id);
        }
      }
      await writeSystemAuditLog({
        action: "course.auto_open",
        entityType: "course",
        entityId: course.id,
        entityName: course.name,
        detail: {
          scheduledOpenTime: course.openTime,
        },
      });
    } catch (error) {
      result.failedCourseIds.push(course.id);
      console.error(`Scheduled course open failed for course ${course.id}:`, error);

      if (webhookUrl) {
        await notifyMarkdownSafely(
          `course-auto-open-failed:${course.id}`,
          buildCourseAutoOpenFailureMarkdown({
            courseName: course.name,
            scheduledOpenTime: course.openTime,
            errorMessage: error instanceof Error ? error.message : "未知错误",
            eventTime: new Date(),
          }),
          webhookUrl,
          {
            relatedEntityType: "course",
            relatedEntityId: course.id,
          },
        );
      }
    }
  }

  return result;
};

const sendDailyActiveSummary = async () => {
  const now = new Date();
  const systemConfig = await prisma.systemConfig.findUnique({
    where: { id: 1 },
    select: { webhookUrl: true },
  });
  const webhookUrl = `${systemConfig?.webhookUrl ?? ""}`.trim();

  if (!webhookUrl) {
    return { sent: false, dateKey: getDateKey(now) };
  }

  const { start, end } = getDayBounds(now);
  const [totalUsers, loginUsers, progressUsers, progressPairs, courses] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({
      where: {
        lastLoginAt: {
          gte: start,
          lt: end,
        },
      },
      select: { id: true },
    }),
    prisma.userProgress.findMany({
      where: {
        lastUpdated: {
          gte: start,
          lt: end,
        },
      },
      distinct: ["userId"],
      select: { userId: true },
    }),
    prisma.userProgress.findMany({
      where: {
        lastUpdated: {
          gte: start,
          lt: end,
        },
      },
      distinct: ["courseId", "userId"],
      select: {
        courseId: true,
        userId: true,
      },
    }),
    prisma.course.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  const activeUserIds = new Set([...loginUsers.map((item) => item.id), ...progressUsers.map((item) => item.userId)]);
  const courseActiveMap = new Map();

  for (const item of progressPairs) {
    courseActiveMap.set(item.courseId, (courseActiveMap.get(item.courseId) ?? 0) + 1);
  }

  const sent = await notifyMarkdownSafely(
    "daily-active-summary",
    buildDailyActiveSummaryMarkdown({
      reportDate: getDateKey(now),
      totalUsers,
      activeUsersToday: activeUserIds.size,
      courseStats: courses.map((course) => ({
        courseName: course.name,
        activeUsers: courseActiveMap.get(course.id) ?? 0,
      })),
      eventTime: now,
    }),
    webhookUrl,
    {
      relatedEntityType: "system_summary",
      relatedEntityId: getDateKey(now),
    },
  );

  return { sent, dateKey: getDateKey(now) };
};

const startCourseSyncLoop = (intervalMs) => {
  const safeInterval = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 30000;

  const run = async () => {
    try {
      await syncScheduledCourses();
    } catch (error) {
      console.error("Scheduled course sync failed:", error);
    }
  };

  void run();
  return setInterval(() => {
    void run();
  }, safeInterval);
};

const startDailySummaryJob = () => {
  let timer = null;

  const scheduleNext = () => {
    const now = new Date();
    const nextRun = getNextDailySummaryTime(now);
    const delay = Math.max(nextRun.getTime() - now.getTime(), 0);

    timer = setTimeout(async () => {
      try {
        await sendDailyActiveSummary();
      } catch (error) {
        console.error("Daily active summary failed:", error);
      } finally {
        scheduleNext();
      }
    }, delay);
  };

  scheduleNext();
  return {
    stop: () => {
      if (timer) clearTimeout(timer);
    },
  };
};

export const syncScheduledCourses = async () => {
  if (runningSyncPromise) {
    return runningSyncPromise;
  }

  const currentRun = syncScheduledCoursesInternal().finally(() => {
    if (runningSyncPromise === currentRun) {
      runningSyncPromise = null;
    }
  });

  runningSyncPromise = currentRun;
  return currentRun;
};

export const startScheduledCourseSync = (intervalMs) => {
  const syncInterval = startCourseSyncLoop(intervalMs);
  const dailySummaryJob = startDailySummaryJob();

  return {
    stop: () => {
      clearInterval(syncInterval);
      dailySummaryJob.stop();
    },
  };
};
