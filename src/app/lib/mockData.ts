export type UserStatus = "active" | "disabled";
export type CourseStatus = "open" | "closed" | "scheduled";

export interface User {
  id: string;
  phone: string;
  password: string;
  status: UserStatus;
  registeredAt: string;
  lastLogin: string;
  deviceCount: number;
  coursePermissions: string[];
}

export interface Course {
  id: string;
  name: string;
  cover: string;
  description: string;
  status: CourseStatus;
  openTime: string;
  audioCount: number;
  createdAt: string;
  sortOrder: number;
}

export interface Tag {
  id: string;
  courseId: string;
  name: string;
  order: number;
}

export interface Audio {
  id: string;
  name: string;
  folderId: string;
  duration: number;
  hasScript: boolean;
  script?: string;
  uploadedAt?: string;
  audioUrl?: string;
}

export interface UserProgress {
  userId: string;
  courseId: string;
  audioId: string;
  progress: number;
  completed: boolean;
  lastUpdated: string;
}

export interface Folder {
  id: string;
  name: string;
  audioCount: number;
}

export interface Device {
  id: string;
  userId: string;
  deviceKey: string;
  type: string;
  model: string;
  loginTime: string;
  ip: string;
}

export interface AdminAccount {
  id: string;
  account: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface SystemConfig {
  webhookUrl: string;
  customerServiceUrl: string;
  brandLogoUrl: string;
  brandLogoObjectKey: string;
  playerDiscImageUrl: string;
  playerDiscImageObjectKey: string;
}

export interface LogSummary {
  auditTotal: number;
  auditToday: number;
  webhookSuccess: number;
  webhookFailed: number;
  webhookSkipped: number;
}

export interface AuditLogItem {
  id: string;
  operatorName: string;
  operatorAccount: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName: string;
  detail: string;
  createdAt: string;
}

export type WebhookLogStatus = "success" | "failed" | "skipped";

export interface WebhookLogItem {
  id: string;
  scene: string;
  status: WebhookLogStatus;
  title: string;
  webhookUrl: string;
  messagePreview: string;
  responseCode: number | null;
  errorMessage: string;
  relatedEntityType: string;
  relatedEntityId: string;
  createdAt: string;
}

export interface BrandingConfig {
  brandLogoUrl: string;
  customerServiceUrl: string;
  playerDiscImageUrl: string;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CourseDetailPayload {
  course: Course;
  tags: Tag[];
  selectedTagId?: string;
  tagContents?: TagContentPayload[];
  initialAudios?: Audio[];
  initialProgress?: UserProgress[];
}

export interface TagAudiosPayload {
  audios: Audio[];
  progress: UserProgress[];
}

export interface TagContentPayload extends TagAudiosPayload {
  tagId: string;
}

export interface UserSummary {
  total: number;
  active: number;
  disabled: number;
  fullDevices: number;
}

export interface AudioLibraryTagOption {
  id: string;
  name: string;
}

export interface AudioLibraryMeta {
  totalAudioCount: number;
  referencedCount: number;
  pendingScriptCount: number;
  tagOptions: AudioLibraryTagOption[];
}

export interface AudioLibraryItem extends Audio {
  folderName: string;
  courseRefs: { courseId: string; courseName: string; tagId: string; tagName: string }[];
}

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

export class ApiRequestError extends Error {
  code: number;
  status: number;

