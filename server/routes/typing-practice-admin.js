import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { writeAdminAuditLog } from "../lib/audit.js";
import { fail, ok } from "../lib/response.js";
import {
  createTypingPracticeFolder,
  createTypingPracticeText,
  deleteTypingPracticeFolder,
  deleteTypingPracticeText,
  getTypingPracticeDifficultyConfigs,
  getTypingPracticeHomeConfig,
  getTypingPracticeSummary,
  listTypingPracticeFolders,
  listTypingPracticeTexts,
  updateTypingPracticeDifficultyConfigs,
  updateTypingPracticeFolder,
  updateTypingPracticeHomeConfig,
  updateTypingPracticeText,
} from "../lib/typing-practice.js";
import { requireAdminAuth, requireAdminRoles } from "../middleware/auth.js";

export const typingPracticeAdminRouter = Router();

typingPracticeAdminRouter.use(requireAdminAuth);
typingPracticeAdminRouter.use(requireAdminRoles("super_admin", "operations_admin"));

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(`${value ?? ""}`.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const readPagination = (query) => {
  const page = toPositiveInt(query?.page, 1);
  const pageSize = Math.min(toPositiveInt(query?.pageSize, 20), 50);
  return { page, pageSize };
};

const recordAdminAction = (req, payload) => {
  void writeAdminAuditLog(req, payload).catch((error) => {
    console.error("Audit log write failed:", error);
  });
};

typingPracticeAdminRouter.get("/summary", async (_req, res) => {
  try {
    return ok(
      res,
      await getTypingPracticeSummary({
        db: prisma,
      }),
    );
  } catch (error) {
    return fail(res, error.message || "加载打字练习概览失败", error.statusCode || 400);
  }
});

typingPracticeAdminRouter.get("/difficulty-configs", async (_req, res) => {
  try {
    return ok(
      res,
      await getTypingPracticeDifficultyConfigs({
        db: prisma,
      }),
    );
  } catch (error) {
    return fail(res, error.message || "加载难度配置失败", error.statusCode || 400);
  }
});

typingPracticeAdminRouter.get("/home-config", async (_req, res) => {
  try {
    return ok(
      res,
      await getTypingPracticeHomeConfig({
        db: prisma,
      }),
    );
  } catch (error) {
    return fail(res, error.message || "加载首页配置失败", error.statusCode || 400);
  }
});

typingPracticeAdminRouter.patch("/home-config", async (req, res) => {
  try {
    const nextConfig = await updateTypingPracticeHomeConfig({
      db: prisma,
      config: req.body?.config,
    });

    recordAdminAction(req, {
      action: "typing_practice_home_config_update",
      entityType: "typing_practice_home_config",
      entityId: "system:typing-practice-home",
      entityName: "打字练习首页配置",
      detail: {
        title: nextConfig.hero.title,
        englishTitle: nextConfig.hero.englishTitle,
      },
    });

    return ok(res, nextConfig, "首页配置已更新");
  } catch (error) {
    return fail(res, error.message || "保存首页配置失败", error.statusCode || 400);
  }
});

typingPracticeAdminRouter.patch("/difficulty-configs", async (req, res) => {
  try {
    const configs = await updateTypingPracticeDifficultyConfigs({
      db: prisma,
      items: req.body?.items,
    });

    recordAdminAction(req, {
      action: "typing_practice_difficulty_update",
      entityType: "typing_practice_difficulty_config",
      entityId: "system:typing-practice",
      entityName: "打字练习难度配置",
      detail: {
        items: configs.map((item) => ({
          difficulty: item.difficulty,
          initialLives: item.initialLives,
          baseStageTimeSeconds: item.baseStageTimeSeconds,
          thiefSpeedBase: item.thiefSpeedBase,
        })),
      },
    });

    return ok(res, configs, "难度配置已更新");
  } catch (error) {
    return fail(res, error.message || "更新难度配置失败", error.statusCode || 400);
  }
});

typingPracticeAdminRouter.get("/folders", async (_req, res) => {
  try {
    return ok(
      res,
      await listTypingPracticeFolders({
        db: prisma,
      }),
    );
  } catch (error) {
    return fail(res, error.message || "加载文件夹失败", error.statusCode || 400);
  }
});

typingPracticeAdminRouter.post("/folders", async (req, res) => {
  try {
    const folder = await createTypingPracticeFolder({
      db: prisma,
      name: req.body?.name,
      sortOrder: req.body?.sortOrder,
    });

    recordAdminAction(req, {
      action: "typing_practice_folder_create",
      entityType: "typing_practice_folder",
      entityId: folder.id,
      entityName: folder.name,
    });

    return ok(res, folder, "文件夹已创建");
  } catch (error) {
    return fail(res, error.message || "创建文件夹失败", error.statusCode || 400);
  }
});

typingPracticeAdminRouter.patch("/folders/:folderId", async (req, res) => {
  try {
    const folder = await updateTypingPracticeFolder({
      db: prisma,
      folderId: `${req.params.folderId ?? ""}`.trim(),
      name: req.body?.name,
      sortOrder: req.body?.sortOrder,
    });

    recordAdminAction(req, {
      action: "typing_practice_folder_update",
      entityType: "typing_practice_folder",
      entityId: folder.id,
      entityName: folder.name,
    });

    return ok(res, folder, "文件夹已更新");
  } catch (error) {
    return fail(res, error.message || "更新文件夹失败", error.statusCode || 400);
  }
});

typingPracticeAdminRouter.delete("/folders/:folderId", async (req, res) => {
  try {
    const folderId = `${req.params.folderId ?? ""}`.trim();
    const result = await deleteTypingPracticeFolder({
      db: prisma,
      folderId,
    });

    recordAdminAction(req, {
      action: "typing_practice_folder_delete",
      entityType: "typing_practice_folder",
      entityId: folderId,
    });

    return ok(res, result, "文件夹已删除");
  } catch (error) {
    return fail(res, error.message || "删除文件夹失败", error.statusCode || 400);
  }
});

typingPracticeAdminRouter.get("/texts", async (req, res) => {
  try {
    const { page, pageSize } = readPagination(req.query);
    return ok(
      res,
      await listTypingPracticeTexts({
        db: prisma,
        folderId: `${req.query?.folderId ?? ""}`.trim(),
        keyword: `${req.query?.keyword ?? ""}`.trim(),
        status: `${req.query?.status ?? ""}`.trim(),
        page,
        pageSize,
      }),
    );
  } catch (error) {
    return fail(res, error.message || "加载练习文本失败", error.statusCode || 400);
  }
});

typingPracticeAdminRouter.post("/texts", async (req, res) => {
  try {
    const text = await createTypingPracticeText({
      db: prisma,
      payload: req.body,
    });

    recordAdminAction(req, {
      action: "typing_practice_text_create",
      entityType: "typing_practice_text",
      entityId: text.id,
      entityName: text.title,
      detail: {
        folderId: text.folderId,
        status: text.status,
        difficulty: text.difficulty,
      },
    });

    return ok(res, text, "练习文本已创建");
  } catch (error) {
    return fail(res, error.message || "创建练习文本失败", error.statusCode || 400);
  }
});

typingPracticeAdminRouter.patch("/texts/:textId", async (req, res) => {
  try {
    const text = await updateTypingPracticeText({
      db: prisma,
      textId: `${req.params.textId ?? ""}`.trim(),
      payload: req.body,
    });

    recordAdminAction(req, {
      action: "typing_practice_text_update",
      entityType: "typing_practice_text",
      entityId: text.id,
      entityName: text.title,
      detail: {
        folderId: text.folderId,
        status: text.status,
        difficulty: text.difficulty,
      },
    });

    return ok(res, text, "练习文本已更新");
  } catch (error) {
    return fail(res, error.message || "更新练习文本失败", error.statusCode || 400);
  }
});

typingPracticeAdminRouter.delete("/texts/:textId", async (req, res) => {
  try {
    const textId = `${req.params.textId ?? ""}`.trim();
    const result = await deleteTypingPracticeText({
      db: prisma,
      textId,
    });

    recordAdminAction(req, {
      action: "typing_practice_text_delete",
      entityType: "typing_practice_text",
      entityId: textId,
    });

    return ok(res, result, "练习文本已删除");
  } catch (error) {
    return fail(res, error.message || "删除练习文本失败", error.statusCode || 400);
  }
});
