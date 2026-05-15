import { normalizeDisplayText } from "./text.js";

const readHeaderValue = (value) => {
  if (Array.isArray(value)) {
    return `${value[0] ?? ""}`.trim();
  }

  return `${value ?? ""}`.trim();
};

const trimIp = (value) => {
  const normalized = `${value ?? ""}`.trim().replace(/^::ffff:/, "");
  return normalized ? normalized.slice(0, 64) : "";
};

const getDeviceFallbackFromUserAgent = (userAgent = "") => {
  const ua = `${userAgent ?? ""}`.toLowerCase();

  if (ua.includes("iphone")) {
    return { type: "iPhone", model: "iPhone" };
  }

  if (ua.includes("ipad")) {
    return { type: "iPad", model: "iPad" };
  }

  if (ua.includes("android")) {
    return { type: "Android", model: "Android Device" };
  }

  if (ua.includes("windows")) {
    return { type: "Windows", model: "Windows Browser" };
  }

  if (ua.includes("macintosh") || ua.includes("mac os")) {
    return { type: "Mac", model: "Mac Browser" };
  }

  if (ua.includes("uos") || ua.includes("uniontech") || ua.includes("deepin") || ua.includes("x11") || ua.includes("linux")) {
    return { type: "Linux", model: "Linux Browser" };
  }

  return { type: "Web", model: "Web App" };
};

const normalizeDeviceField = (value, maxLength, fallback) => {
  const normalized = normalizeDisplayText(`${value ?? ""}`).replace(/\s+/g, " ").trim();
  return (normalized || fallback).slice(0, maxLength);
};

export const getClientIp = (req) => {
  const forwardedFor = readHeaderValue(req.headers["x-forwarded-for"]);
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    const normalized = trimIp(firstIp);
    if (normalized) return normalized;
  }

  const realIp = trimIp(readHeaderValue(req.headers["x-real-ip"]));
  if (realIp) return realIp;

  const requestIp = trimIp(req.ip);
  if (requestIp) return requestIp;

  const socketIp = trimIp(req.socket?.remoteAddress ?? req.connection?.remoteAddress);
  return socketIp || "0.0.0.0";
};

export const getNormalizedDeviceInfo = (req, input = {}) => {
  const fallback = getDeviceFallbackFromUserAgent(req.headers["user-agent"]);

  return {
    type: normalizeDeviceField(input.type, 50, fallback.type),
    model: normalizeDeviceField(input.model, 100, fallback.model),
    ip: getClientIp(req),
  };
};
