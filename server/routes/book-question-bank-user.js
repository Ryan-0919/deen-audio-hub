import { Router } from "express";
import {
  getUserBookQuestionBankDetail,
  getUserBookQuestionBankPractice,
  getUserBookQuestionBankResumeTarget,
  listUserBookQuestionBanks,
  markUserBookQuestionBankViewedAnswer,
  saveUserBookQuestionBankPracticeAnswer,
  updateUserBookQuestionBankPracticeState,
} from "../lib/book-question-bank.js";
import { prisma } from "../lib/prisma.js";
import { fail, ok } from "../lib/response.js";
import { requireUserAuth } from "../middleware/auth.js";

export const bookQuestionBankUserRouter = Router();

bookQuestionBankUserRouter.use(requireUserAuth);

bookQuestionBankUserRouter.get("/books", async (req, res) => {
  try {
    return ok(
      res,
      await listUserBookQuestionBanks({
        db: prisma,
        userId: req.auth.userId,
      }),
    );
  } catch (error) {
    return fail(res, error.message || "加载我的题库失败", error.statusCode || 400);
  }
});

bookQuestionBankUserRouter.get("/books/:bookId", async (req, res) => {
  try {
    return ok(
      res,
      await getUserBookQuestionBankDetail({
        db: prisma,
        userId: req.auth.userId,
        bookId: `${req.params.bookId ?? ""}`.trim(),
        subjectId: `${req.query?.subjectId ?? ""}`.trim(),
        statusFilter: `${req.query?.statusFilter ?? "all"}`.trim(),
      }),
    );
  } catch (error) {
    return fail(res, error.message || "加载题库详情失败", error.statusCode || 400);
  }
});

bookQuestionBankUserRouter.get("/books/:bookId/resume", async (req, res) => {
  try {
    return ok(
      res,
      await getUserBookQuestionBankResumeTarget({
        db: prisma,
        userId: req.auth.userId,
        bookId: `${req.params.bookId ?? ""}`.trim(),
      }),
    );
  } catch (error) {
    return fail(res, error.message || "获取继续练习位置失败", error.statusCode || 400);
  }
});

bookQuestionBankUserRouter.get("/books/:bookId/items/:bookItemId", async (req, res) => {
  try {
    return ok(
      res,
      await getUserBookQuestionBankPractice({
        db: prisma,
        userId: req.auth.userId,
        bookId: `${req.params.bookId ?? ""}`.trim(),
        bookItemId: `${req.params.bookItemId ?? ""}`.trim(),
      }),
    );
  } catch (error) {
    return fail(res, error.message || "加载练习题目失败", error.statusCode || 400);
  }
});

bookQuestionBankUserRouter.patch("/books/:bookId/items/:bookItemId/answer", async (req, res) => {
  try {
    return ok(
      res,
      await saveUserBookQuestionBankPracticeAnswer({
        db: prisma,
        userId: req.auth.userId,
        bookId: `${req.params.bookId ?? ""}`.trim(),
        bookItemId: `${req.params.bookItemId ?? ""}`.trim(),
        answerJson: req.body?.answerJson,
        draftText: req.body?.draftText,
      }),
      "答案已保存",
    );
  } catch (error) {
    return fail(res, error.message || "保存答案失败", error.statusCode || 400);
  }
});

bookQuestionBankUserRouter.post("/books/:bookId/items/:bookItemId/view-answer", async (req, res) => {
  try {
    return ok(
      res,
      await markUserBookQuestionBankViewedAnswer({
        db: prisma,
        userId: req.auth.userId,
        bookId: `${req.params.bookId ?? ""}`.trim(),
        bookItemId: `${req.params.bookItemId ?? ""}`.trim(),
      }),
      "已记录查看答案",
    );
  } catch (error) {
    return fail(res, error.message || "记录查看答案失败", error.statusCode || 400);
  }
});

bookQuestionBankUserRouter.patch("/books/:bookId/items/:bookItemId/state", async (req, res) => {
  try {
    return ok(
      res,
      await updateUserBookQuestionBankPracticeState({
        db: prisma,
        userId: req.auth.userId,
        bookId: `${req.params.bookId ?? ""}`.trim(),
        bookItemId: `${req.params.bookItemId ?? ""}`.trim(),
        isMastered: req.body?.isMastered,
        isRedoMarked: req.body?.isRedoMarked,
      }),
      "练习状态已更新",
    );
  } catch (error) {
    return fail(res, error.message || "更新练习状态失败", error.statusCode || 400);
  }
});
