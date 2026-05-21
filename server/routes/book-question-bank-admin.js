import multer from "multer";
import { Router } from "express";
import { getAudioDuration } from "../lib/audio.js";
import { hashPassword } from "../lib/auth.js";
import { writeAdminAuditLog } from "../lib/audit.js";
import {
  createAdminBookQuestionBank,
  createAdminBookQuestionBankItem,
  createAdminBookQuestionBankSubject,
  DEFAULT_BOOK_QUESTION_BANK_USER_PASSWORD,
  deleteAdminBookQuestionBank,
  deleteAdminBookQuestionBankItem,
  deleteAdminBookQuestionBankSubject,
  grantAdminBookQuestionBankPermission,
  attachImportedBookQuestionBankAudios,
  importAdminBookQuestionBankItems,
  listAdminBookQuestionBankItems,
  listAdminBookQuestionBankPermissions,
  listAdminBookQuestionBanks,
  listAdminBookQuestionBankSubjects,
  revokeAdminBookQuestionBankPermission,
  updateAdminBookQuestionBank,
  updateAdminBookQuestionBankItem,
  updateAdminBookQuestionBankSubject,
} from "../lib/book-question-bank.js";
import { createQuestionBankTemplate, parseQuestionBankExcel } from "../lib/question-bank-excel.js";
import { prisma } from "../lib/prisma.js";
import { fail, ok } from "../lib/response.js";
import { validatePhoneOrThrow } from "../lib/security.js";
import { uploadBuffer } from "../lib/upload.js";
import { requireAdminAuth, requireAdminRoles } from "../middleware/auth.js";

export const bookQuestionBankAdminRouter = Router();

bookQuestionBankAdminRouter.use(requireAdminAuth);
bookQuestionBankAdminRouter.use(requireAdminRoles("super_admin", "operations_admin"));

const recordAdminAction = (req, payload) => {
  void writeAdminAuditLog(req, payload).catch((error) => {
    console.error("Audit log write failed:", error);
  });
};

const MB = 1024 * 1024;
const AUDIO_EXTENSIONS = new Set([".mp3", ".m4a", ".wav", ".aac", ".ogg"]);
const EXCEL_EXTENSIONS = new Set([".xls", ".xlsx"]);
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
const EXCEL_MIME_TYPES = new Set([
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
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

const uploadBookQuestionBankLessonAudio = createUploadMiddleware({
  maxFileSize: 30 * MB,
  maxFileCount: 1,
  allowedExtensions: AUDIO_EXTENSIONS,
  allowedMimeTypes: AUDIO_MIME_TYPES,
  fileLabel: "微课音频",
});

const uploadBookQuestionBankExcel = createUploadMiddleware({
  maxFileSize: 10 * MB,
  maxFileCount: 1,
  allowedExtensions: EXCEL_EXTENSIONS,
  allowedMimeTypes: EXCEL_MIME_TYPES,
  fileLabel: "Excel 文件",
});

const uploadBookQuestionBankImportBundle = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 30 * MB,
    files: 21,
  },
});

const parseQuestionBankPaperType = (value) => (`${value ?? ""}`.trim() === "subjective" ? "subjective" : "objective");

bookQuestionBankAdminRouter.get("/books", async (_req, res) => {
  try {
    return ok(res, await listAdminBookQuestionBanks({ db: prisma }));
  } catch (error) {
    return fail(res, error.message || "加载题库产品失败", error.statusCode || 400);
  }
});

bookQuestionBankAdminRouter.post("/books", async (req, res) => {
  try {
    const book = await createAdminBookQuestionBank({ db: prisma, payload: req.body });

    recordAdminAction(req, {
      action: "book_question_bank.create",
      entityType: "book_question_bank",
      entityId: book.id,
      entityName: book.name,
      detail: { code: book.code },
    });

    return ok(res, book, "题库产品已创建");
  } catch (error) {
    return fail(res, error.message || "创建题库产品失败", error.statusCode || 400);
  }
});

bookQuestionBankAdminRouter.patch("/books/:bookId", async (req, res) => {
  try {
    const book = await updateAdminBookQuestionBank({
      db: prisma,
      bookId: `${req.params.bookId ?? ""}`.trim(),
      payload: req.body,
    });

    recordAdminAction(req, {
      action: "book_question_bank.update",
      entityType: "book_question_bank",
      entityId: book.id,
      entityName: book.name,
      detail: { code: book.code },
    });

    return ok(res, book, "题库产品已更新");
  } catch (error) {
    return fail(res, error.message || "更新题库产品失败", error.statusCode || 400);
  }
});

