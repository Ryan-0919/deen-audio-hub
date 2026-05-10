import { prisma } from "./prisma.js";
import { formatDateTime } from "./time.js";
import { normalizeDisplayText } from "./text.js";

const lawEntryMetaSelect = {
  id: true,
  sourceLawId: true,
  topCategoryId: true,
  topCategoryTitle: true,
  bookTitle: true,
  title: true,
  pathString: true,
  pathTitlesJson: true,
  type: true,
  position: true,
  updatedAt: true,
};

const lawEntryContentSelect = {
  ...lawEntryMetaSelect,
  content: true,
};

const lawEntryOperationSelect = {
  sourceLawId: true,
  isPublished: true,
  isPinned: true,
  manualSortOrder: true,
  tagsJson: true,
  operatorNote: true,
  customTitle: true,
  updatedAt: true,
};

const parseJsonArray = (value) => {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
};

const parseLawOperationTags = (value) =>
  parseJsonArray(value)
    .map((item) => normalizeDisplayText(item))
    .filter(Boolean);

const parseLawTagsInput = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeDisplayText(item)).filter(Boolean);
  }

  return `${value ?? ""}`
    .split(/[\n,，、]/)
    .map((item) => normalizeDisplayText(item))
    .filter(Boolean);
};

const normalizeLawOperation = (operation) => ({
  sourceLawId: Number(operation?.sourceLawId ?? 0),
  isPublished: operation?.isPublished !== false,
  isPinned: operation?.isPinned === true,
  manualSortOrder: Number.isFinite(Number(operation?.manualSortOrder)) ? Math.max(0, Number(operation.manualSortOrder)) : 0,
  tags: parseLawOperationTags(operation?.tagsJson),
  operatorNote: normalizeDisplayText(operation?.operatorNote ?? ""),
  customTitle: normalizeDisplayText(operation?.customTitle ?? ""),
  updatedAt: operation?.updatedAt ?? null,
});

const buildLawOperationMap = async (sourceLawIds = []) => {
  if (!Array.isArray(sourceLawIds) || sourceLawIds.length === 0) {
    return new Map();
  }

  const operations = await prisma.lawEntryOperation.findMany({
    where: {
      sourceLawId: {
        in: Array.from(new Set(sourceLawIds.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0))),
      },
    },
    select: lawEntryOperationSelect,
  });

  return new Map(operations.map((item) => [item.sourceLawId, normalizeLawOperation(item)]));
};

const hydrateLawEntry = (entry, operationMap) => {
  const operation = normalizeLawOperation(operationMap?.get(entry.sourceLawId) ?? null);
  const displayTitle = normalizeDisplayText(operation.customTitle || entry.title);

  return {
    ...entry,
    displayTitle,
    isPublished: operation.isPublished,
    isPinned: operation.isPinned,
    manualSortOrder: operation.manualSortOrder,
    tags: operation.tags,
    operatorNote: operation.operatorNote,
    customTitle: operation.customTitle,
    operationUpdatedAt: operation.updatedAt,
  };
};

const hydrateLawEntries = async (entries = []) => {
  const operationMap = await buildLawOperationMap(entries.map((item) => item.sourceLawId));
  return entries.map((entry) => hydrateLawEntry(entry, operationMap));
};

const compareManualSortOrder = (left, right) => {
  const leftValue = Number(left?.manualSortOrder ?? 0);
  const rightValue = Number(right?.manualSortOrder ?? 0);
  const leftRank = leftValue > 0 ? leftValue : Number.MAX_SAFE_INTEGER;
  const rightRank = rightValue > 0 ? rightValue : Number.MAX_SAFE_INTEGER;

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  return 0;
};

const sortLawEntries = (left, right) => {
  if (left.topCategoryId !== right.topCategoryId) {
    return left.topCategoryId - right.topCategoryId;
  }

  if (left.isPinned !== right.isPinned) {
    return left.isPinned ? -1 : 1;
  }

  const manualSortDelta = compareManualSortOrder(left, right);
  if (manualSortDelta !== 0) {
    return manualSortDelta;
  }

  if ((left.position ?? 0) !== (right.position ?? 0)) {
    return (left.position ?? 0) - (right.position ?? 0);
  }

  return (left.sourceLawId ?? 0) - (right.sourceLawId ?? 0);
};

