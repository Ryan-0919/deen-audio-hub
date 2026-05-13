import { Router } from "express";
import multer from "multer";
import { getAudioDuration } from "../lib/audio.js";
import { config as runtimeConfig } from "../lib/config.js";
import { prisma } from "../lib/prisma.js";
import {
  addAdminMockExamPaperQuestionsFromBank,
  claimMockExamReviewRecord,
  createAdminMockExamPaper,
  deleteAdminMockExamPaper,
  getAdminMockExamPaperDetail,
  getMockExamReviewRecord,
  listMockExamReviewPaperSummaries,
  listAdminMockExamPapers,
  listMockExamReviewRecords,
  publishMockExamReviewRecord,
  releaseMockExamReviewLock,
  removeAdminMockExamPaperQuestion,
  renewMockExamReviewLock,
  reviewMockExamRecord,
  serializeMockExamReviewDetail,
  updateAdminMockExamPaper,
} from "../lib/mock-exam.js";
import { aiReviewMockExamRecord } from "../lib/mock-exam-ai-review.js";
import { getMockExamLaunchConfig, updateMockExamLaunchConfig } from "../lib/mock-exam-launch-config.js";
import {
  DEFAULT_AI_REVIEW_SYSTEM_PROMPT,
  DEFAULT_AI_REVIEW_USER_PROMPT_TEMPLATE,
  getAiReviewPromptTemplateMissingPlaceholders,
  normalizeAiReviewSystemPrompt,
  normalizeAiReviewUserPromptTemplate,
} from "../lib/mock-exam-ai-review.js";
import { getMockExamAiReviewConfig, normalizeMockExamAiReviewConfig } from "../lib/mock-exam-ai-review-config.js";
import { writeAdminAuditLog } from "../lib/audit.js";
import { createQuestionBankTemplate, parseQuestionBankExcel } from "../lib/question-bank-excel.js";
import {
  createMockExamPaperFromQuestionBank,
  createQuestionBankFolder,
  createQuestionBankItem,
  deleteQuestionBankFolder,
  deleteQuestionBankItem,
  getQuestionBankSummary,
  importQuestionBankItems,
  listQuestionBankFolders,
  listQuestionBankItems,
  updateQuestionBankFolder,
  updateQuestionBankItem,
} from "../lib/question-bank.js";
import { fail, ok } from "../lib/response.js";
import { uploadBuffer } from "../lib/upload.js";
import { requireAdminAuth, requireAdminRoles } from "../middleware/auth.js";

export const mockExamAdminRouter = Router();

mockExamAdminRouter.use(requireAdminAuth);
mockExamAdminRouter.use("/papers", requireAdminRoles("super_admin", "operations_admin"));
mockExamAdminRouter.use("/question-bank", requireAdminRoles("super_admin", "operations_admin"));
mockExamAdminRouter.use("/reviews", requireAdminRoles("super_admin", "review_admin"));
mockExamAdminRouter.use("/settings/ai-review", requireAdminRoles("super_admin", "review_admin"));
mockExamAdminRouter.use("/settings/launch", requireAdminRoles("super_admin", "operations_admin"));

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(`${value ?? ""}`, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const MB = 1024 * 1024;
const EXCEL_EXTENSIONS = new Set([".xls", ".xlsx"]);
const EXCEL_MIME_TYPES = new Set([
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".m4a", ".wav", ".aac", ".ogg"]);
const AUDIO_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
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
      const extension = `${file.originalname ?? ""}`.includes(".") ? `.${`${file.originalname}`.split(".").pop()?.toLowerCase() ?? ""}` : "";
      const mimeType = `${file.mimetype ?? ""}`.toLowerCase();
      const extensionAllowed = allowedExtensions.has(extension);
      const mimeAllowed = allowedMimeTypes.has(mimeType) || !mimeType || mimeType === "application/octet-stream";

      if (extensionAllowed && mimeAllowed) {
        callback(null, true);
        return;
      }

      callback(buildUploadValidationError(`${fileLabel}格式不支持，请重新选择后上传`));
    },
  });

const uploadQuestionBankExcel = createUploadMiddleware({
  maxFileSize: 10 * MB,
  maxFileCount: 1,
  allowedExtensions: EXCEL_EXTENSIONS,
  allowedMimeTypes: EXCEL_MIME_TYPES,
  fileLabel: "Excel 文件",
});

