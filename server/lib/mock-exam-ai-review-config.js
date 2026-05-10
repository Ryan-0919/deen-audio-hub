import { config as runtimeConfig } from "./config.js";
import {
  DEFAULT_AI_REVIEW_SYSTEM_PROMPT,
  DEFAULT_AI_REVIEW_USER_PROMPT_TEMPLATE,
  normalizeAiReviewSystemPrompt,
  normalizeAiReviewUserPromptTemplate,
} from "./mock-exam-ai-review.js";

const normalizeBaseUrl = (value) => `${value ?? ""}`.trim().replace(/\/+$/, "");

const toNonNegativeInt = (value, fallback) => {
  const parsed = Number.parseInt(`${value ?? ""}`, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const normalizeMockExamAiReviewConfig = (value) => {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const provider = `${source.provider ?? runtimeConfig.mockExamAiReview.provider ?? "rules"}`.trim().toLowerCase() || "rules";

  return {
    provider: provider === "openai-compatible" ? "openai-compatible" : "rules",
    baseUrl: normalizeBaseUrl(source.baseUrl ?? runtimeConfig.mockExamAiReview.baseUrl ?? ""),
    apiKey: `${source.apiKey ?? runtimeConfig.mockExamAiReview.apiKey ?? ""}`.trim(),
    model: `${source.model ?? runtimeConfig.mockExamAiReview.model ?? ""}`.trim(),
    timeoutMs: toNonNegativeInt(source.timeoutMs, runtimeConfig.mockExamAiReview.timeoutMs ?? 120000),
    systemPrompt: normalizeAiReviewSystemPrompt(source.systemPrompt ?? runtimeConfig.mockExamAiReview.systemPrompt ?? DEFAULT_AI_REVIEW_SYSTEM_PROMPT),
    userPromptTemplate: normalizeAiReviewUserPromptTemplate(
      source.userPromptTemplate ?? runtimeConfig.mockExamAiReview.userPromptTemplate ?? DEFAULT_AI_REVIEW_USER_PROMPT_TEMPLATE,
    ),
  };
};

export const parseMockExamAiReviewConfigJson = (value) => {
  if (!value) {
    return normalizeMockExamAiReviewConfig(null);
  }

  try {
    return normalizeMockExamAiReviewConfig(JSON.parse(value));
  } catch (_error) {
    return normalizeMockExamAiReviewConfig(null);
  }
};

export const getMockExamAiReviewConfig = async (db) => {
  const systemConfig = await db.systemConfig.findUnique({
    where: { id: 1 },
    select: {
      mockExamAiReviewConfigJson: true,
    },
  });

  return parseMockExamAiReviewConfigJson(systemConfig?.mockExamAiReviewConfigJson ?? null);
};
