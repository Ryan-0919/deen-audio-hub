import { ArrowLeft, ArrowRight, PackageCheck, ReceiptText } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { type ShopOrder, mockApi } from "../../lib/mockData";
import {
  formatShopCountdown,
  formatShopMoney,
  getShopOrderRemainingMs,
  isPendingPaymentOrder,
  isShopOrderExpired,
} from "../../lib/shopOrder";

const statusTabs = [
  { value: "all", label: "全部" },
  { value: "pending_payment", label: "待支付" },
  { value: "pending_shipment", label: "待发货" },
  { value: "shipped", label: "待收货" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
] as const;

type OrderStatusFilter = (typeof statusTabs)[number]["value"];

const PAGE_SIZE = 20;

const isOrderStatusFilter = (value: string): value is OrderStatusFilter => statusTabs.some((tab) => tab.value === value);
const hasOrderShippingItems = (order: ShopOrder) => order.items.some((item) => item.requiresShipping);

const orderStatusMeta: Record<string, { label: string; className: string }> = {
  pending_payment: { label: "待支付", className: "bg-amber-50 text-amber-700" },
  paid: { label: "已支付", className: "bg-blue-50 text-blue-700" },
  partially_fulfilled: { label: "履约中", className: "bg-indigo-50 text-indigo-700" },
  completed: { label: "已完成", className: "bg-emerald-50 text-emerald-700" },
  cancelled: { label: "已取消", className: "bg-slate-100 text-slate-600" },
  refunding: { label: "退款中", className: "bg-rose-50 text-rose-700" },
  refunded: { label: "已退款", className: "bg-rose-50 text-rose-700" },
};

const paymentStatusLabelMap: Record<string, string> = {
  unpaid: "未支付",
  paid: "已支付",
  failed: "支付失败",
  refunded: "已退款",
};

const shipmentStatusLabelMap: Record<string, string> = {
  pending: "待发货",
  shipped: "已发货",
  in_transit: "运输中",
  signed: "已签收",
  failed: "物流异常",
};

const getShipmentStatusLabel = (order: ShopOrder) => {
  if (!hasOrderShippingItems(order)) {
    return "无需发货";
  }

  if (order.hasPendingShipmentItems) {
    if (order.shipmentStatus === "pending") return "待发货";
    if (order.shipmentStatus === "shipped" || order.shipmentStatus === "in_transit") return "部分已发货";
    if (order.shipmentStatus === "failed") return "待继续发货";
  }

  return shipmentStatusLabelMap[order.shipmentStatus] ?? order.shipmentStatus;
};

export function ShopOrders() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFromQuery = searchParams.get("status") ?? "all";
  const queryStatus = isOrderStatusFilter(statusFromQuery) ? statusFromQuery : "all";

  const [status, setStatus] = useState<OrderStatusFilter>(queryStatus);
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [actionOrderId, setActionOrderId] = useState("");
  const [nowTs, setNowTs] = useState(Date.now());
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setStatus(queryStatus);
  }, [queryStatus]);

  const loadOrders = async (targetPage = 1, options?: { append?: boolean }) => {
    try {
      if (options?.append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const result = await mockApi.getShopOrders({
        status,
        page: targetPage,
        pageSize: PAGE_SIZE,
      });

      setOrders((current) => (options?.append ? [...current, ...result.list] : result.list));
      setPage(targetPage);
      setTotal(result.pagination.total);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载订单失败");
    } finally {
      if (options?.append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadOrders(1);
  }, [status]);

  useEffect(() => {
    if (!orders.some((order) => isPendingPaymentOrder(order))) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setNowTs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [orders]);

  const updateStatus = (nextStatus: OrderStatusFilter) => {
    setStatus(nextStatus);

    const nextParams = new URLSearchParams(searchParams);
    if (nextStatus === "all") {
      nextParams.delete("status");
    } else {
      nextParams.set("status", nextStatus);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const cancelOrder = async (orderId: string) => {
    try {
      setActionOrderId(orderId);
      await mockApi.cancelShopOrder(orderId);
      toast.success("订单已取消");
      await loadOrders(1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "取消订单失败");
    } finally {
      setActionOrderId("");
    }
  };

  const confirmReceipt = async (orderId: string) => {
    try {
      setActionOrderId(orderId);
      await mockApi.confirmShopOrderReceipt(orderId);
      toast.success("已确认收货");
      await loadOrders(1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "确认收货失败");
    } finally {
      setActionOrderId("");
    }
  };

  const hasMore = orders.length < total;

  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <div className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-sm items-center px-4">
          <button
            type="button"
            onClick={() => navigate("/user/me")}
            className="flex size-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="flex-1 text-center text-base font-semibold text-slate-900">我的订单</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="mx-auto max-w-sm px-4 py-4">
        <div className="overflow-x-auto">
          <div className="flex min-w-max gap-2">
            {statusTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => updateStatus(tab.value)}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  status === tab.value ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="mt-4 rounded-3xl border border-slate-200 bg-white px-6 py-14 text-center text-sm text-slate-500">
            订单加载中...
          </div>
        ) : orders.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-slate-200 bg-white px-8 py-14 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <ReceiptText className="size-6" />
            </div>
            <h2 className="mt-4 text-lg font-medium text-slate-900">还没有订单</h2>
            <p className="mt-2 text-sm leading-7 text-slate-500">
              先去商城选购想买的内容，支付后这里会统一展示。
            </p>
            <Button type="button" className="mt-5 rounded-full bg-slate-900 text-white hover:bg-slate-800" onClick={() => navigate("/user/shop")}>
              去逛商城
            </Button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {orders.map((order) => {
              const isExpired = isShopOrderExpired(order, nowTs);
              const canCancel = isPendingPaymentOrder(order);
              const canConfirmReceipt =
                hasOrderShippingItems(order) && (order.shipmentStatus === "shipped" || order.shipmentStatus === "in_transit");
              const canContinuePay = isPendingPaymentOrder(order) && !isExpired;
              const currentStatus = isExpired
                ? { label: "支付超时", className: "bg-rose-50 text-rose-700" }
                : orderStatusMeta[order.status] ?? { label: order.status, className: "bg-slate-100 text-slate-600" };

              return (
                <div key={order.id} className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-500">订单号</p>
                      <p className="mt-1 truncate font-semibold text-slate-900">{order.orderNo}</p>
                    </div>
                    <Badge variant="secondary" className={currentStatus.className}>
                      {currentStatus.label}
                    </Badge>
                  </div>

                  <div className="mt-4 space-y-3">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex gap-3 rounded-2xl bg-slate-50 p-3">
                        <img src={item.coverUrl} alt={item.productName} className="h-16 w-16 rounded-2xl object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-medium text-slate-900">{item.productName}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            数量 {item.quantity} · 单价 {formatShopMoney(item.price)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {isPendingPaymentOrder(order) ? (
                    <div className={`mt-4 rounded-2xl px-3 py-3 text-sm ${isExpired ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>
                      {isExpired ? (
                        <p>该订单支付已超时，请重新下单或等待系统自动关闭。</p>
                      ) : (
                        <>
                          <p>请在 {order.payExpireAt} 前完成支付。</p>
                          <p className="mt-1 font-medium">剩余时间：{formatShopCountdown(getShopOrderRemainingMs(order, nowTs))}</p>
                        </>
                      )}
                    </div>
                  ) : null}

                  <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                    <div className="min-w-0">
                      <p>创建时间 {order.createdAt}</p>
                      <p className="mt-1">
                        支付状态：{paymentStatusLabelMap[order.paymentStatus] ?? order.paymentStatus} · 发货状态：
                        {getShipmentStatusLabel(order)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs">应付金额</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{formatShopMoney(order.payAmount)}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => navigate(`/user/shop/orders/${order.id}`)}>
                      查看详情
                      <ArrowRight className="ml-2 size-4" />
                    </Button>

                    {canCancel ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={actionOrderId === order.id}
                        onClick={() => void cancelOrder(order.id)}
                      >
                        取消订单
                      </Button>
                    ) : null}

                    {canConfirmReceipt ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={actionOrderId === order.id}
                        onClick={() => void confirmReceipt(order.id)}
                      >
                        <PackageCheck className="mr-2 size-4" />
                        确认收货
                      </Button>
                    ) : null}

                    {canContinuePay ? (
                      <Button
                        type="button"
                        size="sm"
                        className="bg-slate-900 text-white hover:bg-slate-800"
                        disabled={actionOrderId === order.id}
                        onClick={() => navigate(`/user/shop/orders/${order.id}`)}
                      >
                        继续支付
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {hasMore ? (
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-full border-slate-200 bg-white"
                disabled={loadingMore}
                onClick={() => void loadOrders(page + 1, { append: true })}
              >
                {loadingMore ? "加载中..." : `加载更多订单 (${orders.length}/${total})`}
              </Button>
            ) : null}

            {total > 0 ? <p className="text-center text-xs text-slate-400">已显示 {orders.length} / {total} 笔订单</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}
