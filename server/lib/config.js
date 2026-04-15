import "dotenv/config";

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

const parseOrigins = (value) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const config = {
  port: Number(optional("PORT") || "3001"),
  schedulerIntervalMs: Number(optional("SCHEDULER_INTERVAL_MS") || "30000"),
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
};

export const ossConfigured = Boolean(
  config.ossRegion &&
    config.ossBucket &&
    config.ossAccessKeyId &&
    config.ossAccessKeySecret &&
    ![config.ossRegion, config.ossBucket, config.ossAccessKeyId, config.ossAccessKeySecret].some(isPlaceholderValue),
);

export const isConfiguredValue = (value) => Boolean(`${value ?? ""}`.trim()) && !isPlaceholderValue(`${value ?? ""}`.trim());
