export interface RecentCourseSnapshot {
  courseId: string;
  courseName: string;
  audioId: string;
  audioName: string;
  tagName: string;
  progressSeconds: number;
  durationSeconds: number;
  progressPercent: number;
  completed: boolean;
  lastUpdated: string;
}

const STORAGE_KEY_PREFIX = "userRecentCourse";

const isBrowser = () => typeof window !== "undefined";

const getStorageKey = (userId: string) => `${STORAGE_KEY_PREFIX}:${userId}`;

const normalizeSnapshot = (value: unknown): RecentCourseSnapshot | null => {
  if (!value || typeof value !== "object") return null;

  const snapshot = value as Partial<RecentCourseSnapshot>;
  if (!snapshot.courseId || !snapshot.audioId) return null;

  const progressSeconds = Math.max(0, Math.floor(Number(snapshot.progressSeconds ?? 0)));
  const durationSeconds = Math.max(0, Math.floor(Number(snapshot.durationSeconds ?? 0)));
  const computedPercent =
    durationSeconds > 0 ? Math.min(100, Math.round((progressSeconds / durationSeconds) * 100)) : 0;

  return {
    courseId: `${snapshot.courseId}`,
    courseName: `${snapshot.courseName ?? ""}`,
    audioId: `${snapshot.audioId}`,
    audioName: `${snapshot.audioName ?? ""}`,
    tagName: `${snapshot.tagName ?? ""}`,
    progressSeconds,
    durationSeconds,
    progressPercent: Math.max(0, Math.min(100, Math.floor(Number(snapshot.progressPercent ?? computedPercent)))),
    completed: Boolean(snapshot.completed),
    lastUpdated: `${snapshot.lastUpdated ?? ""}` || new Date().toISOString(),
  };
};

export const getRecentCourseSnapshot = (userId: string) => {
  if (!isBrowser() || !userId) return null;

  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return null;
    return normalizeSnapshot(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const saveRecentCourseSnapshot = (userId: string, snapshot: RecentCourseSnapshot) => {
  if (!isBrowser() || !userId) return;

  const normalized = normalizeSnapshot(snapshot);
  if (!normalized) return;

  try {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(normalized));
  } catch {
    // Ignore storage failures in restricted environments.
  }
};
