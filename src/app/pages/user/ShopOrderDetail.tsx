import { ArrowLeft, CreditCard, MapPin, PackageCheck, ReceiptText, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { type ShopOrderDetail as ShopOrderDetailType, type ShopPaymentChannel, mockApi } from "../../lib/mockData";
import { startShopPaymentFlow } from "../../lib/shopPayment";
import {
  formatShopCountdown,
  formatShopMoney,
  getShopOrderRemainingMs,
  isPendingPaymentOrder,
  isShopOrderExpired,
} from "../../lib/shopOrder";

const orderStatusMeta: Record<string, { label: string; className: string }> = {
  pending_payment: { label: "待支付", className: "bg-amber-50 text-amber-700" },
  paid: { label: "已支付", className: "bg-blue-50 text-blue-700" },
  partially_fulfilled: { label: "履约中", className: "bg-indigo-50 text-indigo-700" },
  completed: { label: "已完成", className: "bg-emerald-50 text-emerald-700" },
  cancelled: { label: "已取消", className: "bg-slate-100 text-slate-600" },
  refunding: { label: "退款中", className: "bg-rose-50 text-rose-700" },
  refunded: { label: "已退款", className: "bg-rose-50 text-rose-700" },
};

const paymentStatusMeta: Record<string, { label: string; className: string }> = {
  unpaid: { label: "未支付", className: "bg-amber-50 text-amber-700" },
  paid: { label: "已支付", className: "bg-emerald-50 text-emerald-700" },
  failed: { label: "支付失败", className: "bg-rose-50 text-rose-700" },
  refunded: { label: "已退款", className: "bg-slate-100 text-slate-600" },
};

const shipmentStatusMeta: Record<string, { label: string; className: string }> = {
  pending: { label: "待发货", className: "bg-amber-50 text-amber-700" },
  shipped: { label: "已发货", className: "bg-blue-50 text-blue-700" },
  in_transit: { label: "运输中", className: "bg-indigo-50 text-indigo-700" },
  signed: { label: "已签收", className: "bg-emerald-50 text-emerald-700" },
  failed: { label: "物流异常", className: "bg-rose-50 text-rose-700" },
};

const getOrderShipmentStatusMeta = (hasShippingItems: boolean, hasPendingShipmentItems: boolean, shipmentStatus: string) => {
  if (!hasShippingItems) {
    return { label: "无需发货", className: "bg-slate-100 text-slate-600" };
  }

  if (hasPendingShipmentItems) {
    if (shipmentStatus === "pending") return shipmentStatusMeta.pending;
    if (shipmentStatus === "shipped" || shipmentStatus === "in_transit") {
      return { label: "部分已发货", className: "bg-blue-50 text-blue-700" };
    }
    if (shipmentStatus === "failed") {
      return { label: "待继续发货", className: "bg-amber-50 text-amber-700" };
    }
  }

  return shipmentStatusMeta[shipmentStatus] ?? { label: shipmentStatus, className: "bg-slate-100 text-slate-600" };
};

const digitalStatusMeta: Record<string, { label: string; className: string }> = {
  pending: { label: "待开通", className: "bg-amber-50 text-amber-700" },
  success: { label: "已开通", className: "bg-emerald-50 text-emerald-700" },
  failed: { label: "开通失败", className: "bg-rose-50 text-rose-700" },
};

const channelLabelMap: Record<string, string> = {
  wechat_h5: "微信 H5",
  wechat_jsapi: "微信 JSAPI",
  alipay_wap: "支付宝 WAP",
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

  const isExpired = order ? isShopOrderExpired(order, nowTs) : false;
  const canCancel = Boolean(order && isPendingPaymentOrder(order));
  const canPay = Boolean(order && isPendingPaymentOrder(order) && !isExpired);
  const canConfirmReceipt = Boolean(order && hasShippingItems && (order.shipmentStatus === "shipped" || order.shipmentStatus === "in_transit"));

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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f8fb] px-4 py-6">
        <div className="mx-auto max-w-sm rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500">订单详情加载中...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#f6f8fb] px-4 py-6">
        <div className="mx-auto max-w-sm rounded-3xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-base font-medium text-slate-900">订单不存在或已失效</p>
          <Button className="mt-4" variant="outline" onClick={() => navigate("/user/shop/orders")}>
            返回订单列表
          </Button>
        </div>
      </div>
    );
  }

  const currentOrderStatus = isExpired
    ? { label: "支付超时", className: "bg-rose-50 text-rose-700" }
    : orderStatusMeta[order.status] ?? { label: order.status, className: "bg-slate-100 text-slate-600" };
  const currentShipmentStatus = getOrderShipmentStatusMeta(hasShippingItems, order.hasPendingShipmentItems, order.shipmentStatus);

  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <div className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-sm items-center px-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex size-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="flex-1 text-center text-base font-semibold text-slate-900">订单详情</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="mx-auto max-w-sm px-4 py-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-slate-500">订单号</p>
              <p className="mt-1 break-all font-semibold text-slate-900">{order.orderNo}</p>
            </div>
            <Badge variant="secondary" className={currentOrderStatus.className}>
              {currentOrderStatus.label}
            </Badge>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">支付状态</p>
              <Badge variant="secondary" className={`mt-2 ${paymentStatusMeta[order.paymentStatus]?.className ?? "bg-slate-100 text-slate-600"}`}>
                {paymentStatusMeta[order.paymentStatus]?.label ?? order.paymentStatus}
              </Badge>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">发货状态</p>
              <Badge variant="secondary" className={`mt-2 ${currentShipmentStatus.className}`}>
                {currentShipmentStatus.label}
              </Badge>
            </div>
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

          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>商品金额</span>
              <span>{formatShopMoney(order.totalAmount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>运费</span>
              <span>{formatShopMoney(order.freightAmount)}</span>
            </div>
            <div className="flex items-center justify-between text-base font-semibold text-slate-900">
              <span>应付金额</span>
              <span>{formatShopMoney(order.payAmount)}</span>
            </div>
            <div className="pt-1 text-xs text-slate-500">
              <p>创建时间 {order.createdAt}</p>
              {order.payExpireAt ? <p className="mt-1">支付截止 {order.payExpireAt}</p> : null}
              {order.paidAt ? <p className="mt-1">支付时间 {order.paidAt}</p> : null}
              {order.completedAt ? <p className="mt-1">完成时间 {order.completedAt}</p> : null}
              {order.cancelledAt ? <p className="mt-1">取消时间 {order.cancelledAt}</p> : null}
            </div>
          </div>

          {order.remark ? <p className="mt-4 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600">备注：{order.remark}</p> : null}

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {canCancel ? (
              <Button variant="outline" size="sm" disabled={actionLoading !== ""} onClick={() => void handleCancel()}>
                取消订单
              </Button>
            ) : null}
            {canConfirmReceipt ? (
              <Button variant="outline" size="sm" disabled={actionLoading !== ""} onClick={() => void handleConfirmReceipt()}>
                <PackageCheck className="mr-2 size-4" />
                确认收货
              </Button>
            ) : null}
            {canPay ? (
              <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800" disabled={actionLoading !== ""} onClick={() => void handlePay()}>
                <CreditCard className="mr-2 size-4" />
                继续支付
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <ReceiptText className="size-5 text-slate-700" />
            <h2 className="text-base font-semibold text-slate-900">商品清单</h2>
          </div>
          <div className="mt-4 space-y-3">
            {order.items.map((item) => (
              <div key={item.id} className="flex gap-3 rounded-2xl bg-slate-50 p-3">
                <img src={item.coverUrl} alt={item.productName} className="h-16 w-16 rounded-2xl object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-medium text-slate-900">{item.productName}</p>
                      <p className="mt-1 text-xs text-slate-500">数量 {item.quantity}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-slate-900">{formatShopMoney(item.price)}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.requiresShipping ? (
                      <Badge variant="secondary" className="bg-amber-50 text-amber-700">
                        需要发货
                      </Badge>
                    ) : null}
                    {item.courseIds.length > 0 ? (
                      <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                        关联课程 {item.courseIds.length} 门
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {order.receiverName || order.receiverPhone || order.receiverAddress ? (
          <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <MapPin className="size-5 text-slate-700" />
              <h2 className="text-base font-semibold text-slate-900">收货信息</h2>
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p className="font-medium text-slate-900">
                {order.receiverName || "-"} {order.receiverPhone || ""}
              </p>
              <p>
                {[order.receiverProvince, order.receiverCity, order.receiverDistrict, order.receiverAddress].filter(Boolean).join(" ") || "-"}
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <CreditCard className="size-5 text-slate-700" />
            <h2 className="text-base font-semibold text-slate-900">支付记录</h2>
          </div>
          <div className="mt-4 space-y-3">
            {order.payments.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">暂无支付记录</div>
            ) : (
              order.payments.map((payment) => (
                <div key={payment.id} className="rounded-2xl bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{channelLabelMap[payment.channel] ?? payment.channel}</p>
                      <p className="mt-1 text-xs text-slate-500">{payment.transactionNo || "等待支付平台返回流水号"}</p>
                    </div>
                    <Badge variant="secondary" className={paymentStatusMeta[payment.status]?.className ?? "bg-slate-100 text-slate-600"}>
                      {paymentStatusMeta[payment.status]?.label ?? payment.status}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                    <span>{formatShopMoney(payment.payAmount)}</span>
                    <span>{payment.paidAt || payment.createdAt}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {hasDigitalItems ? (
          <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <ReceiptText className="size-5 text-slate-700" />
              <h2 className="text-base font-semibold text-slate-900">课程开通</h2>
            </div>
            <div className="mt-4 space-y-3">
              {order.digitalFulfillments.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">支付成功后会自动开通绑定课程。</div>
              ) : (
                order.digitalFulfillments.map((item) => (
                  <div key={item.id} className="rounded-2xl bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{(grantTypeLabelMap[item.grantType] ?? item.grantType) || "课程权限"}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.grantedAt || item.createdAt}</p>
                      </div>
                      <Badge variant="secondary" className={digitalStatusMeta[item.status]?.className ?? "bg-slate-100 text-slate-600"}>
                        {digitalStatusMeta[item.status]?.label ?? item.status}
                      </Badge>
                    </div>
                    {item.errorMessage ? <p className="mt-2 text-xs text-rose-600">{item.errorMessage}</p> : null}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        {hasShippingItems ? (
          <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <Truck className="size-5 text-slate-700" />
              <h2 className="text-base font-semibold text-slate-900">物流信息</h2>
            </div>
            <div className="mt-4 space-y-4">
              {order.shipments.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">订单已支付，等待商家发货。</div>
              ) : (
                order.shipments.map((shipment) => (
                  <div key={shipment.id} className="rounded-2xl bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{shipment.company || "待补充物流公司"}</p>
                        <p className="mt-1 break-all text-xs text-slate-500">{shipment.trackingNo || "待补充物流单号"}</p>
                      </div>
                      <Badge variant="secondary" className={shipmentStatusMeta[shipment.status]?.className ?? "bg-slate-100 text-slate-600"}>
                        {shipmentStatusMeta[shipment.status]?.label ?? shipment.status}
                      </Badge>
                    </div>

                    <div className="mt-3 grid gap-2 text-xs text-slate-500">
                      <p>发货时间 {shipment.shippedAt || "-"}</p>
                      <p>签收时间 {shipment.signedAt || "-"}</p>
                    </div>

                    <div className="mt-3 space-y-2">
                      {shipment.tracks.length === 0 ? (
                        <p className="text-sm text-slate-500">暂无物流轨迹</p>
                      ) : (
                        shipment.tracks.map((track) => (
                          <div key={track.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                            <p className="text-sm font-medium text-slate-900">{track.content}</p>
                            {track.location ? <p className="mt-1 text-xs text-slate-500">{track.location}</p> : null}
                            <p className="mt-1 text-xs text-slate-400">{track.trackTime}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
