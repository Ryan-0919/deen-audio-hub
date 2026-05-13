import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { getMockExamLaunchConfig } from "../lib/mock-exam-launch-config.js";
import {
  finalizeMockExamRecord,
  getMockExamRecordForUser,
  listUserVisibleMockExamRecords,
  pauseMockExamRecord,
  saveMockExamAnswer,
  saveMockExamReviewFeedback,
  serializeMockExamPaperSummary,
  serializeMockExamRecordDetail,
  startMockExamRecord,
  syncExpiredMockExamRecords,
} from "../lib/mock-exam.js";
import { aiReviewMockExamRecord } from "../lib/mock-exam-ai-review.js";
import { getMockExamAiReviewConfig } from "../lib/mock-exam-ai-review-config.js";
import { fail, ok } from "../lib/response.js";
import { requireUserAuth } from "../middleware/auth.js";

export const mockExamUserRouter = Router();

mockExamUserRouter.use(requireUserAuth);

mockExamUserRouter.get("/launch-config", async (_req, res) => {
  try {
    return ok(res, await getMockExamLaunchConfig(prisma));
  } catch (error) {
    return fail(res, error.message || "加载机考启动页配置失败", error.statusCode || 500);
  }
});

mockExamUserRouter.get("/papers", async (req, res) => {
  try {
    const userId = req.auth.userId;
    await syncExpiredMockExamRecords({ db: prisma, userId });

    const [seriesPermissionRows, legacyPermissionRows] = await Promise.all([
      prisma.userMockExamSeriesPermission.findMany({
        where: {
          userId,
        },
        select: {
          seriesId: true,
        },
      }),
      prisma.userMockExamPermission.findMany({
        where: {
          userId,
        },
        select: {
          paperId: true,
        },
      }),
    ]);
    const visibleSeriesIds = seriesPermissionRows.map((item) => item.seriesId);
    const visiblePaperIds = legacyPermissionRows.map((item) => item.paperId);

    const papers = await prisma.mockExamPaper.findMany({
      where: {
        status: "published",
        OR: [
          {
            permissionRequired: false,
          },
          {
            permissionRequired: true,
            OR: [
              {
                id: {
                  in: visiblePaperIds.length > 0 ? visiblePaperIds : ["__no_permission__"],
                },
              },
              {
                seriesId: {
                  in: visibleSeriesIds.length > 0 ? visibleSeriesIds : ["__no_permission__"],
                },
              },
            ],
          },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
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
    });

    const paperIds = papers.map((item) => item.id);
    const records =
      paperIds.length > 0
        ? await prisma.mockExamRecord.findMany({
            where: {
              userId,
              paperId: {
                in: paperIds,
              },
            },
            orderBy: [{ createdAt: "desc" }],
          })
        : [];

    const list = papers.map((paper) => {
      const paperRecords = records.filter((item) => item.paperId === paper.id);
      const activeRecord = paperRecords.find((item) => item.status === "in_progress") ?? null;
      const latestRecord = paperRecords.find((item) => item.status === "submitted") ?? null;

      return serializeMockExamPaperSummary({
        paper,
        activeRecord,
        latestRecord,
      });
    });

    return ok(res, list);
  } catch (error) {
    return fail(res, error.message || "加载模拟考试试卷失败", error.statusCode || 500);
  }
});

mockExamUserRouter.get("/history", async (req, res) => {
  try {
    const userId = req.auth.userId;
    await syncExpiredMockExamRecords({ db: prisma, userId });

    const list = await listUserVisibleMockExamRecords({
      db: prisma,
      userId,
    });

    return ok(res, list);
  } catch (error) {
    return fail(res, error.message || "加载考试记录失败", error.statusCode || 500);
  }
});

mockExamUserRouter.post("/papers/:paperId/start", async (req, res) => {
  try {
    const record = await startMockExamRecord({
      db: prisma,
      paperId: `${req.params.paperId ?? ""}`.trim(),
      userId: req.auth.userId,
    });

    return ok(res, serializeMockExamRecordDetail(record), "开始答题成功");
  } catch (error) {
    return fail(res, error.message || "开始答题失败", error.statusCode || 400);
  }
});

mockExamUserRouter.get("/records/:recordId", async (req, res) => {
  try {
    const record = await getMockExamRecordForUser({
      db: prisma,
      recordId: `${req.params.recordId ?? ""}`.trim(),
      userId: req.auth.userId,
    });

    return ok(res, serializeMockExamRecordDetail(record));
  } catch (error) {
    return fail(res, error.message || "加载考试记录失败", error.statusCode || 400);
  }
});

mockExamUserRouter.post("/records/:recordId/pause", async (req, res) => {
  try {
    const record = await pauseMockExamRecord({
      db: prisma,
      recordId: `${req.params.recordId ?? ""}`.trim(),
      userId: req.auth.userId,
    });

    return ok(res, serializeMockExamRecordDetail(record), "考试已暂停");
  } catch (error) {
    return fail(res, error.message || "暂停考试失败", error.statusCode || 400);
  }
});

mockExamUserRouter.patch("/records/:recordId/answers", async (req, res) => {
  const questionId = `${req.body?.questionId ?? ""}`.trim();

  if (!questionId) {
    return fail(res, "缺少题目参数", 400);
  }

  try {
    const record = await saveMockExamAnswer({
      db: prisma,
      recordId: `${req.params.recordId ?? ""}`.trim(),
      userId: req.auth.userId,
      questionId,
      answerKeys: req.body?.answerKeys,
      answerText: req.body?.answerText,
      subQuestionId: req.body?.subQuestionId,
    });

    return ok(res, serializeMockExamRecordDetail(record), "答案已保存");
  } catch (error) {
    return fail(res, error.message || "保存答案失败", error.statusCode || 400);
  }
});

mockExamUserRouter.post("/records/:recordId/submit", async (req, res) => {
  try {
    const record = await finalizeMockExamRecord({
      db: prisma,
      recordId: `${req.params.recordId ?? ""}`.trim(),
      userId: req.auth.userId,
    });

    if (`${record.reviewWorkflowStatus ?? ""}`.trim() === "ai_pending") {
      void getMockExamAiReviewConfig(prisma)
        .then((runtimeConfig) =>
          aiReviewMockExamRecord({
            db: prisma,
            recordId: record.id,
            runtimeConfig,
            allowRuleFallback: false,
          }),
        )
        .catch((error) => {
          console.error("Auto AI review failed:", error);
        });
    }

    return ok(res, serializeMockExamRecordDetail(record), "交卷成功");
  } catch (error) {
    return fail(res, error.message || "交卷失败", error.statusCode || 400);
  }
});

mockExamUserRouter.post("/records/:recordId/review-feedback", async (req, res) => {
  try {
    const record = await saveMockExamReviewFeedback({
      db: prisma,
      recordId: `${req.params.recordId ?? ""}`.trim(),
      userId: req.auth.userId,
      questionId: `${req.body?.questionId ?? ""}`.trim(),
      stars: req.body?.stars,
    });

    return ok(res, serializeMockExamRecordDetail(record), "批改满意度已提交");
  } catch (error) {
    return fail(res, error.message || "提交批改满意度失败", error.statusCode || 400);
  }
});
