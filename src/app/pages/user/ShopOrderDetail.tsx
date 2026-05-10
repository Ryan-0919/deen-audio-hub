import { motion } from "motion/react";
import { ArrowLeft, CreditCard, MapPin, PackageCheck, ReceiptText, Truck, Clock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { cn } from "../../components/ui/utils";
import { type ShopOrderDetail as ShopOrderDetailType, type ShopPaymentChannel, type ShopRefundStatus, mockApi } from "../../lib/mockData";
import {
  formatShopCountdown,
  formatShopMoney,
  getShopOrderRemainingMs,
  isPendingPaymentOrder,
  isShopOrderExpired,
} from "../../lib/shopOrder";
import { startShopPaymentFlow } from "../../lib/shopPayment";

const orderStatusMeta: Record<string, { label: string; className: string }> = {
  pending_payment: { label: "待支付", className: "bg-orange-50/50 text-[#ff6a3d]" },
  paid: { label: "已支付", className: "bg-blue-50/50 text-blue-600" },
  partially_fulfilled: { label: "履约中", className: "bg-indigo-50/50 text-indigo-600" },
  completed: { label: "已完成", className: "bg-green-50/50 text-green-600" },
  cancelled: { label: "已取消", className: "bg-slate-100 text-slate-500" },
  refunding: { label: "退款中", className: "bg-rose-50/50 text-rose-600" },
  refunded: { label: "已退款", className: "bg-slate-100 text-slate-500" },
};

const paymentStatusMeta: Record<string, { label: string; className: string }> = {
  unpaid: { label: "未支付", className: "bg-orange-50/50 text-[#ff6a3d]" },
  paid: { label: "已支付", className: "bg-green-50/50 text-green-600" },
  failed: { label: "支付失败", className: "bg-rose-50/50 text-rose-600" },
  refunded: { label: "已退款", className: "bg-slate-100 text-slate-500" },
};

const shipmentStatusMeta: Record<string, { label: string; className: string }> = {
  pending: { label: "待发货", className: "bg-orange-50/50 text-[#ff6a3d]" },
  shipped: { label: "已发货", className: "bg-blue-50/50 text-blue-600" },
  in_transit: { label: "运输中", className: "bg-indigo-50/50 text-indigo-600" },
  signed: { label: "已签收", className: "bg-green-50/50 text-green-600" },
  failed: { label: "物流异常", className: "bg-rose-50/50 text-rose-600" },
};

const getOrderShipmentStatusMeta = (hasShippingItems: boolean, hasPendingShipmentItems: boolean, shipmentStatus: string) => {
  if (!hasShippingItems) {
    return { label: "无需发货", className: "bg-slate-100 text-slate-500" };
  }

  if (hasPendingShipmentItems) {
    if (shipmentStatus === "pending") return shipmentStatusMeta.pending;
    if (shipmentStatus === "shipped" || shipmentStatus === "in_transit") {
      return { label: "部分发货", className: "bg-blue-50/50 text-blue-600" };
    }
    if (shipmentStatus === "failed") {
      return { label: "待继续发货", className: "bg-orange-50/50 text-[#ff6a3d]" };
    }
  }

  return shipmentStatusMeta[shipmentStatus] ?? { label: shipmentStatus, className: "bg-slate-100 text-slate-500" };
};

const digitalStatusMeta: Record<string, { label: string; className: string }> = {
  pending: { label: "待开通", className: "bg-orange-50/50 text-[#ff6a3d]" },
  success: { label: "已开通", className: "bg-green-50/50 text-green-600" },
  failed: { label: "开通失败", className: "bg-rose-50/50 text-rose-600" },
};

const refundStatusMeta: Record<ShopRefundStatus, { label: string; className: string }> = {
  pending: { label: "待审核", className: "bg-orange-50/50 text-[#ff6a3d]" },
  approved: { label: "待退款", className: "bg-blue-50/50 text-blue-600" },
  rejected: { label: "已驳回", className: "bg-slate-100 text-slate-500" },
  completed: { label: "已退款", className: "bg-green-50/50 text-green-600" },
  failed: { label: "退款失败", className: "bg-rose-50/50 text-rose-600" },
};

const channelLabelMap: Record<string, string> = {
  wechat_h5: "微信支付",
  wechat_jsapi: "微信 JSAPI",
  alipay_wap: "支付宝",
};

const grantTypeLabelMap: Record<string, string> = {
  course_permission: "课程权限",
};

const resolvePayChannel = (order: ShopOrderDetailType): ShopPaymentChannel => {
  const channel = order.payments[0]?.channel;
  if (channel === "wechat_h5" || channel === "wechat_jsapi" || channel === "alipay_wap") {
    return channel;
  }
  return "wechat_h5";
};

export function ShopOrderDetail() {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();

  const [order, setOrder] = useState<ShopOrderDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refundSaving, setRefundSaving] = useState(false);
  const [nowTs, setNowTs] = useState(Date.now());

  const loadOrder = async (targetOrderId = orderId) => {
    if (!targetOrderId) {
      setOrder(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const detail = await mockApi.getShopOrderDetail(targetOrderId);
      setOrder(detail);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载订单详情失败");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrder();
  }, [orderId]);

  useEffect(() => {
    if (!order || !isPendingPaymentOrder(order)) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setNowTs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [order]);

  const hasShippingItems = useMemo(() => order?.items.some((item) => item.requiresShipping) ?? false, [order]);
  const hasDigitalItems = useMemo(() => order?.items.some((item) => item.courseIds.length > 0) ?? false, [order]);
  const activeRefund = useMemo(
    () => order?.refunds.find((item) => item.status === "pending" || item.status === "approved") ?? null,
    [order],
  );

  const isExpired = order ? isShopOrderExpired(order, nowTs) : false;
  const canCancel = Boolean(order && isPendingPaymentOrder(order));
  const canPay = Boolean(order && isPendingPaymentOrder(order) && !isExpired);
  const canConfirmReceipt = Boolean(order && hasShippingItems && (order.shipmentStatus === "shipped" || order.shipmentStatus === "in_transit"));
  const canRequestRefund = Boolean(
    order &&
      order.paymentStatus === "paid" &&
      order.status !== "pending_payment" &&
      order.status !== "cancelled" &&
      order.status !== "refunding" &&
      order.status !== "refunded" &&
      !activeRefund,
  );

  const handlePay = async () => {
    if (!order) return;

    try {
      setActionLoading("pay");
      const paymentResult = await startShopPaymentFlow({
        orderId: order.id,
        payChannel: resolvePayChannel(order),
      });

      if (paymentResult.redirected) {
        return;
      }

      setOrder(paymentResult.result.order);
      toast.success(paymentResult.result.mode === "mock" ? "订单已完成模拟支付" : "已发起支付");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "发起支付失败");

      if (error instanceof Error && error.message.includes("超时")) {
        await loadOrder(order.id);
      }
    } finally {
      setActionLoading("");
    }
  };

  const handleCancel = async () => {
    if (!order) return;

    try {
      setActionLoading("cancel");
      await mockApi.cancelShopOrder(order.id);
      toast.success("订单已取消");
      await loadOrder(order.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "取消订单失败");
    } finally {
      setActionLoading("");
    }
  };

  const handleConfirmReceipt = async () => {
    if (!order) return;

    try {
      setActionLoading("receipt");
      await mockApi.confirmShopOrderReceipt(order.id);
      toast.success("已确认收货");
      await loadOrder(order.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "确认收货失败");
    } finally {
      setActionLoading("");
    }
  };

  const handleRequestRefund = async () => {
    if (!order) return;

    const trimmedReason = refundReason.trim();
    if (!trimmedReason) {
      toast.error("请先填写退款原因");
      return;
    }

    try {
      setRefundSaving(true);
      const updatedOrder = await mockApi.requestShopOrderRefund(order.id, {
        reason: trimmedReason,
      });
      setOrder(updatedOrder);
      setRefundOpen(false);
      setRefundReason("");
      toast.success("退款申请已提交");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "提交退款申请失败");
    } finally {
      setRefundSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f7fb] px-4 py-6 md:px-6 xl:px-8">
        <div className="mx-auto max-w-3xl rounded-[40px] bg-white p-12 text-center text-[13px] font-bold uppercase tracking-[0.2em] text-slate-400 shadow-xl shadow-slate-200/40">
          Loading Order...
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#f5f7fb] px-4 py-6 md:px-6 xl:px-8 font-sans">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-3xl rounded-[40px] bg-white p-16 text-center shadow-xl shadow-slate-200/40 ring-1 ring-black/[0.03]">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">订单不存在或已失效</h2>
          <Button className="mt-8 h-12 rounded-full px-8 font-bold tracking-wider" variant="outline" onClick={() => navigate("/user/shop/orders")}>
            返回订单列表
          </Button>
        </motion.div>
      </div>
    );
  }

  const currentOrderStatus = isExpired
    ? { label: "支付超时", className: "bg-rose-50/50 text-rose-600" }
    : orderStatusMeta[order.status] ?? { label: order.status, className: "bg-slate-100 text-slate-500" };
  const currentPaymentStatus = paymentStatusMeta[order.paymentStatus] ?? { label: order.paymentStatus, className: "bg-slate-100 text-slate-500" };
  const currentShipmentStatus = getOrderShipmentStatusMeta(hasShippingItems, order.hasPendingShipmentItems, order.shipmentStatus);

  return (
    <div className="min-h-screen bg-[#f5f7fb] pb-20 font-sans selection:bg-slate-900 selection:text-white">
      {/* Premium Header */}
      <div className="sticky top-0 z-30 border-b border-slate-200/50 bg-white/80 backdrop-blur-xl transition-all">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 md:h-[72px] md:px-6 xl:px-8">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="group flex size-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-black/[0.04] transition-all hover:bg-slate-50 hover:shadow-md"
          >
            <ArrowLeft className="size-5 transition-transform group-hover:-translate-x-0.5" />
          </button>
          <h1 className="flex-1 text-center text-[17px] font-bold tracking-tight text-slate-900 md:text-lg">订单详情</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8 xl:px-8">
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start lg:gap-8">
          
          <aside className="order-1 lg:sticky lg:top-[96px]">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="rounded-[32px] bg-white p-6 shadow-xl shadow-slate-200/40 ring-1 ring-black/[0.03]">
              <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                <div>
                  <p className="text-[12px] font-bold text-slate-400">ORDER NO.</p>
                  <p className="mt-1 text-[13px] font-medium text-slate-900 select-all">{order.orderNo}</p>
                </div>
                <Badge variant="secondary" className={cn("rounded-md px-2.5 py-1 text-[12px] font-bold tracking-wider", currentOrderStatus.className)}>
                  {currentOrderStatus.label}
                </Badge>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="rounded-[20px] bg-slate-50 p-4">
                  <p className="text-[11px] font-bold text-slate-400">PAYMENT</p>
                  <Badge variant="secondary" className={cn("mt-2 rounded-md px-2 py-0.5 text-[11px] font-bold", currentPaymentStatus.className)}>
                    {currentPaymentStatus.label}
                  </Badge>
                </div>
                <div className="rounded-[20px] bg-slate-50 p-4">
                  <p className="text-[11px] font-bold text-slate-400">SHIPPING</p>
                  <Badge variant="secondary" className={cn("mt-2 rounded-md px-2 py-0.5 text-[11px] font-bold", currentShipmentStatus.className)}>
                    {currentShipmentStatus.label}
                  </Badge>
                </div>
              </div>

              {isPendingPaymentOrder(order) && (
                <div className={cn("mt-6 flex items-start gap-3 rounded-[20px] p-4 text-[13px]", isExpired ? "bg-rose-50/50 text-rose-600" : "bg-orange-50/50 text-[#ff6a3d]")}>
                  <Clock className="size-5 shrink-0 mt-0.5" />
                  <div>
                    {isExpired ? (
                      <p className="font-medium">该订单支付已超时，请重新下单或等待系统自动关闭。</p>
                    ) : (
                      <>
                        <p className="font-bold">请在 {order.payExpireAt} 前完成支付。</p>
                        <p className="mt-1 font-medium">剩余时间：{formatShopCountdown(getShopOrderRemainingMs(order, nowTs))}</p>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-6 space-y-3 border-t border-slate-100 pt-6">
                <div className="flex items-center justify-between text-[14px] font-medium text-slate-500">
                  <span>商品总额</span>
                  <span className="text-slate-900">{formatShopMoney(order.totalAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-[14px] font-medium text-slate-500">
                  <span>运费</span>
                  <span className="text-slate-900">{formatShopMoney(order.freightAmount)}</span>
                </div>
                <div className="flex items-end justify-between pt-4">
                  <span className="text-[14px] font-bold text-slate-900 pb-1">应付总计</span>
                  <span className="text-[34px] font-bold tracking-tight text-[#ff6a3d] leading-none">{formatShopMoney(order.payAmount)}</span>
                </div>
              </div>

              <div className="mt-6 rounded-[24px] bg-slate-50 p-5 text-[12px] font-medium leading-relaxed text-slate-500">
                <p>创建时间：{order.createdAt}</p>
                {order.payExpireAt && <p>支付截止：{order.payExpireAt}</p>}
                {order.paidAt && <p>支付时间：{order.paidAt}</p>}
                {order.completedAt && <p>完成时间：{order.completedAt}</p>}
                {order.cancelledAt && <p>取消时间：{order.cancelledAt}</p>}
              </div>

              {order.remark && (
                <div className="mt-4 rounded-[24px] bg-slate-50 p-5 text-[13px] font-medium text-slate-600">
                  <span className="font-bold text-slate-900 block mb-1">买家备注</span>
                  {order.remark}
                </div>
              )}

              <div className="mt-8 flex flex-col gap-3">
                 {canPay && (
                  <Button className="h-14 w-full rounded-full bg-[#ff6a3d] text-[15px] font-bold tracking-widest text-white shadow-lg shadow-orange-500/25 transition-all hover:-translate-y-0.5 hover:bg-[#f65a28] hover:shadow-orange-500/40" disabled={actionLoading !== ""} onClick={() => void handlePay()}>
                    PAY NOW
                  </Button>
                )}
                <div className="flex gap-3">
                  {canCancel && (
                    <Button variant="ghost" className="flex-1 h-12 rounded-full text-[13px] font-bold text-slate-500 hover:bg-slate-100" disabled={actionLoading !== ""} onClick={() => void handleCancel()}>
                      取消订单
                    </Button>
                  )}
                  {canRequestRefund && (
                    <Button variant="outline" className="flex-1 h-12 rounded-full border-slate-200 text-[13px] font-bold text-slate-700 hover:bg-slate-50" disabled={actionLoading !== "" || refundSaving} onClick={() => setRefundOpen(true)}>
                      申请退款
                    </Button>
                  )}
                  {canConfirmReceipt && (
                    <Button variant="outline" className="flex-1 h-12 rounded-full border-blue-200 bg-blue-50 text-[13px] font-bold text-blue-700 hover:bg-blue-100" disabled={actionLoading !== ""} onClick={() => void handleConfirmReceipt()}>
                      <PackageCheck className="mr-1.5 size-4" />
                      确认收货
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          </aside>

          <div className="order-2 space-y-6">
            <motion.section initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="rounded-[32px] bg-white p-5 shadow-sm ring-1 ring-black/[0.03] md:p-7">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex size-10 items-center justify-center rounded-full bg-slate-50 text-slate-700">
                  <ReceiptText className="size-5" />
                </div>
                <h2 className="text-[17px] font-bold tracking-tight text-slate-900">商品清单</h2>
              </div>
              <div className="space-y-4">
                {order.items.map((item) => (
                  <div key={item.id} className="group flex gap-4 rounded-[24px] bg-slate-50 p-3 transition-colors hover:bg-slate-100">
                    <img src={item.coverUrl} alt={item.productName} className="h-20 w-20 rounded-[20px] object-cover ring-1 ring-black/[0.04] transition-transform group-hover:scale-105" />
                    <div className="min-w-0 flex-1 flex flex-col justify-center">
                      <div className="flex items-start justify-between gap-3">
                        <p className="line-clamp-2 text-[14px] font-bold leading-snug text-slate-900">{item.productName}</p>
                        <p className="shrink-0 text-[15px] font-bold text-[#ff6a3d]">{formatShopMoney(item.price)}</p>
                      </div>
                      <p className="mt-1 text-[12px] font-medium text-slate-500">数量 × {item.quantity}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.requiresShipping && (
                          <Badge variant="secondary" className="rounded-md bg-slate-200/60 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                            需要发货
                          </Badge>
                        )}
                        {item.courseIds.length > 0 && (
                          <Badge variant="secondary" className="rounded-md bg-blue-50/50 px-2 py-0.5 text-[11px] font-bold text-blue-600">
                            含课程权限
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.section>

            {order.receiverName || order.receiverPhone || order.receiverAddress ? (
              <motion.section initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-[32px] bg-white p-5 shadow-sm ring-1 ring-black/[0.03] md:p-7">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex size-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <MapPin className="size-5" />
                  </div>
                  <h2 className="text-[17px] font-bold tracking-tight text-slate-900">收货信息</h2>
                </div>
                <div className="rounded-[24px] bg-slate-50 p-5 text-[14px] leading-relaxed text-slate-600">
                  <p className="font-bold text-slate-900 mb-1">
                    {order.receiverName || "-"} <span className="ml-2 font-medium text-slate-500">{order.receiverPhone || ""}</span>
                  </p>
                  <p>{[order.receiverProvince, order.receiverCity, order.receiverDistrict, order.receiverAddress].filter(Boolean).join(" ") || "-"}</p>
                </div>
              </motion.section>
            ) : null}

            <motion.section initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-[32px] bg-white p-5 shadow-sm ring-1 ring-black/[0.03] md:p-7">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex size-10 items-center justify-center rounded-full bg-green-50 text-green-600">
                  <CreditCard className="size-5" />
                </div>
                <h2 className="text-[17px] font-bold tracking-tight text-slate-900">支付记录</h2>
              </div>
              <div className="space-y-4">
                {order.payments.length === 0 ? (
                  <div className="rounded-[24px] bg-slate-50 p-8 text-center text-[13px] font-medium text-slate-500">暂无支付记录</div>
                ) : (
                  order.payments.map((payment) => (
                    <div key={payment.id} className="rounded-[24px] bg-slate-50 p-5">
                      <div className="flex items-center justify-between gap-3 mb-4 border-b border-slate-200/50 pb-4">
                        <div>
                          <p className="text-[15px] font-bold text-slate-900">{channelLabelMap[payment.channel] ?? payment.channel}</p>
                          <p className="mt-1 text-[11px] font-medium text-slate-400 select-all">{payment.transactionNo || "等待返回流水号"}</p>
                        </div>
                        <Badge variant="secondary" className={cn("rounded-md px-2 py-0.5 text-[11px] font-bold", paymentStatusMeta[payment.status]?.className ?? "bg-slate-200/60 text-slate-600")}>
                          {paymentStatusMeta[payment.status]?.label ?? payment.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-[13px] font-medium text-slate-500">
                        <span className="font-bold text-slate-900">{formatShopMoney(payment.payAmount)}</span>
                        <span>{payment.paidAt || payment.createdAt}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.section>

            {hasDigitalItems && (
              <motion.section initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-[32px] bg-white p-5 shadow-sm ring-1 ring-black/[0.03] md:p-7">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex size-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                    <ReceiptText className="size-5" />
                  </div>
                  <h2 className="text-[17px] font-bold tracking-tight text-slate-900">课程开通</h2>
                </div>
                <div className="space-y-4">
                  {order.digitalFulfillments.length === 0 ? (
                    <div className="rounded-[24px] bg-slate-50 p-8 text-center text-[13px] font-medium text-slate-500">支付成功后会自动开通绑定课程。</div>
                  ) : (
                    order.digitalFulfillments.map((item) => (
                      <div key={item.id} className="rounded-[24px] bg-slate-50 p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[14px] font-bold text-slate-900">{(grantTypeLabelMap[item.grantType] ?? item.grantType) || "课程权限"}</p>
                            <p className="mt-1 text-[12px] font-medium text-slate-500">{item.grantedAt || item.createdAt}</p>
                          </div>
                          <Badge variant="secondary" className={cn("rounded-md px-2 py-0.5 text-[11px] font-bold", digitalStatusMeta[item.status]?.className ?? "bg-slate-200/60 text-slate-600")}>
                            {digitalStatusMeta[item.status]?.label ?? item.status}
                          </Badge>
                        </div>
                        {item.errorMessage && <p className="mt-3 text-[13px] font-medium text-rose-600">{item.errorMessage}</p>}
                      </div>
                    ))
                  )}
                </div>
              </motion.section>
            )}

            {hasShippingItems && (
              <motion.section initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="rounded-[32px] bg-white p-5 shadow-sm ring-1 ring-black/[0.03] md:p-7">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex size-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <Truck className="size-5" />
                  </div>
                  <h2 className="text-[17px] font-bold tracking-tight text-slate-900">物流信息</h2>
                </div>
                <div className="space-y-4">
                  {order.shipments.length === 0 ? (
                    <div className="rounded-[24px] bg-slate-50 p-8 text-center text-[13px] font-medium text-slate-500">订单已支付，等待商家发货。</div>
                  ) : (
                    order.shipments.map((shipment) => (
                      <div key={shipment.id} className="rounded-[24px] bg-slate-50 p-5">
                        <div className="flex items-center justify-between gap-3 mb-4 border-b border-slate-200/50 pb-4">
                          <div className="min-w-0">
                            <p className="text-[15px] font-bold text-slate-900">{shipment.company || "待补充物流公司"}</p>
                            <p className="mt-1 break-all text-[12px] font-medium text-slate-500 select-all">{shipment.trackingNo || "待补充物流单号"}</p>
                          </div>
                          <Badge variant="secondary" className={cn("rounded-md px-2 py-0.5 text-[11px] font-bold", shipmentStatusMeta[shipment.status]?.className ?? "bg-slate-200/60 text-slate-600")}>
                            {shipmentStatusMeta[shipment.status]?.label ?? shipment.status}
                          </Badge>
                        </div>

                        <div className="grid gap-2 text-[12px] font-medium text-slate-500 sm:grid-cols-2 mb-4">
                          <p>发货时间：{shipment.shippedAt || "-"}</p>
                          <p>签收时间：{shipment.signedAt || "-"}</p>
                        </div>

                        <div className="space-y-3 rounded-[16px] bg-white p-4 ring-1 ring-black/[0.03]">
                          {shipment.tracks.length === 0 ? (
                            <p className="text-[13px] font-medium text-slate-500 text-center py-2">暂无物流轨迹</p>
                          ) : (
                            shipment.tracks.map((track, idx) => (
                              <div key={track.id} className="relative pl-6 pb-4 last:pb-0">
                                <div className={cn("absolute left-[7px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white", idx === 0 ? "bg-blue-600" : "bg-slate-300")} />
                                {idx !== shipment.tracks.length - 1 && <div className="absolute left-[11px] top-4 bottom-0 w-px bg-slate-200" />}
                                <p className={cn("text-[13px] font-medium", idx === 0 ? "text-slate-900 font-bold" : "text-slate-600")}>{track.content}</p>
                                {track.location && <p className="mt-0.5 text-[12px] text-slate-500">{track.location}</p>}
                                <p className="mt-0.5 text-[11px] text-slate-400">{track.trackTime}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.section>
            )}

             {order.refunds.length > 0 && (
               <motion.section initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="rounded-[32px] bg-white p-5 shadow-sm ring-1 ring-black/[0.03] md:p-7">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex size-10 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                    <ReceiptText className="size-5" />
                  </div>
                  <h2 className="text-[17px] font-bold tracking-tight text-slate-900">退款记录</h2>
                </div>
                <div className="space-y-4">
                    {order.refunds.map((refund) => (
                      <div key={refund.id} className="rounded-[24px] bg-slate-50 p-5">
                        <div className="flex items-center justify-between gap-3 mb-4 border-b border-slate-200/50 pb-4">
                          <div>
                            <p className="text-[14px] font-bold text-slate-900">退款金额：<span className="text-rose-600">{formatShopMoney(refund.refundAmount)}</span></p>
                            <p className="mt-1 text-[11px] font-medium text-slate-400">{refund.createdAt}</p>
                          </div>
                          <Badge variant="secondary" className={cn("rounded-md px-2 py-0.5 text-[11px] font-bold", refundStatusMeta[refund.status]?.className ?? "bg-slate-200/60 text-slate-600")}>
                            {refundStatusMeta[refund.status]?.label ?? refund.status}
                          </Badge>
                        </div>
                        {refund.reason && <p className="text-[13px] font-medium text-slate-600"><span className="font-bold text-slate-900">原因：</span>{refund.reason}</p>}
                        {refund.resultMessage && <p className="mt-2 rounded-[12px] bg-white p-3 text-[12px] font-medium leading-relaxed text-slate-500 ring-1 ring-black/[0.03]">{refund.resultMessage}</p>}
                      </div>
                    ))}
                </div>
              </motion.section>
             )}
          </div>
        </div>

        <Dialog
          open={refundOpen}
          onOpenChange={(open) => {
            setRefundOpen(open);
            if (!open) {
              setRefundReason("");
            }
          }}
        >
          <DialogContent className="sm:max-w-md rounded-[32px] p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">申请退款</DialogTitle>
              <DialogDescription className="text-sm font-medium text-slate-500">先提交退款原因，后台审核后会继续处理退款。</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <Label htmlFor="shop-refund-reason" className="text-sm font-bold text-slate-700">退款原因</Label>
              <Textarea
                id="shop-refund-reason"
                rows={5}
                className="resize-none rounded-[20px] bg-slate-50 border-none p-4 shadow-inner text-sm focus-visible:ring-2 focus-visible:ring-slate-200"
                value={refundReason}
                onChange={(event) => setRefundReason(event.target.value)}
                placeholder="请简要说明退款原因"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" className="rounded-full font-bold text-slate-500 hover:bg-slate-100" onClick={() => setRefundOpen(false)} disabled={refundSaving}>
                取消
              </Button>
              <Button className="rounded-full bg-slate-900 px-6 font-bold text-white hover:bg-slate-800" onClick={() => void handleRequestRefund()} disabled={refundSaving}>
                {refundSaving ? "提交中..." : "提交申请"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
