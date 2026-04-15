import { prisma } from "./prisma.js";

const MAX_PREVIEW_LENGTH = 1000;

const extractTitle = (content = "") => {
  const line = `${content ?? ""}`
    .split("\n")
    .map((item) => item.trim())
    .find((item) => item.startsWith("#"));

  return line ? line.replace(/^#+\s*/, "").slice(0, 191) : "";
};

const maskWebhookUrl = (value = "") => {
  const text = `${value ?? ""}`.trim();
  if (!text) return "";

  try {
    const url = new URL(text);
    return `${url.origin}${url.pathname}`.slice(0, 500);
  } catch (_error) {
    return text.slice(0, 120);
  }
};

export const writeWebhookLog = async ({
  scene,
  status,
  content = "",
  webhookUrl = "",
  responseCode = null,
  errorMessage = "",
  relatedEntityType = "",
  relatedEntityId = "",
}) => {
  if (!scene || !status) return null;

  return prisma.webhookLog.create({
    data: {
      scene,
      status,
      title: extractTitle(content) || null,
      webhookUrl: maskWebhookUrl(webhookUrl) || null,
      messagePreview: `${content ?? ""}`.slice(0, MAX_PREVIEW_LENGTH) || null,
      responseCode: Number.isInteger(responseCode) ? responseCode : null,
      errorMessage: `${errorMessage ?? ""}`.trim().slice(0, 500) || null,
      relatedEntityType: relatedEntityType || null,
      relatedEntityId: relatedEntityId || null,
    },
  });
};
