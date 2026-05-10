import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { config as runtimeConfig } from "../lib/config.js";
import { ok, fail } from "../lib/response.js";
import { requireAdminAuth, requireAdminRoles } from "../middleware/auth.js";
import { writeAdminAuditLog } from "../lib/audit.js";
import { cleanupObjectIfReplaced, cleanupObjectIfUnused } from "../lib/assets.js";
import { buildShopPaymentRuntimeDiagnostics } from "../lib/shop-payment-runtime.js";
import { approveShopRefund, completeShopRefund, rejectShopRefund } from "../lib/shop-refund.js";
import {
  SHOP_BANNER_LINK_TYPE_VALUES,
  SHOP_SHIPMENT_STATUS_VALUES,
  buildShipmentQuantityMaps,
  hasPendingShipmentItems,
  parseProductImageSnapshot,
  parseStringArraySnapshot,
  recalculateShopOrderStatus,
  serializeAdminShopProductDetail,
  serializeAdminShopProductListItem,
  serializeShopCategory,
  serializeShopConfig,
  serializeShopOrder,
  serializeShopShipment,
  shopOrderDetailInclude,
} from "../lib/shop.js";

export const shopAdminRouter = Router();

shopAdminRouter.use(requireAdminAuth);
shopAdminRouter.use(requireAdminRoles("super_admin", "operations_admin"));

const shipmentStatusSet = new Set(SHOP_SHIPMENT_STATUS_VALUES);
const paymentStatusSet = new Set(["unpaid", "paid", "failed", "refunded"]);
const orderStatusSet = new Set(["pending_payment", "paid", "partially_fulfilled", "completed", "cancelled", "refunding", "refunded"]);
const productStatusSet = new Set(["draft", "on_sale", "off_sale"]);
const productTypeSet = new Set(["virtual", "physical", "hybrid"]);
const bannerLinkTypeSet = new Set(SHOP_BANNER_LINK_TYPE_VALUES);
const pendingShipmentOrderSelect = {
  id: true,
  items: {
    select: {
      id: true,
      quantity: true,
      requiresShipping: true,
      shipmentItems: {
        select: {
          quantity: true,
          shipment: {
            select: {
              status: true,
            },
          },
        },
      },
    },
  },
};

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const readPagination = (query = {}, defaultPageSize = 20, maxPageSize = 100) => {
  const page = Math.max(Number.parseInt(`${query.page ?? "1"}`, 10) || 1, 1);
  const pageSize = Math.min(Math.max(Number.parseInt(`${query.pageSize ?? `${defaultPageSize}`}`, 10) || defaultPageSize, 1), maxPageSize);
  return { page, pageSize };
};

const toStringArray = (value) =>
  [...new Set((Array.isArray(value) ? value : value ? [value] : []).map((item) => `${item}`.trim()).filter(Boolean))];

const toNonNegativeInt = (value, fallback = 0) => {
  const parsed = Number.parseInt(`${value ?? ""}`, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const toPositiveNumberString = (value, label) => {
  const parsed = Number.parseFloat(`${value ?? ""}`);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw createHttpError(`${label}必须大于 0`, 400);
  }

  return parsed.toFixed(2);
};

const toOptionalMoneyString = (value) => {
  const text = `${value ?? ""}`.trim();
  if (!text) return null;

  const parsed = Number.parseFloat(text);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw createHttpError("原价格式不正确", 400);
  }

  return parsed.toFixed(2);
};

const recordAdminAction = (req, payload) => {
  void writeAdminAuditLog(req, payload).catch((error) => {
    console.error("Audit log write failed:", error);
  });
};

const getPendingShipmentOrderPage = async ({ where, page, pageSize }) => {
  const candidates = await prisma.shopOrder.findMany({
    where,
    select: pendingShipmentOrderSelect,
    orderBy: {
      createdAt: "desc",
    },
  });
  const orderIds = candidates.filter(hasPendingShipmentItems).map((item) => item.id);

  return {
    total: orderIds.length,
    orderIds: orderIds.slice((page - 1) * pageSize, page * pageSize),
  };
};

const countPendingShipmentOrders = async (where) => {
  const candidates = await prisma.shopOrder.findMany({
    where,
    select: pendingShipmentOrderSelect,
  });
  return candidates.filter(hasPendingShipmentItems).length;
};

const loadOrdersByIds = async (orderIds) => {
  if (orderIds.length === 0) {
    return [];
  }

  const list = await prisma.shopOrder.findMany({
    where: {
      id: {
        in: orderIds,
      },
    },
    include: shopOrderDetailInclude,
  });
  const positionMap = new Map(orderIds.map((id, index) => [id, index]));
  list.sort((left, right) => (positionMap.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (positionMap.get(right.id) ?? Number.MAX_SAFE_INTEGER));
  return list;
};

const cleanupReplacedObject = ({ previousObjectKey = "", nextObjectKey = "" }) => {
  void cleanupObjectIfReplaced({ previousObjectKey, nextObjectKey }).catch((error) => {
    console.error("OSS replacement cleanup failed:", error);
  });
};

const cleanupRemovedObject = (objectKey = "") => {
  void cleanupObjectIfUnused(objectKey).catch((error) => {
    console.error("OSS cleanup failed:", error);
  });
};

const productCourseSelect = {
  id: true,
  name: true,
  coverUrl: true,
  coverObjectKey: true,
  description: true,
  status: true,
  openTime: true,
};

const categoryListInclude = {
  products: {
    where: {
      isDeleted: false,
    },
    select: {
      id: true,
    },
  },
};

const productListInclude = {
  category: true,
  courses: {
    include: {
      course: {
        select: productCourseSelect,
      },
    },
  },
  skus: {
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  },
};

const productDetailInclude = {
  ...productListInclude,
  images: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  },
};

const shipmentDetailInclude = {
  order: {
    include: {
      user: {
        select: {
          id: true,
          phone: true,
        },
      },
    },
  },
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
};

const getProductWhere = ({ keyword = "", categoryId = "", type = "", status = "" } = {}) => ({
  isDeleted: false,
  ...(keyword
    ? {
        OR: [{ name: { contains: keyword } }, { subtitle: { contains: keyword } }],
      }
    : {}),
  ...(categoryId ? { categoryId } : {}),
  ...(productTypeSet.has(type) ? { type } : {}),
  ...(productStatusSet.has(status) ? { status } : {}),
});

const getShipmentStatusTrackContent = (status) => {
  switch (status) {
    case "shipped":
      return "包裹已发货";
    case "in_transit":
      return "包裹运输中";
    case "signed":
      return "包裹已签收";
    case "failed":
      return "物流异常";
    default:
      return "";
  }
};

