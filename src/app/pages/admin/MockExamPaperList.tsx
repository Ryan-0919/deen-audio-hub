import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Textarea } from "../../components/ui/textarea";
import {
  type AdminMockExamPaperListPayload,
  type AdminMockExamPaperStatus,
  type AdminMockExamPaperSummary,
  type AdminMockExamPaperType,
  type AdminMockExamSeriesOption,
  type AdminMockExamSeriesPayload,
  mockApi,
} from "../../lib/mockData";

const EMPTY_PAYLOAD: AdminMockExamPaperListPayload = {
  list: [],
  summary: {
    total: 0,
    published: 0,
    draft: 0,
    objective: 0,
    subjective: 0,
  },
};

const EMPTY_SERIES_FORM: AdminMockExamSeriesPayload = {
  name: "",
  description: "",
  sortOrder: "",
};

const paperTypeMeta: Record<AdminMockExamPaperType, { label: string; className: string }> = {
  objective: { label: "客观题", className: "bg-blue-50 text-blue-700" },
  subjective: { label: "主观题", className: "bg-violet-50 text-violet-700" },
};

const paperStatusMeta: Record<AdminMockExamPaperStatus, { label: string; className: string }> = {
  published: { label: "已发布", className: "bg-emerald-100 text-emerald-700" },
  draft: { label: "草稿", className: "bg-slate-100 text-slate-700" },
};

const buildPaperSearchText = (paper: AdminMockExamPaperSummary) =>
  [paper.title, paper.subtitle, paper.code, paper.phase, paper.seriesName, paper.year ? `${paper.year}` : ""].join(" ").toLowerCase();

const buildSectionSummary = (paper: AdminMockExamPaperSummary) => paper.sections.map((section) => `${section.label}${section.count}题`).join(" / ");

const buildSeriesMetaText = (series: AdminMockExamSeriesOption, papers: AdminMockExamPaperSummary[]) => {
  const linkedPapers = papers.filter((paper) => paper.seriesId === series.id);
  const total = linkedPapers.length;
  const published = linkedPapers.filter((paper) => paper.status === "published").length;
  return [`共 ${total} 套试卷`, `已发布 ${published} 套`, `排序 ${series.sortOrder}`].join(" · ");
};

