import { BarChart3, Download, RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import {
  type AdminMockExamLeaderboardRankPayload,
  type AdminMockExamPaperListPayload,
  type AdminMockExamPaperScoreDetail,
  mockApi,
} from "../../lib/mockData";

const EMPTY_PAPERS: AdminMockExamPaperListPayload = {
  list: [],
  summary: {
    total: 0,
    published: 0,
    draft: 0,
    objective: 0,
    subjective: 0,
  },
};

const EMPTY_DETAIL: AdminMockExamPaperScoreDetail = {
  paper: {
    id: "",
    code: "",
    title: "",
    phase: "",
    year: 0,
    coverUrl: "",
    totalScore: 0,
    passScore: 0,
    questionCount: 0,
    paperType: "objective",
  },
  stats: {
    participantCount: 0,
    publishedCount: 0,
    highestScore: 0,
    lowestScore: 0,
    averageScore: 0,
  },
  items: [],
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

const buildPaperLabel = (paper: AdminMockExamPaperListPayload["list"][number]) =>
  [paper.title, paper.phase, paper.year ? `${paper.year}` : ""].filter(Boolean).join(" · ");

const getReviewStatusLabel = (value: AdminMockExamPaperScoreDetail["items"][number]["reviewStatus"]) => {
  switch (value) {
    case "published":
      return "已发布";
    case "manual_pending":
      return "待发送";
    case "manual_reviewing":
      return "人工批改中";
    case "ai_processing":
      return "AI批改中";
    case "ai_pending":
      return "待批改";
    case "submitted":
      return "已交卷";
    default:
      return value || "--";
  }
};

const buildExportFileName = (paper: AdminMockExamPaperScoreDetail["paper"]) => {
  const baseName = [paper.title, paper.phase, paper.year ? `${paper.year}` : "", "学员考试记录"]
    .filter(Boolean)
    .join("-");
  return `${baseName || "学员考试记录"}.xlsx`;
};

export function MockExamPaperScores() {
  const navigate = useNavigate();
  const { paperId: routePaperId = "" } = useParams();
  const [paperPayload, setPaperPayload] = useState<AdminMockExamPaperListPayload>(EMPTY_PAPERS);
  const [selectedPaperId, setSelectedPaperId] = useState(routePaperId);
  const [detail, setDetail] = useState<AdminMockExamPaperScoreDetail>(EMPTY_DETAIL);
  const [rankDraftMap, setRankDraftMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let disposed = false;

    const load = async () => {
      try {
        setLoading(true);
        const payload = await mockApi.getAdminMockExamPapers();
        if (disposed) return;
        setPaperPayload(payload);
        const defaultPaperId =
          routePaperId && payload.list.some((item) => item.id === routePaperId)
            ? routePaperId
            : payload.list[0]?.id ?? "";
        setSelectedPaperId(defaultPaperId);
      } catch (error) {
        if (!disposed) {
          toast.error(error instanceof Error ? error.message : "加载试卷列表失败");
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      disposed = true;
    };
  }, [routePaperId]);

  useEffect(() => {
    if (!selectedPaperId) return;
    let disposed = false;

    const loadDetail = async () => {
      try {
        setDetailLoading(true);
        const next = await mockApi.getAdminMockExamPaperScores(selectedPaperId);
        if (disposed) return;
        setDetail(next);
        setRankDraftMap(
          Object.fromEntries(next.items.map((item) => [item.userId, item.manualRank ? `${item.manualRank}` : ""])),
        );
      } catch (error) {
        if (!disposed) {
          toast.error(error instanceof Error ? error.message : "加载试卷成绩失败");
          setDetail(EMPTY_DETAIL);
        }
      } finally {
        if (!disposed) {
          setDetailLoading(false);
        }
      }
    };

    void loadDetail();

    return () => {
      disposed = true;
    };
  }, [selectedPaperId]);

  const paperOptions = useMemo(
    () => paperPayload.list.filter((item) => item.status === "published"),
    [paperPayload.list],
  );

  const hasChanges = useMemo(
    () =>
      detail.items.some((item) => {
        const current = rankDraftMap[item.userId] ?? "";
        const original = item.manualRank ? `${item.manualRank}` : "";
        return current !== original;
      }),
    [detail.items, rankDraftMap],
  );

  const handleSaveRanks = async () => {
    if (!selectedPaperId) return;

    const items: AdminMockExamLeaderboardRankPayload[] = detail.items.map((item) => {
      const rawValue = `${rankDraftMap[item.userId] ?? ""}`.trim();
      return {
        userId: item.userId,
        manualRank: rawValue ? Number.parseInt(rawValue, 10) : null,
      };
    });

    const positiveRanks = items
      .map((item) => item.manualRank)
      .filter((value): value is number => Number.isFinite(value) && Number(value) > 0);
    if (new Set(positiveRanks).size !== positiveRanks.length) {
      toast.error("手动排名不能重复");
      return;
    }

    try {
      setSaving(true);
      const next = await mockApi.updateAdminMockExamLeaderboardRanks(selectedPaperId, { items });
      setDetail(next);
      setRankDraftMap(
        Object.fromEntries(next.items.map((item) => [item.userId, item.manualRank ? `${item.manualRank}` : ""])),
      );
      toast.success("排行榜名次已更新");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存排行榜名次失败");
    } finally {
      setSaving(false);
    }
  };

  const handleExportExcel = async () => {
    if (!selectedPaperId || detail.items.length === 0) {
      toast.error("当前试卷还没有可导出的考试记录");
      return;
    }

    try {
      setExporting(true);
      const rows = detail.items.map((item, index) => ({
        序号: index + 1,
        试卷名称: detail.paper.title || "--",
        试卷阶段: detail.paper.phase || "--",
        试卷年份: detail.paper.year || "--",
        用户手机号: item.userPhone || "--",
        考试次数: item.attemptNo || 0,
        考试成绩: item.totalScore,
        显示排名: item.displayRank || "--",
        手动排名: item.manualRank ?? "",
        批改状态: getReviewStatusLabel(item.reviewStatus),
        交卷时间: item.submittedAt || "--",
        发布时间: item.publishedAt || "--",
        记录ID: item.recordId,
      }));

      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, sheet, "考试记录");
      const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
      downloadBlob(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        buildExportFileName(detail.paper),
      );
      toast.success("考试记录已导出");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导出考试记录失败");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-500">学员考试记录加载中...</div>;
  }

  return (
    <div className="p-8">
      <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
              <BarChart3 className="size-4" />
              学员考试记录
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">按试卷查看成绩与排行榜</h1>
            <p className="mt-2 text-sm text-slate-500">这里可以切换试卷，查看该试卷下的参与人数、分数和用户排行榜，也可以手动调整排行榜名次。</p>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => selectedPaperId && navigate(`/admin/mock-exams/papers/${selectedPaperId}/edit`)}>
              编辑试卷
            </Button>
            <Button variant="outline" onClick={() => void handleExportExcel()} disabled={!selectedPaperId || detailLoading || exporting || detail.items.length === 0}>
              <Download className="mr-2 size-4" />
              {exporting ? "导出中..." : "导出Excel"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!selectedPaperId) return;
                setDetailLoading(true);
                void mockApi
                  .getAdminMockExamPaperScores(selectedPaperId)
                  .then((next) => {
                    setDetail(next);
                    setRankDraftMap(
                      Object.fromEntries(next.items.map((item) => [item.userId, item.manualRank ? `${item.manualRank}` : ""])),
                    );
                  })
                  .catch((error) => {
                    toast.error(error instanceof Error ? error.message : "刷新试卷成绩失败");
                  })
                  .finally(() => {
                    setDetailLoading(false);
                  });
              }}
            >
              <RefreshCw className="mr-2 size-4" />
              刷新
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="space-y-2">
            <Label>选择试卷</Label>
            <Select value={selectedPaperId} onValueChange={setSelectedPaperId}>
              <SelectTrigger className="h-11 rounded-2xl">
                <SelectValue placeholder="请选择试卷" />
              </SelectTrigger>
              <SelectContent>
                {paperOptions.map((paper) => (
                  <SelectItem key={paper.id} value={paper.id}>
                    {buildPaperLabel(paper)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>排行榜名次</Label>
            <Button className="h-11 w-full rounded-2xl" onClick={() => void handleSaveRanks()} disabled={!hasChanges || saving || !selectedPaperId}>
              <Save className="mr-2 size-4" />
              {saving ? "保存中..." : "保存名次"}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="参与人数" value={detail.stats.participantCount} />
          <StatCard label="已出分人数" value={detail.stats.publishedCount} />
          <StatCard label="最高分" value={detail.stats.highestScore} />
          <StatCard label="平均分" value={detail.stats.averageScore} />
        </div>

        <div className="rounded-2xl border border-slate-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>显示排名</TableHead>
                <TableHead>手动排名</TableHead>
                <TableHead>用户</TableHead>
                <TableHead>分数</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>提交时间</TableHead>
                <TableHead>发布时间</TableHead>
                <TableHead>记录</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detailLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-slate-500">
                    成绩加载中...
                  </TableCell>
                </TableRow>
              ) : detail.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-slate-500">
                    当前试卷还没有考试记录
                  </TableCell>
                </TableRow>
              ) : (
                detail.items.map((item) => (
                  <TableRow key={item.recordId}>
                    <TableCell className="font-semibold text-slate-900">{item.displayRank || "--"}</TableCell>
                    <TableCell className="w-[130px]">
                      <Input
                        type="number"
                        min={1}
                        value={rankDraftMap[item.userId] ?? ""}
                        onChange={(event) =>
                          setRankDraftMap((current) => ({
                            ...current,
                            [item.userId]: event.target.value,
                          }))
                        }
                        placeholder="自动"
                      />
                    </TableCell>
                    <TableCell>{item.userPhone || "--"}</TableCell>
                    <TableCell>{item.totalScore}</TableCell>
                    <TableCell>{getReviewStatusLabel(item.reviewStatus)}</TableCell>
                    <TableCell>{item.submittedAt || "--"}</TableCell>
                    <TableCell>{item.publishedAt || "--"}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/adminpg/papers/${detail.paper.id}`)}
                      >
                        去批改页
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-900">{value}</div>
    </div>
  );
}
