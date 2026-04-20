import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { PackagePlus, Search, Truck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Checkbox } from "../../components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Textarea } from "../../components/ui/textarea";
import {
  AdminShopOrderListSummary,
  ShopOrder,
  ShopOrderDetail,
  ShopPaymentStatus,
  ShopShipmentStatus,
  mockApi,
} from "../../lib/mockData";

type OrderStatusFilter =
  | "all"
  | "pending_payment"
  | "paid"
  | "partially_fulfilled"
  | "completed"
  | "cancelled"
  | "refunding"
  | "refunded";
type PaymentStatusFilter = "all" | ShopPaymentStatus;
type ShipmentStatusFilter = "all" | ShopShipmentStatus | "pending";
type ShipmentQuantityState = Record<string, { checked: boolean; quantity: string }>;

const PAGE_SIZE = 20;

const orderStatusMeta: Record<Exclude<OrderStatusFilter, "all">, { label: string; className: string }> = {
  pending_payment: { label: "待支付", className: "bg-amber-100 text-amber-700" },
  paid: { label: "已支付", className: "bg-blue-100 text-blue-700" },
  partially_fulfilled: { label: "部分履约", className: "bg-indigo-100 text-indigo-700" },
  completed: { label: "已完成", className: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "已取消", className: "bg-slate-100 text-slate-700" },
  refunding: { label: "退款中", className: "bg-rose-100 text-rose-700" },
  refunded: { label: "已退款", className: "bg-slate-200 text-slate-700" },
};

const paymentStatusMeta: Record<ShopPaymentStatus, { label: string; className: string }> = {
  unpaid: { label: "未支付", className: "bg-amber-100 text-amber-700" },
  paid: { label: "已支付", className: "bg-emerald-100 text-emerald-700" },
  failed: { label: "支付失败", className: "bg-rose-100 text-rose-700" },
  refunded: { label: "已退款", className: "bg-slate-100 text-slate-700" },
};

const shipmentStatusMeta: Record<Exclude<ShipmentStatusFilter, "all">, { label: string; className: string }> = {
  pending: { label: "待发货", className: "bg-amber-100 text-amber-700" },
  shipped: { label: "已发货", className: "bg-blue-100 text-blue-700" },
  in_transit: { label: "运输中", className: "bg-indigo-100 text-indigo-700" },
  signed: { label: "已签收", className: "bg-emerald-100 text-emerald-700" },
  failed: { label: "物流异常", className: "bg-rose-100 text-rose-700" },
};

const getOrderShipmentMeta = (order: Pick<ShopOrder, "items" | "hasPendingShipmentItems" | "shipmentStatus">) => {
  const hasShippingItems = order.items.some((item) => item.requiresShipping);
  if (!hasShippingItems) {
    return { label: "无需发货", className: "bg-slate-100 text-slate-700" };
  }

  if (order.hasPendingShipmentItems) {
    if (order.shipmentStatus === "pending") return shipmentStatusMeta.pending;
    if (order.shipmentStatus === "shipped" || order.shipmentStatus === "in_transit") {
      return { label: "部分已发货", className: "bg-blue-100 text-blue-700" };
    }
    if (order.shipmentStatus === "failed") {
      return { label: "待继续发货", className: "bg-amber-100 text-amber-700" };
    }
  }

  return shipmentStatusMeta[order.shipmentStatus] ?? { label: order.shipmentStatus, className: "bg-slate-100 text-slate-700" };
};

const createShipmentState = (order: ShopOrderDetail | null): ShipmentQuantityState => {
  if (!order) return {};
  const shippedMap = new Map<string, number>();
  order.shipments.forEach((shipment) => {
    if (!["shipped", "in_transit", "signed"].includes(shipment.status)) return;
    shipment.items.forEach((item) => shippedMap.set(item.orderItemId, (shippedMap.get(item.orderItemId) ?? 0) + item.quantity));
  });
  return order.items
    .filter((item) => item.requiresShipping)
    .reduce<ShipmentQuantityState>((result, item) => {
      const remaining = Math.max(item.quantity - (shippedMap.get(item.id) ?? 0), 0);
      if (remaining > 0) result[item.id] = { checked: true, quantity: `${remaining}` };
      return result;
    }, {});
};

