import { formatDateTime } from "./time.js";
import { normalizeDisplayText } from "./text.js";
import { getReadableObjectUrl } from "./upload.js";

export const SHOP_SHIPMENT_STATUS_VALUES = ["pending", "shipped", "in_transit", "signed", "failed"];
export const SHOP_PAYMENT_CHANNEL_VALUES = ["wechat_jsapi", "wechat_h5", "alipay_wap"];
export const SHOP_BANNER_LINK_TYPE_VALUES = ["product", "category", "custom"];

export const toMoneyText = (value) => {
  if (value === null || value === undefined) return "0.00";
  if (typeof value === "number") return value.toFixed(2);
  return `${value}`;
};

export const moneyToCents = (value) => Math.round(Number.parseFloat(toMoneyText(value)) * 100);
export const centsToMoneyText = (value) => (Math.max(value, 0) / 100).toFixed(2);

const resolveReadableAssetUrl = ({ objectKey = "", fallbackUrl = "" }) =>
  getReadableObjectUrl({
    objectKey,
    fallbackUrl,
  });

export const parseCourseIdsSnapshot = (value) => {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => `${item}`.trim()).filter(Boolean) : [];
  } catch (_error) {
    return [];
  }
};

export const parseStringArraySnapshot = (value) => {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => `${item}`.trim()).filter(Boolean) : [];
  } catch (_error) {
    return [];
  }
};

export const generateShopOrderNo = () => {
  const now = new Date();
  const pad = (value, size = 2) => String(value).padStart(size, "0");
  const timestamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
    pad(now.getMilliseconds(), 3),
  ].join("");
  const suffix = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");

  return `SO${timestamp}${suffix}`;
};

const getShipmentProgressEntries = (order) => {
  const entries = [];

  for (const item of order?.items ?? []) {
    for (const shipmentItem of item.shipmentItems ?? []) {
      const shipmentStatus = shipmentItem.shipment?.status;
      if (!shipmentStatus) continue;

      entries.push({
        orderItemId: item.id,
        quantity: shipmentItem.quantity,
        status: shipmentStatus,
      });
    }
  }

  if (entries.length > 0) {
    return entries;
  }

  for (const shipment of order?.shipments ?? []) {
    for (const shipmentItem of shipment.items ?? []) {
      const orderItemId = shipmentItem.orderItemId ?? shipmentItem.orderItem?.id;
      if (!orderItemId) continue;

      entries.push({
        orderItemId,
        quantity: shipmentItem.quantity,
        status: shipment.status,
      });
    }
  }

  return entries;
};

const buildShipmentQuantityMapsFromEntries = (entries = []) => {
  const startedQuantityMap = new Map();
  const signedQuantityMap = new Map();

  for (const entry of entries) {
    if (entry.status === "shipped" || entry.status === "in_transit" || entry.status === "signed") {
      addQuantity(startedQuantityMap, entry.orderItemId, entry.quantity);
    }
    if (entry.status === "signed") {
      addQuantity(signedQuantityMap, entry.orderItemId, entry.quantity);
    }
  }

  return { startedQuantityMap, signedQuantityMap };
};

export const hasPendingShipmentItems = (order) => {
  const shippableItems = (order.items ?? []).filter((item) => item.requiresShipping);
  if (shippableItems.length === 0) {
    return false;
  }

  const { startedQuantityMap } = buildShipmentQuantityMapsFromEntries(getShipmentProgressEntries(order));
  return shippableItems.some((item) => (startedQuantityMap.get(item.id) ?? 0) < item.quantity);
};

export const resolveShipmentStatusSummary = (order) => {
  const shippableItems = (order.items ?? []).filter((item) => item.requiresShipping);
  if (shippableItems.length === 0) {
    return "pending";
  }

  const progressEntries = getShipmentProgressEntries(order);
  const fallbackStatuses = (order.shipments ?? []).map((item) => item.status).filter(Boolean);

  if (progressEntries.length === 0) {
    return fallbackStatuses.includes("failed") ? "failed" : "pending";
  }

  const { startedQuantityMap, signedQuantityMap } = buildShipmentQuantityMapsFromEntries(progressEntries);
  const statuses = [...new Set(progressEntries.map((entry) => entry.status))];
  const allShippingSigned = shippableItems.every((item) => (signedQuantityMap.get(item.id) ?? 0) >= item.quantity);
  const anyShippingStarted = shippableItems.some((item) => (startedQuantityMap.get(item.id) ?? 0) > 0);

  if (allShippingSigned) {
    return "signed";
  }
  if (statuses.includes("in_transit")) {
    return "in_transit";
  }
  if (statuses.includes("shipped")) {
    return "shipped";
  }
  if (anyShippingStarted) {
    return "shipped";
  }
  if (statuses.includes("failed") || fallbackStatuses.includes("failed")) {
    return "failed";
  }

  return "pending";
};

