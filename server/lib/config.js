import "dotenv/config";
import fs from "node:fs";

const readEnv = (name) => `${process.env[name] ?? ""}`.trim();
const isPlaceholderValue = (value) => /^replace-|^your-/i.test(value);

const required = (name, { allowPlaceholder = false } = {}) => {
  const value = readEnv(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  if (!allowPlaceholder && isPlaceholderValue(value)) {
    throw new Error(`Environment variable ${name} is still using a placeholder value`);
  }

  return value;
};

const optional = (name) => readEnv(name);
const optionalBoolean = (name, fallback = false) => {
  const value = optional(name).toLowerCase();
  if (!value) return fallback;
  return value === "1" || value === "true" || value === "yes" || value === "on";
};
const optionalPositiveInt = (name, fallback) => {
  const value = Number.parseInt(optional(name) || "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};
const optionalNonNegativeInt = (name, fallback) => {
  const value = Number.parseInt(optional(name) || "", 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};
const normalizeMultiline = (value) => value.replace(/\\n/g, "\n").trim();
const normalizeBaseUrl = (value) => `${value ?? ""}`.trim().replace(/\/+$/, "");
const readPem = (valueName, pathName) => {
  const inlineValue = optional(valueName);
  if (inlineValue) {
    return normalizeMultiline(inlineValue);
  }

  const filePath = optional(pathName);
  if (!filePath) {
    return "";
  }

  return fs.readFileSync(filePath, "utf8").trim();
};

const parseOrigins = (value) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const config = {
  port: Number(optional("PORT") || "3001"),
  schedulerIntervalMs: Number(optional("SCHEDULER_INTERVAL_MS") || "30000"),
  audioProcessConcurrency: optionalPositiveInt("AUDIO_PROCESS_CONCURRENCY", 1),
  audioProcessingDir: optional("AUDIO_PROCESSING_DIR"),
  audioTranscodeEnabled: optionalBoolean("AUDIO_TRANSCODE_ENABLED", true),
  ffmpegPath: optional("FFMPEG_PATH"),
  mockExamAiReview: {
    provider: optional("MOCK_EXAM_AI_PROVIDER") || "rules",
    baseUrl: normalizeBaseUrl(optional("MOCK_EXAM_AI_BASE_URL")),
    apiKey: optional("MOCK_EXAM_AI_API_KEY"),
    model: optional("MOCK_EXAM_AI_MODEL"),
    timeoutMs: optionalNonNegativeInt("MOCK_EXAM_AI_TIMEOUT_MS", 120000),
  },
  shopPaymentMode: optional("SHOP_PAYMENT_MODE") || "mock",
  shopOrderAutoCloseMinutes: Math.max(Number(optional("SHOP_ORDER_AUTO_CLOSE_MINUTES") || "30"), 1),
  paySiteBaseUrl: normalizeBaseUrl(optional("PAY_SITE_BASE_URL")),
  payNotifyBaseUrl: normalizeBaseUrl(optional("PAY_NOTIFY_BASE_URL") || optional("PAY_SITE_BASE_URL")),
  databaseUrl: required("DATABASE_URL", { allowPlaceholder: true }),
  jwtSecret: required("JWT_SECRET"),
  adminAccount: optional("ADMIN_ACCOUNT"),
  adminPassword: optional("ADMIN_PASSWORD"),
  corsOrigins: parseOrigins(optional("CORS_ORIGIN") || "http://localhost:5173,http://127.0.0.1:5173"),
  ossRegion: optional("OSS_REGION"),
  ossBucket: optional("OSS_BUCKET"),
  ossAccessKeyId: optional("OSS_ACCESS_KEY_ID"),
  ossAccessKeySecret: optional("OSS_ACCESS_KEY_SECRET"),
  ossPublicBaseUrl: optional("OSS_PUBLIC_BASE_URL"),
  ossSecure: optionalBoolean("OSS_SECURE", false),
  ossTimeoutMs: optionalPositiveInt("OSS_TIMEOUT_MS", 5 * 60 * 1000),
  ossRetryMax: optionalPositiveInt("OSS_RETRY_MAX", 2),
  ossMultipartParallel: optionalPositiveInt("OSS_MULTIPART_PARALLEL", 3),
  wechatPay: {
    appId: optional("WECHAT_PAY_APP_ID"),
    appSecret: optional("WECHAT_PAY_APP_SECRET"),
    mchId: optional("WECHAT_PAY_MCH_ID"),
    mchSerialNo: optional("WECHAT_PAY_MCH_SERIAL_NO"),
    privateKeyPem: readPem("WECHAT_PAY_PRIVATE_KEY", "WECHAT_PAY_PRIVATE_KEY_PATH"),
    apiV3Key: optional("WECHAT_PAY_API_V3_KEY"),
    platformCertPem: readPem("WECHAT_PAY_PLATFORM_CERT", "WECHAT_PAY_PLATFORM_CERT_PATH"),
    platformSerial: optional("WECHAT_PAY_PLATFORM_SERIAL"),
    h5AppName: optional("WECHAT_PAY_H5_APP_NAME") || "Deen Audio Hub",
    h5AppUrl: normalizeBaseUrl(optional("WECHAT_PAY_H5_APP_URL") || optional("PAY_SITE_BASE_URL")),
  },
  alipay: {
    appId: optional("ALIPAY_APP_ID"),
    privateKeyPem: readPem("ALIPAY_PRIVATE_KEY", "ALIPAY_PRIVATE_KEY_PATH"),
    publicKeyPem: readPem("ALIPAY_PUBLIC_KEY", "ALIPAY_PUBLIC_KEY_PATH"),
    gateway: normalizeBaseUrl(optional("ALIPAY_GATEWAY") || "https://openapi.alipay.com/gateway.do"),
  },
};

export const ossConfigured = Boolean(
  config.ossRegion &&
    config.ossBucket &&
    config.ossAccessKeyId &&
    config.ossAccessKeySecret &&
    ![config.ossRegion, config.ossBucket, config.ossAccessKeyId, config.ossAccessKeySecret].some(isPlaceholderValue),
);

export const isConfiguredValue = (value) => Boolean(`${value ?? ""}`.trim()) && !isPlaceholderValue(`${value ?? ""}`.trim());
