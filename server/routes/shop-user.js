import { Prisma } from "@prisma/client";
import { Router } from "express";
import { config } from "../lib/config.js";
import { buildShopPaymentRuntimeDiagnostics } from "../lib/shop-payment-runtime.js";
import { prisma } from "../lib/prisma.js";
import { ok, fail } from "../lib/response.js";
import { ensureShopPaymentChannelEnabled, startShopOrderPayment, syncShopOrderPaymentStatus } from "../lib/shop-payment.js";
import { requestShopOrderRefund } from "../lib/shop-refund.js";
import { requireUserAuth } from "../middleware/auth.js";
import { getClientIp } from "../lib/request.js";
import { formatDateTime } from "../lib/time.js";
import { getReadableObjectUrl } from "../lib/upload.js";
import {
  SHOP_PAYMENT_CHANNEL_VALUES,
  centsToMoneyText,
  generateShopOrderNo,
  hasPendingShipmentItems,
  moneyToCents,
  parseStringArraySnapshot,
  recalculateShopOrderStatus,
  serializeShopAddress,
  serializeShopCart,
  serializeShopCategory,
  serializeShopConfig,
  serializeShopLogistics,
  serializeShopOrder,
  serializeShopProductDetail,
  serializeShopProductListItem,
  serializeShopShipment,
  shopOrderDetailInclude,
} from "../lib/shop.js";

export const shopUserRouter = Router();

shopUserRouter.use(requireUserAuth);

const paymentChannelSet = new Set(SHOP_PAYMENT_CHANNEL_VALUES);
const productTypeSet = new Set(["virtual", "physical", "hybrid"]);
const userAddressOrderBy = [{ isDefault: "desc" }, { updatedAt: "desc" }];
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

const createShopOrderPayExpireAt = (baseDate = new Date()) =>
  new Date(baseDate.getTime() + config.shopOrderAutoCloseMinutes * 60 * 1000);

const toStringArray = (value) =>
  [...new Set((Array.isArray(value) ? value : value ? [value] : []).map((item) => `${item}`.trim()).filter(Boolean))];