export const resolveDigitalFulfillmentStatusSummary = (order) => {
  const requiredItems = (order.items ?? []).filter((item) => item.productTypeSnapshot !== "physical");
  if (requiredItems.length === 0) {
    return "pending";
  }

  const statuses = (order.digitalFulfillments ?? []).map((item) => item.status);
  if (statuses.length === 0) {
    return "pending";
  }
  if (statuses.every((status) => status === "success")) {
    return "success";
  }
  if (statuses.some((status) => status === "failed")) {
    return "failed";
  }

  return "pending";
};

export const serializeShopShipmentTrack = (track) => ({
  id: track.id,
  shipmentId: track.shipmentId,
  content: normalizeDisplayText(track.content),
  location: track.location ? normalizeDisplayText(track.location) : "",
  trackTime: formatDateTime(track.trackTime),
  createdAt: formatDateTime(track.createdAt),
});

export const serializeShopShipmentItem = (item) => ({
  id: item.id,
  shipmentId: item.shipmentId,
  orderItemId: item.orderItemId,
  quantity: item.quantity,
  productName: item.orderItem?.productNameSnapshot ? normalizeDisplayText(item.orderItem.productNameSnapshot) : "",
  productType: item.orderItem?.productTypeSnapshot ?? "",
  requiresShipping: Boolean(item.orderItem?.requiresShipping),
});

export const serializeShopShipment = (shipment) => {
  const tracks = (shipment.tracks ?? []).map(serializeShopShipmentTrack);
  const latestTrack = tracks[0] ?? null;

  return {
    id: shipment.id,
    orderId: shipment.orderId,
    orderNo: shipment.order?.orderNo ?? "",
    userId: shipment.order?.userId ?? "",
    userPhone: shipment.order?.user?.phone ?? "",
    status: shipment.status,
    company: shipment.company ? normalizeDisplayText(shipment.company) : "",
    trackingNo: shipment.trackingNo ?? "",
    shippedAt: shipment.shippedAt ? formatDateTime(shipment.shippedAt) : "",
    signedAt: shipment.signedAt ? formatDateTime(shipment.signedAt) : "",
    createdAt: formatDateTime(shipment.createdAt),
    updatedAt: formatDateTime(shipment.updatedAt),
    items: (shipment.items ?? []).map(serializeShopShipmentItem),
    latestTrack,
    tracks,
  };
};

export const serializeShopPaymentRecord = (payment) => ({
  id: payment.id,
  orderId: payment.orderId,
  channel: payment.channel,
  status: payment.status,
  transactionNo: payment.transactionNo ?? "",
  payAmount: toMoneyText(payment.payAmount),
  paidAt: payment.paidAt ? formatDateTime(payment.paidAt) : "",
  createdAt: formatDateTime(payment.createdAt),
  updatedAt: formatDateTime(payment.updatedAt),
});

export const serializeShopDigitalFulfillment = (item) => ({
  id: item.id,
  orderId: item.orderId,
  orderItemId: item.orderItemId,
  userId: item.userId,
  status: item.status,
  grantType: item.grantType,
  grantPayload: item.grantPayload ?? "",
  grantedAt: item.grantedAt ? formatDateTime(item.grantedAt) : "",
  errorMessage: item.errorMessage ? normalizeDisplayText(item.errorMessage) : "",
  createdAt: formatDateTime(item.createdAt),
  updatedAt: formatDateTime(item.updatedAt),
});

export const serializeShopOrderItem = (item) => ({
  id: item.id,
  orderId: item.orderId,
  productId: item.productId,
  skuId: item.skuId,
  productName: normalizeDisplayText(item.productNameSnapshot),
  productType: item.productTypeSnapshot,
  coverUrl: resolveReadableAssetUrl({
    fallbackUrl: item.coverSnapshot,
  }),
  price: toMoneyText(item.priceSnapshot),
  originalPrice: item.originalPriceSnapshot ? toMoneyText(item.originalPriceSnapshot) : "",
  quantity: item.quantity,
  requiresShipping: item.requiresShipping,
  courseIds: parseCourseIdsSnapshot(item.courseIdsSnapshot),
  createdAt: formatDateTime(item.createdAt),
});

