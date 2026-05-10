import crypto from "node:crypto";
import { config } from "./config.js";
import { formatDateTime } from "./time.js";
import { getReadableObjectUrl } from "./upload.js";
import { normalizeTypingPracticeHomeConfig } from "../../src/shared/typing-practice-home-config.js";

const typingPracticeDifficultyOrder = ["easy", "medium", "hard"];
const TYPING_PRACTICE_STAGE_CHAR_COUNT = 60;
const TYPING_PRACTICE_FIRST_STAGE_BONUS_SECONDS = 18;
const TYPING_PRACTICE_STAGE_MODE_TIME_OFFSET_MAP = {
  guided: 0,
  sprint: -2,
  memorize: 4,
};
const TYPING_PRACTICE_PLAY_TICKET_TTL_MS = 24 * 60 * 60 * 1000;
const TYPING_PRACTICE_DURATION_TOLERANCE_SECONDS = 6;
const TYPING_PRACTICE_PLAY_TICKET_SECRET = `${config.jwtSecret}:typing-practice:v1`;

const toBoundedInt = (value, { min, max, fallback }) => {
  const parsed = Number.parseInt(`${value ?? ""}`.trim(), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

export const typingPracticeModeLabelMap = {
  guided: "跟打练习",
  sprint: "限时冲刺",
  memorize: "法条默写",
};

export const typingPracticeDifficultyLabelMap = {
  easy: "入门",
  medium: "标准",
  hard: "挑战",
};

export const defaultTypingPracticeDifficultyConfigMap = {
  easy: {
    difficulty: "easy",
    label: typingPracticeDifficultyLabelMap.easy,
    initialLives: 4,
    baseStageTimeSeconds: 22,
    extraTimePer20Chars: 4,
    minStageTimeSeconds: 14,
    levelTimeReductionSeconds: 1,
    thiefSpeedBase: 1,
    thiefSpeedStepLevels: 3,
    scorePerChar: 18,
    errorPenalty: 6,
    captureBonus: 220,
    lifeBonus: 90,
    memorizePreviewSeconds: 16,
  },
  medium: {
    difficulty: "medium",
    label: typingPracticeDifficultyLabelMap.medium,
    initialLives: 3,
    baseStageTimeSeconds: 18,
    extraTimePer20Chars: 3,
    minStageTimeSeconds: 12,
    levelTimeReductionSeconds: 1,
    thiefSpeedBase: 2,
    thiefSpeedStepLevels: 2,
    scorePerChar: 20,
    errorPenalty: 8,
    captureBonus: 260,
    lifeBonus: 120,
    memorizePreviewSeconds: 12,
  },
  hard: {
    difficulty: "hard",
    label: typingPracticeDifficultyLabelMap.hard,
    initialLives: 2,
    baseStageTimeSeconds: 15,
    extraTimePer20Chars: 2,
    minStageTimeSeconds: 9,
    levelTimeReductionSeconds: 2,
    thiefSpeedBase: 3,
    thiefSpeedStepLevels: 2,
    scorePerChar: 24,
    errorPenalty: 10,
    captureBonus: 320,
    lifeBonus: 160,
    memorizePreviewSeconds: 8,
  },
};

const parseTypingPracticeDifficultyConfigInput = (value) => {
  if (!value) return [];

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parseTypingPracticeDifficultyConfigInput(parsed);
    } catch (_error) {
      return [];
    }
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "object") {
    return Object.values(value);
  }

  return [];
};

export const normalizeTypingPracticeDifficultyConfigs = (value) => {
  const rawItems = parseTypingPracticeDifficultyConfigInput(value);

  return typingPracticeDifficultyOrder.map((difficulty) => {
    const base = defaultTypingPracticeDifficultyConfigMap[difficulty];
    const rawItem = rawItems.find((item) => `${item?.difficulty ?? ""}`.trim() === difficulty) ?? {};

    return {
      difficulty,
      label: typingPracticeDifficultyLabelMap[difficulty] ?? base.label,
      initialLives: toBoundedInt(rawItem.initialLives, { min: 1, max: 9, fallback: base.initialLives }),
      baseStageTimeSeconds: toBoundedInt(rawItem.baseStageTimeSeconds, { min: 6, max: 120, fallback: base.baseStageTimeSeconds }),
      extraTimePer20Chars: toBoundedInt(rawItem.extraTimePer20Chars, { min: 0, max: 30, fallback: base.extraTimePer20Chars }),
      minStageTimeSeconds: toBoundedInt(rawItem.minStageTimeSeconds, { min: 4, max: 60, fallback: base.minStageTimeSeconds }),
      levelTimeReductionSeconds: toBoundedInt(rawItem.levelTimeReductionSeconds, { min: 0, max: 10, fallback: base.levelTimeReductionSeconds }),
      thiefSpeedBase: toBoundedInt(rawItem.thiefSpeedBase, { min: 1, max: 9, fallback: base.thiefSpeedBase }),
      thiefSpeedStepLevels: toBoundedInt(rawItem.thiefSpeedStepLevels, { min: 1, max: 10, fallback: base.thiefSpeedStepLevels }),
      scorePerChar: toBoundedInt(rawItem.scorePerChar, { min: 1, max: 100, fallback: base.scorePerChar }),
      errorPenalty: toBoundedInt(rawItem.errorPenalty, { min: 0, max: 100, fallback: base.errorPenalty }),
      captureBonus: toBoundedInt(rawItem.captureBonus, { min: 0, max: 2000, fallback: base.captureBonus }),
      lifeBonus: toBoundedInt(rawItem.lifeBonus, { min: 0, max: 1000, fallback: base.lifeBonus }),
      memorizePreviewSeconds: toBoundedInt(rawItem.memorizePreviewSeconds, { min: 3, max: 60, fallback: base.memorizePreviewSeconds }),
    };
  });
};