export const parseLawPathTitles = (value) =>
  parseJsonArray(value)
    .map((item) => normalizeDisplayText(item))
    .filter(Boolean);

export const buildLawPathNodeId = (pathLabels = []) => `path:${pathLabels.map((item) => encodeURIComponent(item)).join("/")}`;

export const buildLawRecordNodeId = (recordId) => `record:${recordId}`;

export const parseLawNodeId = (nodeId = "") => {
  if (nodeId.startsWith("record:")) {
    return {
      type: "record",
      recordId: nodeId.slice("record:".length),
      pathLabels: [],
    };
  }

  if (nodeId.startsWith("path:")) {
    const encoded = nodeId.slice("path:".length);
    const pathLabels = encoded
      .split("/")
      .filter(Boolean)
      .map((item) => normalizeDisplayText(decodeURIComponent(item)))
      .filter(Boolean);

    return {
      type: "path",
      recordId: "",
      pathLabels,
    };
  }

  return {
    type: "unknown",
    recordId: "",
    pathLabels: [],
  };
};

const attachRecordCounts = (nodes = []) =>
  nodes.map((node) => {
    if (node.nodeType === "record") {
      return {
        ...node,
        recordCount: 1,
      };
    }

    const children = attachRecordCounts(node.children ?? []);
    return {
      ...node,
      children,
      recordCount: children.reduce((sum, item) => sum + (item.recordCount ?? 0), 0),
    };
  });

export const buildLawTree = (entries = []) => {
  const root = [];
  const folderMap = new Map();

  for (const entry of [...entries].sort(sortLawEntries)) {
    const pathLabels = parseLawPathTitles(entry.pathTitlesJson);
    const folderLabels = pathLabels.slice(0, Math.max(pathLabels.length - 1, 0));
    let currentChildren = root;

    folderLabels.forEach((label, index) => {
      const currentPath = folderLabels.slice(0, index + 1);
      const nodeId = buildLawPathNodeId(currentPath);
      let folder = folderMap.get(nodeId);

      if (!folder) {
        folder = {
          id: nodeId,
          title: normalizeDisplayText(label),
          nodeType: "folder",
          pathLabels: currentPath,
          children: [],
          recordCount: 0,
        };
        folderMap.set(nodeId, folder);
        currentChildren.push(folder);
      }

      currentChildren = folder.children;
    });

    currentChildren.push({
      id: buildLawRecordNodeId(entry.id),
      title: normalizeDisplayText(entry.displayTitle ?? entry.title),
      nodeType: "record",
      pathLabels,
      recordId: entry.id,
      recordCount: 1,
    });
  }

  return attachRecordCounts(root);
};

const serializeLawEntryMeta = (entry) => {
  const pathLabels = parseLawPathTitles(entry.pathTitlesJson);

  return {
    id: entry.id,
    sourceLawId: entry.sourceLawId,
    topCategoryId: entry.topCategoryId,
    topCategoryTitle: normalizeDisplayText(entry.topCategoryTitle),
    bookTitle: normalizeDisplayText(entry.bookTitle ?? ""),
    title: normalizeDisplayText(entry.title),
    displayTitle: normalizeDisplayText(entry.displayTitle ?? entry.title),
    customTitle: normalizeDisplayText(entry.customTitle ?? ""),
    pathLabels,
    pathString: normalizeDisplayText(entry.pathString),
    isPublished: entry.isPublished !== false,
    isPinned: entry.isPinned === true,
    manualSortOrder: Number(entry.manualSortOrder ?? 0),
    tags: Array.isArray(entry.tags) ? entry.tags : [],
    operatorNote: normalizeDisplayText(entry.operatorNote ?? ""),
    updatedAt: formatDateTime(entry.updatedAt),
  };
};

