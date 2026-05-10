import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, ArrowRight, PackageCheck, ReceiptText, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { cn } from "../../components/ui/utils";
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
  pending_payment: { label: "待支付", className: "bg-orange-50/50 text-[#ff6a3d]" },
  paid: { label: "已支付", className: "bg-blue-50/50 text-blue-600" },
  partially_fulfilled: { label: "履约中", className: "bg-indigo-50/50 text-indigo-600" },
  completed: { label: "已完成", className: "bg-green-50/50 text-green-600" },
  cancelled: { label: "已取消", className: "bg-slate-100 text-slate-500" },
  refunding: { label: "退款中", className: "bg-rose-50/50 text-rose-600" },
  refunded: { label: "已退款", className: "bg-slate-100 text-slate-500" },
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
    <div className="min-h-screen bg-[#f5f7fb] pb-20 font-sans selection:bg-slate-900 selection:text-white">
      {/* Premium Header */}
      <div className="sticky top-0 z-30 border-b border-slate-200/50 bg-white/80 backdrop-blur-xl transition-all">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 md:h-[72px] md:px-6 xl:px-8">
          <button
            type="button"
            onClick={() => navigate("/user/me")}
            className="group flex size-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-black/[0.04] transition-all hover:bg-slate-50 hover:shadow-md"
          >
            <ArrowLeft className="size-5 transition-transform group-hover:-translate-x-0.5" />
          </button>
          <h1 className="flex-1 text-center text-[17px] font-bold tracking-tight text-slate-900 md:text-lg">我的订单</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8 xl:px-8">
        <div className="mb-8 rounded-[32px] bg-white p-2 shadow-sm ring-1 ring-black/[0.03] overflow-x-auto hide-scrollbar">
          <div className="flex min-w-max items-center gap-1">
            {statusTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => updateStatus(tab.value)}
                className={cn(
                  "rounded-full px-6 py-2.5 text-[14px] font-bold tracking-wider transition-all",
                  status === tab.value 
                    ? "bg-slate-900 text-white shadow-md shadow-slate-900/20" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-10 text-center text-[13px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Loading Orders...
          </motion.div>
        ) : orders.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} 
            className="mx-auto mt-8 max-w-md rounded-[40px] bg-white p-12 text-center shadow-xl shadow-slate-200/40 ring-1 ring-black/[0.03]"
          >
            <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-slate-50 mb-6">
              <ReceiptText className="size-10 text-slate-300" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">还没有相关订单</h2>
            <p className="mt-3 text-sm font-medium leading-relaxed text-slate-500">所有的购物记录都会在这里安全保存。</p>
            <Button type="button" className="mt-8 h-12 rounded-full bg-slate-900 px-8 text-sm font-bold tracking-wider text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 hover:-translate-y-0.5 transition-all" onClick={() => navigate("/user/shop")}>
              去逛商城
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-6">
            <AnimatePresence mode="popLayout">
              {orders.map((order, i) => {
                const isExpired = isShopOrderExpired(order, nowTs);
                const canCancel = isPendingPaymentOrder(order);
                const canConfirmReceipt =
                  hasOrderShippingItems(order) && (order.shipmentStatus === "shipped" || order.shipmentStatus === "in_transit");
                const canContinuePay = isPendingPaymentOrder(order) && !isExpired;
                const currentStatus = isExpired
                  ? { label: "支付超时", className: "bg-rose-50/50 text-rose-600" }
                  : orderStatusMeta[order.status] ?? { label: order.status, className: "bg-slate-100 text-slate-500" };

                return (
                  <motion.div 
                    key={order.id}
                    layout
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.05 }}
                    className="overflow-hidden rounded-[32px] bg-white shadow-sm ring-1 ring-black/[0.03] transition-all hover:shadow-lg hover:shadow-slate-200/50"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 md:px-6">
                      <div className="flex items-center gap-3">
                         <Badge variant="secondary" className={cn("rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wider", currentStatus.className)}>
                          {currentStatus.label}
                        </Badge>
                        <p className="hidden text-[12px] font-medium text-slate-500 md:block">{order.createdAt}</p>
                      </div>
                      <p className="text-[12px] font-medium text-slate-400 select-all">{order.orderNo}</p>
                    </div>

                    <div className="flex flex-col md:flex-row">
                      <div className="flex-1 p-5 md:p-6 md:border-r border-slate-100">
                        <div className="space-y-4">
                          {order.items.map((item) => (
                            <div key={item.id} className="group flex gap-4">
                              <img src={item.coverUrl} alt={item.productName} className="h-20 w-20 rounded-[20px] object-cover ring-1 ring-black/[0.04] transition-transform group-hover:scale-105" />
                              <div className="min-w-0 flex-1 flex flex-col justify-center">
                                <p className="line-clamp-2 text-[14px] font-bold leading-snug text-slate-900">{item.productName}</p>
                                <div className="mt-2 flex items-center justify-between text-[13px]">
                                  <span className="font-medium text-slate-500">数量 × {item.quantity}</span>
                                  <span className="font-bold text-slate-900">{formatShopMoney(item.price)}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {isPendingPaymentOrder(order) && (
                          <div className={cn("mt-5 flex items-center gap-2 rounded-[20px] px-4 py-3 text-[13px] font-medium", isExpired ? "bg-rose-50/50 text-rose-600" : "bg-orange-50/50 text-[#ff6a3d]")}>
                            <Clock className="size-4" />
                            {isExpired ? (
                              <span>该订单支付已超时，系统即将关闭。</span>
                            ) : (
                              <span>请在 {formatShopCountdown(getShopOrderRemainingMs(order, nowTs))} 内完成支付。</span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col justify-between bg-slate-50/50 p-5 md:w-64 md:p-6">
                        <div className="text-right">
                          <p className="text-[12px] font-bold text-slate-400">应付金额</p>
                          <p className="mt-1 text-[28px] font-bold tracking-tight text-slate-900 leading-none">{formatShopMoney(order.payAmount)}</p>
                          <div className="mt-3 flex flex-col gap-1 text-[11px] font-medium text-slate-400">
                            <p>支付状态：{paymentStatusLabelMap[order.paymentStatus] ?? order.paymentStatus}</p>
                            <p>发货状态：{getShipmentStatusLabel(order)}</p>
                          </div>
                        </div>

                        <div className="mt-6 flex flex-col gap-2">
                          {canContinuePay ? (
                            <Button
                              type="button"
                              className="w-full h-11 rounded-full bg-[#ff6a3d] text-[13px] font-bold tracking-wider text-white shadow-md shadow-orange-500/20 hover:-translate-y-0.5 hover:bg-[#f65a28] transition-all disabled:opacity-50"
                              disabled={actionOrderId === order.id}
                              onClick={() => navigate(`/user/shop/orders/${order.id}`)}
                            >
                              PAY NOW
                            </Button>
                          ) : (
                             <Button type="button" variant="outline" className="w-full h-11 rounded-full border-slate-200 bg-white text-[13px] font-bold text-slate-700 hover:bg-slate-50" onClick={() => navigate(`/user/shop/orders/${order.id}`)}>
                               VIEW DETAILS
                             </Button>
                          )}

                          <div className="flex gap-2">
                             {canCancel && (
                              <Button
                                type="button"
                                variant="ghost"
                                className="flex-1 h-11 rounded-full text-[13px] font-bold text-slate-500 hover:bg-slate-100"
                                disabled={actionOrderId === order.id}
                                onClick={() => void cancelOrder(order.id)}
                              >
                                Cancel
                              </Button>
                            )}

                            {canConfirmReceipt && (
                              <Button
                                type="button"
                                variant="outline"
                                className="flex-1 h-11 rounded-full border-blue-200 bg-blue-50 text-[13px] font-bold text-blue-700 hover:bg-blue-100"
                                disabled={actionOrderId === order.id}
                                onClick={() => void confirmReceipt(order.id)}
                              >
                                <PackageCheck className="mr-1.5 size-4" />
                                确认收货
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {hasMore && (
              <div className="pt-4 flex justify-center">
                 <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full max-w-sm rounded-full border-slate-200 bg-white font-bold tracking-wider text-slate-600 hover:bg-slate-50"
                  disabled={loadingMore}
                  onClick={() => void loadOrders(page + 1, { append: true })}
                >
                  {loadingMore ? "LOADING..." : `LOAD MORE (${orders.length}/${total})`}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