  constructor(message: string, options?: { code?: number; status?: number }) {
    super(message);
    this.name = "ApiRequestError";
    this.code = options?.code ?? -1;
    this.status = options?.status ?? 0;
  }
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const ADMIN_CACHE_TTL_MS = 30 * 1000;

const buildUrl = (path: string) => (API_BASE ? `${API_BASE}${path}` : path);
const buildQueryString = (params: Record<string, string | number | undefined>) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") return;
    searchParams.set(key, `${value}`);
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
};

const isAdminContext = () => typeof window !== "undefined" && window.location.pathname.startsWith("/admin");

const getToken = (mode: "user" | "admin" | "auto") => {
  if (mode === "user") return localStorage.getItem("userToken") ?? "";
  if (mode === "admin") return localStorage.getItem("adminToken") ?? "";
  return isAdminContext() ? localStorage.getItem("adminToken") ?? "" : localStorage.getItem("userToken") ?? "";
};

const clearUserSession = () => {
  localStorage.removeItem("userToken");
  localStorage.removeItem("userId");
  localStorage.removeItem("userPhone");
};

const clearAdminSession = () => {
  localStorage.removeItem("adminToken");
  localStorage.removeItem("adminId");
  localStorage.removeItem("adminAccount");
};

type AdminCacheEntry<T> = {
  data: T;
  expiresAt: number;
};

let adminCourseListCache: AdminCacheEntry<Course[]> | null = null;
let folderListCache: AdminCacheEntry<Folder[]> | null = null;
let adminCourseListPromise: Promise<Course[]> | null = null;
let folderListPromise: Promise<Folder[]> | null = null;

const readCache = <T>(entry: AdminCacheEntry<T> | null) => {
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) return null;
  return entry.data;
};

const writeCache = <T>(data: T): AdminCacheEntry<T> => ({
  data,
  expiresAt: Date.now() + ADMIN_CACHE_TTL_MS,
});

const invalidateAdminCourseListCache = () => {
  adminCourseListCache = null;
  adminCourseListPromise = null;
};

const invalidateFolderListCache = () => {
  folderListCache = null;
  folderListPromise = null;
};

const request = async <T>(path: string, options?: RequestInit & { auth?: "user" | "admin" | "auto" }): Promise<T> => {
  const headers = new Headers(options?.headers);
  const token = getToken(options?.auth ?? "auto");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(buildUrl(path), {
    ...options,
    headers,
  });

  const json = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok || !json || json.code !== 0) {
    const message = json?.message ?? "请求失败";
    if (response.status === 401) {
      if ((options?.auth ?? "auto") === "admin" || path.startsWith("/api/admin")) clearAdminSession();
      else clearUserSession();
    }
    throw new ApiRequestError(message, {
      code: json?.code,
      status: response.status,
    });
  }

  return json.data;
};

const postJson = <T>(path: string, body?: unknown, auth: "user" | "admin" | "auto" = "auto") =>
  request<T>(path, {
    method: "POST",
    auth,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });

const patchJson = <T>(path: string, body?: unknown, auth: "user" | "admin" | "auto" = "auto") =>
  request<T>(path, {
    method: "PATCH",
    auth,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });

const deleteRequest = <T>(path: string, auth: "user" | "admin" | "auto" = "auto") =>
  request<T>(path, {
    method: "DELETE",
    auth,
  });

const uploadFiles = async <T>(
  path: string,
  files: File[],
  extraFields: Record<string, string> = {},
  auth: "user" | "admin" | "auto" = "admin",
) => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  Object.entries(extraFields).forEach(([key, value]) => {
    formData.append(key, value);
  });

  return request<T>(path, {
    method: "POST",
    body: formData,
    auth,
  });
};

const uploadSingleFile = async <T>(path: string, file: File, auth: "user" | "admin" | "auto" = "admin") => {
  const formData = new FormData();
  formData.append("file", file);
  return request<T>(path, {
    method: "POST",
    body: formData,
    auth,
  });
};

const uploadSingleFileWithFields = async <T>(
  path: string,
  file: File,
  extraFields: Record<string, string | string[]>,
  auth: "user" | "admin" | "auto" = "admin",
) => {
  const formData = new FormData();
  formData.append("file", file);

  Object.entries(extraFields).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => formData.append(key, item));
      return;
    }

    formData.append(key, value);
  });

  return request<T>(path, {
    method: "POST",
    body: formData,
    auth,
  });
};

