import { useDeferredValue, useEffect, useState } from "react";
import { Pencil, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Textarea } from "../../components/ui/textarea";
import { AdminShopShipmentListSummary, ShopShipment, ShopShipmentStatus, mockApi } from "../../lib/mockData";

type ShipmentStatusFilter = "all" | ShopShipmentStatus;

const PAGE_SIZE = 20;

const shipmentStatusMeta: Record<ShopShipmentStatus, { label: string; className: string }> = {
  pending: { label: "待处理", className: "bg-amber-100 text-amber-700" },
  shipped: { label: "已发货", className: "bg-blue-100 text-blue-700" },
  in_transit: { label: "运输中", className: "bg-indigo-100 text-indigo-700" },
  signed: { label: "已签收", className: "bg-emerald-100 text-emerald-700" },
  failed: { label: "物流异常", className: "bg-rose-100 text-rose-700" },
};

const SummaryCard = ({ title, value, description }: { title: string; value: number | string; description: string }) => (
  <Card className="rounded-2xl border-slate-200 shadow-none">
    <CardContent className="p-5">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </CardContent>
  </Card>
);

export function ShopShipmentList() {
  const [shipments, setShipments] = useState<ShopShipment[]>([]);
  const [summary, setSummary] = useState<AdminShopShipmentListSummary>({
    total: 0,
    pending: 0,
    shipped: 0,
    inTransit: 0,
    signed: 0,
    failed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [orderNo, setOrderNo] = useState("");
  const [phone, setPhone] = useState("");
  const [keyword, setKeyword] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [statusFilter, setStatusFilter] = useState<ShipmentStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editingShipment, setEditingShipment] = useState<ShopShipment | null>(null);
  const [editCompany, setEditCompany] = useState("");
  const [editTrackingNo, setEditTrackingNo] = useState("");
  const [editStatus, setEditStatus] = useState<ShopShipmentStatus>("shipped");
  const [editTrackContent, setEditTrackContent] = useState("");
  const [editTrackLocation, setEditTrackLocation] = useState("");

  const [trackOpen, setTrackOpen] = useState(false);
  const [trackSaving, setTrackSaving] = useState(false);
  const [trackShipment, setTrackShipment] = useState<ShopShipment | null>(null);
  const [trackContent, setTrackContent] = useState("");
  const [trackLocation, setTrackLocation] = useState("");
  const [trackTime, setTrackTime] = useState("");

  const deferredOrderNo = useDeferredValue(orderNo.trim());
  const deferredPhone = useDeferredValue(phone.trim());
  const deferredKeyword = useDeferredValue(keyword.trim());
  const deferredTrackingNo = useDeferredValue(trackingNo.trim());

  const loadShipments = async (options?: { keepLoading?: boolean }) => {
    if (options?.keepLoading !== false) {
      setLoading(true);
    }

    try {
      const result = await mockApi.getAdminShopShipments({
        orderNo: deferredOrderNo,
        phone: deferredPhone,
        keyword: deferredKeyword,
        trackingNo: deferredTrackingNo,
        status: statusFilter,
        page,
        pageSize: PAGE_SIZE,
      });
      setShipments(result.list);
      setTotal(result.pagination.total);
      setSummary(
        result.summary ?? {
          total: result.pagination.total,
          pending: result.list.filter((item) => item.status === "pending").length,
          shipped: result.list.filter((item) => item.status === "shipped").length,
          inTransit: result.list.filter((item) => item.status === "in_transit").length,
          signed: result.list.filter((item) => item.status === "signed").length,
          failed: result.list.filter((item) => item.status === "failed").length,
        },
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载发货单失败");
    } finally {
      if (options?.keepLoading !== false) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadShipments();
  }, [deferredOrderNo, deferredPhone, deferredKeyword, deferredTrackingNo, statusFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [deferredOrderNo, deferredPhone, deferredKeyword, deferredTrackingNo, statusFilter]);

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  const openEditDialog = (shipment: ShopShipment) => {
    setEditingShipment(shipment);
    setEditCompany(shipment.company);
    setEditTrackingNo(shipment.trackingNo);
    setEditStatus(shipment.status);
    setEditTrackContent("");
    setEditTrackLocation("");
    setEditOpen(true);
  };

  const openTrackDialog = (shipment: ShopShipment) => {
    setTrackShipment(shipment);
    setTrackContent("");
    setTrackLocation("");
    setTrackTime("");
    setTrackOpen(true);
  };

  const handleSaveShipment = async () => {
    if (!editingShipment) return;
    if (!editCompany.trim() || !editTrackingNo.trim()) {
      toast.error("请填写物流公司和物流单号");
      return;
    }

    setEditSaving(true);
    try {
      await mockApi.updateAdminShopShipment(editingShipment.id, {
        company: editCompany.trim(),
        trackingNo: editTrackingNo.trim(),
        status: editStatus,
        trackContent: editTrackContent.trim() || undefined,
        location: editTrackLocation.trim() || undefined,
      });
      toast.success("发货单已更新");
      setEditOpen(false);
      await loadShipments({ keepLoading: false });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新发货单失败");
    } finally {
      setEditSaving(false);
    }
  };

  const handleCreateTrack = async () => {
    if (!trackShipment) return;
    if (!trackContent.trim()) {
      toast.error("请输入轨迹内容");
      return;
    }

    setTrackSaving(true);
    try {
      await mockApi.createAdminShopShipmentTrack(trackShipment.id, {
        content: trackContent.trim(),
        location: trackLocation.trim() || undefined,
        trackTime: trackTime ? `${trackTime}:00` : undefined,
      });
      toast.success("物流轨迹已添加");
      setTrackOpen(false);
      await loadShipments({ keepLoading: false });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "添加物流轨迹失败");
    } finally {
      setTrackSaving(false);
    }
  };

  return (
    <>
      <div className="p-8">
        <div className="rounded-3xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-8 py-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">发货管理</h1>
                <p className="mt-2 text-sm text-slate-500">统一查看发货单、修改物流状态，并补录人工轨迹。</p>
              </div>
              <Button variant="outline" onClick={() => void loadShipments()}>
                <RefreshCw className="mr-2 size-4" />
                刷新发货单
              </Button>
            </div>
          </div>

          <div className="space-y-6 px-8 py-6">
            <div className="grid gap-4 xl:grid-cols-4">
              <SummaryCard title="当前结果" value={summary.total} description="当前筛选结果中的发货单数量" />
              <SummaryCard title="已发货" value={summary.shipped} description="已出库待签收的发货单" />
              <SummaryCard title="运输中" value={summary.inTransit} description="运输途中的发货单数量" />
              <SummaryCard title="已签收" value={summary.signed} description="已完成签收的发货单" />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr_1fr_180px_auto]">
              <Input placeholder="订单号" value={orderNo} onChange={(event) => setOrderNo(event.target.value)} />
              <Input placeholder="手机号" value={phone} onChange={(event) => setPhone(event.target.value)} />
              <Input placeholder="物流公司 / 商品关键词" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
              <Input placeholder="物流单号" value={trackingNo} onChange={(event) => setTrackingNo(event.target.value)} />
              <Select value={statusFilter} onValueChange={(value: ShipmentStatusFilter) => setStatusFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="发货状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="pending">待处理</SelectItem>
                  <SelectItem value="shipped">已发货</SelectItem>
                  <SelectItem value="in_transit">运输中</SelectItem>
                  <SelectItem value="signed">已签收</SelectItem>
                  <SelectItem value="failed">物流异常</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => {
                  setOrderNo("");
                  setPhone("");
                  setKeyword("");
                  setTrackingNo("");
                  setStatusFilter("all");
                }}
              >
                重置
              </Button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>发货单</TableHead>
                    <TableHead>订单号</TableHead>
                    <TableHead>用户</TableHead>
                    <TableHead>物流状态</TableHead>
                    <TableHead>物流信息</TableHead>
                    <TableHead>商品数</TableHead>
                    <TableHead>最新轨迹</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-14 text-center text-slate-500">
                        发货单加载中...
                      </TableCell>
                    </TableRow>
                  ) : shipments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-14 text-center text-slate-500">
                        暂无发货单
                      </TableCell>
                    </TableRow>
                  ) : (
                    shipments.map((shipment) => (
                      <TableRow key={shipment.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-slate-900">{shipment.id}</p>
                            <p className="text-xs text-slate-500">创建于 {shipment.createdAt}</p>
                          </div>
                        </TableCell>
                        <TableCell>{shipment.orderNo || "-"}</TableCell>
                        <TableCell>{shipment.userPhone || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={shipmentStatusMeta[shipment.status].className}>
                            {shipmentStatusMeta[shipment.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-slate-900">{shipment.company || "-"}</p>
                            <p className="text-xs text-slate-500">{shipment.trackingNo || "-"}</p>
                          </div>
                        </TableCell>
                        <TableCell>{shipment.items.length}</TableCell>
                        <TableCell className="max-w-[260px] whitespace-normal text-sm text-slate-600">
                          {shipment.latestTrack ? (
                            <div className="space-y-1">
                              <p>{shipment.latestTrack.content}</p>
                              <p className="text-xs text-slate-500">{shipment.latestTrack.trackTime}</p>
                            </div>
                          ) : (
                            <span className="text-slate-400">暂无轨迹</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => openEditDialog(shipment)}>
                              <Pencil className="mr-2 size-4" />
                              编辑
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => openTrackDialog(shipment)}>
                              <Plus className="mr-2 size-4" />
                              补录轨迹
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p>
                共 {total} 条，当前第 {page} / {totalPages} 页
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))}>
                  上一页
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(current + 1, totalPages))}>
                  下一页
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑发货单</DialogTitle>
            <DialogDescription>可修改物流公司、单号、状态，并附带补充一条轨迹。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>物流公司</Label>
              <Input value={editCompany} onChange={(event) => setEditCompany(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>物流单号</Label>
              <Input value={editTrackingNo} onChange={(event) => setEditTrackingNo(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>物流状态</Label>
              <Select value={editStatus} onValueChange={(value: ShopShipmentStatus) => setEditStatus(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择物流状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">待处理</SelectItem>
                  <SelectItem value="shipped">已发货</SelectItem>
                  <SelectItem value="in_transit">运输中</SelectItem>
                  <SelectItem value="signed">已签收</SelectItem>
                  <SelectItem value="failed">物流异常</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>附加轨迹内容</Label>
              <Textarea rows={3} value={editTrackContent} onChange={(event) => setEditTrackContent(event.target.value)} placeholder="可选，随本次更新一起写入轨迹。" />
            </div>
            <div className="space-y-2">
              <Label>轨迹地点</Label>
              <Input value={editTrackLocation} onChange={(event) => setEditTrackLocation(event.target.value)} placeholder="可选" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>
              取消
            </Button>
            <Button onClick={() => void handleSaveShipment()} disabled={editSaving}>
              {editSaving ? "保存中..." : "保存发货单"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={trackOpen} onOpenChange={setTrackOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增物流轨迹</DialogTitle>
            <DialogDescription>{trackShipment ? `当前发货单 ${trackShipment.trackingNo || trackShipment.id}` : "为发货单补录一条人工轨迹。"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>轨迹内容</Label>
              <Textarea rows={3} value={trackContent} onChange={(event) => setTrackContent(event.target.value)} placeholder="例如：包裹已由上海分拨中心发出。" />
            </div>
            <div className="space-y-2">
              <Label>轨迹地点</Label>
              <Input value={trackLocation} onChange={(event) => setTrackLocation(event.target.value)} placeholder="可选" />
            </div>
            <div className="space-y-2">
              <Label>轨迹时间</Label>
              <Input type="datetime-local" value={trackTime} onChange={(event) => setTrackTime(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrackOpen(false)} disabled={trackSaving}>
              取消
            </Button>
            <Button onClick={() => void handleCreateTrack()} disabled={trackSaving}>
              {trackSaving ? "提交中..." : "添加轨迹"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
