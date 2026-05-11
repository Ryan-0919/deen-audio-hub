import { Bot, Clock3, FileCheck2, Send, Sparkles } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import type {
  AdminMockExamPaperListPayload,
  AdminMockExamReviewPaperListPayload,
  AdminMockExamReviewPaperSummary,
} from "../../lib/mockData";
import { mockApi } from "../../lib/mockData";

const EMPTY_PAPERS: AdminMockExamReviewPaperListPayload = {
  list: [],
  summary: {
    totalPapers: 0,
    totalRecords: 0,
    aiPending: 0,
    aiProcessing: 0,
    manualReviewing: 0,
    manualPending: 0,
    published: 0,
  },
};

const buildFallbackReviewPaperPayload = (
  payload: Awaited<ReturnType<typeof mockApi.getAdminMockExamPapers>>,
): AdminMockExamReviewPaperListPayload => {
  const list = payload.list
    .filter((paper) => paper.paperType === "subjective" && paper.reviewEnabled)
    .map((paper) => ({
      ...paper,
      reviewSummary: {
        total: 0,
        aiPending: 0,
        aiProcessing: 0,
        manualReviewing: 0,
        manualPending: 0,
        published: 0,
      },
    }));

  return {
    list,
    summary: {
      totalPapers: list.length,
      totalRecords: 0,
      aiPending: 0,
      aiProcessing: 0,
      manualReviewing: 0,
      manualPending: 0,
      published: 0,
    },
  };
};

