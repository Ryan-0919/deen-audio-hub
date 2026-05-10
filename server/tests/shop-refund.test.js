import assert from "node:assert/strict";
import test from "node:test";
import { buildShopRefundCompletionMessage, canRequestShopOrderRefund, hasActiveShopRefund } from "../lib/shop-refund.js";

const createOrder = (overrides = {}) => ({
  id: "order_1",
  userId: "user_1",
  status: "paid",
  paymentStatus: "paid",
  items: [
    {
      id: "item_1",
      productTypeSnapshot: "physical",
      quantity: 1,
    },
  ],
  shipments: [],
  refunds: [],
  ...overrides,
});

test("paid order without active refunds can request refund", () => {
  const order = createOrder();

  assert.equal(hasActiveShopRefund(order), false);
  assert.equal(canRequestShopOrderRefund(order), true);
});

test("order with active refund cannot request another refund", () => {
  const order = createOrder({
    status: "refunding",
    refunds: [
      {
        id: "refund_1",
        status: "pending",
      },
    ],
  });

  assert.equal(hasActiveShopRefund(order), true);
  assert.equal(canRequestShopOrderRefund(order), false);
});

test("refund completion message includes gateway and manual follow-up warnings", () => {
  const order = createOrder({
    items: [
      {
        id: "item_1",
        productTypeSnapshot: "hybrid",
        quantity: 1,
      },
    ],
    shipments: [
      {
        id: "shipment_1",
        status: "shipped",
      },
    ],
  });

  const message = buildShopRefundCompletionMessage({
    order,
    note: "已在线下确认退款",
    paymentMode: "gateway",
  });

  assert.match(message, /已在线下确认退款/);
  assert.match(message, /支付平台/);
  assert.match(message, /课程权限/);
  assert.match(message, /库存/);
});
