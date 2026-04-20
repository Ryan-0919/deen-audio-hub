import { readFile } from "node:fs/promises";
import { prisma } from "./prisma.js";
import { normalizeDisplayText } from "./text.js";

const REMOTE_API_BASE = "https://online-web-api-cdn.zhongheschool.com/api/laws";
const REMOTE_API_HEADERS = {
  Accept: "application/json, text/plain, */*",
  channel: "zhumaWeb",
  clientType: "web",
  appName: "zhuma",
  "User-Agent": "Mozilla/5.0",
};

const sleep = (delayMs) => new Promise((resolvePromise) => setTimeout(resolvePromise, delayMs));

const toInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(`${value ?? ""}`, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizePathTitles = (pathTitles, topCategoryTitle, title) => {
  const normalized = (Array.isArray(pathTitles) ? pathTitles : [])
    .map((item) => normalizeDisplayText(item))
    .filter(Boolean);

  if (normalized.length > 0) {
    return normalized;
  }

  const fallback = [normalizeDisplayText(topCategoryTitle), normalizeDisplayText(title)].filter(Boolean);
  return fallback;
};

const buildNodeMap = (tree = []) => {
  const nodeMap = new Map();

  const walk = (nodes = []) => {
    nodes.forEach((node) => {
      nodeMap.set(toInteger(node.id), node);
      walk(node.children ?? []);
    });
  };

  walk(tree);
  return nodeMap;
};

const buildPathTitles = (nodeId, nodeMap) => {
  const titles = [];
  let current = nodeMap.get(nodeId);

  while (current) {
    titles.push(normalizeDisplayText(current.title));
    const parentId = toInteger(current.parentId);
    if (!parentId) {
      break;
    }
    current = nodeMap.get(parentId);
  }

  return titles.reverse().filter(Boolean);
};

const fetchLawApi = async (endpoint, params = {}) => {
  const url = new URL(`${REMOTE_API_BASE}/${endpoint}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    url.searchParams.set(key, `${value}`);
  });

  const response = await fetch(url, {
    method: "GET",
    headers: REMOTE_API_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`法条接口请求失败: HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload?.code !== 200) {
    throw new Error(payload?.msg || "法条接口返回异常");
  }

  return payload.data;
};

const mapLawRecord = (record) => {
  const topCategoryTitle = normalizeDisplayText(record.top_category_title);
  const title = normalizeDisplayText(record.title);
  const pathTitles = normalizePathTitles(record.path_titles, topCategoryTitle, title);

  return {
    sourceLawId: toInteger(record.law_id),
    topCategoryId: toInteger(record.top_category_id),
    topCategoryTitle,
    bookTitle: normalizeDisplayText(pathTitles[1] ?? ""),
    title,
    pathString: normalizeDisplayText(record.path_string || pathTitles.join(" > ")),
    pathTitlesJson: JSON.stringify(pathTitles),
    content: normalizeDisplayText(record.content ?? ""),
    type: toInteger(record.type),
    sourceParentId: toInteger(record.parent_id) || null,
    sourceTopId: toInteger(record.top_id) || null,
    position: toInteger(record.position),
    sourceCreatedAt: toDate(record.created_at_iso),
  };
};

export const loadLawRecordsFromFile = async (filePath) => {
  const raw = JSON.parse(await readFile(filePath, "utf8"));
  const records = Array.isArray(raw?.records) ? raw.records : [];

  return {
    source: "file",
    sourceLabel: filePath,
    topLevelCategories: Array.isArray(raw?.top_level_categories) ? raw.top_level_categories : [],
    records: records.map(mapLawRecord),
  };
};

export const loadLawRecordsFromRemote = async ({ delayMs = 120 } = {}) => {
  const tree = await fetchLawApi("listV2");
  if (!Array.isArray(tree)) {
    throw new Error("法条目录数据异常");
  }

  const nodeMap = buildNodeMap(tree);
  const records = [];
  const seenLawIds = new Set();

  for (const topNode of tree) {
    const topCategoryId = toInteger(topNode.id);
    const topCategoryTitle = normalizeDisplayText(topNode.title);
    const detailItems = await fetchLawApi("infoV2", { id: topCategoryId });
    if (!Array.isArray(detailItems)) {
      throw new Error(`法条详情数据异常: ${topCategoryTitle}`);
    }

    detailItems.forEach((item) => {
      const sourceLawId = toInteger(item.id);
      if (!sourceLawId || seenLawIds.has(sourceLawId)) {
        return;
      }

      seenLawIds.add(sourceLawId);
      const title = normalizeDisplayText(item.title);
      const pathTitles = normalizePathTitles(buildPathTitles(sourceLawId, nodeMap), topCategoryTitle, title);

      records.push(
        mapLawRecord({
          top_category_id: topCategoryId,
          top_category_title: topCategoryTitle,
          law_id: sourceLawId,
          title,
          path_titles: pathTitles,
          path_string: pathTitles.join(" > "),
          type: item.type,
          parent_id: item.parentId,
          position: item.position,
          top_id: item.topId,
          created_at_iso: item.createdAt ? new Date(item.createdAt).toISOString() : "",
          content: item.content ?? "",
        }),
      );
    });

    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }

  records.sort((left, right) => {
    if (left.topCategoryId !== right.topCategoryId) {
      return left.topCategoryId - right.topCategoryId;
    }
    if (left.position !== right.position) {
      return left.position - right.position;
    }
    return left.sourceLawId - right.sourceLawId;
  });

  return {
    source: "remote",
    sourceLabel: REMOTE_API_BASE,
    topLevelCategories: tree.map((item) => ({
      id: toInteger(item.id),
      title: normalizeDisplayText(item.title),
    })),
    records,
  };
};

export const replaceLawEntries = async ({ records = [], topLevelCategories = [], source = "remote", sourceLabel = "" }) => {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("未获取到法条数据，未执行导入");
  }

  await prisma.$transaction([
    prisma.lawEntry.deleteMany(),
    prisma.lawEntry.createMany({
      data: records,
    }),
  ]);

  return {
    source,
    sourceLabel,
    totalRecords: records.length,
    topCategoryCount: topLevelCategories.length || new Set(records.map((item) => item.topCategoryId)).size,
    syncedAt: new Date().toISOString(),
  };
};

export const syncLawEntries = async ({ source = "remote", filePath = "", delayMs = 120 } = {}) => {
  const payload =
    source === "file"
      ? await loadLawRecordsFromFile(filePath)
      : await loadLawRecordsFromRemote({
          delayMs,
        });

  return replaceLawEntries(payload);
};
