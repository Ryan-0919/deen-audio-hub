import { useDeferredValue, useEffect, useState } from "react";
import { BadgePlus, Database, Eye, EyeOff, Pin, RefreshCw, Scale, Search, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Textarea } from "../../components/ui/textarea";
import type { LawAdminSummary, LawRecordMeta, PagedResult } from "../../lib/mockData";
import { mockApi } from "../../lib/mockData";

type VisibilityFilter = "all" | "published" | "hidden";

type LawEditFormState = {
  customTitle: string;
  manualSortOrder: string;
  tags: string;
  operatorNote: string;
};

const createLawEditForm = (entry: LawRecordMeta | null): LawEditFormState => ({
  customTitle: entry?.customTitle ?? "",
  manualSortOrder: entry && entry.manualSortOrder > 0 ? `${entry.manualSortOrder}` : "",
  tags: entry?.tags?.join("，") ?? "",
  operatorNote: entry?.operatorNote ?? "",
});

export function LawAdmin() {
  const [summary, setSummary] = useState<LawAdminSummary | null>(null);
  const [entries, setEntries] = useState<PagedResult<LawRecordMeta>>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  });
  const [keyword, setKeyword] = useState("");
  const [topCategoryId, setTopCategoryId] = useState("all");
  const [visibility, setVisibility] = useState<VisibilityFilter>("all");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [savingSourceLawId, setSavingSourceLawId] = useState<number | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LawRecordMeta | null>(null);
  const [editForm, setEditForm] = useState<LawEditFormState>(createLawEditForm(null));
  const [editSaving, setEditSaving] = useState(false);
  const deferredKeyword = useDeferredValue(keyword.trim());

  useEffect(() => {
    setPage(1);
  }, [deferredKeyword, pinnedOnly, topCategoryId, visibility]);

  const loadSummary = async () => {
    const data = await mockApi.getAdminLawSummary();
    setSummary(data);
  };

  const loadEntries = async (nextPage = page) => {
    setLoading(true);
    try {
      const data = await mockApi.getAdminLawEntries({
        keyword: deferredKeyword,
        topCategoryId,
        visibility,
        pinnedOnly,
        page: nextPage,
        pageSize: 20,
      });
      setEntries(data);
      if (data.page !== nextPage) {
        setPage(data.page);
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshAll = async (options?: { resetPage?: boolean }) => {
    const nextPage = options?.resetPage ? 1 : page;
    if (options?.resetPage) {
      setPage(1);
    }
    await Promise.all([loadSummary(), loadEntries(nextPage)]);
  };

  useEffect(() => {
    let active = true;

    const boot = async () => {
      try {
        const [nextSummary, nextEntries] = await Promise.all([
          mockApi.getAdminLawSummary(),
          mockApi.getAdminLawEntries({
            keyword: deferredKeyword,
            topCategoryId,
            visibility,
            pinnedOnly,
            page,
            pageSize: 20,
          }),
        ]);

        if (!active) return;
        setSummary(nextSummary);
        setEntries(nextEntries);
      } catch (error) {
        if (!active) return;
        toast.error(error instanceof Error ? error.message : "法条数据加载失败");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void boot();

    return () => {
      active = false;
    };
  }, [deferredKeyword, page, pinnedOnly, topCategoryId, visibility]);

  const handleSync = async () => {
    try {
      setSyncing(true);
      const result = await mockApi.syncAdminLaws();
      toast.success(`法条同步完成，共 ${result.totalRecords} 条`);
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "法条同步失败");
    } finally {
      setSyncing(false);
    }
  };

  const patchEntryInList = (updated: LawRecordMeta) => {
    setEntries((current) => ({
      ...current,
      items: current.items.map((item) => (item.sourceLawId === updated.sourceLawId ? updated : item)),
    }));
  };

  const handleQuickToggle = async (entry: LawRecordMeta, field: "isPublished" | "isPinned", nextValue: boolean) => {
    try {
      setSavingSourceLawId(entry.sourceLawId);
      const updated = await mockApi.updateAdminLawEntry(entry.sourceLawId, {
        [field]: nextValue,
      });
      patchEntryInList(updated);
      await loadSummary();
      toast.success(field === "isPublished" ? (nextValue ? "已恢复展示" : "已隐藏该法条") : nextValue ? "已置顶该法条" : "已取消置顶");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "法条配置保存失败");
    } finally {
      setSavingSourceLawId(null);
    }
  };

  const openEditDialog = (entry: LawRecordMeta) => {
    setEditingEntry(entry);
    setEditForm(createLawEditForm(entry));
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) {
      return;
    }

    try {
      setEditSaving(true);
      const updated = await mockApi.updateAdminLawEntry(editingEntry.sourceLawId, {
        customTitle: editForm.customTitle,
        manualSortOrder: editForm.manualSortOrder,
        tags: editForm.tags,
        operatorNote: editForm.operatorNote,
      });
      patchEntryInList(updated);
      setEditingEntry(updated);
      await loadSummary();
      setEditDialogOpen(false);
      toast.success("法条运营配置已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="p-8">
      <div className="rounded-3xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-8 py-6">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
                <Scale className="size-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">法条检索管理</h1>
                <p className="mt-1 text-sm text-slate-500">
                  现在不只是同步法条数据，还可以直接控制用户端展示、置顶顺序、展示标题与运营备注。
                </p>
              </div>
            </div>

            <Button onClick={() => void handleSync()} disabled={syncing} className="rounded-2xl">
              <RefreshCw className={syncing ? "mr-2 size-4 animate-spin" : "mr-2 size-4"} />
              {syncing ? "同步中..." : "同步远程法条"}
            </Button>
          </div>
        </div>

        <div className="space-y-6 px-8 py-6">
          <div className="grid gap-4 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-500">法条总数</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{summary?.totalRecords ?? 0}</p>
              <p className="mt-2 text-sm text-slate-500">同步后的全部源数据</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-sm text-emerald-700">前台可见</p>
              <p className="mt-2 text-3xl font-semibold text-emerald-900">{summary?.publishedRecords ?? 0}</p>
              <p className="mt-2 text-sm text-emerald-800">用户端法条检索实际可见</p>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
              <p className="text-sm text-rose-700">已隐藏</p>
              <p className="mt-2 text-3xl font-semibold text-rose-900">{summary?.hiddenRecords ?? 0}</p>
              <p className="mt-2 text-sm text-rose-800">后台保留但用户端不展示</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="text-sm text-amber-700">置顶法条</p>
              <p className="mt-2 text-3xl font-semibold text-amber-900">{summary?.pinnedRecords ?? 0}</p>
              <p className="mt-2 text-sm text-amber-800">优先展示的重要法条</p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_220px_180px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索标题、展示标题、目录路径、标签或备注"
                className="pl-10"
              />
            </div>

            <Select value={topCategoryId} onValueChange={setTopCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="顶级分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分类</SelectItem>
                {(summary?.topCategories ?? []).map((item) => (
                  <SelectItem key={item.id} value={`${item.id}`}>
                    {item.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={visibility} onValueChange={(value) => setVisibility(value as VisibilityFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="展示状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="published">仅显示中</SelectItem>
                <SelectItem value="hidden">仅已隐藏</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => {
                setKeyword("");
                setTopCategoryId("all");
                setVisibility("all");
                setPinnedOnly(false);
                setPage(1);
              }}
            >
              重置
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <Database className="size-4 text-slate-700" />
              <span>用户端法条检索现在直接吃这里的展示状态和置顶规则，同步源数据不会覆盖运营设置。</span>
            </div>

            <label className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <Pin className="size-4 text-amber-600" />
              <span>只看置顶</span>
              <Switch checked={pinnedOnly} onCheckedChange={setPinnedOnly} />
            </label>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>状态</TableHead>
                  <TableHead>展示标题</TableHead>
                  <TableHead>所属法典</TableHead>
                  <TableHead>目录路径</TableHead>
                  <TableHead>标签 / 备注</TableHead>
                  <TableHead className="w-[240px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-14 text-center text-slate-500">
                      法条列表加载中...
                    </TableCell>
                  </TableRow>
                ) : entries.items.length > 0 ? (
                  entries.items.map((item) => {
                    const currentSaving = savingSourceLawId === item.sourceLawId;

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex flex-col gap-2">
                            <Badge
                              variant="secondary"
                              className={item.isPublished ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-50" : "bg-rose-50 text-rose-700 hover:bg-rose-50"}
                            >
                              {item.isPublished ? "前台显示" : "前台隐藏"}
                            </Badge>
                            {item.isPinned ? (
                              <Badge variant="secondary" className="bg-amber-50 text-amber-700 hover:bg-amber-50">
                                已置顶
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-slate-900">{item.displayTitle}</p>
                            {item.customTitle ? <p className="text-xs text-slate-500">原始标题：{item.title}</p> : null}
                          </div>
                        </TableCell>
                        <TableCell>{item.bookTitle || "-"}</TableCell>
                        <TableCell>
                          <div className="max-w-[420px] whitespace-normal text-sm leading-6 text-slate-600">{item.pathString}</div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[260px] space-y-2">
                            {item.tags.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {item.tags.map((tag) => (
                                  <Badge key={tag} variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-100">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-sm text-slate-400">暂无标签</span>
                            )}
                            {item.operatorNote ? <p className="line-clamp-2 text-xs leading-5 text-slate-500">{item.operatorNote}</p> : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={currentSaving}
                              onClick={() => void handleQuickToggle(item, "isPublished", !item.isPublished)}
                            >
                              {item.isPublished ? <EyeOff className="mr-2 size-4" /> : <Eye className="mr-2 size-4" />}
                              {item.isPublished ? "隐藏" : "显示"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={currentSaving}
                              onClick={() => void handleQuickToggle(item, "isPinned", !item.isPinned)}
                            >
                              <Pin className="mr-2 size-4" />
                              {item.isPinned ? "取消置顶" : "置顶"}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => openEditDialog(item)}>
                              <Settings2 className="mr-2 size-4" />
                              编辑
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="py-14 text-center text-slate-500">
                      暂无匹配法条，请调整筛选条件。
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Database className="size-4 text-slate-700" />
              <span>
                第 {entries.page} / {entries.totalPages} 页，共 {entries.total} 条
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setPage((current) => Math.max(current - 1, 1))} disabled={entries.page <= 1}>
                上一页
              </Button>
              <Button
                variant="outline"
                onClick={() => setPage((current) => Math.min(current + 1, entries.totalPages))}
                disabled={entries.page >= entries.totalPages}
              >
                下一页
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          if (editSaving) return;
          setEditDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑法条展示配置</DialogTitle>
            <DialogDescription>
              这里改的是用户端法条检索的运营展示，不会改动远程同步回来的原始法条内容。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>展示标题</Label>
                <Input
                  value={editForm.customTitle}
                  onChange={(event) => setEditForm((current) => ({ ...current, customTitle: event.target.value }))}
                  placeholder="留空则使用原始标题"
                />
              </div>

              <div className="space-y-2">
                <Label>手动排序值</Label>
                <Input
                  value={editForm.manualSortOrder}
                  onChange={(event) => setEditForm((current) => ({ ...current, manualSortOrder: event.target.value }))}
                  placeholder="数字越小越靠前，留空按默认顺序"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>标签</Label>
              <Input
                value={editForm.tags}
                onChange={(event) => setEditForm((current) => ({ ...current, tags: event.target.value }))}
                placeholder="多个标签用逗号或顿号分隔"
              />
            </div>

            <div className="space-y-2">
              <Label>运营备注</Label>
              <Textarea
                rows={6}
                value={editForm.operatorNote}
                onChange={(event) => setEditForm((current) => ({ ...current, operatorNote: event.target.value }))}
                placeholder="这里可以记录适用场景、推荐理由、搜索引导词等运营备注"
              />
            </div>

            {editingEntry ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                <div className="flex items-center gap-2 font-medium text-slate-900">
                  <BadgePlus className="size-4 text-slate-500" />
                  <span>当前原始信息</span>
                </div>
                <p className="mt-3">原始标题：{editingEntry.title}</p>
                <p className="mt-1">所属法典：{editingEntry.bookTitle || "-"}</p>
                <p className="mt-1 leading-6">目录路径：{editingEntry.pathString}</p>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={editSaving}>
              取消
            </Button>
            <Button onClick={() => void handleSaveEdit()} disabled={editSaving}>
              {editSaving ? "保存中..." : "保存配置"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