export const buildTypingPracticeDifficultyConfigMap = (value) => {
  const items = normalizeTypingPracticeDifficultyConfigs(value);
  return Object.fromEntries(items.map((item) => [item.difficulty, item]));
};

const typingPracticeStatusLabelMap = {
  draft: "草稿",
  published: "已发布",
};

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const normalizeTypingPracticeContent = (value) => `${value ?? ""}`.replace(/\r\n/g, "\n").trim();

const normalizeText = (value) => normalizeTypingPracticeContent(value).replace(/\n+/g, "\n");

const toOptionalText = (value) => {
  const normalized = normalizeText(value);
  return normalized || null;
};

const parseTagsInput = (value) => {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => normalizeText(item)).filter(Boolean)));
  }

  const raw = normalizeText(value);
  if (!raw) return [];
  return Array.from(new Set(raw.split(/[\n,，、]/).map((item) => item.trim()).filter(Boolean)));
};

const parseTagsJson = (value) => {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return parseTagsInput(Array.isArray(parsed) ? parsed : []);
  } catch (_error) {
    return [];
  }
};

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(`${value ?? ""}`.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toNonNegativeInt = (value, fallback = 0) => {
  const parsed = Number.parseInt(`${value ?? ""}`.trim(), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const createPreview = (value, maxLength = 88) => {
  const normalized = normalizeText(value).replace(/\s+/g, " ");
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
};

const createTypingPracticeContentHash = (value) =>
  crypto.createHash("sha256").update(normalizeTypingPracticeContent(value)).digest("hex");

const createPlayTicketSignature = (encodedPayload) =>
  crypto.createHmac("sha256", TYPING_PRACTICE_PLAY_TICKET_SECRET).update(encodedPayload).digest("base64url");

const createTypingPracticePlayTicket = ({ textId, difficulty, mode, content, timeLimitSeconds }) => {
  const issuedAtMs = Date.now();
  const payload = {
    v: 1,
    textId,
    difficulty,
    mode,
    issuedAtMs,
    expiresAtMs: issuedAtMs + TYPING_PRACTICE_PLAY_TICKET_TTL_MS,
    timeLimitSeconds: Number(timeLimitSeconds ?? 0),
    contentHash: createTypingPracticeContentHash(content),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${createPlayTicketSignature(encodedPayload)}`;
};

const readTypingPracticePlayTicket = (value) => {
  const ticket = `${value ?? ""}`.trim();
  if (!ticket) {
    return null;
  }

  const [encodedPayload = "", signature = ""] = ticket.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = createPlayTicketSignature(encodedPayload);
  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (!payload || typeof payload !== "object") {
      return null;
    }

    return payload;
  } catch (_error) {
    return null;
  }
};

const trimTypingPracticeSegmentToBoundary = (content, maxLength) => {
  if (content.length <= maxLength) {
    return content;
  }

  const sliced = content.slice(0, maxLength);
  const lastBoundary = Math.max(sliced.lastIndexOf("。"), sliced.lastIndexOf("；"), sliced.lastIndexOf("！"), sliced.lastIndexOf("？"));
  if (lastBoundary >= Math.max(18, maxLength - 32)) {
    return sliced.slice(0, lastBoundary + 1);
  }

  return sliced;
};

const createSprintTargetContent = (content, timeLimitSeconds) => {
  const normalized = normalizeTypingPracticeContent(content);
  if (!normalized) return "";

  const desiredLength = timeLimitSeconds >= 300 ? 420 : 260;
  if (normalized.length <= desiredLength) {
    return normalized;
  }

  const paragraphs = normalized
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const usableParagraphs = paragraphs.filter((item) => item.length >= 48);
  const pool = usableParagraphs.length > 0 ? usableParagraphs : paragraphs.length > 0 ? paragraphs : [normalized];
  const startIndex = Math.floor(Math.random() * pool.length);
  let segment = pool[startIndex];

  for (let index = startIndex + 1; index < pool.length && segment.length < desiredLength; index += 1) {
    segment = `${segment}\n${pool[index]}`;
  }

  if (segment.length < Math.floor(desiredLength * 0.7)) {
    const maxStart = Math.max(1, normalized.length - desiredLength);
    segment = normalized.slice(Math.max(0, Math.floor(Math.random() * maxStart)), normalized.length);
  }

  return trimTypingPracticeSegmentToBoundary(segment, desiredLength);
};

const getMatchedPrefixLength = (targetText, typedText) => {
  const maxLength = Math.min(targetText.length, typedText.length);
  let index = 0;

  while (index < maxLength && targetText[index] === typedText[index]) {
    index += 1;
  }

  return index;
};

const calculateTypingMetrics = ({ targetText, typedText, errorCount, durationSeconds, comboMax }) => {
  const normalizedTarget = normalizeTypingPracticeContent(targetText);
  const normalizedTyped = normalizeTypingPracticeContent(typedText);
  const targetLength = normalizedTarget.length;
  const typedLength = normalizedTyped.length;
  const correctLength = getMatchedPrefixLength(normalizedTarget, normalizedTyped);
  const normalizedErrorCount = Math.max(0, Number(errorCount ?? 0));
  const safeDurationSeconds = Math.max(1, Number(durationSeconds ?? 0));
  const accuracyRate = typedLength > 0 || normalizedErrorCount > 0 ? Math.round((correctLength / Math.max(correctLength + normalizedErrorCount, 1)) * 100) : 0;
  const completionRate = targetLength > 0 ? Math.round((correctLength / targetLength) * 100) : 0;
  const cpm = Math.round((correctLength / safeDurationSeconds) * 60);
  const score = Math.max(0, Math.round(accuracyRate * 4 + completionRate * 3 + Math.min(cpm, 260) + Math.min(Math.max(0, Number(comboMax ?? 0)), 120)));

  return {
    targetLength,
    typedLength,
    correctLength,
    accuracyRate,
    completionRate,
    cpm,
    score,
  };
};

const calculateCapturedStageCount = ({ correctLength, targetLength }) => {
  const safeTargetLength = Math.max(0, Number(targetLength ?? 0));
  if (safeTargetLength <= 0) {
    return 0;
  }

  const totalStageCount = Math.max(1, Math.ceil(safeTargetLength / TYPING_PRACTICE_STAGE_CHAR_COUNT));
  if (correctLength >= safeTargetLength) {
    return totalStageCount;
  }

  return Math.min(totalStageCount, Math.floor(Math.max(0, Number(correctLength ?? 0)) / TYPING_PRACTICE_STAGE_CHAR_COUNT));
};

const buildTypingPracticeStageLengths = (targetLength) => {
  const lengths = [];
  let remaining = Math.max(0, Number(targetLength ?? 0));

  while (remaining > 0) {
    lengths.push(Math.min(TYPING_PRACTICE_STAGE_CHAR_COUNT, remaining));
    remaining -= TYPING_PRACTICE_STAGE_CHAR_COUNT;
  }

  return lengths.length > 0 ? lengths : [TYPING_PRACTICE_STAGE_CHAR_COUNT];
};

const calculateTypingPracticeStageTimeLimitSeconds = ({ mode, level, chunkLength, difficultyConfig }) => {
  const baseSeconds =
    Number(difficultyConfig?.baseStageTimeSeconds ?? 0) +
    Math.ceil(Math.max(1, Number(chunkLength ?? 0)) / 20) * Number(difficultyConfig?.extraTimePer20Chars ?? 0) +
    Number(TYPING_PRACTICE_STAGE_MODE_TIME_OFFSET_MAP[mode] ?? 0);
  const levelPenalty = Math.max(Number(level ?? 1) - 1, 0) * Number(difficultyConfig?.levelTimeReductionSeconds ?? 0);
  const warmupBonus = Number(level ?? 1) <= 1 ? TYPING_PRACTICE_FIRST_STAGE_BONUS_SECONDS : 0;
  return Math.max(Number(difficultyConfig?.minStageTimeSeconds ?? 1), baseSeconds - levelPenalty + warmupBonus);
};

const calculatePerfectRunLimitSeconds = ({ mode, targetLength, difficultyConfig }) =>
  buildTypingPracticeStageLengths(targetLength).reduce(
    (total, chunkLength, index) =>
      total +
      calculateTypingPracticeStageTimeLimitSeconds({
        mode,
        level: index + 1,
        chunkLength,
        difficultyConfig,
      }),
    0,
  );

const calculateTypingConfiguredScore = ({ correctLength, errorCount, capturedStageCount, livesRemaining, difficultyConfig }) =>
  Math.max(
    0,
    Math.round(
      Math.max(0, Number(correctLength ?? 0)) * Number(difficultyConfig?.scorePerChar ?? 0) -
        Math.max(0, Number(errorCount ?? 0)) * Number(difficultyConfig?.errorPenalty ?? 0) +
        Math.max(0, Number(capturedStageCount ?? 0)) * Number(difficultyConfig?.captureBonus ?? 0) +
        Math.max(0, Number(livesRemaining ?? 0)) * Number(difficultyConfig?.lifeBonus ?? 0),
    ),
  );

const serializeFolder = (folder) => ({
  id: folder.id,
  name: normalizeText(folder.name),
  sortOrder: Number(folder.sortOrder ?? 0),
  textCount: Number(folder._count?.texts ?? 0),
  publishedTextCount: Number(folder._count?.publishedTexts ?? 0),
  createdAt: formatDateTime(folder.createdAt),
  updatedAt: formatDateTime(folder.updatedAt),
});

const serializeText = (text, options = {}) => {
  const includeContent = options.includeContent !== false;
  const resolvedDifficulty = getValidatedDifficulty(options.selectedDifficulty ?? text.difficulty);
  const difficultyConfigMap = options.difficultyConfigMap ?? null;
  const resolvedContent = options.contentOverride ?? text.content;
  const normalizedContent = normalizeTypingPracticeContent(resolvedContent);

  return {
    id: text.id,
    folderId: text.folderId,
    folderName: normalizeText(text.folder?.name),
    title: normalizeText(text.title),
    difficulty: resolvedDifficulty,
    difficultyLabel: typingPracticeDifficultyLabelMap[resolvedDifficulty] ?? resolvedDifficulty,
    source: normalizeText(text.source),
    tags: parseTagsJson(text.tagsJson),
    content: includeContent ? normalizedContent : "",
    note: normalizeText(text.note),
    status: text.status,
    statusLabel: typingPracticeStatusLabelMap[text.status] ?? text.status,
    sortOrder: Number(text.sortOrder ?? 0),
    contentLength: normalizedContent.length || Number(text.contentLength ?? 0),
    preview: createPreview(resolvedContent),
    difficultyConfig: difficultyConfigMap ? difficultyConfigMap[resolvedDifficulty] ?? null : null,
    playTicket: includeContent ? `${options.playTicket ?? ""}` : "",
    createdAt: formatDateTime(text.createdAt),
    updatedAt: formatDateTime(text.updatedAt),
  };
};

const serializeRecord = (record, options = {}) => {
  const includeSnapshots = options.includeSnapshots === true;

  return {
    id: record.id,
    textId: record.textId ?? "",
    mode: record.mode,
    modeLabel: typingPracticeModeLabelMap[record.mode] ?? record.mode,
    difficulty: record.difficulty ?? "medium",
    difficultyLabel: typingPracticeDifficultyLabelMap[record.difficulty] ?? record.difficulty ?? "medium",
    title: normalizeText(record.titleSnapshot),
    source: normalizeText(record.sourceSnapshot),
    targetLength: Number(record.targetLength ?? 0),
    typedLength: Number(record.typedLength ?? 0),
    correctLength: Number(record.correctLength ?? 0),
    errorCount: Number(record.errorCount ?? 0),
    backspaceCount: Number(record.backspaceCount ?? 0),
    comboMax: Number(record.comboMax ?? 0),
    accuracyRate: Number(record.accuracyRate ?? 0),
    completionRate: Number(record.completionRate ?? 0),
    cpm: Number(record.cpm ?? 0),
    score: Number(record.score ?? 0),
    durationSeconds: Number(record.durationSeconds ?? 0),
    timeLimitSeconds: record.timeLimitSeconds ? Number(record.timeLimitSeconds) : null,
    previewSeconds: record.previewSeconds ? Number(record.previewSeconds) : null,
    createdAt: formatDateTime(record.createdAt),
    completedAt: formatDateTime(record.completedAt),
    targetPreview: createPreview(record.contentSnapshot),
    typedPreview: createPreview(record.typedContent),
    contentSnapshot: includeSnapshots ? normalizeTypingPracticeContent(record.contentSnapshot) : "",
    typedContent: includeSnapshots ? normalizeTypingPracticeContent(record.typedContent) : "",
  };
};

const maskPhone = (value) => {
  const phone = `${value ?? ""}`.trim();
  if (!phone) return "匿名用户";
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
};

const serializeLeaderboardEntry = (entry, rank) => ({
  rank,
  userId: entry.userId,
  userLabel: maskPhone(entry.user?.phone),
  bestScore: Number(entry.bestScore ?? 0),
  bestCpm: Number(entry.bestCpm ?? 0),
  practiceCount: Number(entry.practiceCount ?? 0),
  avgAccuracyRate: Number(entry.avgAccuracyRate ?? 0),
  lastCompletedAt: formatDateTime(entry.lastCompletedAt),
});

const getValidatedDifficulty = (value) => {
  const normalized = `${value ?? ""}`.trim();
  if (normalized === "easy" || normalized === "hard") return normalized;
  return "medium";
};

const getValidatedMode = (value) => {
  const normalized = `${value ?? ""}`.trim();
  if (normalized === "sprint" || normalized === "memorize") return normalized;
  return "guided";
};

const getValidatedStatus = (value) => (`${value ?? ""}`.trim() === "draft" ? "draft" : "published");

const validateTextPayload = ({ folder, payload }) => {
  if (!folder) {
    throw createHttpError("目标文件夹不存在", 404);
  }

  const title = normalizeText(payload?.title);
  const content = normalizeTypingPracticeContent(payload?.content);

  if (!title) {
    throw createHttpError("文本标题不能为空");
  }

  if (!content) {
    throw createHttpError("练习文本不能为空");
  }

  if (content.length < 20) {
    throw createHttpError("练习文本至少需要 20 个字符");
  }

  return {
    title,
    source: toOptionalText(payload?.source),
    tagsJson: JSON.stringify(parseTagsInput(payload?.tags)),
    content,
    note: toOptionalText(payload?.note),
    status: getValidatedStatus(payload?.status),
    sortOrder: toPositiveInt(payload?.sortOrder, 0),
    contentLength: content.length,
  };
};

export const getTypingPracticeSummary = async ({ db }) => {
  const [totalFolders, totalTexts, publishedTexts, totalRecords] = await Promise.all([
    db.typingPracticeFolder.count(),
    db.typingPracticeText.count(),
    db.typingPracticeText.count({
      where: {
        status: "published",
      },
    }),
    db.typingPracticeRecord.count(),
  ]);

  return {
    totalFolders,
    totalTexts,
    publishedTexts,
    draftTexts: Math.max(0, totalTexts - publishedTexts),
    totalRecords,
  };
};

export const getTypingPracticeDifficultyConfigs = async ({ db }) => {
  const config = await db.systemConfig.findUnique({
    where: {
      id: 1,
    },
    select: {
      typingPracticeDifficultyConfigJson: true,
    },
  });

  return normalizeTypingPracticeDifficultyConfigs(config?.typingPracticeDifficultyConfigJson);
};

export const getTypingPracticeHomeConfig = async ({ db }) => {
  const configRecord = await db.systemConfig.findUnique({
    where: {
      id: 1,
    },
    select: {
      typingPracticeHomeConfigJson: true,
    },
  });

  let parsed = null;
  try {
    parsed = configRecord?.typingPracticeHomeConfigJson ? JSON.parse(configRecord.typingPracticeHomeConfigJson) : null;
  } catch (_error) {
    parsed = null;
  }

  const configValue = normalizeTypingPracticeHomeConfig(parsed);
  configValue.hero.policeImageUrl = getReadableObjectUrl({
    objectKey: configValue.hero.policeImageObjectKey ?? "",
    fallbackUrl: configValue.hero.policeImageUrl ?? "",
  });
  configValue.hero.thiefImageUrl = getReadableObjectUrl({
    objectKey: configValue.hero.thiefImageObjectKey ?? "",
    fallbackUrl: configValue.hero.thiefImageUrl ?? "",
  });

  return configValue;
};

export const updateTypingPracticeHomeConfig = async ({ db, config: configInput }) => {
  const normalized = normalizeTypingPracticeHomeConfig(configInput);

  await db.systemConfig.upsert({
    where: {
      id: 1,
    },
    update: {
      typingPracticeHomeConfigJson: JSON.stringify(normalized),
    },
    create: {
      id: 1,
      webhookUrl: "",
      typingPracticeHomeConfigJson: JSON.stringify(normalized),
    },
  });

  normalized.hero.policeImageUrl = getReadableObjectUrl({
    objectKey: normalized.hero.policeImageObjectKey ?? "",
    fallbackUrl: normalized.hero.policeImageUrl ?? "",
  });
  normalized.hero.thiefImageUrl = getReadableObjectUrl({
    objectKey: normalized.hero.thiefImageObjectKey ?? "",
    fallbackUrl: normalized.hero.thiefImageUrl ?? "",
  });

  return normalized;
};

export const updateTypingPracticeDifficultyConfigs = async ({ db, items }) => {
  const normalizedItems = normalizeTypingPracticeDifficultyConfigs(items);

  await db.systemConfig.upsert({
    where: {
      id: 1,
    },
    update: {
      typingPracticeDifficultyConfigJson: JSON.stringify(normalizedItems),
    },
    create: {
      id: 1,
      webhookUrl: "",
      typingPracticeDifficultyConfigJson: JSON.stringify(normalizedItems),
    },
  });

  return normalizedItems;
};

export const listTypingPracticeFolders = async ({ db }) => {
  const folders = await db.typingPracticeFolder.findMany({
    include: {
      _count: {
        select: {
          texts: true,
        },
      },
      texts: {
        where: {
          status: "published",
        },
        select: {
          id: true,
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
  });

  return folders.map((folder) =>
    serializeFolder({
      ...folder,
      _count: {
        texts: folder._count?.texts ?? 0,
        publishedTexts: folder.texts?.length ?? 0,
      },
    }),
  );
};

export const createTypingPracticeFolder = async ({ db, name, sortOrder }) => {
  const normalizedName = normalizeText(name);
  if (!normalizedName) {
    throw createHttpError("文件夹名称不能为空");
  }

  try {
    const folder = await db.typingPracticeFolder.create({
      data: {
        name: normalizedName,
        sortOrder: toNonNegativeInt(sortOrder, 0),
      },
      include: {
        _count: {
          select: {
            texts: true,
          },
        },
      },
    });

    return serializeFolder({
      ...folder,
      _count: {
        texts: folder._count?.texts ?? 0,
        publishedTexts: 0,
      },
    });
  } catch (error) {
    if (error?.code === "P2002") {
      throw createHttpError("已存在同名文件夹");
    }

    throw error;
  }
};

export const updateTypingPracticeFolder = async ({ db, folderId, name, sortOrder }) => {
  const folder = await db.typingPracticeFolder.findUnique({
    where: {
      id: folderId,
    },
  });

  if (!folder) {
    throw createHttpError("文件夹不存在", 404);
  }

  const normalizedName = normalizeText(name);
  if (!normalizedName) {
    throw createHttpError("文件夹名称不能为空");
  }

  try {
    const updated = await db.typingPracticeFolder.update({
      where: {
        id: folderId,
      },
      data: {
        name: normalizedName,
        sortOrder: toNonNegativeInt(sortOrder, folder.sortOrder ?? 0),
      },
      include: {
        _count: {
          select: {
            texts: true,
          },
        },
        texts: {
          where: {
            status: "published",
          },
          select: {
            id: true,
          },
        },
      },
    });

    return serializeFolder({
      ...updated,
      _count: {
        texts: updated._count?.texts ?? 0,
        publishedTexts: updated.texts?.length ?? 0,
      },
    });
  } catch (error) {
    if (error?.code === "P2002") {
      throw createHttpError("已存在同名文件夹");
    }

    throw error;
  }
};

export const deleteTypingPracticeFolder = async ({ db, folderId }) => {
  const folder = await db.typingPracticeFolder.findUnique({
    where: {
      id: folderId,
    },
    include: {
      _count: {
        select: {
          texts: true,
        },
      },
    },
  });

  if (!folder) {
    throw createHttpError("文件夹不存在", 404);
  }

  if (Number(folder._count?.texts ?? 0) > 0) {
    throw createHttpError("请先清空文件夹中的练习文本后再删除");
  }

  await db.typingPracticeFolder.delete({
    where: {
      id: folderId,
    },
  });

  return { success: true };
};

export const listTypingPracticeTexts = async ({ db, folderId, keyword, status, page = 1, pageSize = 20 }) => {
  const normalizedKeyword = normalizeText(keyword).replace(/\n/g, " ");
  const normalizedStatus = `${status ?? ""}`.trim();

  const where = {
    ...(folderId ? { folderId } : {}),
    ...(normalizedStatus === "draft" || normalizedStatus === "published" ? { status: normalizedStatus } : {}),
    ...(normalizedKeyword
      ? {
          OR: [
            { title: { contains: normalizedKeyword } },
            { source: { contains: normalizedKeyword } },
            { content: { contains: normalizedKeyword } },
            { folder: { is: { name: { contains: normalizedKeyword } } } },
          ],
        }
      : {}),
  };

  const total = await db.typingPracticeText.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const texts =
    total === 0
      ? []
      : await db.typingPracticeText.findMany({
          where,
          include: {
            folder: {
              select: {
                name: true,
              },
            },
          },
          orderBy: folderId ? [{ sortOrder: "asc" }, { updatedAt: "desc" }] : [{ updatedAt: "desc" }, { id: "desc" }],
          skip: (currentPage - 1) * pageSize,
          take: pageSize,
        });

  return {
    items: texts.map((text) => serializeText(text)),
    total,
    page: currentPage,
    pageSize,
    totalPages,
  };
};

export const createTypingPracticeText = async ({ db, payload }) =>
  db.$transaction(async (tx) => {
    const folderId = `${payload?.folderId ?? ""}`.trim();
    if (!folderId) {
      throw createHttpError("请选择文件夹");
    }

    const folder = await tx.typingPracticeFolder.findUnique({
      where: {
        id: folderId,
      },
    });

    const validated = validateTextPayload({ folder, payload });

    const maxSortText = await tx.typingPracticeText.findFirst({
      where: {
        folderId,
      },
      orderBy: {
        sortOrder: "desc",
      },
      select: {
        sortOrder: true,
      },
    });

    const created = await tx.typingPracticeText.create({
      data: {
        folderId,
        title: validated.title,
        difficulty: "medium",
        source: validated.source,
        tagsJson: validated.tagsJson,
        content: validated.content,
        note: validated.note,
        status: validated.status,
        sortOrder: validated.sortOrder > 0 ? validated.sortOrder : Number(maxSortText?.sortOrder ?? 0) + 1,
        contentLength: validated.contentLength,
      },
      include: {
        folder: {
          select: {
            name: true,
          },
        },
      },
    });

    return serializeText(created);
  });

export const updateTypingPracticeText = async ({ db, textId, payload }) =>
  db.$transaction(async (tx) => {
    const existing = await tx.typingPracticeText.findUnique({
      where: {
        id: textId,
      },
      select: {
        id: true,
        folderId: true,
        sortOrder: true,
      },
    });

    if (!existing) {
      throw createHttpError("练习文本不存在", 404);
    }

    const folderId = `${payload?.folderId ?? existing.folderId}`.trim();
    const folder = await tx.typingPracticeFolder.findUnique({
      where: {
        id: folderId,
      },
    });

    const validated = validateTextPayload({
      folder,
      payload: {
        ...payload,
        folderId,
      },
    });

    let nextSortOrder = existing.sortOrder ?? 0;
    if (folderId !== existing.folderId && validated.sortOrder <= 0) {
      const maxSortText = await tx.typingPracticeText.findFirst({
        where: {
          folderId,
        },
        orderBy: {
          sortOrder: "desc",
        },
        select: {
          sortOrder: true,
        },
      });
      nextSortOrder = Number(maxSortText?.sortOrder ?? 0) + 1;
    } else if (validated.sortOrder > 0) {
      nextSortOrder = validated.sortOrder;
    }

    const updated = await tx.typingPracticeText.update({
      where: {
        id: textId,
      },
      data: {
        folderId,
        title: validated.title,
        difficulty: "medium",
        source: validated.source,
        tagsJson: validated.tagsJson,
        content: validated.content,
        note: validated.note,
        status: validated.status,
        sortOrder: nextSortOrder,
        contentLength: validated.contentLength,
      },
      include: {
        folder: {
          select: {
            name: true,
          },
        },
      },
    });

    return serializeText(updated);
  });

export const deleteTypingPracticeText = async ({ db, textId }) => {
  const existing = await db.typingPracticeText.findUnique({
    where: {
      id: textId,
    },
    select: {
      id: true,
    },
  });

  if (!existing) {
    throw createHttpError("练习文本不存在", 404);
  }

  await db.typingPracticeText.delete({
    where: {
      id: textId,
    },
  });

  return { success: true };
};

export const getTypingPracticeHome = async ({ db, userId }) => {
  const [folders, texts, recentRecords, aggregate, difficultyConfigs, homeConfig] = await Promise.all([
    db.typingPracticeFolder.findMany({
      include: {
        texts: {
          where: {
            status: "published",
          },
          select: {
            id: true,
          },
        },
        _count: {
          select: {
            texts: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    }),
    db.typingPracticeText.findMany({
      where: {
        status: "published",
      },
      include: {
        folder: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    }),
    db.typingPracticeRecord.findMany({
      where: {
        userId,
      },
      orderBy: [{ completedAt: "desc" }],
      take: 8,
    }),
    db.typingPracticeRecord.aggregate({
      where: {
        userId,
      },
      _count: {
        id: true,
      },
      _avg: {
        accuracyRate: true,
        cpm: true,
      },
      _max: {
        cpm: true,
        score: true,
      },
      _sum: {
        correctLength: true,
      },
    }),
    getTypingPracticeDifficultyConfigs({ db }),
    getTypingPracticeHomeConfig({ db }),
  ]);
  const difficultyConfigMap = buildTypingPracticeDifficultyConfigMap(difficultyConfigs);

  return {
    homeConfig,
    summary: {
      totalFolders: folders.length,
      totalTexts: texts.length,
      practiceCount: Number(aggregate._count?.id ?? 0),
      avgAccuracyRate: Math.round(Number(aggregate._avg?.accuracyRate ?? 0)),
      avgCpm: Math.round(Number(aggregate._avg?.cpm ?? 0)),
      bestCpm: Number(aggregate._max?.cpm ?? 0),
      bestScore: Number(aggregate._max?.score ?? 0),
      totalTypedLength: Number(aggregate._sum?.correctLength ?? 0),
    },
    folders: folders.map((folder) =>
      serializeFolder({
        ...folder,
        _count: {
          texts: folder._count?.texts ?? 0,
          publishedTexts: folder.texts?.length ?? 0,
        },
      }),
    ),
    texts: texts.map((text) => serializeText(text, { includeContent: false, difficultyConfigMap })),
    recentRecords: recentRecords.map((record) => serializeRecord(record)),
  };
};

export const listTypingPracticeRecordsForUser = async ({ db, userId, page = 1, pageSize = 10 }) => {
  const safePageSize = Math.min(Math.max(Number(pageSize) || 10, 1), 50);
  const total = await db.typingPracticeRecord.count({
    where: {
      userId,
    },
  });

  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const currentPage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const records =
    total === 0
      ? []
      : await db.typingPracticeRecord.findMany({
          where: {
            userId,
          },
          orderBy: [{ completedAt: "desc" }, { id: "desc" }],
          skip: (currentPage - 1) * safePageSize,
          take: safePageSize,
        });

  return {
    items: records.map((record) => serializeRecord(record)),
    total,
    page: currentPage,
    pageSize: safePageSize,
    totalPages,
  };
};

export const getTypingPracticeLeaderboard = async ({ db, limit = 10 }) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const grouped = await db.typingPracticeRecord.groupBy({
    by: ["userId"],
    _count: {
      id: true,
    },
    _avg: {
      accuracyRate: true,
    },
    _max: {
      score: true,
      cpm: true,
      completedAt: true,
    },
    orderBy: [{ _max: { score: "desc" } }, { _max: { cpm: "desc" } }, { _max: { completedAt: "desc" } }],
    take: safeLimit,
  });

  if (grouped.length === 0) {
    return [];
  }

  const users = await db.user.findMany({
    where: {
      id: {
        in: grouped.map((item) => item.userId),
      },
    },
    select: {
      id: true,
      phone: true,
    },
  });

  const userMap = new Map(users.map((user) => [user.id, user]));

  return grouped.map((item, index) =>
    serializeLeaderboardEntry(
      {
        userId: item.userId,
        user: userMap.get(item.userId) ?? null,
        bestScore: item._max?.score ?? 0,
        bestCpm: item._max?.cpm ?? 0,
        practiceCount: item._count?.id ?? 0,
        avgAccuracyRate: Math.round(Number(item._avg?.accuracyRate ?? 0)),
        lastCompletedAt: item._max?.completedAt ?? null,
      },
      index + 1,
    ),
  );
};

export const getTypingPracticeTextForUser = async ({ db, textId, mode, difficulty, timeLimitSeconds }) => {
  const [text, difficultyConfigs] = await Promise.all([
    db.typingPracticeText.findFirst({
      where: {
        id: textId,
        status: "published",
      },
      include: {
        folder: {
          select: {
            name: true,
          },
        },
      },
    }),
    getTypingPracticeDifficultyConfigs({ db }),
  ]);

  if (!text) {
    throw createHttpError("练习文本不存在", 404);
  }

  const resolvedMode = getValidatedMode(mode);
  const resolvedDifficulty = getValidatedDifficulty(difficulty);
  const resolvedTimeLimitSeconds = resolvedMode === "sprint" ? toPositiveInt(timeLimitSeconds, 180) : 0;
  const resolvedContent =
    resolvedMode === "sprint" ? createSprintTargetContent(text.content, resolvedTimeLimitSeconds) : normalizeTypingPracticeContent(text.content);
  const playTicket = createTypingPracticePlayTicket({
    textId: text.id,
    difficulty: resolvedDifficulty,
    mode: resolvedMode,
    content: resolvedContent,
    timeLimitSeconds: resolvedTimeLimitSeconds,
  });

  return serializeText(text, {
    includeContent: true,
    contentOverride: resolvedContent,
    selectedDifficulty: resolvedDifficulty,
    difficultyConfigMap: buildTypingPracticeDifficultyConfigMap(difficultyConfigs),
    playTicket,
  });
};

export const createTypingPracticeRecord = async ({ db, userId, payload }) => {
  const mode = getValidatedMode(payload?.mode);
  const difficulty = getValidatedDifficulty(payload?.difficulty);
  const textId = `${payload?.textId ?? ""}`.trim() || null;
  const titleSnapshot = normalizeText(payload?.title);
  const contentSnapshot = normalizeTypingPracticeContent(payload?.contentSnapshot);
  const typedContent = normalizeTypingPracticeContent(payload?.typedContent);
  const playTicket = `${payload?.playTicket ?? ""}`.trim();
  const durationSeconds = toPositiveInt(payload?.durationSeconds, 1);
  const errorCount = toNonNegativeInt(payload?.errorCount, 0);
  const backspaceCount = toNonNegativeInt(payload?.backspaceCount, 0);
  const comboMax = toNonNegativeInt(payload?.comboMax, 0);
  const timeLimitSeconds = payload?.timeLimitSeconds ? toPositiveInt(payload.timeLimitSeconds, 0) : null;
  const previewSeconds = payload?.previewSeconds ? toPositiveInt(payload.previewSeconds, 0) : null;

  if (!titleSnapshot) {
    throw createHttpError("缺少练习标题");
  }

  if (!contentSnapshot) {
    throw createHttpError("缺少练习文本");
  }

  const [sourceText, difficultyConfigs] = await Promise.all([
    textId
      ? db.typingPracticeText.findUnique({
          where: {
            id: textId,
          },
          select: {
            id: true,
            title: true,
            source: true,
            difficulty: true,
          },
        })
      : Promise.resolve(null),
    getTypingPracticeDifficultyConfigs({ db }),
  ]);
  const playTicketPayload = textId ? readTypingPracticePlayTicket(playTicket) : null;
  const currentTimeMs = Date.now();

  if (textId && !sourceText) {
    throw createHttpError("练习文本不存在", 404);
  }

  if (textId) {
    if (!playTicketPayload) {
      throw createHttpError("本次练习凭证已失效，请重新进入练习", 400);
    }

    if (!Number.isFinite(Number(playTicketPayload.issuedAtMs)) || !Number.isFinite(Number(playTicketPayload.expiresAtMs))) {
      throw createHttpError("本次练习凭证无效，请重新进入练习", 400);
    }

    if (Number(playTicketPayload.expiresAtMs) < currentTimeMs) {
      throw createHttpError("本次练习已过期，请重新开始", 400);
    }

    if (
      `${playTicketPayload.textId ?? ""}` !== `${sourceText?.id ?? ""}` ||
      `${playTicketPayload.difficulty ?? ""}` !== difficulty ||
      `${playTicketPayload.mode ?? ""}` !== mode
    ) {
      throw createHttpError("练习内容与凭证不匹配，请重新进入练习", 400);
    }

    if (createTypingPracticeContentHash(contentSnapshot) !== `${playTicketPayload.contentHash ?? ""}`) {
      throw createHttpError("练习文本已被修改，请重新进入练习", 400);
    }
  }

  const safeDurationLowerBoundSeconds = playTicketPayload
    ? Math.max(
        1,
        Math.floor((currentTimeMs - Number(playTicketPayload.issuedAtMs)) / 1000) - Math.max(0, Number(previewSeconds ?? 0)) - TYPING_PRACTICE_DURATION_TOLERANCE_SECONDS,
      )
    : durationSeconds;
  const effectiveDurationSeconds = Math.max(durationSeconds, safeDurationLowerBoundSeconds);
  const resolvedTimeLimitSeconds =
    mode === "sprint" ? toPositiveInt(playTicketPayload?.timeLimitSeconds ?? timeLimitSeconds, 180) : null;

  const metrics = calculateTypingMetrics({
    targetText: contentSnapshot,
    typedText: typedContent,
    errorCount,
    durationSeconds: effectiveDurationSeconds,
    comboMax,
  });
  const difficultyConfigMap = buildTypingPracticeDifficultyConfigMap(difficultyConfigs);
  const difficultyConfig = difficultyConfigMap[difficulty] ?? defaultTypingPracticeDifficultyConfigMap.medium;
  const derivedCapturedStageCount = calculateCapturedStageCount({
    correctLength: metrics.correctLength,
    targetLength: metrics.targetLength,
  });
  const capturedStageCount = derivedCapturedStageCount;
  const perfectRunLimitSeconds = calculatePerfectRunLimitSeconds({
    mode,
    targetLength: metrics.targetLength,
    difficultyConfig,
  });
  const submittedLivesRemaining = Math.min(difficultyConfig.initialLives, toNonNegativeInt(payload?.livesRemaining, 0));
  const livesRemaining =
    metrics.completionRate >= 100 && effectiveDurationSeconds <= perfectRunLimitSeconds + TYPING_PRACTICE_DURATION_TOLERANCE_SECONDS
      ? submittedLivesRemaining
      : 0;
  const configuredScore = calculateTypingConfiguredScore({
    correctLength: metrics.correctLength,
    errorCount,
    capturedStageCount,
    livesRemaining,
    difficultyConfig,
  });

  const created = await db.typingPracticeRecord.create({
    data: {
      userId,
      textId: sourceText?.id ?? null,
      mode,
      difficulty,
      titleSnapshot: titleSnapshot || normalizeText(sourceText?.title),
      sourceSnapshot: toOptionalText(payload?.sourceSnapshot) ?? toOptionalText(sourceText?.source),
      contentSnapshot,
      typedContent: typedContent || null,
      targetLength: metrics.targetLength,
      typedLength: metrics.typedLength,
      correctLength: metrics.correctLength,
      errorCount,
      backspaceCount,
      comboMax,
      accuracyRate: metrics.accuracyRate,
      completionRate: metrics.completionRate,
      cpm: metrics.cpm,
      score: configuredScore,
      durationSeconds: effectiveDurationSeconds,
      timeLimitSeconds: resolvedTimeLimitSeconds,
      previewSeconds,
      completedAt: new Date(),
    },
  });

  return serializeRecord(created, { includeSnapshots: true });
};

export const getTypingPracticeRecordForUser = async ({ db, userId, recordId }) => {
  const record = await db.typingPracticeRecord.findFirst({
    where: {
      id: recordId,
      userId,
    },
  });

  if (!record) {
    throw createHttpError("练习记录不存在", 404);
  }

  return serializeRecord(record, { includeSnapshots: true });
};