bookQuestionBankAdminRouter.delete("/books/:bookId", async (req, res) => {
  try {
    const result = await deleteAdminBookQuestionBank({
      db: prisma,
      bookId: `${req.params.bookId ?? ""}`.trim(),
    });

    recordAdminAction(req, {
      action: "book_question_bank.delete",
      entityType: "book_question_bank",
      entityId: result.id,
      entityName: result.name,
    });

    return ok(res, result, "题库产品已删除");
  } catch (error) {
    return fail(res, error.message || "删除题库产品失败", error.statusCode || 400);
  }
});

bookQuestionBankAdminRouter.get("/books/:bookId/subjects", async (req, res) => {
  try {
    return ok(
      res,
      await listAdminBookQuestionBankSubjects({
        db: prisma,
        bookId: `${req.params.bookId ?? ""}`.trim(),
      }),
    );
  } catch (error) {
    return fail(res, error.message || "加载科目失败", error.statusCode || 400);
  }
});

bookQuestionBankAdminRouter.post("/books/:bookId/subjects", async (req, res) => {
  try {
    const subject = await createAdminBookQuestionBankSubject({
      db: prisma,
      bookId: `${req.params.bookId ?? ""}`.trim(),
      payload: req.body,
    });

    recordAdminAction(req, {
      action: "book_question_bank_subject.create",
      entityType: "book_question_bank_subject",
      entityId: subject.id,
      entityName: subject.name,
      detail: { bookId: subject.bookId, code: subject.code },
    });

    return ok(res, subject, "科目已创建");
  } catch (error) {
    return fail(res, error.message || "创建科目失败", error.statusCode || 400);
  }
});

bookQuestionBankAdminRouter.patch("/books/:bookId/subjects/:subjectId", async (req, res) => {
  try {
    const subject = await updateAdminBookQuestionBankSubject({
      db: prisma,
      bookId: `${req.params.bookId ?? ""}`.trim(),
      subjectId: `${req.params.subjectId ?? ""}`.trim(),
      payload: req.body,
    });

    recordAdminAction(req, {
      action: "book_question_bank_subject.update",
      entityType: "book_question_bank_subject",
      entityId: subject.id,
      entityName: subject.name,
      detail: { bookId: subject.bookId, code: subject.code },
    });

    return ok(res, subject, "科目已更新");
  } catch (error) {
    return fail(res, error.message || "更新科目失败", error.statusCode || 400);
  }
});

bookQuestionBankAdminRouter.delete("/books/:bookId/subjects/:subjectId", async (req, res) => {
  try {
    const result = await deleteAdminBookQuestionBankSubject({
      db: prisma,
      bookId: `${req.params.bookId ?? ""}`.trim(),
      subjectId: `${req.params.subjectId ?? ""}`.trim(),
    });

    recordAdminAction(req, {
      action: "book_question_bank_subject.delete",
      entityType: "book_question_bank_subject",
      entityId: result.id,
      entityName: result.name,
    });

    return ok(res, result, "科目已删除");
  } catch (error) {
    return fail(res, error.message || "删除科目失败", error.statusCode || 400);
  }
});

bookQuestionBankAdminRouter.get("/books/:bookId/items", async (req, res) => {
  try {
    return ok(
      res,
      await listAdminBookQuestionBankItems({
        db: prisma,
        bookId: `${req.params.bookId ?? ""}`.trim(),
        subjectId: `${req.query?.subjectId ?? ""}`.trim(),
        keyword: `${req.query?.keyword ?? ""}`.trim(),
        questionType: `${req.query?.questionType ?? ""}`.trim(),
      }),
    );
  } catch (error) {
    return fail(res, error.message || "加载题目失败", error.statusCode || 400);
  }
});

bookQuestionBankAdminRouter.post("/books/:bookId/items", async (req, res) => {
  try {
    const item = await createAdminBookQuestionBankItem({
      db: prisma,
      bookId: `${req.params.bookId ?? ""}`.trim(),
      payload: req.body,
    });

    recordAdminAction(req, {
      action: "book_question_bank_item.create",
      entityType: "book_question_bank_item",
      entityId: item.id,
      entityName: item.title,
      detail: { bookId: item.bookId, subjectId: item.subjectId },
    });

    return ok(res, item, "题目已新增");
  } catch (error) {
    return fail(res, error.message || "新增题目失败", error.statusCode || 400);
  }
});