const normalizeSkuInputs = (value) => {
  const rawItems = Array.isArray(value) ? value : [];
  const normalized = rawItems.map((item, index) => ({
    id: `${item?.id ?? ""}`.trim(),
    name: `${item?.name ?? ""}`.trim(),
    price: toPositiveNumberString(item?.price, "SKU 价格"),
    originalPrice: toOptionalMoneyString(item?.originalPrice),
    stock: toNonNegativeInt(item?.stock, 0),
    weight: toNonNegativeInt(item?.weight, 0),
    isDefault: Boolean(item?.isDefault),
    status: item?.status === undefined ? true : Boolean(item.status),
    sortOrder: toNonNegativeInt(item?.sortOrder, index),
  }));

  if (normalized.length === 0) {
    throw createHttpError("至少需要配置一个 SKU", 400);
  }

  for (const item of normalized) {
    if (!item.name) {
      throw createHttpError("SKU 名称不能为空", 400);
    }
  }

  const defaultCount = normalized.filter((item) => item.isDefault).length;
  if (defaultCount > 1) {
    throw createHttpError("只能设置一个默认 SKU", 400);
  }
  if (defaultCount === 0) {
    normalized[0].isDefault = true;
  }

  return normalized;
};

const normalizeImageInputs = (value) =>
  (Array.isArray(value) ? value : [])
    .map((item, index) => ({
      id: `${item?.id ?? ""}`.trim(),
      imageUrl: `${item?.imageUrl ?? ""}`.trim(),
      imageObjectKey: `${item?.imageObjectKey ?? ""}`.trim(),
      sortOrder: toNonNegativeInt(item?.sortOrder, index),
    }))
    .filter((item) => item.imageUrl);

const serializeImageSnapshot = (images = []) =>
  images.length > 0
    ? JSON.stringify(
        images.map((item, index) => ({
          imageUrl: item.imageUrl,
          imageObjectKey: item.imageObjectKey || null,
          sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index,
        })),
      )
    : null;

const normalizeProductPayload = (body = {}) => {
  const categoryId = `${body?.categoryId ?? ""}`.trim();
  const name = `${body?.name ?? ""}`.trim();
  const subtitle = `${body?.subtitle ?? ""}`.trim();
  const coverUrl = `${body?.coverUrl ?? ""}`.trim();
  const coverObjectKey = `${body?.coverObjectKey ?? ""}`.trim();
  const type = `${body?.type ?? ""}`.trim();
  const status = `${body?.status ?? ""}`.trim();
  const description = `${body?.description ?? ""}`.trim();
  const detailContent = `${body?.detailContent ?? ""}`.trim();
  const sortOrder = toNonNegativeInt(body?.sortOrder, 0);
  const courseIds = toStringArray(body?.courseIds);
  const skus = normalizeSkuInputs(body?.skus);
  const images = normalizeImageInputs(body?.images);
  const detailImages = normalizeImageInputs(body?.detailImages);

  if (!categoryId) {
    throw createHttpError("请选择商品分类", 400);
  }
  if (!name) {
    throw createHttpError("商品名称不能为空", 400);
  }
  if (!coverUrl) {
    throw createHttpError("请上传商品封面", 400);
  }
  if (!productTypeSet.has(type)) {
    throw createHttpError("商品类型不正确", 400);
  }
  if (!productStatusSet.has(status)) {
    throw createHttpError("商品状态不正确", 400);
  }
  if (type === "physical" && courseIds.length > 0) {
    throw createHttpError("实物商品不能绑定课程", 400);
  }
  if (status === "on_sale" && type !== "physical" && courseIds.length === 0) {
    throw createHttpError("虚拟或组合商品上架前至少需要绑定一门课程", 400);
  }
  if (status === "on_sale" && !skus.some((item) => item.status)) {
    throw createHttpError("商品上架前至少需要一个启用中的 SKU", 400);
  }

  return {
    categoryId,
    name,
    subtitle: subtitle || null,
    coverUrl,
    coverObjectKey: coverObjectKey || null,
    type,
    status,
    description: description || null,
    detailContent: detailContent || null,
    detailImages,
    requiresShipping: type !== "virtual",
    sortOrder,
    courseIds,
    images,
    skus,
  };
};

const ensureProductRelationsExist = async ({ categoryId, courseIds }) => {
  const [category, courseCount] = await Promise.all([
    prisma.shopCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true },
    }),
    courseIds.length > 0
      ? prisma.course.count({
          where: {
            id: {
              in: courseIds,
            },
          },
        })
      : Promise.resolve(0),
  ]);

  if (!category) {
    throw createHttpError("商品分类不存在", 404);
  }
  if (courseIds.length > 0 && courseCount !== courseIds.length) {
    throw createHttpError("部分绑定课程不存在", 400);
  }
};

const validateProductEntityForSale = (product) => {
  if (!product || product.isDeleted) {
    throw createHttpError("商品不存在", 404);
  }
  if (!product.categoryId) {
    throw createHttpError("商品缺少分类，暂时不能上架", 400);
  }
  if (!product.coverUrl) {
    throw createHttpError("商品缺少封面，暂时不能上架", 400);
  }
  if (product.type === "physical" && (product.courses ?? []).length > 0) {
    throw createHttpError("实物商品不能绑定课程", 400);
  }
  if (product.type !== "physical" && (product.courses ?? []).length === 0) {
    throw createHttpError("虚拟或组合商品上架前至少需要绑定一门课程", 400);
  }
  if (!(product.skus ?? []).some((sku) => sku.status)) {
    throw createHttpError("商品上架前至少需要一个启用中的 SKU", 400);
  }
};

const getProductDetail = (productId) =>
  prisma.shopProduct.findUnique({
    where: { id: productId },
    include: productDetailInclude,
  });

const restoreOrderStock = async (db, orderId) => {
  const items = await db.shopOrderItem.findMany({
    where: { orderId },
    select: {
      skuId: true,
      quantity: true,
    },
  });

  for (const item of items) {
    await db.shopSku.update({
      where: { id: item.skuId },
      data: {
        stock: {
          increment: item.quantity,
        },
      },
    });
  }
};

const shopConfigInclude = {
  banners: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  },
};

const getShopConfigDetail = (db = prisma) =>
  db.shopConfig.upsert({
    where: {
      id: 1,
    },
    update: {},
    create: {
      id: 1,
    },
    include: shopConfigInclude,
  });

const normalizeBannerInputs = (value) =>
  (Array.isArray(value) ? value : []).map((item, index) => {
    const imageUrl = `${item?.imageUrl ?? ""}`.trim();
    const imageObjectKey = `${item?.imageObjectKey ?? ""}`.trim();
    const linkType = `${item?.linkType ?? "product"}`.trim();
    const linkTarget = `${item?.linkTarget ?? ""}`.trim();

    if (!imageUrl) {
      throw createHttpError("请先上传轮播图图片", 400);
    }
    if (!bannerLinkTypeSet.has(linkType)) {
      throw createHttpError("轮播图跳转类型不正确", 400);
    }
    if (!linkTarget) {
      throw createHttpError("请填写轮播图跳转目标", 400);
    }

    return {
      title: `${item?.title ?? ""}`.trim(),
      imageUrl,
      imageObjectKey,
      linkType,
      linkTarget,
      sortOrder: toNonNegativeInt(item?.sortOrder, index),
      status: item?.status === undefined ? true : Boolean(item.status),
    };
  });

