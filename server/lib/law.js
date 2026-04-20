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

const sortLawEntries = (left, right) => {
  if (left.topCategoryId !== right.topCategoryId) {
    return left.topCategoryId - right.topCategoryId;
  }

  if ((left.position ?? 0) !== (right.position ?? 0)) {
    return (left.position ?? 0) - (right.position ?? 0);
  }

  return (left.sourceLawId ?? 0) - (right.sourceLawId ?? 0);
};

export const parseLawPathTitles = (value) => {
  try {
    const parsed = JSON.parse(value ?? "[]");
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((item) => normalizeDisplayText(item)).filter(Boolean);
  } catch (_error) {
    return [];
  }
};

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
      title: normalizeDisplayText(entry.title),
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
    pathLabels,
    pathString: normalizeDisplayText(entry.pathString),
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
      nodeTitle: normalizeDisplayText(entry.title),
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

export const getLawOverview = async () => {
  const entries = await prisma.lawEntry.findMany({
    select: lawEntryMetaSelect,
    orderBy: [{ topCategoryId: "asc" }, { position: "asc" }, { sourceLawId: "asc" }],
  });
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

    return entry ? listLawEntriesForNode([entry], nodeId) : null;
  }

  if (parsed.type === "path") {
    const entries = await prisma.lawEntry.findMany({
      select: lawEntryContentSelect,
      orderBy: [{ topCategoryId: "asc" }, { position: "asc" }, { sourceLawId: "asc" }],
    });

    return listLawEntriesForNode(entries, nodeId);
  }

  return null;
};

export const searchLawEntries = async ({ keyword = "", limit = 50 } = {}) => {
  const normalizedKeyword = normalizeDisplayText(keyword);
  if (!normalizedKeyword) {
    return [];
  }

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
      ],
    },
    select: lawEntryContentSelect,
    orderBy: [{ topCategoryId: "asc" }, { position: "asc" }, { sourceLawId: "asc" }],
    take: limit,
  });

  return entries.map((entry) => serializeLawSearchResult(entry, normalizedKeyword));
};

export const getLawAdminSummary = async () => {
  const entries = await prisma.lawEntry.findMany({
    select: lawEntryMetaSelect,
    orderBy: [{ updatedAt: "desc" }, { topCategoryId: "asc" }, { position: "asc" }],
  });

  const topCategories = Array.from(
    new Map(entries.map((entry) => [entry.topCategoryId, normalizeDisplayText(entry.topCategoryTitle)])).entries(),
  ).map(([id, title]) => ({
    id,
    title,
  }));

  return {
    totalRecords: entries.length,
    topCategoryCount: topCategories.length,
    lastUpdated: entries[0]?.updatedAt ? formatDateTime(entries[0].updatedAt) : "",
    topCategories,
  };
};

export const getLawAdminEntries = async ({ keyword = "", topCategoryId = "", page = 1, pageSize = 20 } = {}) => {
  const normalizedKeyword = normalizeDisplayText(keyword);
  const normalizedTopCategoryId = Number.parseInt(`${topCategoryId ?? ""}`, 10);
  const where = {
    ...(Number.isFinite(normalizedTopCategoryId)
      ? {
          topCategoryId: normalizedTopCategoryId,
        }
      : {}),
    ...(normalizedKeyword
      ? {
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
          ],
        }
      : {}),
  };

  const safePageSize = Math.min(Math.max(pageSize, 1), 100);
  const safePage = Math.max(page, 1);
  const total = await prisma.lawEntry.count({ where });
  const totalPages = Math.max(Math.ceil(total / safePageSize), 1);
  const currentPage = Math.min(safePage, totalPages);

  const entries =
    total === 0
      ? []
      : await prisma.lawEntry.findMany({
          where,
          select: lawEntryMetaSelect,
          orderBy: [{ topCategoryId: "asc" }, { position: "asc" }, { sourceLawId: "asc" }],
          skip: (currentPage - 1) * safePageSize,
          take: safePageSize,
        });

  return {
    items: entries.map(serializeLawEntryMeta),
    total,
    page: currentPage,
    pageSize: safePageSize,
    totalPages,
  };
};
