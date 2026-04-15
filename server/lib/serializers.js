import { formatDate, formatDateTime } from "./time.js";
import { getReadableObjectUrl } from "./upload.js";
import { normalizeDisplayText } from "./text.js";

export const serializeCourse = (course, audioCount = 0) => ({
  id: course.id,
  name: normalizeDisplayText(course.name),
  cover: getReadableObjectUrl({
    objectKey: course.coverObjectKey ?? "",
    fallbackUrl: course.coverUrl,
  }),
  description: normalizeDisplayText(course.description),
  status: course.status,
  openTime: formatDateTime(course.openTime),
  audioCount,
  createdAt: formatDate(course.createdAt),
  sortOrder: course.sortOrder,
});

export const serializeTag = (tag) => ({
  id: tag.id,
  courseId: tag.courseId,
  name: normalizeDisplayText(tag.name),
  order: tag.order,
});

export const serializeAudio = (audio) => ({
  id: audio.id,
  name: normalizeDisplayText(audio.name),
  folderId: audio.folderId,
  duration: audio.duration,
  hasScript: Boolean(audio.scriptText?.trim()),
  script: audio.scriptText ? normalizeDisplayText(audio.scriptText) : undefined,
  uploadedAt: formatDateTime(audio.uploadedAt),
  audioUrl: getReadableObjectUrl({
    objectKey: audio.objectKey ?? "",
    fallbackUrl: audio.objectUrl,
  }),
});

export const serializeUser = (user) => ({
  id: user.id,
  phone: user.phone,
  password: "",
  status: user.status,
  registeredAt: formatDate(user.registeredAt),
  lastLogin: user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "",
  deviceCount: user._count?.devices ?? user.devices?.length ?? 0,
  coursePermissions: (user.permissions ?? []).map((item) => item.courseId),
});

export const serializeDevice = (device) => ({
  id: device.id,
  userId: device.userId,
  deviceKey: device.deviceKey,
  type: device.type,
  model: device.model,
  loginTime: formatDateTime(device.loginAt),
  ip: device.ip,
});

export const serializeFolder = (folder, audioCount = 0) => ({
  id: folder.id,
  name: normalizeDisplayText(folder.name),
  audioCount,
});