export const serializeLawContentItem = (entry) => ({
  ...serializeLawEntryMeta(entry),
  content: normalizeDisplayText(entry.content ?? ""),
});

export const serializeLawSearchResult = (entry, keyword) => {
  const normalizedKeyword = normalizeDisplayText(keyword);
  const content = normalizeDisplayText(entry.content ?? "");
  const normalizedContent = content.replace(/\s+/g, " ");
  const index = normalizedKeyword ? normalizedContent.indexOf(normalizedKeyword) : -1;
  const snippet =
    index >= 0
      ? normalizedContent.slice(Math.max(0, index - 36), Math.min(normalizedContent.length, index + normalizedKeyword.length + 72))
      : normalizedContent.slice(0, 120);

  return {
    ...serializeLawEntryMeta(entry),
    snippet,
  };
};

export const listLawEntriesForNode = (entries = [], nodeId = "") => {
  const parsed = parseLawNodeId(nodeId);

  if (parsed.type === "record") {
    const entry = entries.find((item) => item.id === parsed.recordId);
    if (!entry) {
      return null;
    }

    const pathLabels = parseLawPathTitles(entry.pathTitlesJson);
    return {
      nodeId,
      nodeType: "record",
      nodeTitle: normalizeDisplayText(entry.displayTitle ?? entry.title),
      pathLabels,
      items: [serializeLawContentItem(entry)],
      total: 1,
    };
  }

  if (parsed.type === "path") {
    const matched = entries
      .filter((entry) => {
        const pathLabels = parseLawPathTitles(entry.pathTitlesJson);
        return parsed.pathLabels.every((label, index) => pathLabels[index] === label);
      })
      .sort(sortLawEntries);

    if (matched.length === 0) {
      return null;
    }

    return {
      nodeId,
      nodeType: "folder",
      nodeTitle: parsed.pathLabels[parsed.pathLabels.length - 1] ?? "",
      pathLabels: parsed.pathLabels,
      items: matched.map(serializeLawContentItem),
      total: matched.length,
    };
  }

  return null;
};

const getPublishedHydratedLawEntries = async ({ selectContent = false } = {}) => {
  const entries = await prisma.lawEntry.findMany({
    select: selectContent ? lawEntryContentSelect : lawEntryMetaSelect,
    orderBy: [{ topCategoryId: "asc" }, { position: "asc" }, { sourceLawId: "asc" }],
  });

  const hydrated = await hydrateLawEntries(entries);
  return hydrated.filter((entry) => entry.isPublished !== false).sort(sortLawEntries);
};

export const getLawOverview = async () => {
  const entries = await getPublishedHydratedLawEntries();
  const tree = buildLawTree(entries);

  const lastUpdated = entries.reduce((latest, entry) => {
    if (!entry.updatedAt) return latest;
    if (!latest || entry.updatedAt.getTime() > latest.getTime()) {
      return entry.updatedAt;
    }
    return latest;
  }, null);

  return {
    tree,
    totalRecords: entries.length,
    topCategoryCount: new Set(entries.map((entry) => entry.topCategoryId)).size,
    lastUpdated: lastUpdated ? formatDateTime(lastUpdated) : "",
    initialNodeId: tree[0]?.id ?? "",
  };
};

export const getLawContentByNode = async (nodeId) => {
  const parsed = parseLawNodeId(nodeId);

  if (parsed.type === "record") {
    const entry = await prisma.lawEntry.findUnique({
      where: { id: parsed.recordId },
      select: lawEntryContentSelect,
    });

    if (!entry) {
      return null;
    }

    const hydrated = (await hydrateLawEntries([entry]))[0];
    if (!hydrated || hydrated.isPublished === false) {
      return null;
    }

    return listLawEntriesForNode([hydrated], nodeId);
  }

  if (parsed.type === "path") {
    const entries = await getPublishedHydratedLawEntries({
      selectContent: true,
    });

    return listLawEntriesForNode(entries, nodeId);
  }

  return null;
};