export const mockApi = {
  login: (phone: string, password: string, deviceInfo: Record<string, string>) =>
    postJson<{ success: boolean; token: string; user: User }>("/api/auth/user/login", { phone, password, ...deviceInfo }, "user"),

  adminLogin: (account: string, password: string) =>
    postJson<{ success: boolean; token: string; admin: { id: string; account: string; name: string } }>(
      "/api/auth/admin/login",
      { account, password },
      "admin",
    ),

  logout: (_userId: string, deviceKey?: string) => postJson<{ success: boolean }>("/api/auth/user/logout", { deviceKey }, "user"),

  getUserCourses: (_userId: string) => request<Course[]>("/api/user/courses", { auth: "user" }),

  getCourseDetail: (courseId: string) =>
    request<CourseDetailPayload>(
      isAdminContext() ? `/api/admin/courses/${courseId}/detail` : `/api/user/courses/${courseId}/detail`,
      { auth: isAdminContext() ? "admin" : "user" },
    ),

  getTagAudios: (tagId: string, scope: string) =>
    request<TagAudiosPayload>(
      scope === "admin-preview" ? `/api/admin/tags/${tagId}/audios` : `/api/user/tags/${tagId}/audios`,
      { auth: scope === "admin-preview" ? "admin" : "user" },
    ),

  getAudioDetail: (audioId: string, courseId: string) =>
    request<{ audio: Audio; tag: Tag; course: Course; prev?: Audio; next?: Audio; first?: Audio; last?: Audio }>(
      `/api/user/courses/${courseId}/audios/${audioId}/detail`,
      { auth: "user" },
    ),

  saveProgress: (_userId: string, courseId: string, audioId: string, progress: number) =>
    postJson<UserProgress>("/api/user/progress", { courseId, audioId, progress }, "user"),

  markCompleted: (_userId: string, courseId: string, audioId: string, progress?: number) =>
    postJson<UserProgress>("/api/user/progress/complete", { courseId, audioId, progress }, "user"),

  getUserProgress: (_userId: string, courseId: string, audioId: string) =>
    request<UserProgress | undefined>(`/api/user/audios/${audioId}/progress?courseId=${encodeURIComponent(courseId)}`, { auth: "user" }),

  getAllUsers: (params?: { keyword?: string; status?: UserStatus | "all"; courseId?: string; page?: number; pageSize?: number }) =>
    request<PagedResult<User>>(
      `/api/admin/users${buildQueryString({
        keyword: params?.keyword,
        status: params?.status && params.status !== "all" ? params.status : undefined,
        courseId: params?.courseId && params.courseId !== "all" ? params.courseId : undefined,
        page: params?.page,
        pageSize: params?.pageSize,
      })}`,
      { auth: "admin" },
    ),
  getUserSummary: () => request<UserSummary>("/api/admin/users/summary", { auth: "admin" }),
  getAllAdmins: () => request<AdminAccount[]>("/api/admin/admins", { auth: "admin" }),
  createAdminAccount: (payload: { account: string; name: string; password: string }) =>
    postJson<AdminAccount>("/api/admin/admins", payload, "admin"),
  updateAdminAccount: (adminId: string, payload: { account: string; name: string }) =>
    patchJson<AdminAccount>(`/api/admin/admins/${adminId}`, payload, "admin"),
  updateAdminPassword: (adminId: string, password: string) =>
    patchJson<{ success: boolean }>(`/api/admin/admins/${adminId}/password`, { password }, "admin"),
  deleteAdminAccount: (adminId: string) => deleteRequest<{ success: boolean }>(`/api/admin/admins/${adminId}`, "admin"),
  getAllCourses: async () => {
    const cached = readCache(adminCourseListCache);
    if (cached) return cached;

    if (!adminCourseListPromise) {
      adminCourseListPromise = request<Course[]>("/api/admin/courses", { auth: "admin" })
        .then((data) => {
          adminCourseListCache = writeCache(data);
          return data;
        })
        .finally(() => {
          adminCourseListPromise = null;
        });
    }

    return adminCourseListPromise;
  },
  getUserDevices: (userId: string) => request<Device[]>(`/api/admin/users/${userId}/devices`, { auth: "admin" }),
  removeDevice: (deviceId: string) => deleteRequest<{ success: boolean }>(`/api/admin/devices/${deviceId}`, "admin"),
  clearUserDevices: (userId: string) => deleteRequest<{ success: boolean }>(`/api/admin/users/${userId}/devices`, "admin"),

  createUser: (phone: string, courseIds: string[]) =>
    postJson<{ isNew: boolean; userId: string; phone: string }>("/api/admin/users", { phone, courseIds }, "admin"),
  batchCreateUsers: (phones: string[], courseIds: string[]) =>
    postJson<{ createdCount: number; appendedCount: number; failed: string[] }>("/api/admin/users/batch-import", { phones, courseIds }, "admin"),
  batchCreateUsersByExcel: (file: File, courseIds: string[]) =>
    uploadSingleFileWithFields<{ createdCount: number; appendedCount: number; failed: string[]; parsedCount: number }>(
      "/api/admin/users/batch-import-excel",
      file,
      { courseIds },
      "admin",
    ),
  updateUserPermissions: (userId: string, addCourses: string[], removeCourses: string[]) =>
    patchJson<{ success: boolean }>(`/api/admin/users/${userId}/permissions`, { addCourses, removeCourses }, "admin"),
  updateUserPassword: (userId: string, password: string) =>
    patchJson<{ success: boolean }>(`/api/admin/users/${userId}/password`, { password }, "admin"),
  batchAddUserPermissions: (userIds: string[], courseIds: string[]) =>
    postJson<{ success: boolean }>("/api/admin/users/batch-permissions", { userIds, courseIds }, "admin"),
  toggleUserStatus: (userId: string, status: UserStatus) =>
    patchJson<{ success: boolean }>(`/api/admin/users/${userId}/status`, { status }, "admin"),
  batchToggleUserStatus: (userIds: string[], status: UserStatus) =>
    postJson<{ success: boolean }>("/api/admin/users/batch-status", { userIds, status }, "admin"),
  deleteUser: (userId: string) => deleteRequest<{ success: boolean }>(`/api/admin/users/${userId}`, "admin"),
  batchDeleteUsers: (userIds: string[]) => postJson<{ success: boolean }>("/api/admin/users/batch-delete", { userIds }, "admin"),

  uploadCoverImage: (file: File) =>
    uploadSingleFile<{ objectKey: string; url: string }>("/api/admin/uploads/course-cover", file, "admin"),

  uploadSystemImage: (file: File) =>
    uploadSingleFile<{ objectKey: string; url: string }>("/api/admin/uploads/system-image", file, "admin"),

  extractScriptFile: (file: File) =>
    uploadSingleFile<{ text: string }>("/api/admin/uploads/script-file", file, "admin"),

  createCourse: async (payload: { name: string; cover: string; coverObjectKey?: string; description: string; status: CourseStatus; openTime: string; tags?: string[] }) => {
    invalidateAdminCourseListCache();
    return postJson<Course>("/api/admin/courses", payload, "admin");
  },
  updateCourse: async (courseId: string, payload: Partial<Course> & { coverObjectKey?: string | null }) => {
    invalidateAdminCourseListCache();
    return patchJson<Course>(`/api/admin/courses/${courseId}`, payload, "admin");
  },
  updateCourseOrder: async (items: { id: string; order: number }[]) => {
    invalidateAdminCourseListCache();
    return patchJson<{ success: boolean }>("/api/admin/courses/order", { items }, "admin");
  },
  deleteCourse: async (courseId: string) => {
    invalidateAdminCourseListCache();
    return deleteRequest<{ success: boolean }>(`/api/admin/courses/${courseId}`, "admin");
  },

  createTag: (courseId: string, name: string) => postJson<Tag>(`/api/admin/courses/${courseId}/tags`, { name }, "admin"),
  updateTag: (tagId: string, name: string) => patchJson<Tag>(`/api/admin/tags/${tagId}`, { name }, "admin"),
  deleteTag: async (tagId: string) => {
    invalidateAdminCourseListCache();
    return deleteRequest<{ success: boolean }>(`/api/admin/tags/${tagId}`, "admin");
  },
  updateTagOrder: (courseId: string, items: { id: string; order: number }[]) =>
    patchJson<{ success: boolean }>(`/api/admin/courses/${courseId}/tags/order`, { items }, "admin"),

  addAudioToCourse: async (courseId: string, tagId: string, audioIds: string[]) => {
    invalidateAdminCourseListCache();
    return postJson<{ success: boolean }>(`/api/admin/courses/${courseId}/tags/${tagId}/audios/reference`, { audioIds }, "admin");
  },
  updateAudioOrder: (courseId: string, tagId: string, items: { id: string; order: number }[]) =>
    patchJson<{ success: boolean }>(`/api/admin/courses/${courseId}/tags/${tagId}/audios/order`, { items }, "admin"),
  updateAudioTag: (courseId: string, audioId: string, tagId: string) =>
    patchJson<{ success: boolean }>(`/api/admin/courses/${courseId}/audios/${audioId}/tag`, { tagId }, "admin"),
  removeAudioFromCourse: async (courseId: string, audioId: string) => {
    invalidateAdminCourseListCache();
    return deleteRequest<{ success: boolean }>(`/api/admin/courses/${courseId}/audios/${audioId}`, "admin");
  },

  getFolders: async () => {
    const cached = readCache(folderListCache);
    if (cached) return cached;

    if (!folderListPromise) {
      folderListPromise = request<Folder[]>("/api/admin/library/folders", { auth: "admin" })
        .then((data) => {
          folderListCache = writeCache(data);
          return data;
        })
        .finally(() => {
          folderListPromise = null;
        });
    }

    return folderListPromise;
  },
  createFolder: async (name: string) => {
    invalidateFolderListCache();
    return postJson<Folder>("/api/admin/library/folders", { name }, "admin");
  },
  updateFolder: async (folderId: string, name: string) => {
    invalidateFolderListCache();
    return patchJson<Folder>(`/api/admin/library/folders/${folderId}`, { name }, "admin");
  },
  deleteFolder: async (folderId: string) => {
    invalidateFolderListCache();
    return deleteRequest<{ success: boolean }>(`/api/admin/library/folders/${folderId}`, "admin");
  },
  getAudioLibraryMeta: () => request<AudioLibraryMeta>("/api/admin/library/meta", { auth: "admin" }),
  getAudioLibraryItems: (params?: {
    folderId?: string;
    keyword?: string;
    courseId?: string;
    excludeCourseId?: string;
    tagId?: string;
    refFilter?: "all" | "referenced" | "unreferenced";
    scriptFilter?: "all" | "scripted" | "unscripted";
    searchScope?: "current" | "all";
    sortMode?: "uploaded-desc" | "name-asc";
    page?: number;
    pageSize?: number;
  }) =>
    request<PagedResult<AudioLibraryItem>>(
      `/api/admin/library/audios${buildQueryString({
        folderId: params?.folderId,
        keyword: params?.keyword,
        courseId: params?.courseId && params.courseId !== "all" ? params.courseId : undefined,
        excludeCourseId: params?.excludeCourseId,
        tagId: params?.tagId && params.tagId !== "all" ? params.tagId : undefined,
        refFilter: params?.refFilter && params.refFilter !== "all" ? params.refFilter : undefined,
        scriptFilter: params?.scriptFilter && params.scriptFilter !== "all" ? params.scriptFilter : undefined,
        searchScope: params?.searchScope,
        sortMode: params?.sortMode,
        page: params?.page,
        pageSize: params?.pageSize,
      })}`,
      { auth: "admin" },
    ),
  updateAudioName: (audioId: string, name: string) => patchJson<Audio>(`/api/admin/library/audios/${audioId}/name`, { name }, "admin"),
  updateAudioScript: (audioId: string, script: string) => patchJson<Audio>(`/api/admin/library/audios/${audioId}/script`, { script }, "admin"),
  moveAudiosToFolder: async (audioIds: string[], folderId: string) => {
    invalidateFolderListCache();
    return postJson<{ success: boolean }>("/api/admin/library/audios/move-folder", { audioIds, folderId }, "admin");
  },
  deleteAudio: async (audioId: string) => {
    invalidateFolderListCache();
    return deleteRequest<{ success: boolean }>(`/api/admin/library/audios/${audioId}`, "admin");
  },

  uploadAudioToLibrary: async (folderId: string, files: File[], script = "") => {
    invalidateFolderListCache();
    return uploadFiles<Audio[]>("/api/admin/library/audios/upload", files, { folderId, script }, "admin");
  },
  uploadAudioDirectlyToCourse: async (courseId: string, tagId: string, files: File[], script = "") => {
    invalidateFolderListCache();
    invalidateAdminCourseListCache();
    return uploadFiles<Audio>(`/api/admin/courses/${courseId}/tags/${tagId}/audios/upload`, files, { script }, "admin");
  },

  getBrandingConfig: () => request<BrandingConfig>("/api/auth/branding", { auth: "auto" }),
  getSystemConfig: () => request<SystemConfig>("/api/admin/system-config", { auth: "admin" }),
  updateSystemConfig: (payload: Partial<SystemConfig>) => patchJson<SystemConfig>("/api/admin/system-config", payload, "admin"),
  testWebhook: (webhookUrl: string) => postJson<{ success: boolean }>("/api/admin/system-config/test-webhook", { webhookUrl }, "admin"),
  getLogSummary: () => request<LogSummary>("/api/admin/logs/summary", { auth: "admin" }),
  getAuditLogs: (params?: { keyword?: string; entityType?: string; page?: number; pageSize?: number }) =>
    request<PagedResult<AuditLogItem>>(
      `/api/admin/logs/audit${buildQueryString({
        keyword: params?.keyword,
        entityType: params?.entityType && params.entityType !== "all" ? params.entityType : undefined,
        page: params?.page,
        pageSize: params?.pageSize,
      })}`,
      { auth: "admin" },
    ),
  getWebhookLogs: (params?: { keyword?: string; status?: WebhookLogStatus | "all"; page?: number; pageSize?: number }) =>
    request<PagedResult<WebhookLogItem>>(
      `/api/admin/logs/webhooks${buildQueryString({
        keyword: params?.keyword,
        status: params?.status && params.status !== "all" ? params.status : undefined,
        page: params?.page,
        pageSize: params?.pageSize,
      })}`,
      { auth: "admin" },
    ),
};
