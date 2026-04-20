import { clearUserSession as clearPersistedUserSession, getUserToken } from "./user-session";

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
  handoutUrl: string;
  handoutObjectKey: string;
  handoutName: string;
  hasHandout: boolean;
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

export type ShopProductType = "virtual" | "physical" | "hybrid";
export type ShopProductStatus = "draft" | "on_sale" | "off_sale";
export type ShopOrderStatus = "pending_payment" | "paid" | "partially_fulfilled" | "completed" | "cancelled" | "refunding" | "refunded";
export type ShopPaymentStatus = "unpaid" | "paid" | "failed" | "refunded";
export type ShopShipmentStatus = "pending" | "shipped" | "in_transit" | "signed" | "failed";
export type ShopPaymentChannel = "wechat_jsapi" | "wechat_h5" | "alipay_wap";
export type ShopBannerLinkType = "product" | "category" | "custom";

export interface ShopBanner {
  id: string;
  title: string;
  imageUrl: string;
  imageSourceUrl?: string;
  imageObjectKey: string;
  linkType: ShopBannerLinkType;
  linkTarget: string;
  sortOrder: number;
  status: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShopConfig {
  shopNotice: string;
  customerServiceUrl: string;
  featuredProductIds: string[];
  featuredCategoryIds: string[];
  paymentGuide: string;
  enableWechatH5: boolean;
  enableWechatJsapi: boolean;
  enableAlipayWap: boolean;
  runtimePaymentMode: string;
  banners: ShopBanner[];
}

export interface AdminShopConfigPayload {
  shopNotice: string;
  customerServiceUrl: string;
  featuredProductIds: string[];
  featuredCategoryIds: string[];
  paymentGuide: string;
  enableWechatH5: boolean;
  enableWechatJsapi: boolean;
  enableAlipayWap: boolean;
  banners: {
    title: string;
    imageUrl: string;
    imageObjectKey: string;
    linkType: ShopBannerLinkType;
    linkTarget: string;
    sortOrder: number;
    status: boolean;
  }[];
}

export interface ShopCategory {
  id: string;
  name: string;
  sortOrder: number;
  status: boolean;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShopProduct {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  subtitle: string;
  coverUrl: string;
  type: ShopProductType;
  status: ShopProductStatus;
  minPrice: string;
  maxPrice: string;
  originalPrice: string;
  defaultSkuId: string;
  requiresShipping: boolean;
  salesCount: number;
  sortOrder: number;
  skuCount: number;
  courseCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShopProductImage {
  id: string;
  imageUrl: string;
  sortOrder: number;
}

export interface ShopSku {
  id: string;
  productId: string;
  name: string;
  price: string;
  originalPrice: string;
  stock: number;
  weight: number;
  isDefault: boolean;
  status: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShopBoundCourse {
  id: string;
  name: string;
  coverUrl: string;
  description: string;
  status: CourseStatus | "";
  openTime: string;
}

export interface ShopProductDetail extends ShopProduct {
  description: string;
  detailContent: string;
  images: ShopProductImage[];
  skus: ShopSku[];
  boundCourses: ShopBoundCourse[];
}

export interface AdminShopProduct extends ShopProduct {
  coverPreviewUrl?: string;
  isDeleted: boolean;
}

export interface AdminShopProductImage extends ShopProductImage {
  imageObjectKey: string;
  imagePreviewUrl?: string;
}

export interface AdminShopSkuInput {
  id?: string;
  name: string;
  price: string;
  originalPrice: string;
  stock: number;
  weight: number;
  isDefault: boolean;
  status: boolean;
  sortOrder: number;
}

export interface AdminShopProductImageInput {
  id?: string;
  imageUrl: string;
  imageObjectKey: string;
  sortOrder: number;
}

export interface AdminShopProductDetail extends AdminShopProduct {
  coverObjectKey: string;
  description: string;
  detailContent: string;
  images: AdminShopProductImage[];
  skus: ShopSku[];
  courseIds: string[];
  boundCourses: ShopBoundCourse[];
}

export interface AdminShopProductPayload {
  categoryId: string;
  name: string;
  subtitle: string;
  coverUrl: string;
  coverObjectKey?: string;
  type: ShopProductType;
  status: ShopProductStatus;
  description: string;
  detailContent: string;
  sortOrder: number;
  courseIds: string[];
  images: AdminShopProductImageInput[];
  skus: AdminShopSkuInput[];
}

export interface ShopCartItem {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  productType: ShopProductType;
  coverUrl: string;
  skuId: string;
  skuName: string;
  price: string;
  originalPrice: string;
  quantity: number;
  stock: number;
  subtotal: string;
  requiresShipping: boolean;
  available: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShopCartPayload {
  items: ShopCartItem[];
  summary: {
    itemCount: number;
    amount: string;
    availableCount: number;
  };
}

export interface ShopAddress {
  id: string;
  userId: string;
  name: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  address: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShopCheckoutPreviewItem {
  productId: string;
  productName: string;
  productType: ShopProductType;
  coverUrl: string;
  skuId: string;
  skuName: string;
  quantity: number;
  price: string;
  originalPrice: string;
  subtotal: string;
  requiresShipping: boolean;
  courseIds: string[];
}

export interface ShopCheckoutPreview {
  items: ShopCheckoutPreviewItem[];
  productAmount: string;
  freightAmount: string;
  discountAmount: string;
  payAmount: string;
  requiresShipping: boolean;
  address: ShopAddress | null;
  warnings: string[];
}

export interface ShopOrderItem {
  id: string;
  orderId: string;
  productId: string;
  skuId: string;
  productName: string;
  productType: ShopProductType;
  coverUrl: string;
  price: string;
  originalPrice: string;
  quantity: number;
  requiresShipping: boolean;
  courseIds: string[];
  createdAt: string;
}

export interface ShopShipmentTrack {
  id: string;
  shipmentId: string;
  content: string;
  location: string;
  trackTime: string;
  createdAt: string;
}

export interface ShopShipmentItem {
  id: string;
  shipmentId: string;
  orderItemId: string;
  quantity: number;
  productName: string;
  productType: ShopProductType | "";
  requiresShipping: boolean;
}

export interface ShopShipment {
  id: string;
  orderId: string;
  orderNo: string;
  userId: string;
  userPhone: string;
  status: ShopShipmentStatus;
  company: string;
  trackingNo: string;
  shippedAt: string;
  signedAt: string;
  createdAt: string;
  updatedAt: string;
  items: ShopShipmentItem[];
  latestTrack: ShopShipmentTrack | null;
  tracks: ShopShipmentTrack[];
}

export interface ShopPaymentRecord {
  id: string;
  orderId: string;
  channel: ShopPaymentChannel | string;
  status: ShopPaymentStatus;
  transactionNo: string;
  payAmount: string;
  paidAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShopDigitalFulfillment {
  id: string;
  orderId: string;
  orderItemId: string;
  userId: string;
  status: "pending" | "success" | "failed";
  grantType: string;
  grantPayload: string;
  grantedAt: string;
  errorMessage: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShopOrder {
  id: string;
  orderNo: string;
  userId: string;
  userPhone: string;
  status: ShopOrderStatus;
  paymentStatus: ShopPaymentStatus;
  hasPendingShipmentItems: boolean;
  shipmentStatus: ShopShipmentStatus;
  digitalFulfillmentStatus: string;
  totalAmount: string;
  payAmount: string;
  freightAmount: string;
  payExpireAt: string;
  remark: string;
  receiverName: string;
  receiverPhone: string;
  receiverProvince: string;
  receiverCity: string;
  receiverDistrict: string;
  receiverAddress: string;
  paidAt: string;
  cancelledAt: string;
  completedAt: string;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  items: ShopOrderItem[];
}

export interface ShopOrderDetail extends ShopOrder {
  payments: ShopPaymentRecord[];
  digitalFulfillments: ShopDigitalFulfillment[];
  shipments: ShopShipment[];
}

export interface ShopLogistics {
  orderId: string;
  orderNo: string;
  orderStatus: ShopOrderStatus;
  shipmentId: string;
  company: string;
  trackingNo: string;
  status: ShopShipmentStatus;
  tracks: ShopShipmentTrack[];
  shipments: ShopShipment[];
}

export interface ShopHomePayload {
  banners: ShopBanner[];
  shopNotice: string;
  customerServiceUrl: string;
  paymentGuide: string;
  enableWechatH5: boolean;
  enableWechatJsapi: boolean;
  enableAlipayWap: boolean;
  featuredCategories: ShopCategory[];
  featuredProducts: ShopProduct[];
  courseProducts: ShopProduct[];
  physicalProducts: ShopProduct[];
  hybridProducts: ShopProduct[];
}

export interface UserShopOrderSummary {
  total: number;
  pendingPayment: number;
  pendingShipment: number;
  pendingReceipt: number;
}

export interface AdminShopProductListSummary {
  total: number;
  onSale: number;
  draft: number;
  offSale: number;
}

export interface AdminShopOrderListSummary {
  total: number;
  pendingPayment: number;
  paid: number;
  waitingShipment: number;
}

export interface AdminShopShipmentListSummary {
  total: number;
  pending: number;
  shipped: number;
  inTransit: number;
  signed: number;
  failed: number;
}

export interface ShopListResult<T, S = undefined> {
  list: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
  summary?: S;
}

export interface ShopCreateOrderResult {
  orderId: string;
  orderNo: string;
  status: ShopOrderStatus;
  paymentStatus: ShopPaymentStatus;
  payAmount: string;
  payExpireAt: string;
}

export interface ShopWechatJsapiPaymentPayload {
  type: "wechat_jsapi";
  appId: string;
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: string;
  paySign: string;
  returnUrl: string;
}

export interface ShopPaymentStartResult {
  mode: "mock" | "gateway";
  channel: ShopPaymentChannel;
  launchUrl: string;
  paymentPayload: ShopWechatJsapiPaymentPayload | null;
  order: ShopOrderDetail;
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
const buildQueryString = (params: Record<string, string | number | boolean | undefined>) => {
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
  if (mode === "user") return getUserToken();
  if (mode === "admin") return localStorage.getItem("adminToken") ?? "";
  return isAdminContext() ? localStorage.getItem("adminToken") ?? "" : getUserToken();
};

const clearUserSession = () => {
  clearPersistedUserSession();
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

const requestBlob = async (path: string, options?: RequestInit & { auth?: "user" | "admin" | "auto" }): Promise<Blob> => {
  const headers = new Headers(options?.headers);
  const token = getToken(options?.auth ?? "auto");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(buildUrl(path), {
    ...options,
    headers,
  });

  if (!response.ok) {
    const json = (await response.json().catch(() => null)) as ApiEnvelope<unknown> | null;
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

  return response.blob();
};

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

  getCurrentUser: () => request<User>("/api/auth/user/me", { auth: "user" }),

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

  getShopHome: () => request<ShopHomePayload>("/api/user/shop/home", { auth: "user" }),
  getShopCategories: () => request<ShopCategory[]>("/api/user/shop/categories", { auth: "user" }),
  getShopProducts: (params?: {
    categoryId?: string;
    type?: ShopProductType | "all";
    keyword?: string;
    sortBy?: "default" | "sales_desc" | "price_asc" | "price_desc" | "latest";
    page?: number;
    pageSize?: number;
  }) =>
    request<ShopListResult<ShopProduct>>(
      `/api/user/shop/products${buildQueryString({
        categoryId: params?.categoryId,
        type: params?.type && params.type !== "all" ? params.type : undefined,
        keyword: params?.keyword,
        sortBy: params?.sortBy,
        page: params?.page,
        pageSize: params?.pageSize,
      })}`,
      { auth: "user" },
    ),
  getShopProductDetail: (productId: string) => request<ShopProductDetail>(`/api/user/shop/products/${productId}`, { auth: "user" }),
  getShopCart: () => request<ShopCartPayload>("/api/user/shop/cart", { auth: "user" }),
  addShopCartItem: (payload: { productId: string; skuId: string; quantity: number }) =>
    postJson<ShopCartPayload>("/api/user/shop/cart/items", payload, "user"),
  updateShopCartItem: (itemId: string, payload: { quantity: number }) =>
    patchJson<ShopCartPayload>(`/api/user/shop/cart/items/${itemId}`, payload, "user"),
  deleteShopCartItem: (itemId: string) => deleteRequest<ShopCartPayload>(`/api/user/shop/cart/items/${itemId}`, "user"),
  getShopAddresses: () => request<ShopAddress[]>("/api/user/shop/addresses", { auth: "user" }),
  createShopAddress: (payload: {
    name: string;
    phone: string;
    province: string;
    city: string;
    district: string;
    address: string;
    isDefault?: boolean;
  }) => postJson<ShopAddress>("/api/user/shop/addresses", payload, "user"),
  updateShopAddress: (
    addressId: string,
    payload: Partial<{
      name: string;
      phone: string;
      province: string;
      city: string;
      district: string;
      address: string;
      isDefault: boolean;
    }>,
  ) => patchJson<ShopAddress>(`/api/user/shop/addresses/${addressId}`, payload, "user"),
  deleteShopAddress: (addressId: string) => deleteRequest<{ success: boolean }>(`/api/user/shop/addresses/${addressId}`, "user"),
  previewShopCheckout: (payload: {
    source: "cart" | "buy_now";
    cartItemIds?: string[];
    buyNowSkuId?: string;
    buyNowQuantity?: number;
    addressId?: string;
  }) => postJson<ShopCheckoutPreview>("/api/user/shop/checkout/preview", payload, "user"),
  createShopOrder: (payload: {
    source: "cart" | "buy_now";
    cartItemIds?: string[];
    buyNowSkuId?: string;
    buyNowQuantity?: number;
    addressId?: string;
    remark?: string;
    payChannel: ShopPaymentChannel;
  }) => postJson<ShopCreateOrderResult>("/api/user/shop/orders", payload, "user"),
  payShopOrder: (orderId: string, payChannel: ShopPaymentChannel, options?: { wechatOpenId?: string }) =>
    postJson<ShopPaymentStartResult>(
      `/api/user/shop/orders/${orderId}/pay`,
      { payChannel, wechatOpenId: options?.wechatOpenId },
      "user",
    ),
  syncShopOrderPaymentStatus: (orderId: string) =>
    postJson<ShopOrderDetail>(`/api/user/shop/orders/${orderId}/payment-status/sync`, {}, "user"),
  getShopOrderDetail: (orderId: string) => request<ShopOrderDetail>(`/api/user/shop/orders/${orderId}`, { auth: "user" }),
  getShopOrderLogistics: (orderId: string) => request<ShopLogistics>(`/api/user/shop/orders/${orderId}/logistics`, { auth: "user" }),
  getShopOrderSummary: () => request<UserShopOrderSummary>("/api/user/shop/orders/summary", { auth: "user" }),
  getShopOrders: (params?: {
    status?: "all" | "pending_payment" | "pending_shipment" | "shipped" | "completed" | "cancelled";
    page?: number;
    pageSize?: number;
  }) =>
    request<ShopListResult<ShopOrder>>(
      `/api/user/shop/orders${buildQueryString({
        status: params?.status && params.status !== "all" ? params.status : undefined,
        page: params?.page,
        pageSize: params?.pageSize,
      })}`,
      { auth: "user" },
    ),
  cancelShopOrder: (orderId: string) => postJson<ShopOrder>(`/api/user/shop/orders/${orderId}/cancel`, {}, "user"),
  confirmShopOrderReceipt: (orderId: string) => postJson<ShopLogistics>(`/api/user/shop/orders/${orderId}/confirm-receipt`, {}, "user"),

  getAdminShopConfig: () => request<ShopConfig>("/api/admin/shop/config", { auth: "admin" }),
  updateAdminShopConfig: (payload: AdminShopConfigPayload) => patchJson<ShopConfig>("/api/admin/shop/config", payload, "admin"),

  getAdminShopCategories: (params?: { keyword?: string; status?: "all" | "enabled" | "disabled" }) =>
    request<ShopCategory[]>(
      `/api/admin/shop/categories${buildQueryString({
        keyword: params?.keyword,
        status: params?.status && params.status !== "all" ? params.status : undefined,
      })}`,
      { auth: "admin" },
    ),
  createAdminShopCategory: (payload: { name: string; sortOrder: number; status: boolean }) =>
    postJson<ShopCategory>("/api/admin/shop/categories", payload, "admin"),
  updateAdminShopCategory: (categoryId: string, payload: { name: string; sortOrder: number; status: boolean }) =>
    patchJson<ShopCategory>(`/api/admin/shop/categories/${categoryId}`, payload, "admin"),
  deleteAdminShopCategory: (categoryId: string) => deleteRequest<{ success: boolean }>(`/api/admin/shop/categories/${categoryId}`, "admin"),

  getAdminShopProducts: (params?: {
    keyword?: string;
    categoryId?: string;
    type?: ShopProductType | "all";
    status?: ShopProductStatus | "all";
    page?: number;
    pageSize?: number;
  }) =>
    request<ShopListResult<AdminShopProduct, AdminShopProductListSummary>>(
      `/api/admin/shop/products${buildQueryString({
        keyword: params?.keyword,
        categoryId: params?.categoryId && params.categoryId !== "all" ? params.categoryId : undefined,
        type: params?.type && params.type !== "all" ? params.type : undefined,
        status: params?.status && params.status !== "all" ? params.status : undefined,
        page: params?.page,
        pageSize: params?.pageSize,
      })}`,
      { auth: "admin" },
    ),
  getAdminShopProductDetail: (productId: string) => request<AdminShopProductDetail>(`/api/admin/shop/products/${productId}`, { auth: "admin" }),
  createAdminShopProduct: (payload: AdminShopProductPayload) => postJson<AdminShopProductDetail>("/api/admin/shop/products", payload, "admin"),
  updateAdminShopProduct: (productId: string, payload: AdminShopProductPayload) =>
    patchJson<AdminShopProductDetail>(`/api/admin/shop/products/${productId}`, payload, "admin"),
  publishAdminShopProduct: (productId: string, status: ShopProductStatus) =>
    postJson<AdminShopProductDetail>(`/api/admin/shop/products/${productId}/publish`, { status }, "admin"),
  deleteAdminShopProduct: (productId: string) => deleteRequest<{ success: boolean }>(`/api/admin/shop/products/${productId}`, "admin"),
  getAdminShopOrders: (params?: {
    orderNo?: string;
    phone?: string;
    keyword?: string;
    status?: ShopOrderStatus | "all";
    paymentStatus?: ShopPaymentStatus | "all";
    shipmentStatus?: ShopShipmentStatus | "pending" | "all";
    page?: number;
    pageSize?: number;
  }) =>
    request<ShopListResult<ShopOrder, AdminShopOrderListSummary>>(
      `/api/admin/shop/orders${buildQueryString({
        orderNo: params?.orderNo,
        phone: params?.phone,
        keyword: params?.keyword,
        status: params?.status && params.status !== "all" ? params.status : undefined,
        paymentStatus: params?.paymentStatus && params.paymentStatus !== "all" ? params.paymentStatus : undefined,
        shipmentStatus: params?.shipmentStatus && params.shipmentStatus !== "all" ? params.shipmentStatus : undefined,
        page: params?.page,
        pageSize: params?.pageSize,
      })}`,
      { auth: "admin" },
    ),
  getAdminShopOrderDetail: (orderId: string) => request<ShopOrderDetail>(`/api/admin/shop/orders/${orderId}`, { auth: "admin" }),
  closeAdminShopOrder: (orderId: string, reason: string) => postJson<ShopOrderDetail>(`/api/admin/shop/orders/${orderId}/close`, { reason }, "admin"),
  getAdminShopShipments: (params?: {
    orderNo?: string;
    phone?: string;
    keyword?: string;
    trackingNo?: string;
    status?: ShopShipmentStatus | "all";
    page?: number;
    pageSize?: number;
  }) =>
    request<ShopListResult<ShopShipment, AdminShopShipmentListSummary>>(
      `/api/admin/shop/shipments${buildQueryString({
        orderNo: params?.orderNo,
        phone: params?.phone,
        keyword: params?.keyword,
        trackingNo: params?.trackingNo,
        status: params?.status && params.status !== "all" ? params.status : undefined,
        page: params?.page,
        pageSize: params?.pageSize,
      })}`,
      { auth: "admin" },
    ),
  createAdminShopShipment: (
    orderId: string,
    payload: {
      company: string;
      trackingNo: string;
      remark?: string;
      status?: ShopShipmentStatus;
      items: { orderItemId: string; quantity: number }[];
    },
  ) => postJson<ShopShipment>(`/api/admin/shop/orders/${orderId}/shipments`, payload, "admin"),
  updateAdminShopShipment: (
    shipmentId: string,
    payload: {
      company?: string;
      trackingNo?: string;
      status?: ShopShipmentStatus;
      trackContent?: string;
      location?: string;
      trackTime?: string;
    },
  ) => patchJson<ShopShipment>(`/api/admin/shop/shipments/${shipmentId}`, payload, "admin"),
  createAdminShopShipmentTrack: (
    shipmentId: string,
    payload: {
      content: string;
      location?: string;
      trackTime?: string;
    },
  ) => postJson<ShopShipment>(`/api/admin/shop/shipments/${shipmentId}/tracks`, payload, "admin"),
  uploadShopImage: (file: File) =>
    uploadSingleFile<{ objectKey: string; url: string; readableUrl?: string }>("/api/admin/uploads/shop-image", file, "admin"),

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

  uploadCourseHandout: (file: File) =>
    uploadSingleFile<{ objectKey: string; url: string }>("/api/admin/uploads/course-handout", file, "admin"),

  uploadSystemImage: (file: File) =>
    uploadSingleFile<{ objectKey: string; url: string }>("/api/admin/uploads/system-image", file, "admin"),

  extractScriptFile: (file: File) =>
    uploadSingleFile<{ text: string }>("/api/admin/uploads/script-file", file, "admin"),

  createCourse: async (payload: {
    name: string;
    cover: string;
    coverObjectKey?: string;
    handoutUrl?: string | null;
    handoutObjectKey?: string | null;
    handoutName?: string | null;
    description: string;
    status: CourseStatus;
    openTime: string;
    tags?: string[];
  }) => {
    invalidateAdminCourseListCache();
    return postJson<Course>("/api/admin/courses", payload, "admin");
  },
  updateCourse: async (
    courseId: string,
    payload: Partial<Course> & {
      coverObjectKey?: string | null;
      handoutUrl?: string | null;
      handoutObjectKey?: string | null;
      handoutName?: string | null;
    },
  ) => {
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
  downloadCourseHandout: (courseId: string) => requestBlob(`/api/user/courses/${courseId}/handout/download`, { auth: "user" }),
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