const matchesLawKeyword = (entry, normalizedKeyword) => {
  if (!normalizedKeyword) {
    return true;
  }

  return [
    entry.title,
    entry.displayTitle,
    entry.customTitle,
    entry.bookTitle,
    entry.pathString,
    entry.operatorNote,
    Array.isArray(entry.tags) ? entry.tags.join(" ") : "",
  ].some((item) => normalizeDisplayText(item ?? "").includes(normalizedKeyword));
};

const findMatchingOperationSourceLawIds = async (keyword) => {
  const normalizedKeyword = normalizeDisplayText(keyword);
  if (!normalizedKeyword) {
    return [];
  }

  const operations = await prisma.lawEntryOperation.findMany({
    where: {
      OR: [
        {
          customTitle: {
            contains: normalizedKeyword,
          },
        },
        {
          tagsJson: {
            contains: normalizedKeyword,
          },
        },
        {
          operatorNote: {
            contains: normalizedKeyword,
          },
        },
      ],
    },
    select: {
      sourceLawId: true,
    },
  });

  return operations.map((item) => item.sourceLawId);
};

export const searchLawEntries = async ({ keyword = "", limit = 50 } = {}) => {
  const normalizedKeyword = normalizeDisplayText(keyword);
  if (!normalizedKeyword) {
    return [];
  }

  const operationMatchIds = await findMatchingOperationSourceLawIds(normalizedKeyword);
  const entries = await prisma.lawEntry.findMany({
    where: {
      OR: [
        {
          title: {
            contains: normalizedKeyword,
          },
        },
        {
          bookTitle: {
            contains: normalizedKeyword,
          },
        },
        {
          pathString: {
            contains: normalizedKeyword,
          },
        },
        {
          content: {
            contains: normalizedKeyword,
          },
        },
        ...(operationMatchIds.length > 0
          ? [
              {
                sourceLawId: {
                  in: operationMatchIds,
                },
              },
            ]
          : []),
      ],
    },
    select: lawEntryContentSelect,
    orderBy: [{ topCategoryId: "asc" }, { position: "asc" }, { sourceLawId: "asc" }],
    take: Math.max(limit * 4, limit),
  });

  const hydrated = await hydrateLawEntries(entries);

  return hydrated
    .filter((entry) => entry.isPublished !== false)
    .filter((entry) => matchesLawKeyword(entry, normalizedKeyword) || normalizeDisplayText(entry.content ?? "").includes(normalizedKeyword))
    .sort(sortLawEntries)
    .slice(0, limit)
    .map((entry) => serializeLawSearchResult(entry, normalizedKeyword));
};

export const getLawAdminSummary = async () => {
  const entries = await prisma.lawEntry.findMany({
    select: lawEntryMetaSelect,
    orderBy: [{ updatedAt: "desc" }, { topCategoryId: "asc" }, { position: "asc" }],
  });
  const hydrated = await hydrateLawEntries(entries);

  const topCategories = Array.from(
    new Map(hydrated.map((entry) => [entry.topCategoryId, normalizeDisplayText(entry.topCategoryTitle)])).entries(),
  ).map(([id, title]) => ({
    id,
    title,
  }));

  return {
    totalRecords: hydrated.length,
    publishedRecords: hydrated.filter((entry) => entry.isPublished !== false).length,
    hiddenRecords: hydrated.filter((entry) => entry.isPublished === false).length,
    pinnedRecords: hydrated.filter((entry) => entry.isPinned === true).length,
    topCategoryCount: topCategories.length,
    lastUpdated: entries[0]?.updatedAt ? formatDateTime(entries[0].updatedAt) : "",
    topCategories,
  };
};

