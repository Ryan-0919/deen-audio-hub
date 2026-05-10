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
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  type AdminMockExamPaperListPayload,
  type AdminMockExamPaperStatus,
  type AdminMockExamPaperSummary,
  type AdminMockExamPaperType,
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

const paperTypeMeta: Record<AdminMockExamPaperType, { label: string; className: string }> = {
  objective: { label: "客观题", className: "bg-blue-50 text-blue-700" },
  subjective: { label: "主观题", className: "bg-violet-50 text-violet-700" },
};

const paperStatusMeta: Record<AdminMockExamPaperStatus, { label: string; className: string }> = {
  published: { label: "已发布", className: "bg-emerald-100 text-emerald-700" },
  draft: { label: "草稿", className: "bg-slate-100 text-slate-700" },
};

const buildPaperSearchText = (paper: AdminMockExamPaperSummary) =>
  [paper.title, paper.subtitle, paper.code, paper.phase, paper.year ? `${paper.year}` : ""].join(" ").toLowerCase();

const buildSectionSummary = (paper: AdminMockExamPaperSummary) => paper.sections.map((section) => `${section.label}${section.count}题`).join(" / ");

export function MockExamPaperList() {
  const [payload, setPayload] = useState<AdminMockExamPaperListPayload>(EMPTY_PAYLOAD);
  const [loading, setLoading] = useState(true);
  const [deletingPaperId, setDeletingPaperId] = useState("");
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AdminMockExamPaperStatus>("all");
  const [paperType, setPaperType] = useState<AdminMockExamPaperType>("objective");
  const deferredKeyword = useDeferredValue(keyword.trim().toLowerCase());

  const loadPapers = async () => {
    try {
      setLoading(true);
      const next = await mockApi.getAdminMockExamPapers();
      setPayload(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载机考试卷列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPapers();
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

  useEffect(() => {
    if (paperType === "objective" && objectivePapers.length === 0 && subjectivePapers.length > 0) {
      setPaperType("subjective");
      return;
    }

    if (paperType === "subjective" && subjectivePapers.length === 0 && objectivePapers.length > 0) {
      setPaperType("objective");
    }
  }, [objectivePapers.length, paperType, subjectivePapers.length]);

  const handleDeletePaper = async (paper: AdminMockExamPaperSummary) => {
    try {
      setDeletingPaperId(paper.id);
      await mockApi.deleteAdminMockExamPaper(paper.id);
      toast.success("试卷已删除");
      await loadPapers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除试卷失败");
    } finally {
      setDeletingPaperId("");
    }
  };

  const renderTable = (papers: AdminMockExamPaperSummary[], currentType: AdminMockExamPaperType) => (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>试卷</TableHead>
            <TableHead>状态</TableHead>
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
              <TableCell colSpan={11} className="py-10 text-center text-sm text-slate-500">
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
                      <div className="text-xs text-slate-500">{[paper.phase, paper.year ? `${paper.year}年` : "", paper.code].filter(Boolean).join(" · ")}</div>
                      {paper.subtitle ? <div className="text-xs text-slate-500">{paper.subtitle}</div> : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={paperStatusMeta[paper.status].className}>{paperStatusMeta[paper.status].label}</Badge>
                </TableCell>
                <TableCell>
                  {paper.questionCount} 题 / {paper.totalScore} 分
                </TableCell>
                <TableCell>{paper.durationMinutes} 分钟</TableCell>
                <TableCell>{paper.maxAttempts > 0 ? `${paper.maxAttempts} 次` : "不限"}</TableCell>
                <TableCell>{paper.permissionRequired ? "需开通" : "默认开放"}</TableCell>
                <TableCell>{paper.reviewEnabled ? "人工批改" : "直接解析"}</TableCell>
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
    <div className="p-8">
      <div className="rounded-3xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-8 py-6">
          <h1 className="text-2xl font-semibold text-slate-900">机考试卷</h1>
          <p className="mt-2 text-sm text-slate-500">这里按客观题、主观题区分展示后台已配置的机考试卷，前台机考系统会直接读取这里的已发布试卷。</p>
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
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <p className="text-sm text-blue-700">客观题</p>
              <p className="mt-2 text-3xl font-semibold text-blue-800">{payload.summary.objective}</p>
            </div>
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
              <p className="text-sm text-violet-700">主观题</p>
              <p className="mt-2 text-3xl font-semibold text-violet-800">{payload.summary.subjective}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input className="pl-9" placeholder="按试卷标题、期次或编号搜索" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
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
  );
}
