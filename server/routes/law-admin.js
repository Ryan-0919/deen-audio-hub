import { Router } from "express";
import { fail, ok } from "../lib/response.js";
import { getLawAdminEntries, getLawAdminSummary } from "../lib/law.js";
import { syncLawEntries } from "../lib/law-sync.js";
import { requireAdminAuth } from "../middleware/auth.js";

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(`${value ?? ""}`, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const lawAdminRouter = Router();

lawAdminRouter.use(requireAdminAuth);

lawAdminRouter.get("/summary", async (_req, res) => {
  return ok(res, await getLawAdminSummary());
});

lawAdminRouter.get("/entries", async (req, res) => {
  return ok(
    res,
    await getLawAdminEntries({
      keyword: `${req.query?.keyword ?? ""}`.trim(),
      topCategoryId: `${req.query?.topCategoryId ?? ""}`.trim(),
      page: toPositiveInt(req.query?.page, 1),
      pageSize: toPositiveInt(req.query?.pageSize, 20),
    }),
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