export function ShopOrderList() {
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [summary, setSummary] = useState<AdminShopOrderListSummary>({
    total: 0,
    pendingPayment: 0,
    paid: 0,
    waitingShipment: 0,
  });
  const [loading, setLoading] = useState(true);
  const [orderNo, setOrderNo] = useState("");
  const [phone, setPhone] = useState("");
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusFilter>("all");
  const [shipmentStatusFilter, setShipmentStatusFilter] = useState<ShipmentStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ShopOrderDetail | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [closeSaving, setCloseSaving] = useState(false);
  const [shipmentOpen, setShipmentOpen] = useState(false);
  const [shipmentSaving, setShipmentSaving] = useState(false);
  const [shipmentCompany, setShipmentCompany] = useState("");
  const [shipmentTrackingNo, setShipmentTrackingNo] = useState("");
  const [shipmentStatus, setShipmentStatus] = useState<ShopShipmentStatus>("shipped");
  const [shipmentRemark, setShipmentRemark] = useState("");
  const [shipmentItems, setShipmentItems] = useState<ShipmentQuantityState>({});
  const deferredOrderNo = useDeferredValue(orderNo.trim());
  const deferredPhone = useDeferredValue(phone.trim());
  const deferredKeyword = useDeferredValue(keyword.trim());

  const loadOrders = async (options?: { keepLoading?: boolean }) => {
    if (options?.keepLoading !== false) setLoading(true);
    try {
      const result = await mockApi.getAdminShopOrders({
        orderNo: deferredOrderNo,
        phone: deferredPhone,
        keyword: deferredKeyword,
        status: statusFilter,
        paymentStatus: paymentStatusFilter,
        shipmentStatus: shipmentStatusFilter,
        page,
        pageSize: PAGE_SIZE,
      });
      setOrders(result.list);
      setTotal(result.pagination.total);
      setSummary(
        result.summary ?? {
          total: result.pagination.total,
          pendingPayment: result.list.filter((item) => item.status === "pending_payment").length,
          paid: result.list.filter((item) => item.paymentStatus === "paid").length,
          waitingShipment: result.list.filter((item) => item.hasPendingShipmentItems).length,
        },
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载订单失败");
    } finally {
      if (options?.keepLoading !== false) setLoading(false);
    }
  };

  const loadOrderDetail = async (orderId: string, options?: { open?: boolean }) => {
    try {
      setDetailLoading(true);
      const detail = await mockApi.getAdminShopOrderDetail(orderId);
      setSelectedOrder(detail);
      if (options?.open !== false) setDetailOpen(true);
      return detail;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载订单详情失败");
      return null;
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, [deferredOrderNo, deferredPhone, deferredKeyword, statusFilter, paymentStatusFilter, shipmentStatusFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [deferredOrderNo, deferredPhone, deferredKeyword, statusFilter, paymentStatusFilter, shipmentStatusFilter]);

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const shippableItems = useMemo(() => {
    if (!selectedOrder) return [];
    const shippedMap = new Map<string, number>();
    selectedOrder.shipments.forEach((shipment) => {
      if (!["shipped", "in_transit", "signed"].includes(shipment.status)) return;
      shipment.items.forEach((item) => shippedMap.set(item.orderItemId, (shippedMap.get(item.orderItemId) ?? 0) + item.quantity));
    });
    return selectedOrder.items
      .filter((item) => item.requiresShipping)
      .map((item) => ({
        ...item,
        shippedQuantity: shippedMap.get(item.id) ?? 0,
        remainingQuantity: Math.max(item.quantity - (shippedMap.get(item.id) ?? 0), 0),
      }));
  }, [selectedOrder]);

  const openShipmentDialog = () => {
    if (!selectedOrder) return;
    setShipmentCompany("");
    setShipmentTrackingNo("");
    setShipmentStatus("shipped");
    setShipmentRemark("");
    setShipmentItems(createShipmentState(selectedOrder));
    setShipmentOpen(true);
  };

  const handleCloseOrder = async () => {
    if (!selectedOrder) return;
    setCloseSaving(true);
    try {
      const detail = await mockApi.closeAdminShopOrder(selectedOrder.id, closeReason.trim());
      setSelectedOrder(detail);
      setCloseOpen(false);
      setCloseReason("");
      toast.success("订单已关闭");
      await loadOrders({ keepLoading: false });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "关闭订单失败");
    } finally {
      setCloseSaving(false);
    }
  };

  const handleCreateShipment = async () => {
    if (!selectedOrder) return;
    const items = Object.entries(shipmentItems)
      .filter(([, value]) => value.checked)
      .map(([orderItemId, value]) => ({ orderItemId, quantity: Math.max(Number.parseInt(value.quantity, 10) || 0, 0) }))
      .filter((item) => item.quantity > 0);
    if (!shipmentCompany.trim() || !shipmentTrackingNo.trim()) return toast.error("请填写物流公司和物流单号");
    if (items.length === 0) return toast.error("请至少选择一条发货明细");
    setShipmentSaving(true);
    try {
      await mockApi.createAdminShopShipment(selectedOrder.id, {
        company: shipmentCompany.trim(),
        trackingNo: shipmentTrackingNo.trim(),
        remark: shipmentRemark.trim(),
        status: shipmentStatus,
        items,
      });
      toast.success("发货单已创建");
      setShipmentOpen(false);
      await loadOrderDetail(selectedOrder.id, { open: false });
      await loadOrders({ keepLoading: false });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建发货单失败");
    } finally {
      setShipmentSaving(false);
    }
  };

  return (
    <>
      <div className="p-8">
        <div className="rounded-3xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-8 py-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">商城订单</h1>
                <p className="mt-2 text-sm text-slate-500">支持筛单、关单和拆单发货。</p>
              </div>
              <Button variant="outline" onClick={() => void loadOrders()}><Search className="mr-2 size-4" />刷新订单</Button>
            </div>
          </div>
          <div className="space-y-6 px-8 py-6">
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="rounded-2xl border-slate-200 shadow-none"><CardContent className="p-5"><p className="text-sm text-slate-500">当前结果</p><p className="mt-2 text-3xl font-semibold text-slate-900">{summary.total}</p></CardContent></Card>
              <Card className="rounded-2xl border-slate-200 shadow-none"><CardContent className="p-5"><p className="text-sm text-slate-500">待支付</p><p className="mt-2 text-3xl font-semibold text-slate-900">{summary.pendingPayment}</p></CardContent></Card>
              <Card className="rounded-2xl border-slate-200 shadow-none"><CardContent className="p-5"><p className="text-sm text-slate-500">已支付</p><p className="mt-2 text-3xl font-semibold text-slate-900">{summary.paid}</p></CardContent></Card>
              <Card className="rounded-2xl border-slate-200 shadow-none"><CardContent className="p-5"><p className="text-sm text-slate-500">待发货</p><p className="mt-2 text-3xl font-semibold text-slate-900">{summary.waitingShipment}</p></CardContent></Card>
            </div>
            <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr_180px_180px_180px_auto]">
              <Input placeholder="订单号" value={orderNo} onChange={(event) => setOrderNo(event.target.value)} />
              <Input placeholder="手机号" value={phone} onChange={(event) => setPhone(event.target.value)} />
              <Input placeholder="商品关键词" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
              <Select value={statusFilter} onValueChange={(value: OrderStatusFilter) => setStatusFilter(value)}><SelectTrigger><SelectValue placeholder="订单状态" /></SelectTrigger><SelectContent><SelectItem value="all">全部订单</SelectItem><SelectItem value="pending_payment">待支付</SelectItem><SelectItem value="paid">已支付</SelectItem><SelectItem value="partially_fulfilled">部分履约</SelectItem><SelectItem value="completed">已完成</SelectItem><SelectItem value="cancelled">已取消</SelectItem><SelectItem value="refunding">退款中</SelectItem><SelectItem value="refunded">已退款</SelectItem></SelectContent></Select>
              <Select value={paymentStatusFilter} onValueChange={(value: PaymentStatusFilter) => setPaymentStatusFilter(value)}><SelectTrigger><SelectValue placeholder="支付状态" /></SelectTrigger><SelectContent><SelectItem value="all">全部支付</SelectItem><SelectItem value="unpaid">未支付</SelectItem><SelectItem value="paid">已支付</SelectItem><SelectItem value="failed">失败</SelectItem><SelectItem value="refunded">已退款</SelectItem></SelectContent></Select>
              <Select value={shipmentStatusFilter} onValueChange={(value: ShipmentStatusFilter) => setShipmentStatusFilter(value)}><SelectTrigger><SelectValue placeholder="发货状态" /></SelectTrigger><SelectContent><SelectItem value="all">全部发货</SelectItem><SelectItem value="pending">待发货</SelectItem><SelectItem value="shipped">已发货</SelectItem><SelectItem value="in_transit">运输中</SelectItem><SelectItem value="signed">已签收</SelectItem><SelectItem value="failed">物流异常</SelectItem></SelectContent></Select>
              <Button variant="outline" onClick={() => { setOrderNo(""); setPhone(""); setKeyword(""); setStatusFilter("all"); setPaymentStatusFilter("all"); setShipmentStatusFilter("all"); }}>重置</Button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <Table>
                <TableHeader><TableRow><TableHead>订单信息</TableHead><TableHead>用户</TableHead><TableHead>订单状态</TableHead><TableHead>支付状态</TableHead><TableHead>发货状态</TableHead><TableHead>金额</TableHead><TableHead>商品数</TableHead><TableHead>下单时间</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
                <TableBody>
                  {loading ? <TableRow><TableCell colSpan={9} className="py-14 text-center text-slate-500">订单加载中...</TableCell></TableRow> : null}
                  {!loading && orders.length === 0 ? <TableRow><TableCell colSpan={9} className="py-14 text-center text-slate-500">暂无订单</TableCell></TableRow> : null}
                  {!loading ? orders.map((order) => { const shipmentMeta = getOrderShipmentMeta(order); return <TableRow key={order.id}><TableCell><div className="space-y-1"><p className="font-medium text-slate-900">{order.orderNo}</p><p className="text-xs text-slate-500">订单 ID: {order.id}</p></div></TableCell><TableCell>{order.userPhone}</TableCell><TableCell><Badge variant="secondary" className={orderStatusMeta[order.status].className}>{orderStatusMeta[order.status].label}</Badge></TableCell><TableCell><Badge variant="secondary" className={paymentStatusMeta[order.paymentStatus].className}>{paymentStatusMeta[order.paymentStatus].label}</Badge></TableCell><TableCell><Badge variant="secondary" className={shipmentMeta.className}>{shipmentMeta.label}</Badge></TableCell><TableCell><div className="space-y-1"><p className="font-medium text-slate-900">￥{order.payAmount}</p><p className="text-xs text-slate-500">运费 ￥{order.freightAmount}</p></div></TableCell><TableCell>{order.itemCount}</TableCell><TableCell>{order.createdAt}</TableCell><TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => void loadOrderDetail(order.id)}>查看详情</Button></TableCell></TableRow>; }) : null}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p>共 {total} 条，当前第 {page} / {totalPages} 页</p>
              <div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))}>上一页</Button><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(current + 1, totalPages))}>下一页</Button></div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={detailOpen} onOpenChange={(open) => { setDetailOpen(open); if (!open) setSelectedOrder(null); }}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader><DialogTitle>{selectedOrder?.orderNo || "订单详情"}</DialogTitle><DialogDescription>查看订单明细、支付记录和发货记录。</DialogDescription></DialogHeader>
          {detailLoading || !selectedOrder ? <div className="py-16 text-center text-slate-500">订单详情加载中...</div> : <>
            <div className="mb-4 flex flex-wrap gap-3">
              {selectedOrder.status === "pending_payment" && selectedOrder.paymentStatus === "unpaid" ? <Button variant="destructive" onClick={() => setCloseOpen(true)}><XCircle className="mr-2 size-4" />关闭订单</Button> : null}
              {selectedOrder.paymentStatus === "paid" && shippableItems.some((item) => item.remainingQuantity > 0) ? <Button onClick={openShipmentDialog}><PackagePlus className="mr-2 size-4" />创建发货单</Button> : null}
              <Button variant="outline" onClick={() => void loadOrderDetail(selectedOrder.id)}><Truck className="mr-2 size-4" />刷新详情</Button>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="rounded-2xl border-slate-200 shadow-none"><CardContent className="p-5"><p className="text-sm text-slate-500">订单状态</p><p className="mt-2 text-xl font-semibold text-slate-900">{orderStatusMeta[selectedOrder.status].label}</p></CardContent></Card>
              <Card className="rounded-2xl border-slate-200 shadow-none"><CardContent className="p-5"><p className="text-sm text-slate-500">支付状态</p><p className="mt-2 text-xl font-semibold text-slate-900">{paymentStatusMeta[selectedOrder.paymentStatus].label}</p></CardContent></Card>
              <Card className="rounded-2xl border-slate-200 shadow-none"><CardContent className="p-5"><p className="text-sm text-slate-500">发货状态</p><p className="mt-2 text-xl font-semibold text-slate-900">{getOrderShipmentMeta(selectedOrder).label}</p></CardContent></Card>
              <Card className="rounded-2xl border-slate-200 shadow-none"><CardContent className="p-5"><p className="text-sm text-slate-500">实付金额</p><p className="mt-2 text-xl font-semibold text-slate-900">￥{selectedOrder.payAmount}</p></CardContent></Card>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Card className="rounded-2xl border-slate-200 shadow-none"><CardContent className="space-y-2 p-5 text-sm text-slate-600"><p><span className="text-slate-500">用户手机号:</span> {selectedOrder.userPhone}</p><p><span className="text-slate-500">收货人:</span> {selectedOrder.receiverName || "-"}</p><p><span className="text-slate-500">收货手机号:</span> {selectedOrder.receiverPhone || "-"}</p><p><span className="text-slate-500">收货地址:</span> {[selectedOrder.receiverProvince, selectedOrder.receiverCity, selectedOrder.receiverDistrict, selectedOrder.receiverAddress].filter(Boolean).join(" ") || "-"}</p><p><span className="text-slate-500">用户备注:</span> {selectedOrder.remark || "-"}</p></CardContent></Card>
              <Card className="rounded-2xl border-slate-200 shadow-none"><CardContent className="space-y-2 p-5 text-sm text-slate-600"><p><span className="text-slate-500">下单时间:</span> {selectedOrder.createdAt}</p><p><span className="text-slate-500">支付时间:</span> {selectedOrder.paidAt || "-"}</p><p><span className="text-slate-500">完成时间:</span> {selectedOrder.completedAt || "-"}</p><p><span className="text-slate-500">数字履约:</span> {selectedOrder.digitalFulfillmentStatus || "-"}</p><p><span className="text-slate-500">支付记录数:</span> {selectedOrder.payments.length}</p></CardContent></Card>
            </div>
            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
              <Table>
                <TableHeader><TableRow><TableHead>商品</TableHead><TableHead>价格</TableHead><TableHead>数量</TableHead><TableHead>发货</TableHead><TableHead>课程数</TableHead></TableRow></TableHeader>
                <TableBody>{selectedOrder.items.map((item) => { const shippingMeta = shippableItems.find((row) => row.id === item.id); return <TableRow key={item.id}><TableCell><div className="flex items-center gap-3"><img src={item.coverUrl} alt={item.productName} className="h-12 w-12 rounded-xl object-cover" /><div><p className="font-medium text-slate-900">{item.productName}</p><p className="text-xs text-slate-500">SKU: {item.skuId}</p></div></div></TableCell><TableCell>￥{item.price}</TableCell><TableCell>{item.quantity}</TableCell><TableCell>{item.requiresShipping ? `已发 ${shippingMeta?.shippedQuantity ?? 0} / 待发 ${shippingMeta?.remainingQuantity ?? item.quantity}` : "无需发货"}</TableCell><TableCell>{item.courseIds.length}</TableCell></TableRow>; })}</TableBody>
              </Table>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Card className="rounded-2xl border-slate-200 shadow-none"><CardContent className="p-5"><p className="mb-3 font-medium text-slate-900">支付记录</p><div className="space-y-2 text-sm text-slate-600">{selectedOrder.payments.length === 0 ? <p>暂无支付记录</p> : selectedOrder.payments.map((payment) => <div key={payment.id} className="rounded-xl bg-slate-50 px-3 py-2"><p>{payment.channel} / {paymentStatusMeta[payment.status].label}</p><p>金额 ￥{payment.payAmount}</p><p>流水号 {payment.transactionNo || "-"}</p><p>支付时间 {payment.paidAt || "-"}</p></div>)}</div></CardContent></Card>
              <Card className="rounded-2xl border-slate-200 shadow-none"><CardContent className="p-5"><p className="mb-3 font-medium text-slate-900">发货记录</p><div className="space-y-2 text-sm text-slate-600">{selectedOrder.shipments.length === 0 ? <p>暂无发货记录</p> : selectedOrder.shipments.map((shipment) => <div key={shipment.id} className="rounded-xl bg-slate-50 px-3 py-2"><p>{shipment.company || "未填写物流公司"} / {shipment.trackingNo || "未填写单号"}</p><p>状态 {shipmentStatusMeta[shipment.status].label}</p><p>时间 {shipment.shippedAt || "-"}</p><p>轨迹 {shipment.latestTrack?.content || "暂无轨迹"}</p></div>)}</div></CardContent></Card>
            </div>
          </>}
        </DialogContent>
      </Dialog>

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent><DialogHeader><DialogTitle>关闭订单</DialogTitle><DialogDescription>仅待支付订单可手动关闭。</DialogDescription></DialogHeader><div className="space-y-2 py-4"><Label htmlFor="close-order-reason">关闭原因</Label><Textarea id="close-order-reason" rows={4} value={closeReason} onChange={(event) => setCloseReason(event.target.value)} placeholder="可选，用于记录本次关单原因" /></div><DialogFooter><Button variant="outline" onClick={() => setCloseOpen(false)} disabled={closeSaving}>取消</Button><Button variant="destructive" onClick={() => void handleCloseOrder()} disabled={closeSaving}>{closeSaving ? "关闭中..." : "确认关闭"}</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={shipmentOpen} onOpenChange={setShipmentOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>创建发货单</DialogTitle><DialogDescription>支持同一订单拆分多次发货。</DialogDescription></DialogHeader>
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="shipment-company">物流公司</Label><Input id="shipment-company" value={shipmentCompany} onChange={(event) => setShipmentCompany(event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="shipment-tracking-no">物流单号</Label><Input id="shipment-tracking-no" value={shipmentTrackingNo} onChange={(event) => setShipmentTrackingNo(event.target.value)} /></div>
              <div className="space-y-2"><Label>发货状态</Label><Select value={shipmentStatus} onValueChange={(value: ShopShipmentStatus) => setShipmentStatus(value)}><SelectTrigger><SelectValue placeholder="请选择发货状态" /></SelectTrigger><SelectContent><SelectItem value="pending">待处理</SelectItem><SelectItem value="shipped">已发货</SelectItem><SelectItem value="in_transit">运输中</SelectItem><SelectItem value="signed">已签收</SelectItem><SelectItem value="failed">物流异常</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="shipment-remark">轨迹备注</Label><Input id="shipment-remark" value={shipmentRemark} onChange={(event) => setShipmentRemark(event.target.value)} placeholder="可选，作为首条物流轨迹" /></div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <Table>
                <TableHeader><TableRow><TableHead>选择</TableHead><TableHead>商品</TableHead><TableHead>订单数量</TableHead><TableHead>已发数量</TableHead><TableHead>剩余可发</TableHead><TableHead>本次发货</TableHead></TableRow></TableHeader>
                <TableBody>{shippableItems.length === 0 ? <TableRow><TableCell colSpan={6} className="py-12 text-center text-slate-500">当前订单没有可发货商品</TableCell></TableRow> : shippableItems.map((item) => <TableRow key={item.id}><TableCell><Checkbox checked={shipmentItems[item.id]?.checked === true} onCheckedChange={(checked) => setShipmentItems((current) => ({ ...current, [item.id]: { checked: checked === true, quantity: current[item.id]?.quantity ?? `${item.remainingQuantity}` } }))} /></TableCell><TableCell><div className="space-y-1"><p className="font-medium text-slate-900">{item.productName}</p><p className="text-xs text-slate-500">明细 ID: {item.id}</p></div></TableCell><TableCell>{item.quantity}</TableCell><TableCell>{item.shippedQuantity}</TableCell><TableCell>{item.remainingQuantity}</TableCell><TableCell><Input type="number" min={0} max={item.remainingQuantity} value={shipmentItems[item.id]?.quantity ?? `${item.remainingQuantity}`} onChange={(event) => setShipmentItems((current) => ({ ...current, [item.id]: { checked: current[item.id]?.checked ?? true, quantity: event.target.value } }))} disabled={shipmentItems[item.id]?.checked === false} /></TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShipmentOpen(false)} disabled={shipmentSaving}>取消</Button><Button onClick={() => void handleCreateShipment()} disabled={shipmentSaving}>{shipmentSaving ? "创建中..." : "确认创建"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