export const serializeShopAddress = (address) => ({
  id: address.id,
  userId: address.userId,
  name: normalizeDisplayText(address.name),
  phone: address.phone,
  province: normalizeDisplayText(address.province),
  city: normalizeDisplayText(address.city),
  district: normalizeDisplayText(address.district),
  address: normalizeDisplayText(address.address),
  isDefault: Boolean(address.isDefault),
  createdAt: formatDateTime(address.createdAt),
  updatedAt: formatDateTime(address.updatedAt),
});

export const serializeShopBanner = (banner) => ({
  id: banner.id,
  title: banner.title ? normalizeDisplayText(banner.title) : "",
  imageUrl: resolveReadableAssetUrl({
    objectKey: banner.imageObjectKey ?? "",
    fallbackUrl: banner.imageUrl,
  }),
  imageSourceUrl: banner.imageUrl,
  imageObjectKey: banner.imageObjectKey ?? "",
  linkType: banner.linkType,
  linkTarget: banner.linkTarget ? normalizeDisplayText(banner.linkTarget) : "",
  sortOrder: banner.sortOrder,
  status: Boolean(banner.status),
  createdAt: formatDateTime(banner.createdAt),
  updatedAt: formatDateTime(banner.updatedAt),
});

export const serializeShopConfig = (config, options = {}) => ({
  shopNotice: config?.shopNotice ? normalizeDisplayText(config.shopNotice) : "",
  customerServiceUrl: config?.customerServiceUrl ?? "",
  featuredProductIds: parseStringArraySnapshot(config?.featuredProductIds),
  featuredCategoryIds: parseStringArraySnapshot(config?.featuredCategoryIds),
  paymentGuide: config?.paymentGuide ? normalizeDisplayText(config.paymentGuide) : "",
  enableWechatH5: Boolean(config?.enableWechatH5),
  enableWechatJsapi: Boolean(config?.enableWechatJsapi),
  enableAlipayWap: Boolean(config?.enableAlipayWap),
  runtimePaymentMode: options.runtimePaymentMode ?? "",
  banners: (config?.banners ?? []).map(serializeShopBanner),
});

const getSortedShopSkus = (product) =>
  [...(product.skus ?? [])].sort(
    (left, right) =>
      Number(Boolean(right.isDefault)) - Number(Boolean(left.isDefault)) ||
      Number(Boolean(right.status)) - Number(Boolean(left.status)) ||
      left.createdAt.getTime() - right.createdAt.getTime(),
  );

const getVisibleShopSkus = (product) => {
  const sortedSkus = getSortedShopSkus(product);
  const activeSkus = sortedSkus.filter((sku) => sku.status);
  return activeSkus.length > 0 ? activeSkus : sortedSkus;
};

const getShopProductPriceSummary = (product) => {
  const sourceSkus = getVisibleShopSkus(product);
  if (sourceSkus.length === 0) {
    return {
      minPrice: "0.00",
      maxPrice: "0.00",
      originalPrice: "",
      defaultSkuId: "",
    };
  }

  const priceList = sourceSkus.map((sku) => moneyToCents(sku.price));
  const originalPriceList = sourceSkus
    .map((sku) => (sku.originalPrice ? moneyToCents(sku.originalPrice) : 0))
    .filter((price) => price > 0);
  const defaultSku = sourceSkus.find((sku) => sku.isDefault) ?? sourceSkus[0];

  return {
    minPrice: centsToMoneyText(Math.min(...priceList)),
    maxPrice: centsToMoneyText(Math.max(...priceList)),
    originalPrice: originalPriceList.length > 0 ? centsToMoneyText(Math.max(...originalPriceList)) : "",
    defaultSkuId: defaultSku?.id ?? "",
  };
};

export const serializeShopCategory = (category) => ({
  id: category.id,
  name: normalizeDisplayText(category.name),
  sortOrder: category.sortOrder,
  status: Boolean(category.status),
  productCount: Array.isArray(category.products) ? category.products.length : 0,
  createdAt: formatDateTime(category.createdAt),
  updatedAt: formatDateTime(category.updatedAt),
});