bookQuestionBankAdminRouter.post("/books/:bookId/items/import", uploadBookQuestionBankExcel.single("file"), async (req, res) => {
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

    const result = await importAdminBookQuestionBankItems({
      db: prisma,
      bookId: `${req.params.bookId ?? ""}`.trim(),
      subjectId: `${req.body?.subjectId ?? ""}`.trim(),
      items: parsedItems,
    });

    recordAdminAction(req, {
      action: "book_question_bank_item.import",
      entityType: "book_question_bank",
      entityId: `${req.params.bookId ?? ""}`.trim(),
      detail: {
        subjectId: `${req.body?.subjectId ?? ""}`.trim(),
        paperType,
        fileName: file.originalname,
        createdCount: result.createdCount,
      },
    });

    return ok(res, result, `已批量导入 ${result.createdCount} 道题目`);
  } catch (error) {
    return fail(res, error.message || "批量导入独立题库失败", error.statusCode || 400);
  }
});

bookQuestionBankAdminRouter.post(
  "/books/:bookId/items/import-with-audio",
  uploadBookQuestionBankImportBundle.fields([
    { name: "file", maxCount: 1 },
    { name: "audioFiles", maxCount: 20 },
  ]),
  async (req, res) => {
    try {
      const file = Array.isArray(req.files?.file) ? req.files.file[0] : null;
      if (!file) {
        throw Object.assign(new Error("请选择 Excel 文件"), { statusCode: 400 });
      }

      const audioFiles = Array.isArray(req.files?.audioFiles) ? req.files.audioFiles : [];
      const paperType = parseQuestionBankPaperType(req.body?.paperType);
      const parsedItems = await parseQuestionBankExcel({
        fileName: file.originalname,
        buffer: file.buffer,
        paperType,
      });

      const bookId = `${req.params.bookId ?? ""}`.trim();
      const subjectId = `${req.body?.subjectId ?? ""}`.trim();
      const result = await importAdminBookQuestionBankItems({
        db: prisma,
        bookId,
        subjectId,
        items: parsedItems,
      });

      let audioMatchResult = {
        matchedCount: 0,
        unmatchedAudioNames: [],
      };

      if (audioFiles.length > 0) {
        const audioAssets = await Promise.all(
          audioFiles.map(async (audioFile) => {
            const [uploaded, durationSeconds] = await Promise.all([
              uploadBuffer({
                fileName: audioFile.originalname,
                buffer: audioFile.buffer,
                mimeType: audioFile.mimetype,
                folder: "book-question-bank-lessons",
              }),
              getAudioDuration(audioFile),
            ]);

            return {
              fileName: audioFile.originalname,
              objectKey: uploaded.objectKey,
              url: uploaded.url,
              readableUrl: uploaded.readableUrl,
              durationSeconds,
            };
          }),
        );

        audioMatchResult = await attachImportedBookQuestionBankAudios({
          db: prisma,
          bookId,
          subjectId,
          items: parsedItems,
          audioAssets,
        });
      }

      recordAdminAction(req, {
        action: "book_question_bank_item.import_with_audio",
        entityType: "book_question_bank",
        entityId: bookId,
        detail: {
          subjectId,
          paperType,
          fileName: file.originalname,
          createdCount: result.createdCount,
          matchedAudioCount: audioMatchResult.matchedCount,
          unmatchedAudioCount: audioMatchResult.unmatchedAudioNames.length,
        },
      });

      return ok(
        res,
        {
          ...result,
          matchedAudioCount: audioMatchResult.matchedCount,
          unmatchedAudioNames: audioMatchResult.unmatchedAudioNames,
        },
        `已批量导入 ${result.createdCount} 道题目`,
      );
    } catch (error) {
      return fail(res, error.message || "批量导入独立题库失败", error.statusCode || 400);
    }
  },
);

bookQuestionBankAdminRouter.get("/template", async (req, res) => {
  try {
    const { fileName, buffer } = createQuestionBankTemplate(parseQuestionBankPaperType(req.query?.paperType));

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.send(buffer);
  } catch (error) {
    return fail(res, error.message || "下载独立题库模板失败", error.statusCode || 400);
  }
});

