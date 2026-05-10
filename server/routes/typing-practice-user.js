import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { fail, ok } from "../lib/response.js";
import {
  createTypingPracticeRecord,
  getTypingPracticeHome,
  getTypingPracticeLeaderboard,
  getTypingPracticeRecordForUser,
  getTypingPracticeTextForUser,
  listTypingPracticeRecordsForUser,
} from "../lib/typing-practice.js";
import { requireUserAuth } from "../middleware/auth.js";

export const typingPracticeUserRouter = Router();

typingPracticeUserRouter.use(requireUserAuth);

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(`${value ?? ""}`.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

typingPracticeUserRouter.get("/home", async (req, res) => {
  try {
    return ok(
      res,
      await getTypingPracticeHome({
        db: prisma,
        userId: req.auth.userId,
      }),
    );
  } catch (error) {
    return fail(res, error.message || "加载打字练习首页失败", error.statusCode || 400);
  }
});

typingPracticeUserRouter.get("/leaderboard", async (req, res) => {
  try {
    return ok(
      res,
      await getTypingPracticeLeaderboard({
        db: prisma,
        limit: toPositiveInt(req.query?.limit, 10),
      }),
    );
  } catch (error) {
    return fail(res, error.message || "加载排行榜失败", error.statusCode || 400);
  }
});

typingPracticeUserRouter.get("/texts/:textId", async (req, res) => {
  try {
    return ok(
      res,
      await getTypingPracticeTextForUser({
        db: prisma,
        textId: `${req.params.textId ?? ""}`.trim(),
        mode: `${req.query?.mode ?? ""}`.trim(),
        difficulty: `${req.query?.difficulty ?? ""}`.trim(),
        timeLimitSeconds: toPositiveInt(req.query?.limit, 180),
      }),
    );
  } catch (error) {
    return fail(res, error.message || "加载练习文本失败", error.statusCode || 400);
  }
});

typingPracticeUserRouter.get("/records", async (req, res) => {
  try {
    return ok(
      res,
      await listTypingPracticeRecordsForUser({
        db: prisma,
        userId: req.auth.userId,
        page: toPositiveInt(req.query?.page, 1),
        pageSize: Math.min(toPositiveInt(req.query?.pageSize, 10), 50),
      }),
    );
  } catch (error) {
    return fail(res, error.message || "加载练习记录失败", error.statusCode || 400);
  }
});

typingPracticeUserRouter.post("/records", async (req, res) => {
  try {
    return ok(
      res,
      await createTypingPracticeRecord({
        db: prisma,
        userId: req.auth.userId,
        payload: req.body,
      }),
      "练习记录已保存",
    );
  } catch (error) {
    return fail(res, error.message || "保存练习记录失败", error.statusCode || 400);
  }
});

typingPracticeUserRouter.get("/records/:recordId", async (req, res) => {
  try {
    return ok(
      res,
      await getTypingPracticeRecordForUser({
        db: prisma,
        userId: req.auth.userId,
        recordId: `${req.params.recordId ?? ""}`.trim(),
      }),
    );
  } catch (error) {
    return fail(res, error.message || "加载练习记录失败", error.statusCode || 400);
  }
});
