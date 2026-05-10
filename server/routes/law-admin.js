import { Router } from "express";
import { fail, ok } from "../lib/response.js";
import { getLawAdminEntries, getLawAdminSummary, updateLawAdminEntry } from "../lib/law.js";
import { syncLawEntries } from "../lib/law-sync.js";
import { requireAdminAuth, requireAdminRoles } from "../middleware/auth.js";

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(`${value ?? ""}`, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const lawAdminRouter = Router();

lawAdminRouter.use(requireAdminAuth);
lawAdminRouter.use(requireAdminRoles("super_admin", "operations_admin"));

lawAdminRouter.get("/summary", async (_req, res) => {
  return ok(res, await getLawAdminSummary());
});

lawAdminRouter.get("/entries", async (req, res) => {
  return ok(
    res,
    await getLawAdminEntries({
      keyword: `${req.query?.keyword ?? ""}`.trim(),
      topCategoryId: `${req.query?.topCategoryId ?? ""}`.trim(),
      visibility: `${req.query?.visibility ?? "all"}`.trim(),
      pinnedOnly: `${req.query?.pinnedOnly ?? ""}`.trim() === "true",
      page: toPositiveInt(req.query?.page, 1),
      pageSize: toPositiveInt(req.query?.pageSize, 20),
    }),
  );
});

lawAdminRouter.patch("/entries/:sourceLawId", async (req, res) => {
  return ok(
    res,
    await updateLawAdminEntry(req.params.sourceLawId, {
      isPublished: req.body?.isPublished,
      isPinned: req.body?.isPinned,
      manualSortOrder: req.body?.manualSortOrder,
      customTitle: req.body?.customTitle,
      tags: req.body?.tags,
      operatorNote: req.body?.operatorNote,
    }),
    "法条运营配置已更新",
  );
});

lawAdminRouter.post("/sync", async (_req, res) => {
  try {
    return ok(
      res,
      await syncLawEntries({
        source: "remote",
      }),
      "法条数据同步完成",
    );
  } catch (error) {
    return fail(res, error.message || "法条数据同步失败", 500);
  }
});