export const serializeShopSku = (sku) => ({
  id: sku.id,
  productId: sku.productId,
  name: normalizeDisplayText(sku.name),
  price: toMoneyText(sku.price),
  originalPrice: sku.originalPrice ? toMoneyText(sku.originalPrice) : "",
  stock: sku.stock,
  weight: sku.weight ?? 0,
  isDefault: Boolean(sku.isDefault),
  status: Boolean(sku.status),
  createdAt: formatDateTime(sku.createdAt),
  updatedAt: formatDateTime(sku.updatedAt),
});

export const serializeShopProductListItem = (product) => {
  const priceSummary = getShopProductPriceSummary(product);

  return {
    id: product.id,
    categoryId: product.categoryId ?? "",
    categoryName: product.category?.name ? normalizeDisplayText(product.category.name) : "",
    name: normalizeDisplayText(product.name),
    subtitle: product.subtitle ? normalizeDisplayText(product.subtitle) : "",
    coverUrl: resolveReadableAssetUrl({
      objectKey: product.coverObjectKey ?? "",
      fallbackUrl: product.coverUrl,
    }),
    type: product.type,
    status: product.status,
    minPrice: priceSummary.minPrice,
    maxPrice: priceSummary.maxPrice,
    originalPrice: priceSummary.originalPrice,
    defaultSkuId: priceSummary.defaultSkuId,
    requiresShipping: Boolean(product.requiresShipping),
    salesCount: product.salesCount,
    sortOrder: product.sortOrder,
    skuCount: getVisibleShopSkus(product).length,
    courseCount: Array.isArray(product.courses) ? product.courses.length : 0,
    createdAt: formatDateTime(product.createdAt),
    updatedAt: formatDateTime(product.updatedAt),
  };
};

export const serializeShopProductDetail = (product) => ({
  ...serializeShopProductListItem(product),
  description: product.description ? normalizeDisplayText(product.description) : "",
  detailContent: product.detailContent ? normalizeDisplayText(product.detailContent) : "",
  images: (product.images ?? []).map((image) => ({
    id: image.id,
    imageUrl: resolveReadableAssetUrl({
      objectKey: image.imageObjectKey ?? "",
      fallbackUrl: image.imageUrl,
    }),
    sortOrder: image.sortOrder,
  })),
  skus: getSortedShopSkus(product).map(serializeShopSku),
  boundCourses: (product.courses ?? []).map((item) => ({
    id: item.course?.id ?? item.courseId,
    name: item.course?.name ? normalizeDisplayText(item.course.name) : "",
    coverUrl: resolveReadableAssetUrl({
      objectKey: item.course?.coverObjectKey ?? "",
      fallbackUrl: item.course?.coverUrl ?? "",
    }),
    description: item.course?.description ? normalizeDisplayText(item.course.description) : "",
    status: item.course?.status ?? "",
    openTime: item.course?.openTime ? formatDateTime(item.course.openTime) : "",
  })),
});

export const serializeShopCartItem = (item) => {
  const priceCents = moneyToCents(item.sku.price);
  const available =
    !item.product.isDeleted &&
    item.product.status === "on_sale" &&
    Boolean(item.sku.status) &&
    item.sku.stock > 0;

  return {
    id: item.id,
    userId: item.userId,
    productId: item.productId,
    productName: normalizeDisplayText(item.product.name),
    productType: item.product.type,
    coverUrl: resolveReadableAssetUrl({
      objectKey: item.product.coverObjectKey ?? "",
      fallbackUrl: item.product.coverUrl,
    }),
    skuId: item.skuId,
    skuName: normalizeDisplayText(item.sku.name),
    price: toMoneyText(item.sku.price),
    originalPrice: item.sku.originalPrice ? toMoneyText(item.sku.originalPrice) : "",
    quantity: item.quantity,
    stock: item.sku.stock,
    subtotal: centsToMoneyText(priceCents * item.quantity),
    requiresShipping: Boolean(item.product.requiresShipping),
    available,
    createdAt: formatDateTime(item.createdAt),
    updatedAt: formatDateTime(item.updatedAt),
  };
};

