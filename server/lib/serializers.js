import { formatDate, formatDateTime } from "./time.js";
import { getReadableObjectUrl } from "./upload.js";
import { normalizeDisplayText } from "./text.js";

export const serializeCourse = (
  course,
  audioCount = course?._count?.courseAudios ?? 0,
  videoCount = course?._count?.courseVideos ?? 0,
) => ({
  id: course.id,
  name: normalizeDisplayText(course.name),
  cover: getReadableObjectUrl({
    objectKey: course.coverObjectKey ?? "",
    fallbackUrl: course.coverUrl,
  }),
  coverObjectKey: course.coverObjectKey ?? "",
  description: normalizeDisplayText(course.description),
  courseType: course.courseType ?? "audio",
  status: course.status,
  openTime: formatDateTime(course.openTime),
  audioCount,
  videoCount,
  contentCount: (course.courseType ?? "audio") === "video" ? videoCount : audioCount,
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
  processStatus: audio.processStatus ?? "ready",
  processMessage: audio.processMessage ? normalizeDisplayText(audio.processMessage) : "",
  isReady: (audio.processStatus ?? "ready") === "ready",
  hasScript: Boolean(audio.scriptText?.trim()),
  script: audio.scriptText ? normalizeDisplayText(audio.scriptText) : undefined,
  handoutUrl: getReadableObjectUrl({
    objectKey: audio.handoutObjectKey ?? "",
    fallbackUrl: audio.handoutUrl ?? "",
  }),
  handoutObjectKey: audio.handoutObjectKey ?? "",
  handoutName: audio.handoutName ? normalizeDisplayText(audio.handoutName) : "",
  hasHandout: Boolean(audio.handoutObjectKey || audio.handoutUrl),
  uploadedAt: formatDateTime(audio.uploadedAt),
  audioUrl:
    (audio.processStatus ?? "ready") === "ready"
      ? getReadableObjectUrl({
          objectKey: audio.objectKey ?? "",
          fallbackUrl: audio.objectUrl ?? "",
        })
      : "",
});

export const serializeAudioListItem = (audio) => ({
  id: audio.id,
  name: normalizeDisplayText(audio.name),
  folderId: audio.folderId,
  duration: audio.duration,
  processStatus: audio.processStatus ?? "ready",
  processMessage: audio.processMessage ? normalizeDisplayText(audio.processMessage) : "",
  isReady: (audio.processStatus ?? "ready") === "ready",
  hasScript: Boolean(audio.scriptText?.trim()),
  handoutUrl: getReadableObjectUrl({
    objectKey: audio.handoutObjectKey ?? "",
    fallbackUrl: audio.handoutUrl ?? "",
  }),
  handoutObjectKey: audio.handoutObjectKey ?? "",
  handoutName: audio.handoutName ? normalizeDisplayText(audio.handoutName) : "",
  hasHandout: Boolean(audio.handoutObjectKey || audio.handoutUrl),
});

export const serializeVideo = (video) => ({
  id: video.id,
  name: normalizeDisplayText(video.name),
  folderId: video.folderId,
  duration: video.duration,
  hasScript: Boolean(video.scriptText?.trim()),
  script: video.scriptText ? normalizeDisplayText(video.scriptText) : undefined,
  handoutUrl: getReadableObjectUrl({
    objectKey: video.handoutObjectKey ?? "",
    fallbackUrl: video.handoutUrl ?? "",
  }),
  handoutObjectKey: video.handoutObjectKey ?? "",
  handoutName: video.handoutName ? normalizeDisplayText(video.handoutName) : "",
  hasHandout: Boolean(video.handoutObjectKey || video.handoutUrl),
  uploadedAt: formatDateTime(video.uploadedAt),
  videoUrl: getReadableObjectUrl({
    objectKey: video.objectKey ?? "",
    fallbackUrl: video.objectUrl ?? "",
  }),
});

export const serializeVideoListItem = (video) => ({
  id: video.id,
  name: normalizeDisplayText(video.name),
  folderId: video.folderId,
  duration: video.duration,
  hasScript: Boolean(video.scriptText?.trim()),
  handoutUrl: getReadableObjectUrl({
    objectKey: video.handoutObjectKey ?? "",
    fallbackUrl: video.handoutUrl ?? "",
  }),
  handoutObjectKey: video.handoutObjectKey ?? "",
  handoutName: video.handoutName ? normalizeDisplayText(video.handoutName) : "",
  hasHandout: Boolean(video.handoutObjectKey || video.handoutUrl),
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
  mockExamPermissions: (user.mockExamSeriesPermissions ?? []).map((item) => item.seriesId),
  mockExamAccessiblePaperIds: Array.from(new Set([...(user.mockExamPermissions ?? []).map((item) => item.paperId), ...(user.mockExamParticipatedPaperIds ?? [])])),
  mockExamPermissionConfigs: [
    ...new Map(
      [
        ...(user.mockExamPermissions ?? []).map((item) => [
          item.paperId,
          {
            paperId: item.paperId,
            manualAttemptLimit: item.manualAttemptLimit ?? null,
            manualAttemptUsed: Number(item.manualAttemptUsed ?? 0),
            currentRecordStartedAt: item.currentRecordStartedAt ? formatDateTime(item.currentRecordStartedAt) : "",
          },
        ]),
        ...(user.mockExamParticipatedPaperIds ?? []).map((paperId) => [
          paperId,
          {
            paperId,
            manualAttemptLimit: null,
            manualAttemptUsed: 0,
            currentRecordStartedAt: "",
          },
        ]),
      ],
    ).values(),
  ],
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

export const serializeVideoFolder = (folder, videoCount = 0) => ({
  id: folder.id,
  name: normalizeDisplayText(folder.name),
  videoCount,
});
