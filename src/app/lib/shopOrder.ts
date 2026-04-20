import type { ShopOrder } from "./mockData";

type OrderLike = Pick<ShopOrder, "status" | "paymentStatus" | "payExpireAt">;

const SHOP_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

export const formatShopMoney = (value: string) => `￥${value}`;

export const parseShopDateTime = (value: string) => {
  const text = `${value ?? ""}`.trim();
  if (!text) return null;

  const normalized = text.includes(" ") ? text.replace(" ", "T") : text;
  const directDate = new Date(normalized);
  if (!Number.isNaN(directDate.getTime())) {
    return directDate;
  }

  const match = SHOP_DATE_TIME_PATTERN.exec(text);
  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
};

export const isPendingPaymentOrder = (order: OrderLike) =>
  order.status === "pending_payment" && order.paymentStatus === "unpaid";

export const isShopOrderExpired = (order: OrderLike, now = Date.now()) => {
  if (!isPendingPaymentOrder(order)) {
    return false;
  }

  const expireAt = parseShopDateTime(order.payExpireAt);
  if (!expireAt) {
    return false;
  }

  return expireAt.getTime() <= now;
};

export const getShopOrderRemainingMs = (order: OrderLike, now = Date.now()) => {
  if (!isPendingPaymentOrder(order)) {
    return 0;
  }

  const expireAt = parseShopDateTime(order.payExpireAt);
  if (!expireAt) {
    return 0;
  }

  return Math.max(expireAt.getTime() - now, 0);
};

export const formatShopCountdown = (remainingMs: number) => {
  if (remainingMs <= 0) {
    return "已超时";
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}天${hours}小时`;
  }

  if (hours > 0) {
    return `${hours}小时${minutes}分`;
  }

  if (minutes > 0) {
    return `${minutes}分${seconds}秒`;
  }

  return `${seconds}秒`;
};