export function MockExamPaperList() {
  const [payload, setPayload] = useState<AdminMockExamPaperListPayload>(EMPTY_PAYLOAD);
  const [seriesOptions, setSeriesOptions] = useState<AdminMockExamSeriesOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingPaperId, setDeletingPaperId] = useState("");
  const [savingSeries, setSavingSeries] = useState(false);
  const [deletingSeriesId, setDeletingSeriesId] = useState("");
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AdminMockExamPaperStatus>("all");
  const [paperType, setPaperType] = useState<AdminMockExamPaperType>("objective");
  const [showSeriesDialog, setShowSeriesDialog] = useState(false);
  const [editingSeries, setEditingSeries] = useState<AdminMockExamSeriesOption | null>(null);
  const [seriesForm, setSeriesForm] = useState<AdminMockExamSeriesPayload>(EMPTY_SERIES_FORM);
  const deferredKeyword = useDeferredValue(keyword.trim().toLowerCase());

  const loadData = async () => {
    try {
      setLoading(true);
      const [papers, series] = await Promise.all([mockApi.getAdminMockExamPapers(), mockApi.getAdminMockExamSeries()]);
      setPayload(papers);
      setSeriesOptions(series);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载机考试卷失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredPapers = useMemo(() => {
    return payload.list.filter((paper) => {
      if (statusFilter !== "all" && paper.status !== statusFilter) {
        return false;
      }

      if (!deferredKeyword) {
        return true;
      }

      return buildPaperSearchText(paper).includes(deferredKeyword);
    });
  }, [deferredKeyword, payload.list, statusFilter]);

  const objectivePapers = useMemo(() => filteredPapers.filter((paper) => paper.paperType === "objective"), [filteredPapers]);
  const subjectivePapers = useMemo(() => filteredPapers.filter((paper) => paper.paperType === "subjective"), [filteredPapers]);
  const ungroupedCount = useMemo(() => payload.list.filter((paper) => !paper.seriesId).length, [payload.list]);

  useEffect(() => {
    if (paperType === "objective" && objectivePapers.length === 0 && subjectivePapers.length > 0) {
      setPaperType("subjective");
      return;
    }

    if (paperType === "subjective" && subjectivePapers.length === 0 && objectivePapers.length > 0) {
      setPaperType("objective");
    }
  }, [objectivePapers.length, paperType, subjectivePapers.length]);

  const resetSeriesDialog = () => {
    setEditingSeries(null);
    setSeriesForm(EMPTY_SERIES_FORM);
  };

  const openCreateSeriesDialog = () => {
    resetSeriesDialog();
    setShowSeriesDialog(true);
  };

  const openEditSeriesDialog = (series: AdminMockExamSeriesOption) => {
    setEditingSeries(series);
    setSeriesForm({
      name: series.name,
      description: series.description,
      sortOrder: `${series.sortOrder}`,
    });
    setShowSeriesDialog(true);
  };

  const handleDeletePaper = async (paper: AdminMockExamPaperSummary) => {
    try {
      setDeletingPaperId(paper.id);
      await mockApi.deleteAdminMockExamPaper(paper.id);
      toast.success("试卷已删除");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除试卷失败");
    } finally {
      setDeletingPaperId("");
    }
  };

  const handleSaveSeries = async () => {
    if (!seriesForm.name?.trim()) {
      toast.error("请输入机考课程名称");
      return;
    }

    try {
      setSavingSeries(true);
      if (editingSeries) {
        await mockApi.updateAdminMockExamSeries(editingSeries.id, seriesForm);
        toast.success("机考课程已更新");
      } else {
        await mockApi.createAdminMockExamSeries(seriesForm);
        toast.success("机考课程已创建");
      }
      setShowSeriesDialog(false);
      resetSeriesDialog();
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存机考课程失败");
    } finally {
      setSavingSeries(false);
    }
  };

  const handleDeleteSeries = async (series: AdminMockExamSeriesOption) => {
    try {
      setDeletingSeriesId(series.id);
      await mockApi.deleteAdminMockExamSeries(series.id);
      toast.success("机考课程已删除");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除机考课程失败");
    } finally {
      setDeletingSeriesId("");
    }
  };

  const renderTable = (papers: AdminMockExamPaperSummary[], currentType: AdminMockExamPaperType) => (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>试卷</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>开放时间</TableHead>
            <TableHead>题量 / 总分</TableHead>
            <TableHead>考试时长</TableHead>
            <TableHead>次数限制</TableHead>
            <TableHead>权限</TableHead>
            <TableHead>批改</TableHead>
            <TableHead>及格线</TableHead>
            <TableHead>题型结构</TableHead>
            <TableHead>更新时间</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {papers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={12} className="py-10 text-center text-sm text-slate-500">
                当前筛选条件下没有{paperTypeMeta[currentType].label}试卷
              </TableCell>
            </TableRow>
          ) : (
            papers.map((paper) => (
              <TableRow key={paper.id}>
                <TableCell>
                  <div className="flex items-center gap-4">
                    <img src={paper.coverUrl} alt={paper.title} className="h-16 w-28 rounded-2xl object-cover ring-1 ring-black/[0.04]" />
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900">{paper.title}</p>
                        <Badge className={paperTypeMeta[paper.paperType].className}>{paperTypeMeta[paper.paperType].label}</Badge>
                      </div>
                      <div className="text-xs text-slate-500">
                        {[paper.seriesName || "未归属机考课程", paper.phase, paper.year ? `${paper.year}年` : "", paper.code].filter(Boolean).join(" · ")}
                      </div>
                      {paper.subtitle ? <div className="text-xs text-slate-500">{paper.subtitle}</div> : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={paperStatusMeta[paper.status].className}>{paperStatusMeta[paper.status].label}</Badge>
                </TableCell>
                <TableCell>{paper.openTime || "立即开放"}</TableCell>
                <TableCell>
                  {paper.questionCount} 题 / {paper.totalScore} 分
                </TableCell>
                <TableCell>{paper.durationMinutes} 分钟</TableCell>
                <TableCell>{paper.maxAttempts > 0 ? `${paper.maxAttempts} 次` : "不限"}</TableCell>
                <TableCell>{paper.permissionRequired ? "需开通" : "默认开放"}</TableCell>
                <TableCell>
                  {paper.reviewEnabled
                    ? paper.reviewAttemptLimit > 0
                      ? `前 ${paper.reviewAttemptLimit} 次批改`
                      : "每次都批改"
                    : "直接解析"}
                </TableCell>
                <TableCell>{paper.passScore} 分</TableCell>
                <TableCell className="max-w-[280px] text-sm text-slate-600">{buildSectionSummary(paper) || "-"}</TableCell>
                <TableCell>{paper.updatedAt}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/admin/mock-exams/papers/${paper.id}/edit`}>
                        <Pencil className="size-4" />
                        编辑
                      </Link>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="size-4" />
                          删除
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>确认删除这套试卷？</AlertDialogTitle>
                          <AlertDialogDescription>删除后将移除这套试卷及其题目结构，历史考试记录仍以提交时保存的快照为准。</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => void handleDeletePaper(paper)}
                            disabled={deletingPaperId === paper.id}
                            className="bg-red-600 text-white hover:bg-red-700"
                          >
                            {deletingPaperId === paper.id ? "删除中..." : "确认删除"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  if (loading) {
    return <div className="p-8 text-slate-500">机考试卷列表加载中...</div>;
  }

  return (
    <>
      <div className="p-8">
        <div className="rounded-3xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-8 py-6">
            <h1 className="text-2xl font-semibold text-slate-900">机考试卷</h1>
            <p className="mt-2 text-sm text-slate-500">
              先管理机考课程系列，再把具体试卷挂到对应系列下。用户授权按系列开通，后续该系列新增试卷会自动继承给已授权用户。
            </p>
          </div>

          <div className="space-y-6 px-8 py-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm text-slate-500">全部试卷</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{payload.summary.total}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-sm text-emerald-700">已发布</p>
                <p className="mt-2 text-3xl font-semibold text-emerald-800">{payload.summary.published}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm text-slate-500">机考课程</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{seriesOptions.length}</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <p className="text-sm text-amber-700">未归类试卷</p>
                <p className="mt-2 text-3xl font-semibold text-amber-900">{ungroupedCount}</p>
              </div>
            </div>

            <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">机考课程管理</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    比如“通关宝”作为一个机考课程，下面可以挂民法 1、民法 2、民法 3 等多张试卷。
                  </p>
                </div>
                <Button onClick={openCreateSeriesDialog}>
                  <Plus className="size-4" />
                  新建机考课程
                </Button>
              </div>

              {seriesOptions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
                  还没有机考课程，先创建一个系列，再把试卷挂进去。
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {seriesOptions.map((series) => {
                    const linkedPapers = payload.list.filter((paper) => paper.seriesId === series.id);
                    return (
                      <div key={series.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-semibold text-slate-900">{series.name}</h3>
                              <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                                {linkedPapers.length} 套试卷
                              </Badge>
                            </div>
                            <p className="mt-2 text-sm text-slate-500">{series.description || "暂无课程说明"}</p>
                            <p className="mt-2 text-xs text-slate-400">{buildSeriesMetaText(series, payload.list)}</p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <Button variant="outline" size="sm" onClick={() => openEditSeriesDialog(series)}>
                              <Pencil className="size-4" />
                              编辑
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                  <Trash2 className="size-4" />
                                  删除
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>确认删除机考课程？</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    只有该机考课程下不再挂任何试卷时才可以删除。已有用户授权会一并清理。
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>取消</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => void handleDeleteSeries(series)}
                                    disabled={deletingSeriesId === series.id}
                                    className="bg-red-600 text-white hover:bg-red-700"
                                  >
                                    {deletingSeriesId === series.id ? "删除中..." : "确认删除"}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {linkedPapers.length === 0 ? (
                            <span className="text-sm text-slate-400">当前还没有试卷挂到这个机考课程下</span>
                          ) : (
                            linkedPapers.map((paper) => (
                              <Badge key={paper.id} variant="secondary" className="bg-blue-50 text-blue-700">
                                {paper.title}
                              </Badge>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_auto_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input className="pl-9" placeholder="按试卷标题、期次、编号或机考课程搜索" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
              </div>
              <Select value={statusFilter} onValueChange={(value: "all" | AdminMockExamPaperStatus) => setStatusFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="试卷状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="published">已发布</SelectItem>
                  <SelectItem value="draft">草稿</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => {
                  setKeyword("");
                  setStatusFilter("all");
                }}
              >
                重置
              </Button>
              <Button asChild>
                <Link to="/admin/mock-exams/papers/new">
                  <Plus className="size-4" />
                  新建试卷
                </Link>
              </Button>
            </div>

            <Tabs value={paperType} onValueChange={(value) => setPaperType(value as AdminMockExamPaperType)} className="gap-4">
              <TabsList className="h-11 rounded-2xl bg-slate-100 p-1">
                <TabsTrigger value="objective" className="rounded-xl px-5">
                  客观题
                </TabsTrigger>
                <TabsTrigger value="subjective" className="rounded-xl px-5">
                  主观题
                </TabsTrigger>
              </TabsList>

              <TabsContent value="objective">{renderTable(objectivePapers, "objective")}</TabsContent>
              <TabsContent value="subjective">{renderTable(subjectivePapers, "subjective")}</TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <Dialog
        open={showSeriesDialog}
        onOpenChange={(open) => {
          setShowSeriesDialog(open);
          if (!open) {
            resetSeriesDialog();
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingSeries ? "编辑机考课程" : "新建机考课程"}</DialogTitle>
            <DialogDescription>
              试卷系列授权按这里的机考课程来开通。系列名称建议使用“通关宝”“体验营”这种产品层名称。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="mock-exam-series-name">机考课程名称</Label>
              <Input
                id="mock-exam-series-name"
                value={seriesForm.name ?? ""}
                onChange={(event) => setSeriesForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="例如：通关宝"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mock-exam-series-sort-order">排序</Label>
              <Input
                id="mock-exam-series-sort-order"
                value={`${seriesForm.sortOrder ?? ""}`}
                onChange={(event) => setSeriesForm((current) => ({ ...current, sortOrder: event.target.value }))}
                placeholder="数字越小越靠前"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mock-exam-series-description">课程说明</Label>
              <Textarea
                id="mock-exam-series-description"
                value={seriesForm.description ?? ""}
                onChange={(event) => setSeriesForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="可写这个机考课程的适用范围、包含的卷子方向等"
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSeriesDialog(false)} disabled={savingSeries}>
              取消
            </Button>
            <Button onClick={() => void handleSaveSeries()} disabled={savingSeries}>
              {savingSeries ? "保存中..." : editingSeries ? "保存修改" : "创建课程"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
