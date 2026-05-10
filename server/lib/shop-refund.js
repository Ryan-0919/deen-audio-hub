import { config } from "./config.js";
import { recalculateShopOrderStatus, shopOrderDetailInclude } from "./shop.js";

const activeRefundStatusSet = new Set(["pending", "approved"]);
const startedShipmentStatusSet = new Set(["shipped", "in_transit", "signed"]);

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getOrderWithRefunds = (db, orderId) =>
  db.shopOrder.findUnique({
    where: {
      id: orderId,
    },
    include: shopOrderDetailInclude,
  });

const getRefundWithOrder = (db, refundId) =>
  db.shopRefundRecord.findUnique({
    where: {
      id: refundId,
    },
    include: {
      order: {
        include: shopOrderDetailInclude,
      },
      orderItem: {
        select: {
          id: true,
          productNameSnapshot: true,
        },
      },
    },
  });

const getActiveRefund = (order) => (order?.refunds ?? []).find((item) => activeRefundStatusSet.has(item.status)) ?? null;

const orderHasDigitalItems = (order) => (order?.items ?? []).some((item) => item.productTypeSnapshot !== "physical");
const orderHasStartedShipments = (order) => (order?.shipments ?? []).some((shipment) => startedShipmentStatusSet.has(shipment.status));

const ensureRefundRequestable = (order) => {
  if (!order) {
    throw createHttpError("订单不存在", 404);
  }

  if (order.paymentStatus !== "paid") {
    throw createHttpError("当前订单未支付，不能申请退款", 400);
  }

  if (order.status === "pending_payment" || order.status === "cancelled") {
    throw createHttpError("当前订单状态不允许申请退款", 400);
  }

  if (order.status === "refunding" || order.status === "refunded") {
    throw createHttpError("当前订单已有退款处理记录", 400);
  }

  if (getActiveRefund(order)) {
    throw createHttpError("当前订单已有进行中的退款申请", 400);
  }
};

const buildRefundResultMessage = ({ order, note = "", paymentMode = config.shopPaymentMode }) => {
  const messages = [];
  const trimmedNote = `${note ?? ""}`.trim();

  if (trimmedNote) {
    messages.push(trimmedNote);
  }

  if (paymentMode === "gateway") {
    messages.push("请确认已在支付平台完成退款");
  }

  if (orderHasDigitalItems(order)) {
    messages.push("数字商品权限不会自动回收，请人工核对课程权限");
  }

  if (orderHasStartedShipments(order)) {
    messages.push("已发货订单不会自动回补库存，请在退货入库后人工核对库存");
  }

  return messages.join("；") || "退款已完成";
};

const restoreOrderStockIfSafe = async (db, order) => {
  if (orderHasStartedShipments(order)) {
    return false;
  }

  for (const item of order.items ?? []) {
    await db.shopSku.update({
      where: {
        id: item.skuId,
      },
      data: {
        stock: {
          increment: item.quantity,
        },
      },
    });
  }

  return true;
};

const rollbackProductSales = async (db, order) => {
  for (const item of order.items ?? []) {
    await db.shopProduct.update({
      where: {
        id: item.productId,
      },
      data: {
        salesCount: {
          decrement: item.quantity,
        },
      },
    });
  }
};

export const hasActiveShopRefund = (order) => Boolean(getActiveRefund(order));

export const canRequestShopOrderRefund = (order) => {
  try {
    ensureRefundRequestable(order);
    return true;
  } catch (_error) {
    return false;
  }
};

export const buildShopRefundCompletionMessage = buildRefundResultMessage;

export const requestShopOrderRefund = async ({ db, orderId, userId, reason = "" }) => {
  const trimmedReason = `${reason ?? ""}`.trim();

  if (!trimmedReason) {
    throw createHttpError("请填写退款原因", 400);
  }

  const existingOrder = await getOrderWithRefunds(db, orderId);

  if (!existingOrder || existingOrder.userId !== userId) {
    throw createHttpError("订单不存在", 404);
  }

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM \`ShopOrder\` WHERE id = ${existingOrder.id} FOR UPDATE`;
    const order = await getOrderWithRefunds(tx, existingOrder.id);

    if (!order || order.userId !== userId) {
      throw createHttpError("订单不存在", 404);
    }

    ensureRefundRequestable(order);

    await tx.shopRefundRecord.create({
      data: {
        orderId: order.id,
        refundAmount: order.payAmount,
        reason: trimmedReason,
      },
    });

    await tx.shopOrder.update({
      where: {
        id: order.id,
      },
      data: {
        status: "refunding",
      },
    });

    return getOrderWithRefunds(tx, order.id);
  });
};