export const serializeShopCart = (items) => {
  const normalizedItems = items.map(serializeShopCartItem);
  const amountCents = normalizedItems.reduce((sum, item) => sum + moneyToCents(item.price) * item.quantity, 0);
  const quantity = normalizedItems.reduce((sum, item) => sum + item.quantity, 0);

  return {
    items: normalizedItems,
    summary: {
      itemCount: quantity,
      amount: centsToMoneyText(amountCents),
      availableCount: normalizedItems.filter((item) => item.available).length,
    },
  };
};

export const serializeAdminShopProductListItem = (product) => ({
  ...serializeShopProductListItem(product),
  coverUrl: product.coverUrl,
  coverPreviewUrl: resolveReadableAssetUrl({
    objectKey: product.coverObjectKey ?? "",
    fallbackUrl: product.coverUrl,
  }),
  isDeleted: Boolean(product.isDeleted),
});

export const serializeAdminShopProductDetail = (product) => ({
  ...serializeAdminShopProductListItem(product),
  coverObjectKey: product.coverObjectKey ?? "",
  description: product.description ? normalizeDisplayText(product.description) : "",
  detailContent: product.detailContent ? normalizeDisplayText(product.detailContent) : "",
  images: (product.images ?? []).map((image) => ({
    id: image.id,
    imageUrl: image.imageUrl,
    imagePreviewUrl: resolveReadableAssetUrl({
      objectKey: image.imageObjectKey ?? "",
      fallbackUrl: image.imageUrl,
    }),
    imageObjectKey: image.imageObjectKey ?? "",
    sortOrder: image.sortOrder,
  })),
  skus: getSortedShopSkus(product).map(serializeShopSku),
  courseIds: (product.courses ?? []).map((item) => item.courseId),
  boundCourses: (product.courses ?? []).map((item) => ({
    id: item.course?.id ?? item.courseId,
    name: item.course?.name ? normalizeDisplayText(item.course.name) : "",
    coverUrl: resolveReadableAssetUrl({
      objectKey: item.course?.coverObjectKey ?? "",
      fallbackUrl: item.course?.coverUrl ?? "",
    }),
    description: item.course?.description ? normalizeDisplayText(item.course.description) : "",
    status: item.course?.status ?? "",
    openTime: item.course?.openTime ? formatDateTime(item.course.openTime) : "",
  })),
});

export const serializeShopLogistics = ({ order, shipments }) => {
  const latestShipment = shipments[0] ?? null;

  return {
    orderId: order.id,
    orderNo: order.orderNo,
    orderStatus: order.status,
    shipmentId: latestShipment?.id ?? "",
    company: latestShipment?.company ?? "",
    trackingNo: latestShipment?.trackingNo ?? "",
    status: latestShipment?.status ?? "pending",
    tracks: latestShipment?.tracks ?? [],
    shipments,
  };
};

export const serializeShopOrder = (order, options = {}) => {
  const includeRelations = options.includeRelations ?? false;
  const shipments = (order.shipments ?? []).map((shipment) =>
    serializeShopShipment({
      ...shipment,
      order,
    }),
  );
  const items = (order.items ?? []).map(serializeShopOrderItem);
  const payments = (order.payments ?? []).map(serializeShopPaymentRecord);
  const digitalFulfillments = (order.digitalFulfillments ?? []).map(serializeShopDigitalFulfillment);

  return {
    id: order.id,
    orderNo: order.orderNo,
    userId: order.userId,
    userPhone: order.user?.phone ?? "",
    status: order.status,
    paymentStatus: order.paymentStatus,
    hasPendingShipmentItems: hasPendingShipmentItems(order),
    shipmentStatus: resolveShipmentStatusSummary(order),
    digitalFulfillmentStatus: resolveDigitalFulfillmentStatusSummary(order),
    totalAmount: toMoneyText(order.totalAmount),
    payAmount: toMoneyText(order.payAmount),
    freightAmount: toMoneyText(order.freightAmount),
    payExpireAt: order.payExpireAt ? formatDateTime(order.payExpireAt) : "",
    remark: order.remark ? normalizeDisplayText(order.remark) : "",
    receiverName: order.receiverName ? normalizeDisplayText(order.receiverName) : "",
    receiverPhone: order.receiverPhone ?? "",
    receiverProvince: order.receiverProvince ? normalizeDisplayText(order.receiverProvince) : "",
    receiverCity: order.receiverCity ? normalizeDisplayText(order.receiverCity) : "",
    receiverDistrict: order.receiverDistrict ? normalizeDisplayText(order.receiverDistrict) : "",
    receiverAddress: order.receiverAddress ? normalizeDisplayText(order.receiverAddress) : "",
    paidAt: order.paidAt ? formatDateTime(order.paidAt) : "",
    cancelledAt: order.cancelledAt ? formatDateTime(order.cancelledAt) : "",
    completedAt: order.completedAt ? formatDateTime(order.completedAt) : "",
    createdAt: formatDateTime(order.createdAt),
    updatedAt: formatDateTime(order.updatedAt),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    items,
    ...(includeRelations
      ? {
          payments,
          digitalFulfillments,
          shipments,
        }
      : {}),
  };
};