const normalizeShopConfigPayload = (body = {}) => ({
  shopNotice: `${body?.shopNotice ?? ""}`.trim(),
  customerServiceUrl: `${body?.customerServiceUrl ?? ""}`.trim(),
  featuredProductIds: toStringArray(body?.featuredProductIds),
  featuredCategoryIds: toStringArray(body?.featuredCategoryIds),
  paymentGuide: `${body?.paymentGuide ?? ""}`.trim(),
  enableWechatH5: body?.enableWechatH5 === undefined ? true : Boolean(body.enableWechatH5),
  enableWechatJsapi: body?.enableWechatJsapi === undefined ? true : Boolean(body.enableWechatJsapi),
  enableAlipayWap: body?.enableAlipayWap === undefined ? true : Boolean(body.enableAlipayWap),
  banners: normalizeBannerInputs(body?.banners),
});

const ensureShopConfigReferencesExist = async (payload) => {
  const productIds = new Set(payload.featuredProductIds);
  const categoryIds = new Set(payload.featuredCategoryIds);

  payload.banners.forEach((banner) => {
    if (banner.linkType === "product") {
      productIds.add(banner.linkTarget);
    }

    if (banner.linkType === "category") {
      categoryIds.add(banner.linkTarget);
    }
  });

  const [products, categories] = await Promise.all([
    productIds.size > 0
      ? prisma.shopProduct.findMany({
          where: {
            id: {
              in: [...productIds],
            },
            isDeleted: false,
          },
          select: {
            id: true,
          },
        })
      : Promise.resolve([]),
    categoryIds.size > 0
      ? prisma.shopCategory.findMany({
          where: {
            id: {
              in: [...categoryIds],
            },
          },
          select: {
            id: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const productIdSet = new Set(products.map((item) => item.id));
  const categoryIdSet = new Set(categories.map((item) => item.id));

  if (payload.featuredProductIds.some((id) => !productIdSet.has(id))) {
    throw createHttpError("推荐商品中包含不存在或已删除的商品", 400);
  }

  if (payload.featuredCategoryIds.some((id) => !categoryIdSet.has(id))) {
    throw createHttpError("推荐分类中包含不存在的分类", 400);
  }

  for (const banner of payload.banners) {
    if (banner.linkType === "product" && !productIdSet.has(banner.linkTarget)) {
      throw createHttpError("轮播图关联的商品不存在或已删除", 400);
    }

    if (banner.linkType === "category" && !categoryIdSet.has(banner.linkTarget)) {
      throw createHttpError("轮播图关联的分类不存在", 400);
    }
  }
};

shopAdminRouter.get("/config", async (_req, res) => {
  const configRecord = await getShopConfigDetail();
  const paymentRuntime = buildShopPaymentRuntimeDiagnostics({
    runtimeConfig,
    shopConfig: configRecord,
  });
  return ok(
    res,
    serializeShopConfig(configRecord, {
      runtimePaymentMode: runtimeConfig.shopPaymentMode,
      paymentRuntime,
    }),
  );
});

shopAdminRouter.patch("/config", async (req, res) => {
  try {
    const existing = await getShopConfigDetail();
    const payload = normalizeShopConfigPayload(req.body);
    await ensureShopConfigReferencesExist(payload);

    const nextBannerKeys = new Set(payload.banners.map((item) => item.imageObjectKey).filter(Boolean));
    const removedBannerKeys = existing.banners
      .map((item) => item.imageObjectKey ?? "")
      .filter((objectKey) => objectKey && !nextBannerKeys.has(objectKey));

    const updated = await prisma.$transaction(async (tx) => {
      await tx.shopConfig.upsert({
        where: {
          id: 1,
        },
        update: {
          shopNotice: payload.shopNotice || null,
          customerServiceUrl: payload.customerServiceUrl || null,
          featuredProductIds: payload.featuredProductIds.length > 0 ? JSON.stringify(payload.featuredProductIds) : null,
          featuredCategoryIds: payload.featuredCategoryIds.length > 0 ? JSON.stringify(payload.featuredCategoryIds) : null,
          paymentGuide: payload.paymentGuide || null,
          enableWechatH5: payload.enableWechatH5,
          enableWechatJsapi: payload.enableWechatJsapi,
          enableAlipayWap: payload.enableAlipayWap,
        },
        create: {
          id: 1,
          shopNotice: payload.shopNotice || null,
          customerServiceUrl: payload.customerServiceUrl || null,
          featuredProductIds: payload.featuredProductIds.length > 0 ? JSON.stringify(payload.featuredProductIds) : null,
          featuredCategoryIds: payload.featuredCategoryIds.length > 0 ? JSON.stringify(payload.featuredCategoryIds) : null,
          paymentGuide: payload.paymentGuide || null,
          enableWechatH5: payload.enableWechatH5,
          enableWechatJsapi: payload.enableWechatJsapi,
          enableAlipayWap: payload.enableAlipayWap,
        },
      });

      await tx.shopBanner.deleteMany({
        where: {
          configId: 1,
        },
      });

      if (payload.banners.length > 0) {
        await tx.shopBanner.createMany({
          data: payload.banners.map((item) => ({
            configId: 1,
            title: item.title || null,
            imageUrl: item.imageUrl,
            imageObjectKey: item.imageObjectKey || null,
            linkType: item.linkType,
            linkTarget: item.linkTarget,
            sortOrder: item.sortOrder,
            status: item.status,
          })),
        });
      }

      return getShopConfigDetail(tx);
    });

    removedBannerKeys.forEach(cleanupRemovedObject);

    recordAdminAction(req, {
      action: "shop.config.update",
      entityType: "shopConfig",
      entityId: "1",
      entityName: "商城配置",
      detail: {
        previousFeaturedProductIds: parseStringArraySnapshot(existing.featuredProductIds),
        previousFeaturedCategoryIds: parseStringArraySnapshot(existing.featuredCategoryIds),
        nextFeaturedProductIds: payload.featuredProductIds,
        nextFeaturedCategoryIds: payload.featuredCategoryIds,
        bannerCount: payload.banners.length,
        paymentChannels: {
          wechatH5: payload.enableWechatH5,
          wechatJsapi: payload.enableWechatJsapi,
          alipayWap: payload.enableAlipayWap,
        },
      },
    });

    return ok(
      res,
      serializeShopConfig(updated, {
        runtimePaymentMode: runtimeConfig.shopPaymentMode,
        paymentRuntime: buildShopPaymentRuntimeDiagnostics({
          runtimeConfig,
          shopConfig: updated,
        }),
      }),
      "商城配置已更新",
    );
  } catch (error) {
    return fail(res, error.message || "更新商城配置失败", error.statusCode || 400);
  }
});

shopAdminRouter.get("/categories", async (req, res) => {
  const keyword = `${req.query?.keyword ?? ""}`.trim();
  const status = `${req.query?.status ?? ""}`.trim();

  const list = await prisma.shopCategory.findMany({
    where: {
      ...(keyword ? { name: { contains: keyword } } : {}),
      ...(status === "enabled" ? { status: true } : {}),
      ...(status === "disabled" ? { status: false } : {}),
    },
    include: categoryListInclude,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return ok(res, list.map(serializeShopCategory));
});

shopAdminRouter.post("/categories", async (req, res) => {
  const name = `${req.body?.name ?? ""}`.trim();
  const sortOrder = toNonNegativeInt(req.body?.sortOrder, 0);
  const status = req.body?.status === undefined ? true : Boolean(req.body.status);

  if (!name) {
    return fail(res, "分类名称不能为空", 400);
  }

  try {
    const category = await prisma.shopCategory.create({
      data: {
        name,
        sortOrder,
        status,
      },
      include: categoryListInclude,
    });

    recordAdminAction(req, {
      action: "shop.category.create",
      entityType: "shopCategory",
      entityId: category.id,
      entityName: category.name,
    });

    return ok(res, serializeShopCategory(category), "商品分类已创建");
  } catch (error) {
    if (error?.code === "P2002") {
      return fail(res, "分类名称已存在", 400);
    }

    throw error;
  }
});

shopAdminRouter.patch("/categories/:categoryId", async (req, res) => {
  const categoryId = `${req.params.categoryId ?? ""}`.trim();
  const name = `${req.body?.name ?? ""}`.trim();
  const sortOrder = toNonNegativeInt(req.body?.sortOrder, 0);
  const status = req.body?.status === undefined ? true : Boolean(req.body.status);

  if (!categoryId) {
    return fail(res, "缺少分类参数", 400);
  }
  if (!name) {
    return fail(res, "分类名称不能为空", 400);
  }

  const existing = await prisma.shopCategory.findUnique({
    where: { id: categoryId },
    include: categoryListInclude,
  });

  if (!existing) {
    return fail(res, "商品分类不存在", 404);
  }

  try {
    const category = await prisma.shopCategory.update({
      where: { id: categoryId },
      data: {
        name,
        sortOrder,
        status,
      },
      include: categoryListInclude,
    });

    recordAdminAction(req, {
      action: "shop.category.update",
      entityType: "shopCategory",
      entityId: category.id,
      entityName: category.name,
      detail: {
        previousName: existing.name,
      },
    });

    return ok(res, serializeShopCategory(category), "商品分类已更新");
  } catch (error) {
    if (error?.code === "P2002") {
      return fail(res, "分类名称已存在", 400);
    }

    throw error;
  }
});

shopAdminRouter.delete("/categories/:categoryId", async (req, res) => {
  const categoryId = `${req.params.categoryId ?? ""}`.trim();
  if (!categoryId) {
    return fail(res, "缺少分类参数", 400);
  }

  const category = await prisma.shopCategory.findUnique({
    where: { id: categoryId },
    select: {
      id: true,
      name: true,
    },
  });

  if (!category) {
    return fail(res, "商品分类不存在", 404);
  }

  const productCount = await prisma.shopProduct.count({
    where: {
      categoryId,
      isDeleted: false,
    },
  });

  if (productCount > 0) {
    return fail(res, "该分类下仍有商品，无法删除", 400);
  }

  await prisma.shopCategory.delete({
    where: { id: categoryId },
  });

  recordAdminAction(req, {
    action: "shop.category.delete",
    entityType: "shopCategory",
    entityId: category.id,
    entityName: category.name,
  });

  return ok(res, { success: true }, "商品分类已删除");
});

shopAdminRouter.get("/products", async (req, res) => {
  const { page, pageSize } = readPagination(req.query, 20, 100);
  const keyword = `${req.query?.keyword ?? ""}`.trim();
  const categoryId = `${req.query?.categoryId ?? ""}`.trim();
  const type = `${req.query?.type ?? ""}`.trim();
  const status = `${req.query?.status ?? ""}`.trim();

  const where = getProductWhere({ keyword, categoryId, type, status });
  const [total, list, groupedStatusCounts] = await prisma.$transaction([
    prisma.shopProduct.count({ where }),
    prisma.shopProduct.findMany({
      where,
      include: productListInclude,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.shopProduct.groupBy({
      by: ["status"],
      where,
      _count: {
        _all: true,
      },
    }),
  ]);
  const statusCountMap = new Map(groupedStatusCounts.map((item) => [item.status, item._count._all]));

  return ok(res, {
    list: list.map(serializeAdminShopProductListItem),
    pagination: {
      page,
      pageSize,
      total,
    },
    summary: {
      total,
      onSale: statusCountMap.get("on_sale") ?? 0,
      draft: statusCountMap.get("draft") ?? 0,
      offSale: statusCountMap.get("off_sale") ?? 0,
    },
  });
});

shopAdminRouter.get("/products/:productId", async (req, res) => {
  const productId = `${req.params.productId ?? ""}`.trim();
  if (!productId) {
    return fail(res, "缺少商品参数", 400);
  }

  const product = await getProductDetail(productId);
  if (!product || product.isDeleted) {
    return fail(res, "商品不存在", 404);
  }

  return ok(res, serializeAdminShopProductDetail(product));
});

shopAdminRouter.post("/products", async (req, res) => {
  try {
    const payload = normalizeProductPayload(req.body);
    await ensureProductRelationsExist(payload);

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.shopProduct.create({
        data: {
          categoryId: payload.categoryId,
          name: payload.name,
          subtitle: payload.subtitle,
          coverUrl: payload.coverUrl,
          coverObjectKey: payload.coverObjectKey,
          type: payload.type,
          status: payload.status,
          description: payload.description,
          detailContent: payload.detailContent,
          detailImages: serializeImageSnapshot(payload.detailImages),
          requiresShipping: payload.requiresShipping,
          sortOrder: payload.sortOrder,
          images: {
            create: payload.images.map((item) => ({
              imageUrl: item.imageUrl,
              imageObjectKey: item.imageObjectKey || null,
              sortOrder: item.sortOrder,
            })),
          },
          courses: {
            create: payload.courseIds.map((courseId) => ({
              courseId,
            })),
          },
          skus: {
            create: payload.skus.map((item) => ({
              name: item.name,
              price: item.price,
              originalPrice: item.originalPrice,
              stock: item.stock,
              weight: item.weight,
              isDefault: item.isDefault,
              status: item.status,
            })),
          },
        },
      });

      return tx.shopProduct.findUnique({
        where: { id: created.id },
        include: productDetailInclude,
      });
    });

    recordAdminAction(req, {
      action: "shop.product.create",
      entityType: "shopProduct",
      entityId: product.id,
      entityName: product.name,
      detail: {
        type: product.type,
        status: product.status,
      },
    });

    return ok(res, serializeAdminShopProductDetail(product), "商品已创建");
  } catch (error) {
    return fail(res, error.message || "创建商品失败", error.statusCode || 400);
  }
});

shopAdminRouter.patch("/products/:productId", async (req, res) => {
  const productId = `${req.params.productId ?? ""}`.trim();
  if (!productId) {
    return fail(res, "缺少商品参数", 400);
  }

  const existing = await getProductDetail(productId);
  if (!existing || existing.isDeleted) {
    return fail(res, "商品不存在", 404);
  }

  try {
    const payload = normalizeProductPayload(req.body);
    await ensureProductRelationsExist(payload);

      const imageCleanupPairs = [];
      const removedImageObjectKeys = [];
      const existingDetailImages = parseProductImageSnapshot(existing.detailImages);

      const product = await prisma.$transaction(async (tx) => {
        await tx.shopProduct.update({
          where: { id: productId },
          data: {
          categoryId: payload.categoryId,
          name: payload.name,
          subtitle: payload.subtitle,
          coverUrl: payload.coverUrl,
          coverObjectKey: payload.coverObjectKey,
            type: payload.type,
            status: payload.status,
            description: payload.description,
            detailContent: payload.detailContent,
            detailImages: serializeImageSnapshot(payload.detailImages),
            requiresShipping: payload.requiresShipping,
            sortOrder: payload.sortOrder,
          },
        });

      await tx.shopProductCourse.deleteMany({
        where: { productId },
      });

      if (payload.courseIds.length > 0) {
        await tx.shopProductCourse.createMany({
          data: payload.courseIds.map((courseId) => ({
            productId,
            courseId,
          })),
          skipDuplicates: true,
        });
      }

      const existingImageMap = new Map(existing.images.map((item) => [item.id, item]));
      const retainedImageIds = new Set();

      for (const image of payload.images) {
        if (image.id && existingImageMap.has(image.id)) {
          const previous = existingImageMap.get(image.id);
          retainedImageIds.add(image.id);
          await tx.shopProductImage.update({
            where: { id: image.id },
            data: {
              imageUrl: image.imageUrl,
              imageObjectKey: image.imageObjectKey || null,
              sortOrder: image.sortOrder,
            },
          });
          imageCleanupPairs.push({
            previousObjectKey: previous.imageObjectKey ?? "",
            nextObjectKey: image.imageObjectKey || "",
          });
          continue;
        }

        await tx.shopProductImage.create({
          data: {
            productId,
            imageUrl: image.imageUrl,
            imageObjectKey: image.imageObjectKey || null,
            sortOrder: image.sortOrder,
          },
        });
      }

      const removedImages = existing.images.filter((item) => !retainedImageIds.has(item.id));
        if (removedImages.length > 0) {
          await tx.shopProductImage.deleteMany({
            where: {
              id: {
                in: removedImages.map((item) => item.id),
            },
          },
          });
          removedImageObjectKeys.push(...removedImages.map((item) => item.imageObjectKey ?? "").filter(Boolean));
        }

        const nextDetailObjectKeySet = new Set(payload.detailImages.map((item) => item.imageObjectKey).filter(Boolean));
        removedImageObjectKeys.push(
          ...existingDetailImages
            .map((item) => item.imageObjectKey ?? "")
            .filter((objectKey) => objectKey && !nextDetailObjectKeySet.has(objectKey)),
        );

        const existingSkuMap = new Map(existing.skus.map((item) => [item.id, item]));
      const retainedSkuIds = new Set();

      for (const sku of payload.skus) {
        if (sku.id && existingSkuMap.has(sku.id)) {
          retainedSkuIds.add(sku.id);
          await tx.shopSku.update({
            where: { id: sku.id },
            data: {
              name: sku.name,
              price: sku.price,
              originalPrice: sku.originalPrice,
              stock: sku.stock,
              weight: sku.weight,
              isDefault: sku.isDefault,
              status: sku.status,
            },
          });
          continue;
        }

        await tx.shopSku.create({
          data: {
            productId,
            name: sku.name,
            price: sku.price,
            originalPrice: sku.originalPrice,
            stock: sku.stock,
            weight: sku.weight,
            isDefault: sku.isDefault,
            status: sku.status,
          },
        });
      }

      const removedSkus = existing.skus.filter((item) => !retainedSkuIds.has(item.id));
      for (const sku of removedSkus) {
        const orderRefCount = await tx.shopOrderItem.count({
          where: { skuId: sku.id },
        });

        if (orderRefCount > 0) {
          await tx.shopSku.update({
            where: { id: sku.id },
            data: {
              status: false,
              isDefault: false,
              stock: 0,
            },
          });
          continue;
        }

        await tx.shopSku.delete({
          where: { id: sku.id },
        });
      }

      return tx.shopProduct.findUnique({
        where: { id: productId },
        include: productDetailInclude,
      });
    });

    cleanupReplacedObject({
      previousObjectKey: existing.coverObjectKey ?? "",
      nextObjectKey: payload.coverObjectKey ?? "",
    });
    imageCleanupPairs.forEach(cleanupReplacedObject);
    removedImageObjectKeys.forEach(cleanupRemovedObject);

    recordAdminAction(req, {
      action: "shop.product.update",
      entityType: "shopProduct",
      entityId: product.id,
      entityName: product.name,
      detail: {
        previousName: existing.name,
        type: product.type,
        status: product.status,
      },
    });

    return ok(res, serializeAdminShopProductDetail(product), "商品已更新");
  } catch (error) {
    return fail(res, error.message || "更新商品失败", error.statusCode || 400);
  }
});

shopAdminRouter.post("/products/:productId/publish", async (req, res) => {
  const productId = `${req.params.productId ?? ""}`.trim();
  const status = `${req.body?.status ?? ""}`.trim();

  if (!productId) {
    return fail(res, "缺少商品参数", 400);
  }
  if (!productStatusSet.has(status)) {
    return fail(res, "商品状态不正确", 400);
  }

  const product = await getProductDetail(productId);
  if (!product || product.isDeleted) {
    return fail(res, "商品不存在", 404);
  }

  try {
    if (status === "on_sale") {
      validateProductEntityForSale(product);
    }

    const updated = await prisma.shopProduct.update({
      where: { id: productId },
      data: { status },
      include: productDetailInclude,
    });

    recordAdminAction(req, {
      action: "shop.product.publish",
      entityType: "shopProduct",
      entityId: updated.id,
      entityName: updated.name,
      detail: {
        previousStatus: product.status,
        nextStatus: status,
      },
    });

    return ok(res, serializeAdminShopProductDetail(updated), "商品状态已更新");
  } catch (error) {
    return fail(res, error.message || "更新商品状态失败", error.statusCode || 400);
  }
});

shopAdminRouter.delete("/products/:productId", async (req, res) => {
  const productId = `${req.params.productId ?? ""}`.trim();
  if (!productId) {
    return fail(res, "缺少商品参数", 400);
  }

  const product = await prisma.shopProduct.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      isDeleted: true,
    },
  });

  if (!product || product.isDeleted) {
    return fail(res, "商品不存在", 404);
  }

  await prisma.shopProduct.update({
    where: { id: productId },
    data: {
      isDeleted: true,
      status: "off_sale",
    },
  });

  recordAdminAction(req, {
    action: "shop.product.delete",
    entityType: "shopProduct",
    entityId: product.id,
    entityName: product.name,
  });

  return ok(res, { success: true }, "商品已删除");
});

shopAdminRouter.get("/orders", async (req, res) => {
  const { page, pageSize } = readPagination(req.query, 20, 100);
  const orderNo = `${req.query?.orderNo ?? ""}`.trim();
  const phone = `${req.query?.phone ?? ""}`.trim();
  const keyword = `${req.query?.keyword ?? ""}`.trim();
  const status = `${req.query?.status ?? ""}`.trim();
  const paymentStatus = `${req.query?.paymentStatus ?? ""}`.trim();
  const shipmentStatus = `${req.query?.shipmentStatus ?? ""}`.trim();

  const baseWhere = {
    ...(orderNo ? { orderNo: { contains: orderNo } } : {}),
    ...(status && orderStatusSet.has(status) ? { status } : {}),
    ...(paymentStatus && paymentStatusSet.has(paymentStatus) ? { paymentStatus } : {}),
    ...(phone
      ? {
          user: {
            phone: { contains: phone },
          },
        }
      : {}),
    ...(keyword
      ? {
          items: {
            some: {
              productNameSnapshot: { contains: keyword },
            },
          },
        }
      : {}),
  };

  if (shipmentStatus === "pending") {
    const { total, orderIds } = await getPendingShipmentOrderPage({
      where: {
        AND: [
          baseWhere,
          {
            paymentStatus: "paid",
            status: {
              notIn: ["cancelled", "refunding", "refunded", "completed"],
            },
          },
          {
            items: {
              some: {
                requiresShipping: true,
              },
            },
          },
        ],
      },
      page,
      pageSize,
    });
    const list = await loadOrdersByIds(orderIds);
    const summary = {
      total,
      pendingPayment: 0,
      paid: total,
      waitingShipment: total,
    };

    return ok(res, {
      list: list.map((order) => serializeShopOrder(order)),
      pagination: {
        page,
        pageSize,
        total,
      },
      summary,
    });
  }

  const where = {
    ...baseWhere,
    ...(shipmentStatus && shipmentStatusSet.has(shipmentStatus)
      ? {
          shipments: {
            some: {
              status: shipmentStatus,
            },
          },
        }
      : {}),
  };

  const pendingShipmentWhere = {
    AND: [
      where,
      {
        paymentStatus: "paid",
        status: {
          notIn: ["cancelled", "refunding", "refunded", "completed"],
        },
      },
      {
        items: {
          some: {
            requiresShipping: true,
          },
        },
      },
    ],
  };

  const [total, list, pendingPaymentCount, paidCount, waitingShipmentCount] = await Promise.all([
    prisma.shopOrder.count({ where }),
    prisma.shopOrder.findMany({
      where,
      include: shopOrderDetailInclude,
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.shopOrder.count({
      where: {
        AND: [where, { status: "pending_payment" }],
      },
    }),
    prisma.shopOrder.count({
      where: {
        AND: [where, { paymentStatus: "paid" }],
      },
    }),
    countPendingShipmentOrders(pendingShipmentWhere),
  ]);

  return ok(res, {
    list: list.map((order) => serializeShopOrder(order)),
    pagination: {
      page,
      pageSize,
      total,
    },
    summary: {
      total,
      pendingPayment: pendingPaymentCount,
      paid: paidCount,
      waitingShipment: waitingShipmentCount,
    },
  });
});

shopAdminRouter.get("/orders/:orderId", async (req, res) => {
  const orderId = `${req.params.orderId ?? ""}`.trim();
  if (!orderId) {
    return fail(res, "缺少订单参数", 400);
  }

  const order = await prisma.shopOrder.findUnique({
    where: { id: orderId },
    include: shopOrderDetailInclude,
  });

  if (!order) {
    return fail(res, "订单不存在", 404);
  }

  return ok(res, serializeShopOrder(order, { includeRelations: true }));
});

shopAdminRouter.post("/orders/:orderId/close", async (req, res) => {
  const orderId = `${req.params.orderId ?? ""}`.trim();
  const reason = `${req.body?.reason ?? ""}`.trim();

  if (!orderId) {
    return fail(res, "缺少订单参数", 400);
  }

  const order = await prisma.shopOrder.findUnique({
    where: { id: orderId },
    include: {
      items: true,
    },
  });

  if (!order) {
    return fail(res, "订单不存在", 404);
  }
  if (order.status !== "pending_payment" || order.paymentStatus !== "unpaid") {
    return fail(res, "当前订单不允许关闭", 400);
  }

  await prisma.$transaction(async (tx) => {
    await restoreOrderStock(tx, orderId);
    await tx.shopOrder.update({
      where: { id: orderId },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
      },
    });
  });

  recordAdminAction(req, {
    action: "shop.order.close",
    entityType: "shopOrder",
    entityId: orderId,
    entityName: order.orderNo,
    detail: {
      reason,
    },
  });

  const updated = await prisma.shopOrder.findUnique({
    where: { id: orderId },
    include: shopOrderDetailInclude,
  });

  return ok(res, serializeShopOrder(updated, { includeRelations: true }), "订单已关闭");
});

shopAdminRouter.post("/refunds/:refundId/approve", async (req, res) => {
  const refundId = `${req.params.refundId ?? ""}`.trim();
  const note = `${req.body?.note ?? ""}`.trim();

  if (!refundId) {
    return fail(res, "缺少退款参数", 400);
  }

  try {
    const order = await approveShopRefund({
      db: prisma,
      refundId,
      note,
    });

    const targetRefund = (order.refunds ?? []).find((item) => item.id === refundId);
    recordAdminAction(req, {
      action: "shop.refund.approve",
      entityType: "shopRefund",
      entityId: refundId,
      entityName: order.orderNo,
      detail: {
        orderId: order.id,
        orderNo: order.orderNo,
        refundAmount: targetRefund?.refundAmount?.toString?.() ?? "",
        note,
      },
    });

    return ok(res, serializeShopOrder(order, { includeRelations: true }), "退款申请已通过");
  } catch (error) {
    return fail(res, error.message || "审批退款失败", error.statusCode || 400);
  }
});

shopAdminRouter.post("/refunds/:refundId/reject", async (req, res) => {
  const refundId = `${req.params.refundId ?? ""}`.trim();
  const reason = `${req.body?.reason ?? ""}`.trim();

  if (!refundId) {
    return fail(res, "缺少退款参数", 400);
  }

  try {
    const order = await rejectShopRefund({
      db: prisma,
      refundId,
      reason,
    });

    recordAdminAction(req, {
      action: "shop.refund.reject",
      entityType: "shopRefund",
      entityId: refundId,
      entityName: order.orderNo,
      detail: {
        orderId: order.id,
        orderNo: order.orderNo,
        reason,
      },
    });

    return ok(res, serializeShopOrder(order, { includeRelations: true }), "退款申请已驳回");
  } catch (error) {
    return fail(res, error.message || "驳回退款失败", error.statusCode || 400);
  }
});

shopAdminRouter.post("/refunds/:refundId/complete", async (req, res) => {
  const refundId = `${req.params.refundId ?? ""}`.trim();
  const note = `${req.body?.note ?? ""}`.trim();

  if (!refundId) {
    return fail(res, "缺少退款参数", 400);
  }

  try {
    const order = await completeShopRefund({
      db: prisma,
      refundId,
      note,
    });

    const targetRefund = (order.refunds ?? []).find((item) => item.id === refundId);
    recordAdminAction(req, {
      action: "shop.refund.complete",
      entityType: "shopRefund",
      entityId: refundId,
      entityName: order.orderNo,
      detail: {
        orderId: order.id,
        orderNo: order.orderNo,
        refundAmount: targetRefund?.refundAmount?.toString?.() ?? "",
        note,
      },
    });

    return ok(res, serializeShopOrder(order, { includeRelations: true }), "退款已完成");
  } catch (error) {
    return fail(res, error.message || "完成退款失败", error.statusCode || 400);
  }
});

const shipmentStartedStatusSet = new Set(["shipped", "in_transit", "signed"]);

const toPositiveInt = (value, fallback = 1) => {
  const parsed = Number.parseInt(`${value ?? ""}`, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseOptionalDate = (value, label = "时间") => {
  const text = `${value ?? ""}`.trim();
  if (!text) return null;

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw createHttpError(`${label}格式不正确`, 400);
  }

  return date;
};

const getShipmentWhere = ({ orderNo = "", phone = "", status = "", keyword = "", trackingNo = "" } = {}) => {
  const orderFilter = {};

  if (orderNo) {
    orderFilter.orderNo = { contains: orderNo };
  }
  if (phone) {
    orderFilter.user = {
      is: {
        phone: { contains: phone },
      },
    };
  }

  return {
    ...(Object.keys(orderFilter).length > 0
      ? {
          order: {
            is: orderFilter,
          },
        }
      : {}),
    ...(shipmentStatusSet.has(status) ? { status } : {}),
    ...(trackingNo ? { trackingNo: { contains: trackingNo } } : {}),
    ...(keyword
      ? {
          OR: [
            { company: { contains: keyword } },
            { trackingNo: { contains: keyword } },
            {
              items: {
                some: {
                  orderItem: {
                    productNameSnapshot: { contains: keyword },
                  },
                },
              },
            },
          ],
        }
      : {}),
  };
};

const normalizeShipmentItemInputs = (value) => {
  const list = Array.isArray(value) ? value : [];
  const seen = new Set();
  const normalized = [];

  for (const rawItem of list) {
    const orderItemId = `${rawItem?.orderItemId ?? ""}`.trim();
    const quantity = toPositiveInt(rawItem?.quantity, 0);

    if (!orderItemId) {
      throw createHttpError("发货项缺少订单明细 ID", 400);
    }
    if (quantity <= 0) {
      throw createHttpError("发货数量必须大于 0", 400);
    }
    if (seen.has(orderItemId)) {
      throw createHttpError("同一订单明细不能重复发货", 400);
    }

    seen.add(orderItemId);
    normalized.push({ orderItemId, quantity });
  }

  if (normalized.length === 0) {
    throw createHttpError("请至少选择一个发货商品", 400);
  }

  return normalized;
};

const buildShipmentCreateItems = (order, itemInputs) => {
  const shippableItems = (order.items ?? []).filter((item) => item.requiresShipping);
  if (shippableItems.length === 0) {
    throw createHttpError("当前订单不需要发货", 400);
  }

  const { startedQuantityMap } = buildShipmentQuantityMaps(shippableItems);
  const orderItemMap = new Map(shippableItems.map((item) => [item.id, item]));

  return itemInputs.map((item) => {
    const orderItem = orderItemMap.get(item.orderItemId);
    if (!orderItem) {
      throw createHttpError("发货商品不存在或不支持发货", 400);
    }

    const startedQuantity = startedQuantityMap.get(orderItem.id) ?? 0;
    const remainingQuantity = Math.max(orderItem.quantity - startedQuantity, 0);

    if (remainingQuantity <= 0) {
      throw createHttpError(`商品 ${orderItem.productNameSnapshot} 已全部发货`, 400);
    }
    if (item.quantity > remainingQuantity) {
      throw createHttpError(`商品 ${orderItem.productNameSnapshot} 剩余可发货数量不足`, 400);
    }

    return {
      orderItemId: orderItem.id,
      quantity: item.quantity,
    };
  });
};

shopAdminRouter.get("/shipments", async (req, res) => {
  const { page, pageSize } = readPagination(req.query, 20, 100);
  const orderNo = `${req.query?.orderNo ?? ""}`.trim();
  const phone = `${req.query?.phone ?? ""}`.trim();
  const status = `${req.query?.status ?? ""}`.trim();
  const keyword = `${req.query?.keyword ?? ""}`.trim();
  const trackingNo = `${req.query?.trackingNo ?? ""}`.trim();

  const where = getShipmentWhere({ orderNo, phone, status, keyword, trackingNo });
  const [total, list, groupedStatusCounts] = await prisma.$transaction([
    prisma.shopShipment.count({ where }),
    prisma.shopShipment.findMany({
      where,
      include: shipmentDetailInclude,
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.shopShipment.groupBy({
      by: ["status"],
      where,
      _count: {
        _all: true,
      },
    }),
  ]);
  const statusCountMap = new Map(groupedStatusCounts.map((item) => [item.status, item._count._all]));

  return ok(res, {
    list: list.map(serializeShopShipment),
    pagination: {
      page,
      pageSize,
      total,
    },
    summary: {
      total,
      pending: statusCountMap.get("pending") ?? 0,
      shipped: statusCountMap.get("shipped") ?? 0,
      inTransit: statusCountMap.get("in_transit") ?? 0,
      signed: statusCountMap.get("signed") ?? 0,
      failed: statusCountMap.get("failed") ?? 0,
    },
  });
});

shopAdminRouter.post("/orders/:orderId/shipments", async (req, res) => {
  const orderId = `${req.params.orderId ?? ""}`.trim();
  const company = `${req.body?.company ?? ""}`.trim();
  const trackingNo = `${req.body?.trackingNo ?? ""}`.trim();
  const remark = `${req.body?.remark ?? ""}`.trim();
  const requestedStatus = `${req.body?.status ?? "shipped"}`.trim();

  if (!orderId) {
    return fail(res, "缺少订单参数", 400);
  }
  if (!company) {
    return fail(res, "请输入物流公司", 400);
  }
  if (!trackingNo) {
    return fail(res, "请输入物流单号", 400);
  }
  if (!shipmentStatusSet.has(requestedStatus)) {
    return fail(res, "物流状态不正确", 400);
  }

  const order = await prisma.shopOrder.findUnique({
    where: { id: orderId },
    include: {
      items: {
        orderBy: {
          createdAt: "asc",
        },
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
    },
  });

  if (!order) {
    return fail(res, "订单不存在", 404);
  }
  if (order.paymentStatus !== "paid") {
    return fail(res, "未支付订单不能发货", 400);
  }
  if (order.status === "cancelled" || order.status === "refunding" || order.status === "refunded" || order.status === "completed") {
    return fail(res, "当前订单状态不允许继续发货", 400);
  }

  try {
    const shipmentItems = buildShipmentCreateItems(order, normalizeShipmentItemInputs(req.body?.items));
    const eventTime = new Date();
    const initialTrackContent = remark || getShipmentStatusTrackContent(requestedStatus);

    const created = await prisma.$transaction(async (tx) => {
      const shipment = await tx.shopShipment.create({
        data: {
          orderId,
          status: requestedStatus,
          company,
          trackingNo,
          shippedAt: shipmentStartedStatusSet.has(requestedStatus) ? eventTime : null,
          signedAt: requestedStatus === "signed" ? eventTime : null,
          items: {
            create: shipmentItems,
          },
          ...(initialTrackContent
            ? {
                tracks: {
                  create: {
                    content: initialTrackContent,
                    trackTime: eventTime,
                  },
                },
              }
            : {}),
        },
        include: shipmentDetailInclude,
      });

      await recalculateShopOrderStatus(tx, orderId);
      return shipment;
    });

    recordAdminAction(req, {
      action: "shop.shipment.create",
      entityType: "shopShipment",
      entityId: created.id,
      entityName: trackingNo,
      detail: {
        orderId,
        orderNo: order.orderNo,
        status: requestedStatus,
        company,
        itemCount: shipmentItems.length,
      },
    });

    return ok(res, serializeShopShipment(created), "发货单已创建");
  } catch (error) {
    return fail(res, error.message || "创建发货单失败", error.statusCode || 400);
  }
});

shopAdminRouter.patch("/shipments/:shipmentId", async (req, res) => {
  const shipmentId = `${req.params.shipmentId ?? ""}`.trim();
  if (!shipmentId) {
    return fail(res, "缺少发货单参数", 400);
  }

  const existing = await prisma.shopShipment.findUnique({
    where: { id: shipmentId },
    include: shipmentDetailInclude,
  });

  if (!existing) {
    return fail(res, "发货单不存在", 404);
  }

  const company = req.body?.company === undefined ? existing.company ?? "" : `${req.body.company ?? ""}`.trim();
  const trackingNo = req.body?.trackingNo === undefined ? existing.trackingNo ?? "" : `${req.body.trackingNo ?? ""}`.trim();
  const nextStatus = req.body?.status === undefined ? existing.status : `${req.body.status ?? ""}`.trim();
  const trackContent = `${req.body?.trackContent ?? ""}`.trim();
  const location = `${req.body?.location ?? ""}`.trim();

  if (!company) {
    return fail(res, "请输入物流公司", 400);
  }
  if (!trackingNo) {
    return fail(res, "请输入物流单号", 400);
  }
  if (!shipmentStatusSet.has(nextStatus)) {
    return fail(res, "物流状态不正确", 400);
  }

  const statusChanged = nextStatus !== existing.status;
  const nextTrackContent = trackContent || (statusChanged ? getShipmentStatusTrackContent(nextStatus) : "");
  if (!statusChanged && company === (existing.company ?? "") && trackingNo === (existing.trackingNo ?? "") && !nextTrackContent) {
    return fail(res, "没有可更新的内容", 400);
  }

  try {
    const eventTime = parseOptionalDate(req.body?.trackTime, "轨迹时间") ?? new Date();

    const updated = await prisma.$transaction(async (tx) => {
      await tx.shopShipment.update({
        where: { id: shipmentId },
        data: {
          company,
          trackingNo,
          status: nextStatus,
          shippedAt: shipmentStartedStatusSet.has(nextStatus)
            ? existing.shippedAt ?? eventTime
            : nextStatus === "pending"
              ? null
              : existing.shippedAt,
          signedAt: nextStatus === "signed" ? existing.signedAt ?? eventTime : null,
        },
      });

      if (nextTrackContent) {
        await tx.shopShipmentTrack.create({
          data: {
            shipmentId,
            content: nextTrackContent,
            location: location || null,
            trackTime: eventTime,
          },
        });
      }

      await recalculateShopOrderStatus(tx, existing.orderId);

      return tx.shopShipment.findUnique({
        where: { id: shipmentId },
        include: shipmentDetailInclude,
      });
    });

    recordAdminAction(req, {
      action: "shop.shipment.update",
      entityType: "shopShipment",
      entityId: updated.id,
      entityName: updated.trackingNo ?? updated.id,
      detail: {
        previousStatus: existing.status,
        nextStatus,
        previousTrackingNo: existing.trackingNo ?? "",
        nextTrackingNo: trackingNo,
        company,
      },
    });

    return ok(res, serializeShopShipment(updated), "发货单已更新");
  } catch (error) {
    return fail(res, error.message || "更新发货单失败", error.statusCode || 400);
  }
});

shopAdminRouter.post("/shipments/:shipmentId/tracks", async (req, res) => {
  const shipmentId = `${req.params.shipmentId ?? ""}`.trim();
  const content = `${req.body?.content ?? ""}`.trim();
  const location = `${req.body?.location ?? ""}`.trim();

  if (!shipmentId) {
    return fail(res, "缺少发货单参数", 400);
  }
  if (!content) {
    return fail(res, "请输入轨迹内容", 400);
  }

  const shipment = await prisma.shopShipment.findUnique({
    where: { id: shipmentId },
    select: {
      id: true,
      trackingNo: true,
    },
  });

  if (!shipment) {
    return fail(res, "发货单不存在", 404);
  }

  try {
    const trackTime = parseOptionalDate(req.body?.trackTime, "轨迹时间") ?? new Date();

    await prisma.shopShipmentTrack.create({
      data: {
        shipmentId,
        content,
        location: location || null,
        trackTime,
      },
    });

    const updated = await prisma.shopShipment.findUnique({
      where: { id: shipmentId },
      include: shipmentDetailInclude,
    });

    recordAdminAction(req, {
      action: "shop.shipment.track.create",
      entityType: "shopShipment",
      entityId: shipment.id,
      entityName: shipment.trackingNo ?? shipment.id,
      detail: {
        content,
        location,
      },
    });

    return ok(res, serializeShopShipment(updated), "物流轨迹已添加");
  } catch (error) {
    return fail(res, error.message || "添加物流轨迹失败", error.statusCode || 400);
  }
});
