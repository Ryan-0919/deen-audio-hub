import { Router } from "express";
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
  listAdminBookQuestionBankAvailableItems,
  listAdminBookQuestionBankItems,
  listAdminBookQuestionBankPermissions,
  listAdminBookQuestionBanks,
  listAdminBookQuestionBankSubjects,
  revokeAdminBookQuestionBankPermission,
  updateAdminBookQuestionBank,
  updateAdminBookQuestionBankItem,
  updateAdminBookQuestionBankSubject,
} from "../lib/book-question-bank.js";
import { prisma } from "../lib/prisma.js";
import { fail, ok } from "../lib/response.js";
import { validatePhoneOrThrow } from "../lib/security.js";
import { requireAdminAuth, requireAdminRoles } from "../middleware/auth.js";

export const bookQuestionBankAdminRouter = Router();

bookQuestionBankAdminRouter.use(requireAdminAuth);
bookQuestionBankAdminRouter.use(requireAdminRoles("super_admin", "operations_admin"));

const recordAdminAction = (req, payload) => {
  void writeAdminAuditLog(req, payload).catch((error) => {
    console.error("Audit log write failed:", error);
  });
};

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(`${value ?? ""}`, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

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

bookQuestionBankAdminRouter.get("/available-items", async (req, res) => {
  try {
    return ok(
      res,
      await listAdminBookQuestionBankAvailableItems({
        db: prisma,
        paperType: `${req.query?.paperType ?? ""}`.trim(),
        folderId: `${req.query?.folderId ?? ""}`.trim(),
        keyword: `${req.query?.keyword ?? ""}`.trim(),
        page: toPositiveInt(req.query?.page, 1),
        pageSize: Math.min(toPositiveInt(req.query?.pageSize, 20), 50),
      }),
    );
  } catch (error) {
    return fail(res, error.message || "加载可选题目失败", error.statusCode || 400);
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
      }),
    );
  } catch (error) {
    return fail(res, error.message || "加载题目映射失败", error.statusCode || 400);
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

    return ok(res, item, "题目已加入书籍题库");
  } catch (error) {
    return fail(res, error.message || "添加题目失败", error.statusCode || 400);
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

    return ok(res, item, "题目映射已更新");
  } catch (error) {
    return fail(res, error.message || "更新题目映射失败", error.statusCode || 400);
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

    return ok(res, result, "题目已移除");
  } catch (error) {
    return fail(res, error.message || "删除题目映射失败", error.statusCode || 400);
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