function MetricCard({
  title,
  value,
  hint,
  tone,
  icon,
}: {
  title: string;
  value: number;
  hint: string;
  tone: "slate" | "amber" | "sky" | "violet" | "emerald";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const toneMap = {
    slate: "border-slate-200 bg-white text-slate-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    sky: "border-sky-200 bg-sky-50 text-sky-900",
    violet: "border-violet-200 bg-violet-50 text-violet-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
  } as const;

  const Icon = icon;

  return (
    <div className={`rounded-[28px] border px-5 py-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] ${toneMap[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium opacity-75">{title}</p>
          <p className="mt-3 text-4xl font-semibold tracking-[-0.05em]">{value}</p>
        </div>
        <div className="rounded-2xl bg-white/70 p-3 shadow-sm">
          <Icon className="size-5" />
        </div>
      </div>
      <p className="mt-4 text-xs leading-6 opacity-70">{hint}</p>
    </div>
  );
}

function ReviewPaperCard({ paper, onOpen }: { paper: AdminMockExamReviewPaperSummary; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group overflow-hidden rounded-[30px] border border-slate-200 bg-white text-left shadow-[0_20px_50px_rgba(15,23,42,0.07)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-slate-100">
        <img src={paper.coverUrl} alt={paper.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(15,23,42,0)_0%,rgba(15,23,42,0.86)_100%)] px-5 pb-5 pt-12">
          <div className="flex items-center justify-between gap-3">
            <Badge className="border-0 bg-white/90 text-slate-800">{paper.phase || "主观题"}</Badge>
            {paper.year ? <Badge className="border-0 bg-white/15 text-white">{paper.year} 年</Badge> : null}
          </div>
          <h3 className="mt-3 line-clamp-2 text-[22px] font-semibold tracking-[-0.04em] text-white">{paper.title}</h3>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-5 py-5">
        <div className="rounded-2xl bg-amber-50 px-3 py-3">
          <p className="text-xs text-amber-700">待批改</p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-amber-900">{paper.reviewSummary.aiPending}</p>
        </div>
        <div className="rounded-2xl bg-sky-50 px-3 py-3">
          <p className="text-xs text-sky-700">批改中</p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-sky-900">{paper.reviewSummary.aiProcessing}</p>
        </div>
        <div className="rounded-2xl bg-violet-50 px-3 py-3">
          <p className="text-xs text-violet-700">待人工发送</p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-violet-900">{paper.reviewSummary.manualPending}</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 px-3 py-3">
          <p className="text-xs text-emerald-700">已发送</p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-emerald-900">{paper.reviewSummary.published}</p>
        </div>
      </div>
    </button>
  );
}

export function ReviewDashboard() {
  const navigate = useNavigate();
  const [papers, setPapers] = useState<AdminMockExamReviewPaperListPayload>(EMPTY_PAPERS);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const deferredKeyword = useDeferredValue(keyword.trim());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const next = await mockApi.getAdminMockExamReviewPapers({ keyword: deferredKeyword });
        setPapers(next);
      } catch (error) {
        const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: unknown }).status ?? 0) : 0;

        if (status === 404) {
          const paperList: AdminMockExamPaperListPayload = await mockApi.getAdminMockExamPapers();
          setPapers(buildFallbackReviewPaperPayload(paperList));
          setLoading(false);
          return;
        }

        toast.error(error instanceof Error ? error.message : "加载批改工作台失败");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [deferredKeyword]);

  const urgentPaper = useMemo(
    () =>
      [...papers.list].sort(
        (left, right) =>
          right.reviewSummary.aiPending + right.reviewSummary.manualPending - (left.reviewSummary.aiPending + left.reviewSummary.manualPending),
      )[0] ?? null,
    [papers.list],
  );

  return (
    <div className="space-y-8 p-8">
      <section className="overflow-hidden rounded-[36px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_35%),linear-gradient(135deg,#ffffff_0%,#f8fafc_100%)] px-7 py-7 shadow-[0_30px_80px_rgba(15,23,42,0.06)]">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-600">
              <Sparkles className="size-3.5 text-blue-600" />
              独立批改工作台
            </div>
            <h1 className="mt-4 text-[38px] font-semibold tracking-[-0.06em] text-slate-900">主观题批改中心</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
              先按试卷查看积压，再进入单卷处理待批改、批改中、待人工核对发送和已发送记录。这样批改流程会更聚焦，也更适合批改员日常使用。
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard title="开启批改试卷" value={papers.summary.totalPapers} hint="当前参与批改流程的主观题试卷数量" tone="slate" icon={FileCheck2} />
              <MetricCard title="待批改" value={papers.summary.aiPending} hint="交卷后尚未进入完成结果的记录" tone="amber" icon={Bot} />
              <MetricCard title="批改中" value={papers.summary.aiProcessing} hint="当前正在生成评分与批注的记录" tone="sky" icon={Clock3} />
              <MetricCard title="待人工发送" value={papers.summary.manualPending} hint="结果已完成，仍需人工核对确认后发送给学生" tone="violet" icon={Send} />
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white/90 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">优先处理</p>
            {urgentPaper ? (
              <>
                <div className="mt-4 overflow-hidden rounded-[24px]">
                  <img src={urgentPaper.coverUrl} alt={urgentPaper.title} className="aspect-[16/9] w-full object-cover" />
                </div>
                <h2 className="mt-4 line-clamp-2 text-2xl font-semibold tracking-[-0.04em] text-slate-900">{urgentPaper.title}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                  这张试卷当前有 {urgentPaper.reviewSummary.aiPending} 份待批改、{urgentPaper.reviewSummary.manualPending} 份待人工发送，建议优先进入处理。
                </p>
                <button
                  type="button"
                  onClick={() => navigate(`/adminpg/papers/${urgentPaper.id}`)}
                  className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  进入这张试卷
                </button>
              </>
            ) : (
              <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center text-sm text-slate-500">
                当前没有需要优先处理的试卷
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-[28px] font-semibold tracking-[-0.05em] text-slate-900">按试卷进入批改</h2>
            <p className="mt-2 text-sm leading-7 text-slate-500">只展示已开启批改的主观题试卷，点击卡片后进入单卷批改队列。</p>
          </div>
          <div className="w-full max-w-[340px]">
            <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索试卷标题 / 编号" className="h-11 rounded-full bg-white px-4" />
          </div>
        </div>

        {loading ? (
          <div className="rounded-[30px] border border-slate-200 bg-white px-6 py-20 text-center text-sm text-slate-500 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            批改工作台加载中...
          </div>
        ) : papers.list.length === 0 ? (
          <div className="rounded-[30px] border border-dashed border-slate-300 bg-white px-6 py-20 text-center text-sm text-slate-500 shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
            当前没有开启批改的主观题试卷
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {papers.list.map((paper) => (
              <ReviewPaperCard key={paper.id} paper={paper} onOpen={() => navigate(`/adminpg/papers/${paper.id}`)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
