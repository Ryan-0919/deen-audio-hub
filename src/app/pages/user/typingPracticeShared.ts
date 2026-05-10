import type { TypingPracticeDifficulty, TypingPracticeMode, TypingPracticeText } from "../../lib/mockData";

export const TYPING_PRACTICE_POLICE_IMAGE = "/typing-practice/police.png";
export const TYPING_PRACTICE_THIEF_IMAGE = "/typing-practice/thief.png";

export const typingPracticeModeMeta: Record<
  TypingPracticeMode,
  {
    label: string;
    shortDescription: string;
    badgeClassName: string;
    buttonClassName: string;
    softPanelClassName: string;
    startLabel: string;
  }
> = {
  guided: {
    label: "跟打练习",
    shortDescription: "按原文逐字输入",
    badgeClassName: "border-[#6db6d8] bg-[#e7f7ff] text-[#25617d]",
    buttonClassName: "border-[#6db6d8] bg-[#7fd0f4] text-[#0f3b4d] hover:bg-[#72c8ef]",
    softPanelClassName: "border-[#bfe6f6] bg-[#f0fbff] text-[#25617d]",
    startLabel: "开始练习",
  },
  sprint: {
    label: "限时冲刺",
    shortDescription: "当前文本截段限时追捕",
    badgeClassName: "border-[#e9bf57] bg-[#fff4cc] text-[#8c5e00]",
    buttonClassName: "border-[#e0aa2a] bg-[#ffd666] text-[#7a5000] hover:bg-[#ffcb47]",
    softPanelClassName: "border-[#f2dea3] bg-[#fff9e5] text-[#8c5e00]",
    startLabel: "开始冲刺",
  },
  memorize: {
    label: "法条默写",
    shortDescription: "先预览后隐藏默写",
    badgeClassName: "border-[#d5b5f0] bg-[#f7eeff] text-[#7a4aa0]",
    buttonClassName: "border-[#cb9ef0] bg-[#e5c8fb] text-[#5f2c87] hover:bg-[#ddb8fa]",
    softPanelClassName: "border-[#ead7fa] bg-[#fcf7ff] text-[#7a4aa0]",
    startLabel: "开始默写",
  },
};

export const DEFAULT_MEMORIZE_PREVIEW_SECONDS = 12;
export const TYPING_PRACTICE_VISIBLE_TILE_COUNT = 60;

const normalizeTypingPracticeContent = (value: string) => `${value ?? ""}`.replace(/\r\n/g, "\n").trim();

export const buildTypingPracticeSearch = (
  mode: TypingPracticeMode,
  options?: { difficulty?: TypingPracticeDifficulty; timeLimitSeconds?: number; previewSeconds?: number },
) => {
  const searchParams = new URLSearchParams();
  searchParams.set("mode", mode);

  if (options?.difficulty) {
    searchParams.set("difficulty", options.difficulty);
  }

  if (options?.timeLimitSeconds) {
    searchParams.set("limit", `${options.timeLimitSeconds}`);
  }

  if (options?.previewSeconds) {
    searchParams.set("preview", `${options.previewSeconds}`);
  }

  return `?${searchParams.toString()}`;
};

