import { useDeferredValue, useEffect, useState } from "react";
import { Database, RefreshCw, Scale, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import type { LawAdminSummary, LawRecordMeta, PagedResult } from "../../lib/mockData";
import { mockApi } from "../../lib/mockData";

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
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const deferredKeyword = useDeferredValue(keyword.trim());

  useEffect(() => {
    setPage(1);
  }, [deferredKeyword, topCategoryId]);

  useEffect(() => {
    let active = true;

    const loadSummary = async () => {
      try {
        const data = await mockApi.getAdminLawSummary();
        if (!active) return;
        setSummary(data);
      } catch (error) {
        if (!active) return;
        toast.error("法条统计加载失败");
      }
    };

    void loadSummary();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);

    const loadEntries = async () => {
      try {
        const data = await mockApi.getAdminLawEntries({
          keyword: deferredKeyword,
          topCategoryId,
          page,
          pageSize: 20,
        });
        if (!active) return;
        setEntries(data);
      } catch (error) {
        if (!active) return;
        toast.error("法条列表加载失败");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadEntries();

    return () => {
      active = false;
    };
  }, [deferredKeyword, page, topCategoryId]);

  const refreshAll = async () => {
    const [nextSummary, nextEntries] = await Promise.all([
      mockApi.getAdminLawSummary(),
      mockApi.getAdminLawEntries({
        keyword: deferredKeyword,
        topCategoryId,
        page,
        pageSize: 20,
      }),
    ]);

    setSummary(nextSummary);
    setEntries(nextEntries);
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const result = await mockApi.syncAdminLaws();
      toast.success(`法条数据同步完成，共 ${result.totalRecords} 条`);
      await refreshAll();
    } catch (error) {
      toast.error("法条数据同步失败");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-8">
      <div className="rounded-3xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-8 py-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
                  <Scale className="size-5" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-slate-900">法条检索管理</h1>
                  <p className="mt-1 text-sm text-slate-500">统一维护法条数据库，并给用户端提供目录浏览和关键词检索。</p>
                </div>
              </div>
            </div>

            <Button onClick={() => void handleSync()} disabled={syncing} className="rounded-2xl">
              <RefreshCw className={syncing ? "mr-2 size-4 animate-spin" : "mr-2 size-4"} />
              {syncing ? "同步中..." : "同步远程法条"}
            </Button>
          </div>
        </div>

        <div className="space-y-6 px-8 py-6">
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-500">法条记录总数</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{summary?.totalRecords ?? 0}</p>
              <p className="mt-2 text-sm text-slate-500">当前数据库内可检索内容</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="text-sm text-amber-700">顶级分类</p>
              <p className="mt-2 text-3xl font-semibold text-amber-900">{summary?.topCategoryCount ?? 0}</p>
              <p className="mt-2 text-sm text-amber-800">例如宪法、民法、商法</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-sm text-emerald-700">最近同步时间</p>
              <p className="mt-2 text-xl font-semibold text-emerald-900">{summary?.lastUpdated || "未同步"}</p>
              <p className="mt-2 text-sm text-emerald-800">用户端展示以此为准</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_260px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="按法条标题、目录路径搜索"
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

            <Button
              variant="outline"
              onClick={() => {
                setKeyword("");
                setTopCategoryId("all");
                setPage(1);
              }}
            >
              重置
            </Button>
          </div>

          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            这套法条数据现在完全走数据库。同步完成后，用户端导航里的“法条”会直接读取这里的数据。
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>分类</TableHead>
                  <TableHead>法条标题</TableHead>
                  <TableHead>所属法典</TableHead>
                  <TableHead>目录路径</TableHead>
                  <TableHead>更新时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-14 text-center text-slate-500">
                      法条列表加载中...
                    </TableCell>
                  </TableRow>
                ) : entries.items.length > 0 ? (
                  entries.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-100">
                          {item.topCategoryTitle}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">{item.title}</TableCell>
                      <TableCell>{item.bookTitle || "-"}</TableCell>
                      <TableCell>
                        <div className="max-w-[520px] whitespace-normal text-sm leading-6 text-slate-600">{item.pathString}</div>
                      </TableCell>
                      <TableCell>{item.updatedAt || "-"}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="py-14 text-center text-slate-500">
                      暂无数据，请先执行同步。
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
    </div>
  );
}
