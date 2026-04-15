import OSS from "ali-oss";
import { randomUUID } from "node:crypto";
import { lookup as lookupMime, extension as mimeExtension } from "mime-types";
import { config, ossConfigured } from "./config.js";
import { normalizeDisplayText } from "./text.js";

const slugify = (value) =>
  value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const ossClient = ossConfigured
  ? new OSS({
      region: config.ossRegion,
      bucket: config.ossBucket,
      accessKeyId: config.ossAccessKeyId,
      accessKeySecret: config.ossAccessKeySecret,
    })
  : null;

const buildPublicUrl = (objectKey, fallbackUrl = "") => {
  if (config.ossPublicBaseUrl) {
    return `${config.ossPublicBaseUrl.replace(/\/$/, "")}/${objectKey}`;
  }
  return fallbackUrl;
};

const getDefaultBucketHosts = () => [
  `http://${config.ossBucket}.${config.ossRegion}.aliyuncs.com/`,
  `https://${config.ossBucket}.${config.ossRegion}.aliyuncs.com/`,
];

export const extractObjectKeyFromUrl = (url = "") => {
  if (!url) return "";

  if (config.ossPublicBaseUrl) {
    const base = `${config.ossPublicBaseUrl.replace(/\/$/, "")}/`;
    if (url.startsWith(base)) {
      return decodeURIComponent(url.slice(base.length));
    }
  }

  for (const host of getDefaultBucketHosts()) {
    if (url.startsWith(host)) {
      return decodeURIComponent(url.slice(host.length));
    }
  }

  return "";
};

export const getReadableObjectUrl = ({ objectKey = "", fallbackUrl = "" }) => {
  const resolvedKey = objectKey || extractObjectKeyFromUrl(fallbackUrl);

  if (!resolvedKey) {
    return fallbackUrl;
  }

  if (config.ossPublicBaseUrl) {
    return buildPublicUrl(resolvedKey, fallbackUrl);
  }

  if (ossClient) {
    return ossClient.signatureUrl(resolvedKey, {
      expires: 24 * 60 * 60,
    });
  }

  return fallbackUrl;
};

export const ensureOssConfigured = () => {
  if (!ossClient) {
    throw new Error("请先完成阿里云 OSS 环境变量配置");
  }
};

export const uploadBuffer = async ({ fileName, buffer, mimeType, folder }) => {
  ensureOssConfigured();

  const normalizedFileName = normalizeDisplayText(fileName) || fileName;
  const ext =
    (mimeType && mimeExtension(mimeType)) ||
    (normalizedFileName.includes(".") ? normalizedFileName.split(".").pop() : "") ||
    (fileName.includes(".") ? fileName.split(".").pop() : "") ||
    "bin";
  const baseName = normalizedFileName.replace(/\.[^.]+$/, "") || "file";
  const objectKey = `${folder}/${Date.now()}-${randomUUID()}-${slugify(baseName)}.${ext}`;

  const result = await ossClient.put(objectKey, buffer, {
    headers: {
      "Content-Type": mimeType || lookupMime(normalizedFileName) || lookupMime(fileName) || "application/octet-stream",
    },
  });

  return {
    objectKey,
    url: buildPublicUrl(objectKey, result.url),
  };
};

export const deleteObject = async (objectKey = "") => {
  ensureOssConfigured();

  const normalized = `${objectKey ?? ""}`.trim();
  if (!normalized) return false;

  await ossClient.delete(normalized);
  return true;
};