export const approveShopRefund = async ({ db, refundId, note = "" }) => {
  const existingRefund = await getRefundWithOrder(db, refundId);

  if (!existingRefund) {
    throw createHttpError("退款记录不存在", 404);
  }

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM \`ShopOrder\` WHERE id = ${existingRefund.orderId} FOR UPDATE`;
    const refund = await getRefundWithOrder(tx, refundId);

    if (!refund?.order) {
      throw createHttpError("退款记录不存在", 404);
    }

    if (refund.status !== "pending") {
      throw createHttpError("当前退款记录不允许审批", 400);
    }

    await tx.shopRefundRecord.update({
      where: {
        id: refund.id,
      },
      data: {
        status: "approved",
        resultMessage: `${note ?? ""}`.trim() || null,
      },
    });

    await tx.shopOrder.update({
      where: {
        id: refund.orderId,
      },
      data: {
        status: "refunding",
      },
    });

    return getOrderWithRefunds(tx, refund.orderId);
  });
};

export const rejectShopRefund = async ({ db, refundId, reason = "" }) => {
  const trimmedReason = `${reason ?? ""}`.trim();

  if (!trimmedReason) {
    throw createHttpError("请填写驳回原因", 400);
  }

  const existingRefund = await getRefundWithOrder(db, refundId);

  if (!existingRefund) {
    throw createHttpError("退款记录不存在", 404);
  }

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM \`ShopOrder\` WHERE id = ${existingRefund.orderId} FOR UPDATE`;
    const refund = await getRefundWithOrder(tx, refundId);

    if (!refund?.order) {
      throw createHttpError("退款记录不存在", 404);
    }

    if (refund.status !== "pending" && refund.status !== "approved") {
      throw createHttpError("当前退款记录不允许驳回", 400);
    }

    await tx.shopRefundRecord.update({
      where: {
        id: refund.id,
      },
      data: {
        status: "rejected",
        resultMessage: trimmedReason,
      },
    });

    const refreshedOrder = await getOrderWithRefunds(tx, refund.orderId);
    if (refreshedOrder && !getActiveRefund(refreshedOrder)) {
      await recalculateShopOrderStatus(tx, refund.orderId);
    }

    return getOrderWithRefunds(tx, refund.orderId);
  });
};

export const completeShopRefund = async ({ db, refundId, note = "" }) => {
  const existingRefund = await getRefundWithOrder(db, refundId);

  if (!existingRefund) {
    throw createHttpError("退款记录不存在", 404);
  }

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM \`ShopOrder\` WHERE id = ${existingRefund.orderId} FOR UPDATE`;
    const refund = await getRefundWithOrder(tx, refundId);

    if (!refund?.order) {
      throw createHttpError("退款记录不存在", 404);
    }

    if (refund.status !== "pending" && refund.status !== "approved") {
      if (refund.status === "completed" && refund.order.paymentStatus === "refunded") {
        return getOrderWithRefunds(tx, refund.orderId);
      }

      throw createHttpError("当前退款记录不允许完成退款", 400);
    }

    if (refund.order.paymentStatus !== "paid" && refund.order.paymentStatus !== "refunded") {
      throw createHttpError("当前订单支付状态不允许完成退款", 400);
    }

    const resultMessage = buildRefundResultMessage({
      order: refund.order,
      note,
    });

    await tx.shopRefundRecord.update({
      where: {
        id: refund.id,
      },
      data: {
        status: "completed",
        resultMessage,
      },
    });

    if (refund.order.paymentStatus !== "refunded") {
      await tx.shopPaymentRecord.updateMany({
        where: {
          orderId: refund.orderId,
          status: "paid",
        },
        data: {
          status: "refunded",
        },
      });

      await tx.shopOrder.update({
        where: {
          id: refund.orderId,
        },
        data: {
          paymentStatus: "refunded",
          status: "refunded",
        },
      });

      await restoreOrderStockIfSafe(tx, refund.order);
      await rollbackProductSales(tx, refund.order);
    }

    return getOrderWithRefunds(tx, refund.orderId);
  });
};