export const getLawAdminEntries = async ({
  keyword = "",
  topCategoryId = "",
  visibility = "all",
  pinnedOnly = false,
  page = 1,
  pageSize = 20,
} = {}) => {
  const normalizedKeyword = normalizeDisplayText(keyword);
  const normalizedTopCategoryId = Number.parseInt(`${topCategoryId ?? ""}`, 10);
  const safePageSize = Math.min(Math.max(pageSize, 1), 100);
  const safePage = Math.max(page, 1);

  const entries = await prisma.lawEntry.findMany({
    where: {
      ...(Number.isFinite(normalizedTopCategoryId)
        ? {
            topCategoryId: normalizedTopCategoryId,
          }
        : {}),
    },
    select: lawEntryMetaSelect,
    orderBy: [{ topCategoryId: "asc" }, { position: "asc" }, { sourceLawId: "asc" }],
  });

  const hydrated = await hydrateLawEntries(entries);
  const filtered = hydrated
    .filter((entry) => matchesLawKeyword(entry, normalizedKeyword))
    .filter((entry) => {
      if (visibility === "published") {
        return entry.isPublished !== false;
      }
      if (visibility === "hidden") {
        return entry.isPublished === false;
      }
      return true;
    })
    .filter((entry) => (pinnedOnly ? entry.isPinned === true : true))
    .sort(sortLawEntries);

  const total = filtered.length;
  const totalPages = Math.max(Math.ceil(total / safePageSize), 1);
  const currentPage = Math.min(safePage, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * safePageSize, currentPage * safePageSize);

  return {
    items: pageItems.map(serializeLawEntryMeta),
    total,
    page: currentPage,
    pageSize: safePageSize,
    totalPages,
  };
};

const createLawHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const updateLawAdminEntry = async (sourceLawId, payload = {}) => {
  const normalizedSourceLawId = Number.parseInt(`${sourceLawId ?? ""}`, 10);
  if (!Number.isFinite(normalizedSourceLawId) || normalizedSourceLawId <= 0) {
    throw createLawHttpError("法条标识不合法", 400);
  }

  const entry = await prisma.lawEntry.findUnique({
    where: {
      sourceLawId: normalizedSourceLawId,
    },
    select: lawEntryMetaSelect,
  });

  if (!entry) {
    throw createLawHttpError("法条记录不存在", 404);
  }

  const existing = normalizeLawOperation(
    await prisma.lawEntryOperation.findUnique({
      where: {
        sourceLawId: normalizedSourceLawId,
      },
      select: lawEntryOperationSelect,
    }),
  );

  const nextTags = payload?.tags === undefined ? existing.tags : parseLawTagsInput(payload.tags);
  const nextCustomTitle =
    payload?.customTitle === undefined ? existing.customTitle : normalizeDisplayText(payload.customTitle ?? "");
  const nextOperatorNote =
    payload?.operatorNote === undefined ? existing.operatorNote : normalizeDisplayText(payload.operatorNote ?? "");
  const nextIsPublished = typeof payload?.isPublished === "boolean" ? payload.isPublished : existing.isPublished;
  const nextIsPinned = typeof payload?.isPinned === "boolean" ? payload.isPinned : existing.isPinned;
  const manualSortOrderRaw =
    payload?.manualSortOrder === undefined ? existing.manualSortOrder : Number.parseInt(`${payload.manualSortOrder ?? ""}`, 10);
  const nextManualSortOrder = Number.isFinite(manualSortOrderRaw) && manualSortOrderRaw > 0 ? manualSortOrderRaw : 0;

  const operation = await prisma.lawEntryOperation.upsert({
    where: {
      sourceLawId: normalizedSourceLawId,
    },
    create: {
      sourceLawId: normalizedSourceLawId,
      isPublished: nextIsPublished,
      isPinned: nextIsPinned,
      manualSortOrder: nextManualSortOrder,
      tagsJson: JSON.stringify(nextTags),
      operatorNote: nextOperatorNote || null,
      customTitle: nextCustomTitle || null,
    },
    update: {
      isPublished: nextIsPublished,
      isPinned: nextIsPinned,
      manualSortOrder: nextManualSortOrder,
      tagsJson: JSON.stringify(nextTags),
      operatorNote: nextOperatorNote || null,
      customTitle: nextCustomTitle || null,
    },
    select: lawEntryOperationSelect,
  });

  return serializeLawEntryMeta(
    hydrateLawEntry(
      entry,
      new Map([[normalizedSourceLawId, normalizeLawOperation(operation)]]),
    ),
  );
};