export const shopOrderDetailInclude = {
  user: {
    select: {
      id: true,
      phone: true,
    },
  },
  items: {
    orderBy: {
      createdAt: "asc",
    },
  },
  payments: {
    orderBy: {
      createdAt: "desc",
    },
  },
  digitalFulfillments: {
    orderBy: {
      createdAt: "desc",
    },
  },
  shipments: {
    include: {
      items: {
        include: {
          orderItem: true,
        },
      },
      tracks: {
        orderBy: {
          trackTime: "desc",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  },
};

const addQuantity = (map, key, value) => {
  map.set(key, (map.get(key) ?? 0) + value);
};

export const buildShipmentQuantityMaps = (items = []) => {
  return buildShipmentQuantityMapsFromEntries(
    items.flatMap((item) =>
      (item.shipmentItems ?? [])
        .filter((shipmentItem) => shipmentItem.shipment?.status)
        .map((shipmentItem) => ({
          orderItemId: item.id,
          quantity: shipmentItem.quantity,
          status: shipmentItem.shipment.status,
        })),
    ),
  );
};

export const resolveShopOrderStatus = (order) => {
  if (!order) return null;
  if (order.status === "cancelled" || order.status === "refunded" || order.status === "refunding") {
    return order.status;
  }
  if (order.paymentStatus !== "paid") {
    return "pending_payment";
  }

  const shippableItems = (order.items ?? []).filter((item) => item.requiresShipping);
  const digitalRequiredItems = (order.items ?? []).filter((item) => item.productTypeSnapshot !== "physical");
  const { startedQuantityMap, signedQuantityMap } = buildShipmentQuantityMaps(order.items ?? []);

  const successfulDigitalItemIds = new Set(
    (order.digitalFulfillments ?? []).filter((item) => item.status === "success").map((item) => item.orderItemId),
  );

  const allShippingSigned =
    shippableItems.length === 0 ||
    shippableItems.every((item) => (signedQuantityMap.get(item.id) ?? 0) >= item.quantity);

  const anyShippingStarted = shippableItems.some((item) => (startedQuantityMap.get(item.id) ?? 0) > 0);

  const allDigitalSuccess =
    digitalRequiredItems.length === 0 || digitalRequiredItems.every((item) => successfulDigitalItemIds.has(item.id));

  const anyDigitalSuccess = digitalRequiredItems.some((item) => successfulDigitalItemIds.has(item.id));

  if (allShippingSigned && allDigitalSuccess) {
    return "completed";
  }

  if (anyShippingStarted || anyDigitalSuccess) {
    return "partially_fulfilled";
  }

  return "paid";
};

const shopOrderLifecycleInclude = {
  items: {
    include: {
      shipmentItems: {
        include: {
          shipment: {
            select: {
              status: true,
            },
          },
        },
      },
    },
  },
  digitalFulfillments: {
    select: {
      orderItemId: true,
      status: true,
    },
  },
  shipments: {
    select: {
      status: true,
    },
  },
};

export const recalculateShopOrderStatus = async (db, orderId) => {
  const order = await db.shopOrder.findUnique({
    where: { id: orderId },
    include: shopOrderLifecycleInclude,
  });

  if (!order) return null;

  const nextStatus = resolveShopOrderStatus(order);
  const shouldSetCompletedAt = nextStatus === "completed" && !order.completedAt;

  if (nextStatus === order.status && !shouldSetCompletedAt) {
    return order;
  }

  return db.shopOrder.update({
    where: { id: orderId },
    data: {
      status: nextStatus,
      ...(shouldSetCompletedAt ? { completedAt: new Date() } : {}),
    },
  });
};