export const formatTypingDuration = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${`${minutes}`.padStart(2, "0")}:${`${seconds}`.padStart(2, "0")}`;
};

export const formatTypingSecondsText = (totalSeconds: number) => `${Math.max(0, Math.floor(totalSeconds))}秒`;

export const buildTypingAccuracyText = (value: number) => `${Math.max(0, Math.round(value))}%`;
export const buildTypingScoreText = (value: number) => `${Math.max(0, Math.round(value))}`;

const trimSegmentToBoundary = (content: string, maxLength: number) => {
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

export const createSprintTargetContent = (content: string, timeLimitSeconds: number) => {
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
    segment = normalized.slice(Math.max(0, Math.floor(Math.random() * Math.max(1, normalized.length - desiredLength))), normalized.length);
  }

  return trimSegmentToBoundary(segment, desiredLength);
};

export const parseTypingPracticeMode = (value: string | null): TypingPracticeMode => {
  if (value === "sprint" || value === "memorize") return value;
  return "guided";
};

export const parseTypingPracticeDifficulty = (value: string | null): TypingPracticeDifficulty => {
  if (value === "easy" || value === "hard") return value;
  return "medium";
};

export const parsePositiveSearchNumber = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(`${value ?? ""}`.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const buildTypingPracticePromptText = (mode: TypingPracticeMode) => {
  if (mode === "memorize") {
    return "预览结束后，请凭记忆按顺序输入以下内容：";
  }

  if (mode === "sprint") {
    return "请在限时内按顺序输入以下内容：";
  }

  return "请按顺序输入以下内容：";
};

export const buildTypingPracticeIdleHint = (mode: TypingPracticeMode, modeHints?: Partial<Record<TypingPracticeMode, string>>) => {
  const configured = `${modeHints?.[mode] ?? ""}`.trim();
  if (configured) {
    return configured;
  }

  if (mode === "memorize") {
    return "开始后会先进入短暂预览，再自动隐藏题面进入默写。";
  }

  if (mode === "sprint") {
    return "开始后会基于当前选中文本截取片段，并立即进入限时追击。";
  }

  return "开始后立即进入逐字跟打状态。";
};

export const buildTypingPracticeCompletionMessage = (isSuccess: boolean) =>
  isSuccess ? "任务完成，所有小偷均已抓获。" : "本局结束，仍有小偷逃脱。";

export const buildTypingPracticeTileWindow = (content: string, currentIndex: number, visibleCount = TYPING_PRACTICE_VISIBLE_TILE_COUNT) => {
  const normalized = `${content ?? ""}`;
  const safeIndex = Math.max(0, Math.min(currentIndex, normalized.length));
  const anchorIndex = normalized.length > 0 && safeIndex >= normalized.length ? normalized.length - 1 : safeIndex;
  const chunkStart = Math.floor(anchorIndex / visibleCount) * visibleCount;
  const rawChars = Array.from(normalized.slice(chunkStart, chunkStart + visibleCount));
  const chars = rawChars.length === visibleCount ? rawChars : [...rawChars, ...Array.from({ length: visibleCount - rawChars.length }, () => "")];

  return {
    chunkStart,
    chars,
    activeIndexInChunk: Math.max(0, safeIndex - chunkStart),
  };
};

export const buildTypingPracticeStageWindow = (totalStageCount: number, currentStageIndex: number, visibleCount = 12) => {
  const safeTotal = Math.max(0, totalStageCount);
  if (safeTotal <= 0) {
    return [];
  }

  if (safeTotal <= visibleCount) {
    return Array.from({ length: safeTotal }, (_, index) => index);
  }

  const maxStart = safeTotal - visibleCount;
  const centeredStart = Math.max(0, currentStageIndex - Math.floor(visibleCount / 2));
  const start = Math.min(centeredStart, maxStart);
  return Array.from({ length: visibleCount }, (_, index) => start + index);
};

export const buildTypingPracticeRetryHref = (record: {
  textId: string;
  mode: TypingPracticeMode;
  difficulty: TypingPracticeDifficulty;
  timeLimitSeconds: number | null;
  previewSeconds: number | null;
}) => {
  if (!record.textId) return "";

  return `/user/typing-practice/texts/${record.textId}/play${buildTypingPracticeSearch(record.mode, {
    difficulty: record.difficulty,
    timeLimitSeconds: record.timeLimitSeconds ?? undefined,
    previewSeconds: record.previewSeconds ?? undefined,
  })}`;
};

export const pickNextTypingPracticeText = (texts: TypingPracticeText[], currentTextId: string, direction: "next" | "prev") => {
  if (texts.length === 0) return null;

  const currentIndex = texts.findIndex((item) => item.id === currentTextId);
  if (currentIndex < 0) {
    return texts[0];
  }

  const offset = direction === "next" ? 1 : -1;
  const nextIndex = (currentIndex + offset + texts.length) % texts.length;
  return texts[nextIndex];
};