const toPositiveInt = (value, fallback = 1) => {
  const parsed = Number.parseInt(`${value ?? ""}`, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const shopSkuInclude = {
  product: {
    include: {
      courses: {
        select: {
          courseId: true,
        },
      },
    },
  },
};

const shopCourseSelect = {
  id: true,
  name: true,
  coverUrl: true,
  coverObjectKey: true,
  description: true,
  status: true,
  openTime: true,
};

const shopProductListInclude = {
  category: true,
  courses: {
    include: {
      course: {
        select: shopCourseSelect,
      },
    },
  },
  skus: {
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  },
};

const shopProductDetailInclude = {
  ...shopProductListInclude,
  images: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  },
};

const shopCartItemInclude = {
  product: {
    include: shopProductListInclude,
  },
  sku: true,
};

const buildVisibleProductWhere = ({ categoryId = "", type = "", keyword = "" } = {}) => ({
  isDeleted: false,
  status: "on_sale",
  ...(categoryId ? { categoryId } : {}),
  ...(productTypeSet.has(type) ? { type } : {}),
  ...(keyword
    ? {
        OR: [{ name: { contains: keyword } }, { subtitle: { contains: keyword } }],
      }
    : {}),
});

const buildVisibleProductSqlWhere = ({ categoryId = "", type = "", keyword = "" } = {}) => {
  const conditions = [Prisma.sql`p.\`isDeleted\` = FALSE`, Prisma.sql`p.\`status\` = ${"on_sale"}`];

  if (categoryId) {
    conditions.push(Prisma.sql`p.\`categoryId\` = ${categoryId}`);
  }
  if (productTypeSet.has(type)) {
    conditions.push(Prisma.sql`p.\`type\` = ${type}`);
  }
  if (keyword) {
    const likeKeyword = `%${keyword}%`;
    conditions.push(Prisma.sql`(p.\`name\` LIKE ${likeKeyword} OR p.\`subtitle\` LIKE ${likeKeyword})`);
  }

  return Prisma.join(conditions, Prisma.sql` AND `);
};

const productListOrderByMap = {
  default: [{ sortOrder: "asc" }, { salesCount: "desc" }, { createdAt: "desc" }],
  sales_desc: [{ salesCount: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  latest: [{ createdAt: "desc" }, { sortOrder: "asc" }],
};

const getVisibleProductPageIdsByPrice = async ({ categoryId = "", type = "", keyword = "", sortBy = "price_asc", page = 1, pageSize = 20 }) => {
  const direction = sortBy === "price_desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;
  const offset = (page - 1) * pageSize;
  const rows = await prisma.$queryRaw(
    Prisma.sql`
      SELECT p.\`id\`
      FROM \`ShopProduct\` p
      LEFT JOIN \`ShopSku\` s ON s.\`productId\` = p.\`id\`
      WHERE ${buildVisibleProductSqlWhere({ categoryId, type, keyword })}
      GROUP BY p.\`id\`, p.\`sortOrder\`, p.\`salesCount\`, p.\`createdAt\`
      ORDER BY
        COALESCE(MIN(CASE WHEN s.\`status\` = TRUE THEN s.\`price\` END), MIN(s.\`price\`), 0) ${direction},
        p.\`sortOrder\` ASC,
        p.\`salesCount\` DESC,
        p.\`createdAt\` DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
  );

  return rows.map((item) => item.id).filter(Boolean);
};

const getVisibleProductListPage = async ({ categoryId = "", type = "", keyword = "", sortBy = "default", page = 1, pageSize = 20 }) => {
  const where = buildVisibleProductWhere({ categoryId, type, keyword });
  const total = await prisma.shopProduct.count({ where });

  if (total === 0) {
    return { total, list: [] };
  }

  if (sortBy === "price_asc" || sortBy === "price_desc") {
    const pageIds = await getVisibleProductPageIdsByPrice({ categoryId, type, keyword, sortBy, page, pageSize });
    if (pageIds.length === 0) {
      return { total, list: [] };
    }

    const list = await prisma.shopProduct.findMany({
      where: {
        id: {
          in: pageIds,
        },
      },
      include: shopProductListInclude,
    });
    const positionMap = new Map(pageIds.map((id, index) => [id, index]));
    list.sort((left, right) => (positionMap.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (positionMap.get(right.id) ?? Number.MAX_SAFE_INTEGER));
    return { total, list };
  }

  const list = await prisma.shopProduct.findMany({
    where,
    include: shopProductListInclude,
    orderBy: productListOrderByMap[sortBy] ?? productListOrderByMap.default,
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return { total, list };
};

const promoteUserDefaultAddress = async (db, userId, { excludeId = "" } = {}) => {
  const fallback = await db.userAddress.findFirst({
    where: {
      userId,
      ...(excludeId
        ? {
            id: {
              not: excludeId,
            },
          }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  if (!fallback) {
    return null;
  }

  await db.userAddress.updateMany({
    where: {
      userId,
      id: {
        not: fallback.id,
      },
      isDefault: true,
    },
    data: {
      isDefault: false,
    },
  });

  await db.userAddress.update({
    where: { id: fallback.id },
    data: {
      isDefault: true,
    },
  });

  return fallback.id;
};

const listUserAddresses = async (db, userId) => {
  let list = await db.userAddress.findMany({
    where: {
      userId,
    },
    orderBy: userAddressOrderBy,
  });

  if (list.length > 0 && !list.some((item) => item.isDefault)) {
    const fallbackId = await promoteUserDefaultAddress(db, userId);
    if (fallbackId) {
      list = await db.userAddress.findMany({
        where: {
          userId,
        },
        orderBy: userAddressOrderBy,
      });
    }
  }

  return list;
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

const getVisibleCategories = () =>
  prisma.shopCategory.findMany({
    where: {
      status: true,
    },
    include: {
      products: {
        where: {
          isDeleted: false,
          status: "on_sale",
        },
        select: {
          id: true,
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

const getCartWithItems = (userId) =>
  prisma.shopCartItem.findMany({
    where: {
      userId,
    },
    include: shopCartItemInclude,
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

const validateCheckoutItem = ({ product, sku, quantity }) => {
  if (!product || !sku) {
    throw createHttpError("商品或规格不存在", 404);
  }
  if (sku.productId !== product.id) {
    throw createHttpError("商品规格信息异常", 400);
  }
  if (product.isDeleted || product.status !== "on_sale") {
    throw createHttpError(`商品 ${product.name} 当前不可购买`, 400);
  }
  if (!sku.status) {
    throw createHttpError(`商品 ${product.name} 当前规格不可购买`, 400);
  }
  if (quantity <= 0) {
    throw createHttpError(`商品 ${product.name} 的购买数量不正确`, 400);
  }
  if (sku.stock < quantity) {
    throw createHttpError(`商品 ${product.name} 库存不足`, 400);
  }
};

const buildNormalizedOrderItems = (sourceItems) =>
  sourceItems.map((item) => {
    const courseIds = (item.product.courses ?? []).map((course) => course.courseId);
    const priceCents = moneyToCents(item.sku.price);
    const originalPriceCents = item.sku.originalPrice ? moneyToCents(item.sku.originalPrice) : null;

    return {
      cartItemId: item.cartItemId ?? null,
      product: item.product,
      sku: item.sku,
      quantity: item.quantity,
      courseIds,
      subtotalCents: priceCents * item.quantity,
      priceCents,
      originalPriceCents,
      requiresShipping: Boolean(item.product.requiresShipping),
    };
  });

const buildOrderSummary = ({ items, address }) => {
  const productAmountCents = items.reduce((sum, item) => sum + item.subtotalCents, 0);
  const requiresShipping = items.some((item) => item.requiresShipping);
  const freightAmountCents = 0;
  const payAmountCents = productAmountCents + freightAmountCents;

  return {
    items: items.map((item) => ({
      productId: item.product.id,
      productName: item.product.name,
      productType: item.product.type,
      coverUrl: getReadableObjectUrl({
        objectKey: item.product.coverObjectKey ?? "",
        fallbackUrl: item.product.coverUrl,
      }),
      skuId: item.sku.id,
      skuName: item.sku.name,
      quantity: item.quantity,
      price: centsToMoneyText(item.priceCents),
      originalPrice: item.originalPriceCents === null ? "" : centsToMoneyText(item.originalPriceCents),
      subtotal: centsToMoneyText(item.subtotalCents),
      requiresShipping: item.requiresShipping,
      courseIds: item.courseIds,
    })),
    productAmount: centsToMoneyText(productAmountCents),
    freightAmount: centsToMoneyText(freightAmountCents),
    discountAmount: "0.00",
    payAmount: centsToMoneyText(payAmountCents),
    requiresShipping,
    address: address ? serializeShopAddress(address) : null,
    warnings: [],
  };
};

const getCheckoutItems = async ({ db, userId, source, cartItemIds, buyNowSkuId, buyNowQuantity }) => {
  if (source === "cart") {
    const normalizedCartItemIds = toStringArray(cartItemIds);
    if (normalizedCartItemIds.length === 0) {
      throw createHttpError("请选择结算商品", 400);
    }

    const cartItems = await db.shopCartItem.findMany({
      where: {
        userId,
        id: {
          in: normalizedCartItemIds,
        },
      },
      include: {
        product: {
          include: {
            courses: {
              select: {
                courseId: true,
              },
            },
          },
        },
        sku: true,
      },
    });

    if (cartItems.length !== normalizedCartItemIds.length) {
      throw createHttpError("购物车商品不存在或已失效", 400);
    }

    return buildNormalizedOrderItems(
      cartItems.map((item) => {
        validateCheckoutItem({
          product: item.product,
          sku: item.sku,
          quantity: item.quantity,
        });

        return {
          cartItemId: item.id,
          product: item.product,
          sku: item.sku,
          quantity: item.quantity,
        };
      }),
    );
  }

  if (source === "buy_now") {
    const skuId = `${buyNowSkuId ?? ""}`.trim();
    const quantity = toPositiveInt(buyNowQuantity, 1);
    if (!skuId) {
      throw createHttpError("请选择购买规格", 400);
    }

    const sku = await db.shopSku.findUnique({
      where: { id: skuId },
      include: shopSkuInclude,
    });

    if (!sku) {
      throw createHttpError("商品规格不存在", 404);
    }

    validateCheckoutItem({
      product: sku.product,
      sku,
      quantity,
    });

    return buildNormalizedOrderItems([
      {
        product: sku.product,
        sku,
        quantity,
      },
    ]);
  }

  throw createHttpError("结算来源不正确", 400);
};

const getUserAddressOrThrow = async ({ db, userId, addressId, requiresShipping, allowEmptyWhenRequired = false }) => {
  if (!requiresShipping) {
    if (!addressId) return null;

    const optionalAddress = await db.userAddress.findFirst({
      where: {
        id: addressId,
        userId,
      },
    });

    if (!optionalAddress) {
      throw createHttpError("收货地址不存在", 404);
    }

    return optionalAddress;
  }

  if (!addressId) {
    if (allowEmptyWhenRequired) {
      const addressList = await listUserAddresses(db, userId);
      return addressList[0] ?? null;
    }
    throw createHttpError("请选择收货地址", 400);
  }

  const address = await db.userAddress.findFirst({
    where: {
      id: addressId,
      userId,
    },
  });

  if (!address) {
    throw createHttpError("收货地址不存在", 404);
  }

  return address;
};

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

const getOrderWithShipments = (orderId, userId) =>
  prisma.shopOrder.findFirst({
    where: {
      id: orderId,
      userId,
    },
    include: shopOrderDetailInclude,
  });

const sortByConfiguredIds = (items, ids) => {
  const orderMap = new Map(ids.map((id, index) => [id, index]));

  return [...items].sort(
    (left, right) =>
      (orderMap.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (orderMap.get(right.id) ?? Number.MAX_SAFE_INTEGER),
  );
};

const mergeRecommendedItems = (preferredItems, fallbackItems, limit) => {
  const seen = new Set();
  const result = [];

  for (const item of [...preferredItems, ...fallbackItems]) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);

    if (result.length >= limit) {
      break;
    }
  }

  return result;
};

shopUserRouter.get("/home", async (_req, res) => {
  const [categories, shopConfig, fallbackFeaturedProducts, courseProducts, physicalProducts, hybridProducts] = await Promise.all([
    getVisibleCategories(),
    prisma.shopConfig.findUnique({
      where: {
        id: 1,
      },
      include: {
        banners: {
          where: {
            status: true,
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
      },
    }),
    prisma.shopProduct.findMany({
      where: buildVisibleProductWhere(),
      include: shopProductListInclude,
      orderBy: [{ salesCount: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      take: 24,
    }),
    prisma.shopProduct.findMany({
      where: buildVisibleProductWhere({ type: "virtual" }),
      include: shopProductListInclude,
      orderBy: [{ salesCount: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      take: 6,
    }),
    prisma.shopProduct.findMany({
      where: buildVisibleProductWhere({ type: "physical" }),
      include: shopProductListInclude,
      orderBy: [{ salesCount: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      take: 6,
    }),
    prisma.shopProduct.findMany({
      where: buildVisibleProductWhere({ type: "hybrid" }),
      include: shopProductListInclude,
      orderBy: [{ salesCount: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      take: 6,
    }),
  ]);

  const paymentRuntime = buildShopPaymentRuntimeDiagnostics({
    runtimeConfig: config,
    shopConfig,
  });
  const serializedConfig = serializeShopConfig(shopConfig, {
    runtimePaymentMode: config.shopPaymentMode,
    paymentRuntime,
  });
  const publicPaymentChannels =
    config.shopPaymentMode === "gateway"
      ? {
          enableWechatH5: serializedConfig.enableWechatH5 && paymentRuntime.channels.wechatH5.ready,
          enableWechatJsapi: serializedConfig.enableWechatJsapi && paymentRuntime.channels.wechatJsapi.ready,
          enableAlipayWap: serializedConfig.enableAlipayWap && paymentRuntime.channels.alipayWap.ready,
        }
      : {
          enableWechatH5: serializedConfig.enableWechatH5,
          enableWechatJsapi: serializedConfig.enableWechatJsapi,
          enableAlipayWap: serializedConfig.enableAlipayWap,
        };
  const featuredProductIds = parseStringArraySnapshot(shopConfig?.featuredProductIds);
  const featuredCategoryIds = parseStringArraySnapshot(shopConfig?.featuredCategoryIds);

  const configuredFeaturedProducts =
    featuredProductIds.length > 0
      ? await prisma.shopProduct.findMany({
          where: {
            id: {
              in: featuredProductIds,
            },
            ...buildVisibleProductWhere(),
          },
          include: shopProductListInclude,
        })
      : [];

  const configuredFeaturedCategories =
    featuredCategoryIds.length > 0
      ? sortByConfiguredIds(
          categories.filter((category) => featuredCategoryIds.includes(category.id)),
          featuredCategoryIds,
        )
      : [];

  const featuredCategories = mergeRecommendedItems(configuredFeaturedCategories, categories, 8);
  const featuredProducts = mergeRecommendedItems(
    sortByConfiguredIds(configuredFeaturedProducts, featuredProductIds),
    fallbackFeaturedProducts,
    8,
  );

  return ok(res, {
    banners: serializedConfig.banners,
    shopNotice: serializedConfig.shopNotice,
    customerServiceUrl: serializedConfig.customerServiceUrl,
    paymentGuide: serializedConfig.paymentGuide,
    enableWechatH5: publicPaymentChannels.enableWechatH5,
    enableWechatJsapi: publicPaymentChannels.enableWechatJsapi,
    enableAlipayWap: publicPaymentChannels.enableAlipayWap,
    featuredCategories: featuredCategories.map(serializeShopCategory),
    featuredProducts: featuredProducts.map(serializeShopProductListItem),
    courseProducts: courseProducts.map(serializeShopProductListItem),
    physicalProducts: physicalProducts.map(serializeShopProductListItem),
    hybridProducts: hybridProducts.map(serializeShopProductListItem),
  });
});

shopUserRouter.get("/categories", async (_req, res) => {
  const categories = await getVisibleCategories();
  return ok(res, categories.map(serializeShopCategory));
});

shopUserRouter.get("/products", async (req, res) => {
  const { page, pageSize } = readPagination(req.query, 20, 100);
  const categoryId = `${req.query?.categoryId ?? ""}`.trim();
  const type = `${req.query?.type ?? ""}`.trim();
  const keyword = `${req.query?.keyword ?? ""}`.trim();
  const sortBy = `${req.query?.sortBy ?? "default"}`.trim();

  const { total, list } = await getVisibleProductListPage({
    categoryId,
    type,
    keyword,
    sortBy,
    page,
    pageSize,
  });

  return ok(res, {
    list: list.map(serializeShopProductListItem),
    pagination: {
      page,
      pageSize,
      total,
    },
  });
});

shopUserRouter.get("/products/:productId", async (req, res) => {
  const productId = `${req.params.productId ?? ""}`.trim();
  if (!productId) {
    return fail(res, "缺少商品参数", 400);
  }

  const product = await prisma.shopProduct.findFirst({
    where: {
      id: productId,
      ...buildVisibleProductWhere(),
    },
    include: shopProductDetailInclude,
  });

  if (!product) {
    return fail(res, "商品不存在", 404);
  }

  return ok(res, serializeShopProductDetail(product));
});

shopUserRouter.get("/cart", async (req, res) => {
  const items = await getCartWithItems(req.auth.userId);
  return ok(res, serializeShopCart(items));
});

shopUserRouter.post("/cart/items", async (req, res) => {
  const productId = `${req.body?.productId ?? ""}`.trim();
  const skuId = `${req.body?.skuId ?? ""}`.trim();
  const quantity = toPositiveInt(req.body?.quantity, 1);

  if (!productId || !skuId) {
    return fail(res, "请选择商品规格", 400);
  }

  const sku = await prisma.shopSku.findUnique({
    where: { id: skuId },
    include: shopSkuInclude,
  });

  if (!sku || sku.productId !== productId) {
    return fail(res, "商品规格不存在", 404);
  }

  try {
    const existing = await prisma.shopCartItem.findUnique({
      where: {
        userId_skuId: {
          userId: req.auth.userId,
          skuId,
        },
      },
    });
    const nextQuantity = (existing?.quantity ?? 0) + quantity;

    validateCheckoutItem({
      product: sku.product,
      sku,
      quantity: nextQuantity,
    });

    await prisma.shopCartItem.upsert({
      where: {
        userId_skuId: {
          userId: req.auth.userId,
          skuId,
        },
      },
      update: {
        quantity: nextQuantity,
      },
      create: {
        userId: req.auth.userId,
        productId,
        skuId,
        quantity,
      },
    });

    const items = await getCartWithItems(req.auth.userId);
    return ok(res, serializeShopCart(items), "已加入购物车");
  } catch (error) {
    return fail(res, error.message || "加入购物车失败", error.statusCode || 400);
  }
});

shopUserRouter.patch("/cart/items/:itemId", async (req, res) => {
  const itemId = `${req.params.itemId ?? ""}`.trim();
  const quantity = toPositiveInt(req.body?.quantity, 0);

  if (!itemId) {
    return fail(res, "缺少购物车参数", 400);
  }
  if (quantity <= 0) {
    return fail(res, "购买数量必须大于 0", 400);
  }

  const item = await prisma.shopCartItem.findFirst({
    where: {
      id: itemId,
      userId: req.auth.userId,
    },
    include: shopCartItemInclude,
  });

  if (!item) {
    return fail(res, "购物车商品不存在", 404);
  }

  try {
    validateCheckoutItem({
      product: item.product,
      sku: item.sku,
      quantity,
    });

    await prisma.shopCartItem.update({
      where: { id: itemId },
      data: {
        quantity,
      },
    });

    const items = await getCartWithItems(req.auth.userId);
    return ok(res, serializeShopCart(items), "购物车已更新");
  } catch (error) {
    return fail(res, error.message || "更新购物车失败", error.statusCode || 400);
  }
});

shopUserRouter.delete("/cart/items/:itemId", async (req, res) => {
  const itemId = `${req.params.itemId ?? ""}`.trim();
  if (!itemId) {
    return fail(res, "缺少购物车参数", 400);
  }

  const item = await prisma.shopCartItem.findFirst({
    where: {
      id: itemId,
      userId: req.auth.userId,
    },
  });

  if (!item) {
    return fail(res, "购物车商品不存在", 404);
  }

  await prisma.shopCartItem.delete({
    where: { id: itemId },
  });

  const items = await getCartWithItems(req.auth.userId);
  return ok(res, serializeShopCart(items), "商品已从购物车移除");
});

shopUserRouter.get("/addresses", async (req, res) => {
  const list = await listUserAddresses(prisma, req.auth.userId);

  return ok(res, list.map(serializeShopAddress));
});

shopUserRouter.post("/addresses", async (req, res) => {
  const name = `${req.body?.name ?? ""}`.trim();
  const phone = `${req.body?.phone ?? ""}`.trim();
  const province = `${req.body?.province ?? ""}`.trim();
  const city = `${req.body?.city ?? ""}`.trim();
  const district = `${req.body?.district ?? ""}`.trim();
  const address = `${req.body?.address ?? ""}`.trim();
  const requestedDefault = Boolean(req.body?.isDefault);

  if (!name || !phone || !province || !city || !district || !address) {
    return fail(res, "请填写完整的收货地址信息", 400);
  }

  const count = await prisma.userAddress.count({
    where: {
      userId: req.auth.userId,
    },
  });

  const isDefault = requestedDefault || count === 0;
  const created = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.userAddress.updateMany({
        where: {
          userId: req.auth.userId,
        },
        data: {
          isDefault: false,
        },
      });
    }

    return tx.userAddress.create({
      data: {
        userId: req.auth.userId,
        name,
        phone,
        province,
        city,
        district,
        address,
        isDefault,
      },
    });
  });

  return ok(res, serializeShopAddress(created), "地址已新增");
});

shopUserRouter.patch("/addresses/:addressId", async (req, res) => {
  const addressId = `${req.params.addressId ?? ""}`.trim();
  if (!addressId) {
    return fail(res, "缺少地址参数", 400);
  }

  const existing = await prisma.userAddress.findFirst({
    where: {
      id: addressId,
      userId: req.auth.userId,
    },
  });

  if (!existing) {
    return fail(res, "收货地址不存在", 404);
  }

  const payload = {
    name: req.body?.name === undefined ? existing.name : `${req.body.name ?? ""}`.trim(),
    phone: req.body?.phone === undefined ? existing.phone : `${req.body.phone ?? ""}`.trim(),
    province: req.body?.province === undefined ? existing.province : `${req.body.province ?? ""}`.trim(),
    city: req.body?.city === undefined ? existing.city : `${req.body.city ?? ""}`.trim(),
    district: req.body?.district === undefined ? existing.district : `${req.body.district ?? ""}`.trim(),
    address: req.body?.address === undefined ? existing.address : `${req.body.address ?? ""}`.trim(),
  };
  const isDefault = req.body?.isDefault === undefined ? existing.isDefault : Boolean(req.body.isDefault);

  if (!payload.name || !payload.phone || !payload.province || !payload.city || !payload.district || !payload.address) {
    return fail(res, "请填写完整的收货地址信息", 400);
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.userAddress.updateMany({
        where: {
          userId: req.auth.userId,
        },
        data: {
          isDefault: false,
        },
      });
    }

    const nextAddress = await tx.userAddress.update({
      where: { id: addressId },
      data: {
        ...payload,
        isDefault,
      },
    });

    if (!isDefault && existing.isDefault) {
      const fallbackId = await promoteUserDefaultAddress(tx, req.auth.userId, { excludeId: addressId });
      if (!fallbackId) {
        return tx.userAddress.update({
          where: { id: addressId },
          data: {
            isDefault: true,
          },
        });
      }
    }

    return nextAddress;
  });

  return ok(res, serializeShopAddress(updated), "地址已更新");
});

shopUserRouter.delete("/addresses/:addressId", async (req, res) => {
  const addressId = `${req.params.addressId ?? ""}`.trim();
  if (!addressId) {
    return fail(res, "缺少地址参数", 400);
  }

  const existing = await prisma.userAddress.findFirst({
    where: {
      id: addressId,
      userId: req.auth.userId,
    },
  });

  if (!existing) {
    return fail(res, "收货地址不存在", 404);
  }

  await prisma.$transaction(async (tx) => {
    await tx.userAddress.delete({
      where: { id: addressId },
    });

    if (existing.isDefault) {
      await promoteUserDefaultAddress(tx, req.auth.userId, { excludeId: addressId });
    }
  });

  return ok(res, { success: true }, "地址已删除");
});

shopUserRouter.post("/checkout/preview", async (req, res) => {
  const source = `${req.body?.source ?? (req.body?.cartItemIds ? "cart" : "buy_now")}`.trim();

  try {
    const items = await getCheckoutItems({
      db: prisma,
      userId: req.auth.userId,
      source,
      cartItemIds: req.body?.cartItemIds,
      buyNowSkuId: req.body?.buyNowSkuId,
      buyNowQuantity: req.body?.buyNowQuantity,
    });
    const address = await getUserAddressOrThrow({
      db: prisma,
      userId: req.auth.userId,
      addressId: req.body?.addressId ? `${req.body.addressId}`.trim() : "",
      requiresShipping: items.some((item) => item.requiresShipping),
      allowEmptyWhenRequired: true,
    });

    return ok(res, buildOrderSummary({ items, address }));
  } catch (error) {
    return fail(res, error.message || "订单预览失败", error.statusCode || 400);
  }
});

shopUserRouter.post("/orders", async (req, res) => {
  const source = `${req.body?.source ?? ""}`.trim();
  const payChannel = `${req.body?.payChannel ?? ""}`.trim();
  const remark = `${req.body?.remark ?? ""}`.trim();

  if (!source || (source !== "cart" && source !== "buy_now")) {
    return fail(res, "订单来源不正确", 400);
  }
  if (!paymentChannelSet.has(payChannel)) {
    return fail(res, "支付渠道不正确", 400);
  }

  try {
    await ensureShopPaymentChannelEnabled({
      db: prisma,
      channel: payChannel,
    });

    const order = await prisma.$transaction(async (tx) => {
      const items = await getCheckoutItems({
        db: tx,
        userId: req.auth.userId,
        source,
        cartItemIds: req.body?.cartItemIds,
        buyNowSkuId: req.body?.buyNowSkuId,
        buyNowQuantity: req.body?.buyNowQuantity,
      });
      const address = await getUserAddressOrThrow({
        db: tx,
        userId: req.auth.userId,
        addressId: req.body?.addressId ? `${req.body.addressId}`.trim() : "",
        requiresShipping: items.some((item) => item.requiresShipping),
      });
      const summary = buildOrderSummary({ items, address });

      for (const item of items) {
        const updated = await tx.shopSku.updateMany({
          where: {
            id: item.sku.id,
            stock: {
              gte: item.quantity,
            },
          },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });

        if (updated.count === 0) {
          throw createHttpError(`商品 ${item.product.name} 库存不足`, 400);
        }
      }

      const orderCreatedAt = new Date();
      const payExpireAt = createShopOrderPayExpireAt(orderCreatedAt);

      const created = await tx.shopOrder.create({
        data: {
          orderNo: generateShopOrderNo(),
          userId: req.auth.userId,
          status: "pending_payment",
          paymentStatus: "unpaid",
          totalAmount: summary.payAmount,
          payAmount: summary.payAmount,
          freightAmount: summary.freightAmount,
          payExpireAt,
          remark: remark || null,
          receiverName: address?.name ?? null,
          receiverPhone: address?.phone ?? null,
          receiverProvince: address?.province ?? null,
          receiverCity: address?.city ?? null,
          receiverDistrict: address?.district ?? null,
          receiverAddress: address?.address ?? null,
          items: {
            create: items.map((item) => ({
              productId: item.product.id,
              skuId: item.sku.id,
              productNameSnapshot: item.product.name,
              productTypeSnapshot: item.product.type,
              coverSnapshot: item.product.coverUrl,
              priceSnapshot: centsToMoneyText(item.priceCents),
              originalPriceSnapshot: item.originalPriceCents === null ? null : centsToMoneyText(item.originalPriceCents),
              quantity: item.quantity,
              requiresShipping: item.requiresShipping,
              courseIdsSnapshot: item.courseIds.length === 0 ? null : JSON.stringify(item.courseIds),
            })),
          },
          payments: {
            create: {
              channel: payChannel,
              status: "unpaid",
              payAmount: summary.payAmount,
            },
          },
        },
        include: shopOrderDetailInclude,
      });

      if (source === "cart") {
        await tx.shopCartItem.deleteMany({
          where: {
            userId: req.auth.userId,
            id: {
              in: items.map((item) => item.cartItemId).filter(Boolean),
            },
          },
        });
      }

      return created;
    });

    return ok(
      res,
      {
        orderId: order.id,
        orderNo: order.orderNo,
        status: order.status,
        paymentStatus: order.paymentStatus,
        payAmount: order.payAmount.toString(),
        payExpireAt: order.payExpireAt ? formatDateTime(order.payExpireAt) : "",
      },
      "订单已创建",
    );
  } catch (error) {
    return fail(res, error.message || "创建订单失败", error.statusCode || 400);
  }
});

shopUserRouter.post("/orders/:orderId/pay", async (req, res) => {
  const orderId = `${req.params.orderId ?? ""}`.trim();
  const payChannel = `${req.body?.payChannel ?? ""}`.trim();
  const wechatOpenId = `${req.body?.wechatOpenId ?? ""}`.trim();

  if (!orderId) {
    return fail(res, "缺少订单参数", 400);
  }

  if (!paymentChannelSet.has(payChannel)) {
    return fail(res, "支付渠道不正确", 400);
  }

  try {
    const result = await startShopOrderPayment({
      db: prisma,
      orderId,
      userId: req.auth.userId,
      channel: payChannel,
      clientIp: getClientIp(req),
      userAgent: `${req.headers["user-agent"] ?? ""}`,
      wechatOpenId,
    });

    return ok(
      res,
      {
        mode: result.mode,
        channel: result.channel,
        launchUrl: result.launchUrl,
        paymentPayload: result.paymentPayload ?? null,
        order: serializeShopOrder(result.order, { includeRelations: true }),
      },
      result.mode === "mock" ? "模拟支付已完成" : "支付拉起成功",
    );
  } catch (error) {
    return fail(res, error.message || "拉起支付失败", error.statusCode || 400);
  }
});

shopUserRouter.post("/orders/:orderId/payment-status/sync", async (req, res) => {
  const orderId = `${req.params.orderId ?? ""}`.trim();

  if (!orderId) {
    return fail(res, "缺少订单参数", 400);
  }

  try {
    const order = await syncShopOrderPaymentStatus({
      db: prisma,
      orderId,
      userId: req.auth.userId,
    });

    return ok(res, serializeShopOrder(order, { includeRelations: true }));
  } catch (error) {
    return fail(res, error.message || "同步支付状态失败", error.statusCode || 400);
  }
});

shopUserRouter.get("/orders/summary", async (req, res) => {
  const baseWhere = {
    userId: req.auth.userId,
  };
  const pendingShipmentWhere = {
    ...baseWhere,
    paymentStatus: "paid",
    status: {
      notIn: ["cancelled", "refunding", "refunded", "completed"],
    },
    items: {
      some: {
        requiresShipping: true,
      },
    },
  };

  const [total, pendingPayment, pendingShipment, pendingReceipt] = await Promise.all([
    prisma.shopOrder.count({
      where: baseWhere,
    }),
    prisma.shopOrder.count({
      where: {
        ...baseWhere,
        status: "pending_payment",
      },
    }),
    countPendingShipmentOrders(pendingShipmentWhere),
    prisma.shopOrder.count({
      where: {
        ...baseWhere,
        shipments: {
          some: {
            status: {
              in: ["shipped", "in_transit"],
            },
          },
        },
      },
    }),
  ]);

  return ok(res, {
    total,
    pendingPayment,
    pendingShipment,
    pendingReceipt,
  });
});

shopUserRouter.get("/orders", async (req, res) => {
  const { page, pageSize } = readPagination(req.query, 20, 100);
  const status = `${req.query?.status ?? ""}`.trim();

  if (status === "pending_shipment") {
    const { total, orderIds } = await getPendingShipmentOrderPage({
      where: {
        userId: req.auth.userId,
        paymentStatus: "paid",
        status: {
          notIn: ["cancelled", "refunding", "refunded", "completed"],
        },
        items: {
          some: {
            requiresShipping: true,
          },
        },
      },
      page,
      pageSize,
    });
    const list = await loadOrdersByIds(orderIds);

    return ok(res, {
      list: list.map((order) => serializeShopOrder(order)),
      pagination: {
        page,
        pageSize,
        total,
      },
    });
  }

  const where = {
    userId: req.auth.userId,
    ...(status && status !== "all"
      ? status === "shipped"
        ? {
            shipments: {
              some: {
                status: {
                  in: ["shipped", "in_transit"],
                },
              },
            },
          }
        : {
            status,
          }
      : {}),
  };

  const [total, list] = await prisma.$transaction([
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
  ]);

  return ok(res, {
    list: list.map((order) => serializeShopOrder(order)),
    pagination: {
      page,
      pageSize,
      total,
    },
  });
});

shopUserRouter.get("/orders/:orderId", async (req, res) => {
  const orderId = `${req.params.orderId ?? ""}`.trim();
  if (!orderId) {
    return fail(res, "缺少订单参数", 400);
  }

  const order = await getOrderWithShipments(orderId, req.auth.userId);

  if (!order) {
    return fail(res, "订单不存在", 404);
  }

  return ok(res, serializeShopOrder(order, { includeRelations: true }));
});

shopUserRouter.post("/orders/:orderId/cancel", async (req, res) => {
  const orderId = `${req.params.orderId ?? ""}`.trim();
  if (!orderId) {
    return fail(res, "缺少订单参数", 400);
  }

  const order = await prisma.shopOrder.findFirst({
    where: {
      id: orderId,
      userId: req.auth.userId,
    },
    include: {
      items: true,
    },
  });

  if (!order) {
    return fail(res, "订单不存在", 404);
  }
  if (order.status !== "pending_payment" || order.paymentStatus !== "unpaid") {
    return fail(res, "当前订单不允许取消", 400);
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

  const updated = await getOrderWithShipments(orderId, req.auth.userId);
  return ok(res, serializeShopOrder(updated, { includeRelations: true }), "订单已取消");
});

shopUserRouter.post("/orders/:orderId/refunds", async (req, res) => {
  const orderId = `${req.params.orderId ?? ""}`.trim();
  const reason = `${req.body?.reason ?? ""}`.trim();

  if (!orderId) {
    return fail(res, "缺少订单参数", 400);
  }

  try {
    const order = await requestShopOrderRefund({
      db: prisma,
      orderId,
      userId: req.auth.userId,
      reason,
    });

    return ok(res, serializeShopOrder(order, { includeRelations: true }), "退款申请已提交");
  } catch (error) {
    return fail(res, error.message || "提交退款申请失败", error.statusCode || 400);
  }
});

shopUserRouter.get("/orders/:orderId/logistics", async (req, res) => {
  const orderId = `${req.params.orderId ?? ""}`.trim();
  if (!orderId) {
    return fail(res, "缺少订单参数", 400);
  }

  const order = await getOrderWithShipments(orderId, req.auth.userId);

  if (!order) {
    return fail(res, "订单不存在", 404);
  }

  const shipments = order.shipments.map((shipment) =>
    serializeShopShipment({
      ...shipment,
      order,
    }),
  );

  return ok(res, serializeShopLogistics({ order, shipments }));
});

shopUserRouter.post("/orders/:orderId/confirm-receipt", async (req, res) => {
  const orderId = `${req.params.orderId ?? ""}`.trim();
  if (!orderId) {
    return fail(res, "缺少订单参数", 400);
  }

  const order = await getOrderWithShipments(orderId, req.auth.userId);

  if (!order) {
    return fail(res, "订单不存在", 404);
  }

  const pendingReceiptShipments = order.shipments.filter(
    (shipment) => shipment.status === "shipped" || shipment.status === "in_transit",
  );

  if (pendingReceiptShipments.length === 0) {
    return fail(res, "当前订单没有可确认收货的发货单", 400);
  }

  const timestamp = new Date();
  const shipmentIds = pendingReceiptShipments.map((shipment) => shipment.id);

  await prisma.$transaction(async (tx) => {
    await tx.shopShipment.updateMany({
      where: {
        id: {
          in: shipmentIds,
        },
      },
      data: {
        status: "signed",
        signedAt: timestamp,
      },
    });

    await tx.shopShipmentTrack.createMany({
      data: shipmentIds.map((shipmentId) => ({
        shipmentId,
        content: "用户已确认收货",
        trackTime: timestamp,
      })),
    });

    await recalculateShopOrderStatus(tx, orderId);
  });

  const updatedOrder = await getOrderWithShipments(orderId, req.auth.userId);
  const shipments = updatedOrder.shipments.map((shipment) =>
    serializeShopShipment({
      ...shipment,
      order: updatedOrder,
    }),
  );

  return ok(res, serializeShopLogistics({ order: updatedOrder, shipments }), "已确认收货");
});