bookQuestionBankAdminRouter.patch("/books/:bookId/items/:bookItemId", async (req, res) => {
  try {
    const item = await updateAdminBookQuestionBankItem({
      db: prisma,
      bookId: `${req.params.bookId ?? ""}`.trim(),
      bookItemId: `${req.params.bookItemId ?? ""}`.trim(),
      payload: req.body,
    });

    recordAdminAction(req, {
      action: "book_question_bank_item.update",
      entityType: "book_question_bank_item",
      entityId: item.id,
      entityName: item.title,
      detail: { bookId: item.bookId, subjectId: item.subjectId },
    });

    return ok(res, item, "题目已更新");
  } catch (error) {
    return fail(res, error.message || "更新题目失败", error.statusCode || 400);
  }
});

bookQuestionBankAdminRouter.delete("/books/:bookId/items/:bookItemId", async (req, res) => {
  try {
    const result = await deleteAdminBookQuestionBankItem({
      db: prisma,
      bookId: `${req.params.bookId ?? ""}`.trim(),
      bookItemId: `${req.params.bookItemId ?? ""}`.trim(),
    });

    recordAdminAction(req, {
      action: "book_question_bank_item.delete",
      entityType: "book_question_bank_item",
      entityId: result.id,
      entityName: result.title,
    });

    return ok(res, result, "题目已删除");
  } catch (error) {
    return fail(res, error.message || "删除题目失败", error.statusCode || 400);
  }
});

bookQuestionBankAdminRouter.post("/upload-lesson-audio", uploadBookQuestionBankLessonAudio.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      throw Object.assign(new Error("请先选择微课音频文件"), { statusCode: 400 });
    }

    const [uploaded, durationSeconds] = await Promise.all([
      uploadBuffer({
        fileName: file.originalname,
        buffer: file.buffer,
        mimeType: file.mimetype,
        folder: "book-question-bank-lessons",
      }),
      getAudioDuration(file),
    ]);

    return ok(
      res,
      {
        ...uploaded,
        durationSeconds: Math.max(0, Number(durationSeconds ?? 0)),
      },
      "题目微课上传成功",
    );
  } catch (error) {
    return fail(res, error.message || "上传题目微课失败", error.statusCode || 400);
  }
});

bookQuestionBankAdminRouter.get("/books/:bookId/permissions", async (req, res) => {
  try {
    return ok(
      res,
      await listAdminBookQuestionBankPermissions({
        db: prisma,
        bookId: `${req.params.bookId ?? ""}`.trim(),
      }),
    );
  } catch (error) {
    return fail(res, error.message || "加载题库权限失败", error.statusCode || 400);
  }
});

bookQuestionBankAdminRouter.post("/books/:bookId/permissions", async (req, res) => {
  try {
    const phones = Array.isArray(req.body?.phones) ? req.body.phones.map((item) => validatePhoneOrThrow(item)) : [];
    const defaultPasswordHash = await hashPassword(DEFAULT_BOOK_QUESTION_BANK_USER_PASSWORD);
    const result = await grantAdminBookQuestionBankPermission({
      db: prisma,
      bookId: `${req.params.bookId ?? ""}`.trim(),
      phones,
      defaultPasswordHash,
    });

    recordAdminAction(req, {
      action: "book_question_bank_permission.grant",
      entityType: "book_question_bank",
      entityId: `${req.params.bookId ?? ""}`.trim(),
      detail: result,
    });

    return ok(res, result, "题库权限已开通");
  } catch (error) {
    return fail(res, error.message || "开通题库权限失败", error.statusCode || 400);
  }
});

bookQuestionBankAdminRouter.delete("/books/:bookId/permissions/:userId", async (req, res) => {
  try {
    const result = await revokeAdminBookQuestionBankPermission({
      db: prisma,
      bookId: `${req.params.bookId ?? ""}`.trim(),
      userId: `${req.params.userId ?? ""}`.trim(),
    });

    recordAdminAction(req, {
      action: "book_question_bank_permission.revoke",
      entityType: "book_question_bank",
      entityId: `${req.params.bookId ?? ""}`.trim(),
      detail: {
        userId: `${req.params.userId ?? ""}`.trim(),
      },
    });

    return ok(res, result, "题库权限已移除");
  } catch (error) {
    return fail(res, error.message || "移除题库权限失败", error.statusCode || 400);
  }
});
