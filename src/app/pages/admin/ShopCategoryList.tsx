import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { mockApi, ShopCategory } from "../../lib/mockData";

type CategoryStatusFilter = "all" | "enabled" | "disabled";

const statusMeta = {
  enabled: { label: "启用", className: "bg-emerald-100 text-emerald-700" },
  disabled: { label: "停用", className: "bg-slate-100 text-slate-700" },
} as const;

export function ShopCategoryList() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<CategoryStatusFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ShopCategory | null>(null);
  const [formName, setFormName] = useState("");
  const [formSortOrder, setFormSortOrder] = useState("0");
  const [formStatus, setFormStatus] = useState(true);
  const deferredKeyword = useDeferredValue(keyword.trim());

  const loadCategories = async (options?: { keepLoading?: boolean }) => {
    if (options?.keepLoading !== false) setLoading(true);
    try {
      const list = await mockApi.getAdminShopCategories({ keyword: deferredKeyword, status: statusFilter });
      setCategories(list);
    } catch (_error) {
      toast.error("加载商品分类失败");
    } finally {
      if (options?.keepLoading !== false) setLoading(false);
    }
  };

  useEffect(() => {
    void loadCategories();
  }, [deferredKeyword, statusFilter]);

  const summary = useMemo(
    () => ({
      total: categories.length,
      enabled: categories.filter((item) => item.status).length,
      disabled: categories.filter((item) => !item.status).length,
      products: categories.reduce((sum, item) => sum + item.productCount, 0),
    }),
    [categories],
  );

  const resetForm = () => {
    setEditingCategory(null);
    setFormName("");
    setFormSortOrder("0");
    setFormStatus(true);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (category: ShopCategory) => {
    setEditingCategory(category);
    setFormName(category.name);
    setFormSortOrder(`${category.sortOrder}`);
    setFormStatus(category.status);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const name = formName.trim();
    const sortOrder = Number.parseInt(formSortOrder, 10) || 0;
    if (!name) return toast.error("请输入分类名称");
    setSaving(true);
    try {
      if (editingCategory) {
        await mockApi.updateAdminShopCategory(editingCategory.id, { name, sortOrder, status: formStatus });
        toast.success("分类已更新");
      } else {
        await mockApi.createAdminShopCategory({ name, sortOrder, status: formStatus });
        toast.success("分类已创建");
      }
      setDialogOpen(false);
      resetForm();
      await loadCategories({ keepLoading: false });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存分类失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (category: ShopCategory) => {
    if (!window.confirm(`确认删除分类“${category.name}”吗？`)) return;
    try {
      await mockApi.deleteAdminShopCategory(category.id);
      toast.success("分类已删除");
      await loadCategories({ keepLoading: false });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除分类失败");
    }
  };

  if (loading) return <div className="p-8 text-slate-500">商品分类加载中...</div>;

  return (
    <div className="p-8">
      <div className="rounded-3xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-8 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">商品分类</h1>
              <p className="mt-2 text-sm text-slate-500">维护商城分类名称、排序和启停状态。删除分类前请先清空分类下商品。</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate("/admin/shop/products")}>查看商品</Button>
              <Button onClick={openCreateDialog}><Plus className="mr-2 size-4" />新建分类</Button>
            </div>
          </div>
        </div>

        <div className="space-y-6 px-8 py-6">
          <div className="grid gap-4 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">分类总数</p><p className="mt-2 text-3xl font-semibold text-slate-900">{summary.total}</p></div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-sm text-emerald-700">启用</p><p className="mt-2 text-3xl font-semibold text-emerald-800">{summary.enabled}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><p className="text-sm text-slate-600">停用</p><p className="mt-2 text-3xl font-semibold text-slate-900">{summary.disabled}</p></div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5"><p className="text-sm text-blue-700">商品总数</p><p className="mt-2 text-3xl font-semibold text-blue-900">{summary.products}</p></div>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_220px_auto]">
            <Input placeholder="按分类名称搜索" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
            <Select value={statusFilter} onValueChange={(value: CategoryStatusFilter) => setStatusFilter(value)}>
              <SelectTrigger><SelectValue placeholder="分类状态" /></SelectTrigger>
              <SelectContent><SelectItem value="all">全部状态</SelectItem><SelectItem value="enabled">仅启用</SelectItem><SelectItem value="disabled">仅停用</SelectItem></SelectContent>
            </Select>
            <Button variant="outline" onClick={() => { setKeyword(""); setStatusFilter("all"); }}>重置</Button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <Table>
              <TableHeader><TableRow><TableHead>分类名称</TableHead><TableHead>排序</TableHead><TableHead>商品数</TableHead><TableHead>状态</TableHead><TableHead>更新时间</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
              <TableBody>
                {categories.map((category) => <TableRow key={category.id}><TableCell className="font-medium text-slate-900">{category.name}</TableCell><TableCell>{category.sortOrder}</TableCell><TableCell>{category.productCount}</TableCell><TableCell><Badge variant="secondary" className={category.status ? statusMeta.enabled.className : statusMeta.disabled.className}>{category.status ? statusMeta.enabled.label : statusMeta.disabled.label}</Badge></TableCell><TableCell>{category.updatedAt}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => openEditDialog(category)}><Pencil className="mr-2 size-4" />编辑</Button><Button variant="destructive" size="sm" onClick={() => void handleDelete(category)}><Trash2 className="mr-2 size-4" />删除</Button></div></TableCell></TableRow>)}
                {categories.length === 0 ? <TableRow><TableCell colSpan={6} className="py-14 text-center text-slate-500">暂无商品分类</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!saving) { setDialogOpen(open); if (!open) resetForm(); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCategory ? "编辑商品分类" : "新建商品分类"}</DialogTitle><DialogDescription>分类用于前台商品分组与后台筛选，排序值越小越靠前。</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label htmlFor="shop-category-name">分类名称</Label><Input id="shop-category-name" value={formName} onChange={(event) => setFormName(event.target.value)} placeholder="请输入分类名称" /></div>
            <div className="space-y-2"><Label htmlFor="shop-category-sort-order">排序值</Label><Input id="shop-category-sort-order" type="number" min={0} value={formSortOrder} onChange={(event) => setFormSortOrder(event.target.value)} /></div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><div><p className="text-sm font-medium text-slate-900">启用状态</p><p className="mt-1 text-sm text-slate-500">停用后该分类不会在商城前台展示。</p></div><Switch checked={formStatus} onCheckedChange={setFormStatus} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>取消</Button><Button onClick={() => void handleSave()} disabled={saving}>{saving ? "保存中..." : editingCategory ? "保存分类" : "创建分类"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