const uploadQuestionBankLessonAudio = createUploadMiddleware({
  maxFileSize: 30 * MB,
  maxFileCount: 1,
  allowedExtensions: AUDIO_EXTENSIONS,
  allowedMimeTypes: AUDIO_MIME_TYPES,
  fileLabel: "å¾®è¯¾éŸ³é¢‘",
});

const uploadReviewVoice = createUploadMiddleware({
  maxFileSize: 30 * MB,
  maxFileCount: 1,
  allowedExtensions: AUDIO_EXTENSIONS,
  allowedMimeTypes: AUDIO_MIME_TYPES,
  fileLabel: "语音文件",
});

const readPagination = (query) => {
  const page = toPositiveInt(query?.page, 1);
  const pageSize = Math.min(toPositiveInt(query?.pageSize, 20), 50);
  return { page, pageSize };
};

const parseQuestionBankPaperType = (value) => (`${value ?? ""}`.trim() === "subjective" ? "subjective" : "objective");
const isUniqueConstraintError = (error) => Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
const normalizeSeriesText = (value) => `${value ?? ""}`.replace(/\r\n/g, "\n").trim();
const toSeriesSortOrder = (value, fallback = 0) => {
  const parsed = Number.parseInt(`${value ?? ""}`.trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const recordAdminAction = (req, payload) => {
  void writeAdminAuditLog(req, payload).catch((error) => {
    console.error("Audit log write failed:", error);
  });
};

mockExamAdminRouter.get("/papers", async (_req, res) => {
  try {
    const result = await listAdminMockExamPapers({
      db: prisma,
    });

    return ok(res, result);
  } catch (error) {
    return fail(res, error.message || "加载模考试卷列表失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.get("/series", async (_req, res) => {
  try {
    const list = await prisma.mockExamSeries.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        description: true,
        sortOrder: true,
      },
    });

    return ok(
      res,
      list.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description ?? "",
        sortOrder: Number(item.sortOrder ?? 0),
      })),
    );
  } catch (error) {
    return fail(res, error.message || "加载机考课程失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.post("/series", async (req, res) => {
  const name = normalizeSeriesText(req.body?.name);
  if (!name) {
    return fail(res, "机考课程名称不能为空", 400);
  }

  try {
    const series = await prisma.mockExamSeries.create({
      data: {
        name,
        description: normalizeSeriesText(req.body?.description) || null,
        sortOrder: toSeriesSortOrder(req.body?.sortOrder, 0),
      },
      select: {
        id: true,
        name: true,
        description: true,
        sortOrder: true,
      },
    });

    recordAdminAction(req, {
      action: "mock_exam_series_create",
      entityType: "mock_exam_series",
      entityId: series.id,
      entityName: series.name,
      detail: {
        sortOrder: series.sortOrder,
      },
    });

    return ok(
      res,
      {
        id: series.id,
        name: series.name,
        description: series.description ?? "",
        sortOrder: Number(series.sortOrder ?? 0),
      },
      "机考课程已创建",
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return fail(res, "机考课程名称已存在", 400);
    }
    return fail(res, error.message || "创建机考课程失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.patch("/series/:seriesId", async (req, res) => {
  const seriesId = `${req.params.seriesId ?? ""}`.trim();
  const name = normalizeSeriesText(req.body?.name);
  if (!seriesId) {
    return fail(res, "缺少机考课程参数", 400);
  }
  if (!name) {
    return fail(res, "机考课程名称不能为空", 400);
  }

  const existing = await prisma.mockExamSeries.findUnique({
    where: { id: seriesId },
    select: { id: true, name: true, sortOrder: true },
  });
  if (!existing) {
    return fail(res, "机考课程不存在", 404);
  }

  try {
    const series = await prisma.mockExamSeries.update({
      where: { id: seriesId },
      data: {
        name,
        description: normalizeSeriesText(req.body?.description) || null,
        sortOrder: toSeriesSortOrder(req.body?.sortOrder, Number(existing.sortOrder ?? 0)),
      },
      select: {
        id: true,
        name: true,
        description: true,
        sortOrder: true,
      },
    });

    recordAdminAction(req, {
      action: "mock_exam_series_update",
      entityType: "mock_exam_series",
      entityId: series.id,
      entityName: series.name,
      detail: {
        previousName: existing.name,
        sortOrder: series.sortOrder,
      },
    });

    return ok(
      res,
      {
        id: series.id,
        name: series.name,
        description: series.description ?? "",
        sortOrder: Number(series.sortOrder ?? 0),
      },
      "机考课程已更新",
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return fail(res, "机考课程名称已存在", 400);
    }
    return fail(res, error.message || "更新机考课程失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.delete("/series/:seriesId", async (req, res) => {
  const seriesId = `${req.params.seriesId ?? ""}`.trim();
  if (!seriesId) {
    return fail(res, "缺少机考课程参数", 400);
  }

  const series = await prisma.mockExamSeries.findUnique({
    where: { id: seriesId },
    include: {
      _count: {
        select: {
          papers: true,
          permissions: true,
        },
      },
    },
  });

  if (!series) {
    return fail(res, "机考课程不存在", 404);
  }

  if (Number(series._count?.papers ?? 0) > 0) {
    return fail(res, "该机考课程下还有试卷，不能直接删除", 400);
  }

  if (Number(series._count?.permissions ?? 0) > 0) {
    await prisma.userMockExamSeriesPermission.deleteMany({
      where: {
        seriesId,
      },
    });
  }

  await prisma.mockExamSeries.delete({
    where: { id: seriesId },
  });

  recordAdminAction(req, {
    action: "mock_exam_series_delete",
    entityType: "mock_exam_series",
    entityId: series.id,
    entityName: series.name,
  });

  return ok(res, { success: true, id: series.id, name: series.name }, "机考课程已删除");
});

mockExamAdminRouter.get("/settings/launch", async (_req, res) => {
  try {
    return ok(res, await getMockExamLaunchConfig(prisma));
  } catch (error) {
    return fail(res, error.message || "加载机考启动页配置失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.patch("/settings/launch", async (req, res) => {
  try {
    const nextConfig = await updateMockExamLaunchConfig({
      db: prisma,
      config: req.body?.config,
    });

    recordAdminAction(req, {
      action: "mock_exam_launch_config_update",
      entityType: "mock_exam_launch_config",
      entityId: "system:mock-exam-launch",
      entityName: "机考启动页配置",
      detail: {
        noticeLabel: nextConfig.tabs[0]?.label ?? "",
        rulesLabel: nextConfig.tabs[1]?.label ?? "",
        guideLabel: nextConfig.tabs[2]?.label ?? "",
      },
    });

    return ok(res, nextConfig, "机考启动页配置已更新");
  } catch (error) {
    return fail(res, error.message || "保存机考启动页配置失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.post("/papers/create-from-bank", async (req, res) => {
  try {
    const result = await createMockExamPaperFromQuestionBank({
      db: prisma,
      itemIds: req.body?.itemIds,
      paper: req.body?.paper,
    });

    recordAdminAction(req, {
      action: "mock_exam_paper_create_from_bank",
      entityType: "mock_exam_paper",
      entityId: result.paperId,
      entityName: result.title,
      detail: {
        questionCount: result.questionCount,
        totalScore: result.totalScore,
      },
    });

    return ok(res, result, "试卷已根据题库内容生成");
  } catch (error) {
    return fail(res, error.message || "根据题库生成试卷失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.post("/papers", async (req, res) => {
  try {
    const paper = await createAdminMockExamPaper({
      db: prisma,
      payload: req.body,
    });

    recordAdminAction(req, {
      action: "mock_exam_paper_create",
      entityType: "mock_exam_paper",
      entityId: paper.id,
      entityName: paper.title,
      detail: {
        paperType: paper.paperType,
        questionCount: paper.questionCount,
      },
    });

    return ok(res, paper, "试卷已创建");
  } catch (error) {
    return fail(res, error.message || "创建试卷失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.get("/papers/:paperId", async (req, res) => {
  try {
    return ok(
      res,
      await getAdminMockExamPaperDetail({
        db: prisma,
        paperId: `${req.params.paperId ?? ""}`.trim(),
      }),
    );
  } catch (error) {
    return fail(res, error.message || "加载试卷详情失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.patch("/papers/:paperId", async (req, res) => {
  try {
    const paper = await updateAdminMockExamPaper({
      db: prisma,
      paperId: `${req.params.paperId ?? ""}`.trim(),
      payload: req.body,
    });

    recordAdminAction(req, {
      action: "mock_exam_paper_update",
      entityType: "mock_exam_paper",
      entityId: paper.id,
      entityName: paper.title,
      detail: {
        paperType: paper.paperType,
        status: paper.status,
        questionCount: paper.questionCount,
      },
    });

    return ok(res, paper, "试卷已更新");
  } catch (error) {
    return fail(res, error.message || "更新试卷失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.delete("/papers/:paperId", async (req, res) => {
  try {
    const result = await deleteAdminMockExamPaper({
      db: prisma,
      paperId: `${req.params.paperId ?? ""}`.trim(),
    });

    recordAdminAction(req, {
      action: "mock_exam_paper_delete",
      entityType: "mock_exam_paper",
      entityId: result.paperId,
      entityName: result.title,
    });

    return ok(res, result, "试卷已删除");
  } catch (error) {
    return fail(res, error.message || "删除试卷失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.post("/papers/:paperId/questions/from-bank", async (req, res) => {
  try {
    const paper = await addAdminMockExamPaperQuestionsFromBank({
      db: prisma,
      paperId: `${req.params.paperId ?? ""}`.trim(),
      itemIds: req.body?.itemIds,
    });

    recordAdminAction(req, {
      action: "mock_exam_paper_add_questions",
      entityType: "mock_exam_paper",
      entityId: paper.id,
      entityName: paper.title,
      detail: {
        questionCount: paper.questionCount,
        totalScore: paper.totalScore,
      },
    });

    return ok(res, paper, "题目已加入试卷");
  } catch (error) {
    return fail(res, error.message || "加入题目失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.delete("/papers/:paperId/questions/:questionId", async (req, res) => {
  try {
    const paper = await removeAdminMockExamPaperQuestion({
      db: prisma,
      paperId: `${req.params.paperId ?? ""}`.trim(),
      questionId: `${req.params.questionId ?? ""}`.trim(),
    });

    recordAdminAction(req, {
      action: "mock_exam_paper_remove_question",
      entityType: "mock_exam_paper",
      entityId: paper.id,
      entityName: paper.title,
      detail: {
        questionCount: paper.questionCount,
        totalScore: paper.totalScore,
      },
    });

    return ok(res, paper, "题目已从试卷移除");
  } catch (error) {
    return fail(res, error.message || "移除题目失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.get("/question-bank/summary", async (_req, res) => {
  try {
    return ok(
      res,
      await getQuestionBankSummary({
        db: prisma,
      }),
    );
  } catch (error) {
    return fail(res, error.message || "加载题库概览失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.get("/question-bank/folders", async (req, res) => {
  try {
    return ok(
      res,
      await listQuestionBankFolders({
        db: prisma,
        paperType: parseQuestionBankPaperType(req.query?.paperType),
      }),
    );
  } catch (error) {
    return fail(res, error.message || "加载题库文件夹失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.post("/question-bank/folders", async (req, res) => {
  try {
    const folder = await createQuestionBankFolder({
      db: prisma,
      name: req.body?.name,
      paperType: parseQuestionBankPaperType(req.body?.paperType),
    });

    recordAdminAction(req, {
      action: "question_bank_folder_create",
      entityType: "question_bank_folder",
      entityId: folder.id,
      entityName: folder.name,
      detail: {
        paperType: folder.paperType,
      },
    });

    return ok(res, folder, "题库文件夹已创建");
  } catch (error) {
    return fail(res, error.message || "创建题库文件夹失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.patch("/question-bank/folders/:folderId", async (req, res) => {
  try {
    const folder = await updateQuestionBankFolder({
      db: prisma,
      folderId: `${req.params.folderId ?? ""}`.trim(),
      name: req.body?.name,
    });

    recordAdminAction(req, {
      action: "question_bank_folder_update",
      entityType: "question_bank_folder",
      entityId: folder.id,
      entityName: folder.name,
    });

    return ok(res, folder, "题库文件夹已更新");
  } catch (error) {
    return fail(res, error.message || "更新题库文件夹失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.delete("/question-bank/folders/:folderId", async (req, res) => {
  try {
    const result = await deleteQuestionBankFolder({
      db: prisma,
      folderId: `${req.params.folderId ?? ""}`.trim(),
    });

    recordAdminAction(req, {
      action: "question_bank_folder_delete",
      entityType: "question_bank_folder",
      entityId: `${req.params.folderId ?? ""}`.trim(),
    });

    return ok(res, result, "题库文件夹已删除");
  } catch (error) {
    return fail(res, error.message || "删除题库文件夹失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.get("/question-bank/items", async (req, res) => {
  try {
    const { page, pageSize } = readPagination(req.query);
    return ok(
      res,
      await listQuestionBankItems({
        db: prisma,
        paperType: parseQuestionBankPaperType(req.query?.paperType),
        folderId: `${req.query?.folderId ?? ""}`.trim(),
        keyword: `${req.query?.keyword ?? ""}`.trim(),
        questionType: `${req.query?.questionType ?? ""}`.trim(),
        page,
        pageSize,
      }),
    );
  } catch (error) {
    return fail(res, error.message || "加载题库题目失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.post("/question-bank/items", async (req, res) => {
  try {
    const item = await createQuestionBankItem({
      db: prisma,
      payload: req.body,
    });

    recordAdminAction(req, {
      action: "question_bank_item_create",
      entityType: "question_bank_item",
      entityId: item.id,
      entityName: item.stem.slice(0, 60),
      detail: {
        questionType: item.questionType,
        folderId: item.folderId,
      },
    });

    return ok(res, item, "题目已加入题库");
  } catch (error) {
    return fail(res, error.message || "创建题库题目失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.patch("/question-bank/items/:itemId", async (req, res) => {
  try {
    const item = await updateQuestionBankItem({
      db: prisma,
      itemId: `${req.params.itemId ?? ""}`.trim(),
      payload: req.body,
    });

    recordAdminAction(req, {
      action: "question_bank_item_update",
      entityType: "question_bank_item",
      entityId: item.id,
      entityName: item.stem.slice(0, 60),
      detail: {
        questionType: item.questionType,
        folderId: item.folderId,
      },
    });

    return ok(res, item, "题库题目已更新");
  } catch (error) {
    return fail(res, error.message || "更新题库题目失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.delete("/question-bank/items/:itemId", async (req, res) => {
  try {
    const result = await deleteQuestionBankItem({
      db: prisma,
      itemId: `${req.params.itemId ?? ""}`.trim(),
    });

    recordAdminAction(req, {
      action: "question_bank_item_delete",
      entityType: "question_bank_item",
      entityId: `${req.params.itemId ?? ""}`.trim(),
    });

    return ok(res, result, "题库题目已删除");
  } catch (error) {
    return fail(res, error.message || "删除题库题目失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.post("/question-bank/items/import", uploadQuestionBankExcel.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      throw Object.assign(new Error("请先选择 Excel 文件"), { statusCode: 400 });
    }

    const paperType = parseQuestionBankPaperType(req.body?.paperType);
    const parsedItems = await parseQuestionBankExcel({
      fileName: file.originalname,
      buffer: file.buffer,
      paperType,
    });

    const result = await importQuestionBankItems({
      db: prisma,
      folderId: `${req.body?.folderId ?? ""}`.trim(),
      items: parsedItems,
    });

    recordAdminAction(req, {
      action: "question_bank_item_import",
      entityType: "question_bank_folder",
      entityId: `${req.body?.folderId ?? ""}`.trim(),
      detail: {
        paperType,
        fileName: file.originalname,
        createdCount: result.createdCount,
      },
    });

    return ok(res, result, `已批量导入 ${result.createdCount} 道题目`);
  } catch (error) {
    return fail(res, error.message || "批量导入题库失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.get("/question-bank/template", async (req, res) => {
  try {
    const { fileName, buffer } = createQuestionBankTemplate(parseQuestionBankPaperType(req.query?.paperType));

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.send(buffer);
  } catch (error) {
    return fail(res, error.message || "下载题库模板失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.post("/question-bank/upload-lesson-audio", uploadQuestionBankLessonAudio.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      throw Object.assign(new Error("è¯·å…ˆé€‰æ‹©å¾®è¯¾éŸ³é¢‘æ–‡ä»¶"), { statusCode: 400 });
    }

    const [uploaded, durationSeconds] = await Promise.all([
      uploadBuffer({
        fileName: file.originalname,
        buffer: file.buffer,
        mimeType: file.mimetype,
        folder: "mock-exam-question-lessons",
      }),
      getAudioDuration(file),
    ]);

    return ok(
      res,
      {
        ...uploaded,
        durationSeconds: Math.max(0, Number(durationSeconds ?? 0)),
      },
      "é¢˜ç›®å¾®è¯¾ä¸Šä¼ æˆåŠŸ",
    );
  } catch (error) {
    return fail(res, error.message || "ä¸Šä¼ é¢˜ç›®å¾®è¯¾å¤±è´¥", error.statusCode || 400);
  }
});

mockExamAdminRouter.post("/reviews/upload-voice", uploadReviewVoice.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      throw Object.assign(new Error("请先选择语音文件"), { statusCode: 400 });
    }

    const [uploaded, durationSeconds] = await Promise.all([
      uploadBuffer({
        fileName: file.originalname,
        buffer: file.buffer,
        mimeType: file.mimetype,
        folder: "mock-exam-review-voices",
      }),
      getAudioDuration(file),
    ]);

    return ok(
      res,
      {
        ...uploaded,
        durationSeconds: Math.max(0, Number(durationSeconds ?? 0)),
      },
      "批改语音上传成功",
    );
  } catch (error) {
    return fail(res, error.message || "上传批改语音失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.get("/reviews", async (req, res) => {
  try {
    const { page, pageSize } = readPagination(req.query);
    const result = await listMockExamReviewRecords({
      db: prisma,
      keyword: `${req.query?.keyword ?? ""}`.trim(),
      reviewStatus: `${req.query?.reviewStatus ?? "ai_pending"}`.trim(),
      paperId: `${req.query?.paperId ?? ""}`.trim(),
      currentAdminId: `${req.auth?.adminId ?? ""}`.trim(),
      page,
      pageSize,
    });

    return ok(res, result);
  } catch (error) {
    return fail(res, error.message || "加载主观题批改列表失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.get("/reviews/papers", async (req, res) => {
  try {
    return ok(
      res,
      await listMockExamReviewPaperSummaries({
        db: prisma,
        keyword: `${req.query?.keyword ?? ""}`.trim(),
        currentAdminId: `${req.auth?.adminId ?? ""}`.trim(),
      }),
    );
  } catch (error) {
    return fail(res, error.message || "加载批改试卷概览失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.get("/reviews/:recordId", async (req, res) => {
  try {
    const record = await getMockExamReviewRecord({
      db: prisma,
      recordId: `${req.params.recordId ?? ""}`.trim(),
    });

    return ok(
      res,
      serializeMockExamReviewDetail(record, new Date(), {
        currentAdminId: req.auth?.adminId,
      }),
    );
  } catch (error) {
    return fail(res, error.message || "加载批改详情失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.post("/reviews/:recordId/claim", async (req, res) => {
  try {
    const record = await claimMockExamReviewRecord({
      db: prisma,
      recordId: `${req.params.recordId ?? ""}`.trim(),
      adminId: `${req.auth?.adminId ?? ""}`.trim(),
      adminName: `${req.auth?.admin?.name ?? req.auth?.admin?.account ?? "批改老师"}`.trim(),
    });

    return ok(
      res,
      serializeMockExamReviewDetail(record, new Date(), {
        currentAdminId: req.auth?.adminId,
      }),
      "试卷已领取",
    );
  } catch (error) {
    return fail(res, error.message || "领取试卷失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.post("/reviews/:recordId/renew-lock", async (req, res) => {
  try {
    const record = await renewMockExamReviewLock({
      db: prisma,
      recordId: `${req.params.recordId ?? ""}`.trim(),
      adminId: `${req.auth?.adminId ?? ""}`.trim(),
      lockToken: `${req.body?.lockToken ?? ""}`.trim(),
    });

    return ok(
      res,
      serializeMockExamReviewDetail(record, new Date(), {
        currentAdminId: req.auth?.adminId,
      }),
      "批改锁已续期",
    );
  } catch (error) {
    return fail(res, error.message || "续期批改锁失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.post("/reviews/:recordId/release-lock", async (req, res) => {
  try {
    const record = await releaseMockExamReviewLock({
      db: prisma,
      recordId: `${req.params.recordId ?? ""}`.trim(),
      adminId: `${req.auth?.adminId ?? ""}`.trim(),
      lockToken: `${req.body?.lockToken ?? ""}`.trim(),
    });

    return ok(
      res,
      serializeMockExamReviewDetail(record, new Date(), {
        currentAdminId: req.auth?.adminId,
      }),
      "批改锁已释放",
    );
  } catch (error) {
    return fail(res, error.message || "释放批改锁失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.get("/settings/ai-review", async (_req, res) => {
  try {
    return ok(res, await getMockExamAiReviewConfig(prisma));
  } catch (error) {
    return fail(res, error.message || "加载 AI 批改配置失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.patch("/settings/ai-review", async (req, res) => {
  try {
    const normalizedConfig = normalizeMockExamAiReviewConfig(req.body);
    const missingPlaceholders = getAiReviewPromptTemplateMissingPlaceholders(normalizedConfig.userPromptTemplate);
    if (missingPlaceholders.length > 0) {
      return fail(res, `批改提示词模板缺少必要占位符：${missingPlaceholders.join("、")}`, 400);
    }

    await prisma.systemConfig.upsert({
      where: { id: 1 },
      update: {
        mockExamAiReviewConfigJson: JSON.stringify(normalizedConfig),
      },
      create: {
        id: 1,
        mockExamAiReviewConfigJson: JSON.stringify(normalizedConfig),
      },
    });

    recordAdminAction(req, {
      action: "mock_exam_ai_review_config_update",
      entityType: "mock_exam_setting",
      entityId: "ai-review",
      entityName: "AI批改配置",
      detail: {
        provider: normalizedConfig.provider,
        hasBaseUrl: Boolean(normalizedConfig.baseUrl),
        hasApiKey: Boolean(normalizedConfig.apiKey),
        hasModel: Boolean(normalizedConfig.model),
        timeoutMs: normalizedConfig.timeoutMs,
        hasSystemPrompt: Boolean(normalizedConfig.systemPrompt),
        hasUserPromptTemplate: Boolean(normalizedConfig.userPromptTemplate),
      },
    });

    return ok(res, normalizedConfig, "AI 批改配置已保存");
  } catch (error) {
    return fail(res, error.message || "保存 AI 批改配置失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.post("/reviews/:recordId/score", async (req, res) => {
  try {
    const record = await reviewMockExamRecord({
      db: prisma,
      recordId: `${req.params.recordId ?? ""}`.trim(),
      adminId: `${req.auth?.adminId ?? ""}`.trim(),
      lockToken: `${req.body?.lockToken ?? ""}`.trim(),
      version: req.body?.version,
      questionScores: req.body?.items,
      targetWorkflowStatus: `${req.body?.targetWorkflowStatus ?? ""}`.trim() === "manual_reviewing" ? "manual_reviewing" : "manual_pending",
    });

    return ok(
      res,
      serializeMockExamReviewDetail(record, new Date(), {
        currentAdminId: req.auth?.adminId,
      }),
      "批改结果已保存",
    );
  } catch (error) {
    return fail(res, error.message || "保存批改结果失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.post("/reviews/:recordId/publish", async (req, res) => {
  try {
    const record = await publishMockExamReviewRecord({
      db: prisma,
      recordId: `${req.params.recordId ?? ""}`.trim(),
      adminId: `${req.auth?.adminId ?? ""}`.trim(),
      lockToken: `${req.body?.lockToken ?? ""}`.trim(),
      version: req.body?.version,
    });

    return ok(
      res,
      serializeMockExamReviewDetail(record, new Date(), {
        currentAdminId: req.auth?.adminId,
      }),
      "批改结果已发送给学生",
    );
  } catch (error) {
    return fail(res, error.message || "发送批改结果失败", error.statusCode || 400);
  }
});

mockExamAdminRouter.post("/reviews/:recordId/ai-score", async (req, res) => {
  try {
    const aiReviewConfig = await getMockExamAiReviewConfig(prisma);
    const record = await aiReviewMockExamRecord({
      db: prisma,
      recordId: `${req.params.recordId ?? ""}`.trim(),
      adminId: `${req.auth?.adminId ?? ""}`.trim(),
      runtimeConfig: aiReviewConfig,
      allowRuleFallback: false,
    });

    return ok(
      res,
      serializeMockExamReviewDetail(record, new Date(), {
        currentAdminId: req.auth?.adminId,
      }),
      "批改结果已生成",
    );
  } catch (error) {
    return fail(res, error.message || "批改失败", error.statusCode || 400);
  }
});
