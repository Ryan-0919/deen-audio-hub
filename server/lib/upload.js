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
      secure: config.ossSecure,
      timeout: config.ossTimeoutMs,
      retryMax: config.ossRetryMax,
      accessKeyId: config.ossAccessKeyId,
      accessKeySecret: config.ossAccessKeySecret,
    })
  : null;

const MAX_OBJECT_KEY_LENGTH = 255;
const MAX_SLUG_LENGTH = 120;

const toHttpsUrl = (value = "") => `${value ?? ""}`.trim().replace(/^http:\/\//i, "https://");
const stripTrailingSlash = (value = "") => `${value ?? ""}`.trim().replace(/\/$/, "");
const getConfiguredPublicBaseCandidates = () => {
  const configured = stripTrailingSlash(config.ossPublicBaseUrl);
  if (!configured) return [];
  return [...new Set([configured, toHttpsUrl(configured)])];
};

const buildPublicUrl = (objectKey, fallbackUrl = "") => {
  if (config.ossPublicBaseUrl) {
    return `${toHttpsUrl(stripTrailingSlash(config.ossPublicBaseUrl))}/${objectKey}`;
  }
  return toHttpsUrl(fallbackUrl);
};

const buildOriginObjectUrl = (objectKey = "") => {
  if (!objectKey) return "";
  return `https://${config.ossBucket}.${config.ossRegion}.aliyuncs.com/${objectKey}`;
};

const getDefaultBucketHosts = () => [
  `http://${config.ossBucket}.${config.ossRegion}.aliyuncs.com/`,
  `https://${config.ossBucket}.${config.ossRegion}.aliyuncs.com/`,
];

const stripUrlQueryAndHash = (value = "") => value.split("#", 1)[0].split("?", 1)[0];

export const extractObjectKeyFromUrl = (url = "") => {
  if (!url) return "";

  for (const candidate of getConfiguredPublicBaseCandidates()) {
    const base = `${candidate}/`;
    if (url.startsWith(base)) {
      return decodeURIComponent(stripUrlQueryAndHash(url.slice(base.length)));
    }
  }

  for (const host of getDefaultBucketHosts()) {
    if (url.startsWith(host)) {
      return decodeURIComponent(stripUrlQueryAndHash(url.slice(host.length)));
    }
  }

  return "";
};

export const getReadableObjectUrl = ({ objectKey = "", fallbackUrl = "" }) => {
  const resolvedKey = objectKey || extractObjectKeyFromUrl(fallbackUrl);

  if (!resolvedKey) {
    return toHttpsUrl(fallbackUrl);
  }

  if (config.ossPublicBaseUrl) {
    return buildPublicUrl(resolvedKey, fallbackUrl);
  }

  if (ossClient) {
    return toHttpsUrl(
      ossClient.signatureUrl(resolvedKey, {
        expires: 24 * 60 * 60,
      }),
    );
  }

  return toHttpsUrl(fallbackUrl);
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
  const slug = slugify(baseName).slice(0, MAX_SLUG_LENGTH) || "file";
  const suffix = `${Date.now()}-${randomUUID()}-${slug}.${ext}`;
  const folderPrefix = `${folder}/`;
  const maxSuffixLength = Math.max(MAX_OBJECT_KEY_LENGTH - folderPrefix.length, 32);
  const objectKey = `${folderPrefix}${suffix.slice(0, maxSuffixLength)}`;

  const result = await ossClient.multipartUpload(objectKey, buffer, {
    timeout: config.ossTimeoutMs,
    parallel: config.ossMultipartParallel,
    mime: mimeType || lookupMime(normalizedFileName) || lookupMime(fileName) || "application/octet-stream",
    headers: {
      "Content-Type": mimeType || lookupMime(normalizedFileName) || lookupMime(fileName) || "application/octet-stream",
    },
  });

  return {
    objectKey,
    url: buildPublicUrl(objectKey, buildOriginObjectUrl(objectKey)),
    readableUrl: getReadableObjectUrl({
      objectKey,
      fallbackUrl: buildPublicUrl(objectKey, buildOriginObjectUrl(objectKey)),
    }),
  };
};

export const deleteObject = async (objectKey = "") => {
  ensureOssConfigured();

  const normalized = `${objectKey ?? ""}`.trim();
  if (!normalized) return false;

  await ossClient.delete(normalized);
  return true;
};
