import { Router } from "express";
import { fail, ok } from "../lib/response.js";
import { getLawContentByNode, getLawOverview, searchLawEntries } from "../lib/law.js";
import { requireUserAuth } from "../middleware/auth.js";

export const lawUserRouter = Router();

lawUserRouter.use(requireUserAuth);

lawUserRouter.get("/overview", async (_req, res) => {
  return ok(res, await getLawOverview());
});

lawUserRouter.get("/content", async (req, res) => {
  const nodeId = `${req.query?.nodeId ?? ""}`.trim();
  if (!nodeId) {
    return fail(res, "缺少法条节点参数", 400);
  }

  const payload = await getLawContentByNode(nodeId);
  if (!payload) {
    return fail(res, "法条内容不存在", 404);
  }

  return ok(res, payload);
});

lawUserRouter.get("/search", async (req, res) => {
  const keyword = `${req.query?.keyword ?? ""}`.trim();
  return ok(
    res,
    keyword
      ? await searchLawEntries({
          keyword,
        })
      : [],
  );
});
