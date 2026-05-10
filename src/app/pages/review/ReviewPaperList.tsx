import { ArrowRight, Bot, Clock3, FileCheck2, Search, Send } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
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
      manualPending: 0,
      published: 0,
    },
  };
};

function SummaryCard({
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
      className="group overflow-hidden rounded-[28px] border border-slate-200 bg-white text-left shadow-[0_18px_44px_rgba(15,23,42,0.07)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-slate-100">
        <img src={paper.coverUrl} alt={paper.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(15,23,42,0)_0%,rgba(15,23,42,0.84)_100%)] px-4 pb-4 pt-12">
          <div className="flex items-center justify-between gap-2">
            <Badge className="border-0 bg-white/90 text-slate-800">{paper.phase || "主观题"}</Badge>
            {paper.year ? <Badge className="border-0 bg-white/15 text-white">{paper.year} 年</Badge> : null}
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 pt-4">
        <h3 className="line-clamp-2 text-[18px] font-semibold leading-7 tracking-[-0.04em] text-slate-900">{paper.title}</h3>
        <p className="mt-1 text-xs text-slate-500">{paper.code}</p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-amber-50 px-3 py-3">
            <p className="text-[11px] text-amber-700">待批改</p>
            <p className="mt-1 text-xl font-semibold tracking-[-0.04em] text-amber-900">{paper.reviewSummary.aiPending}</p>
          </div>
          <div className="rounded-2xl bg-sky-50 px-3 py-3">
            <p className="text-[11px] text-sky-700">批改中</p>
            <p className="mt-1 text-xl font-semibold tracking-[-0.04em] text-sky-900">{paper.reviewSummary.aiProcessing}</p>
          </div>
          <div className="rounded-2xl bg-violet-50 px-3 py-3">
            <p className="text-[11px] text-violet-700">待人工发送</p>
            <p className="mt-1 text-xl font-semibold tracking-[-0.04em] text-violet-900">{paper.reviewSummary.manualPending}</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 px-3 py-3">
            <p className="text-[11px] text-emerald-700">已发送</p>
            <p className="mt-1 text-xl font-semibold tracking-[-0.04em] text-emerald-900">{paper.reviewSummary.published}</p>
          </div>
        </div>

        <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-900">
          进入这张试卷
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </button>
  );
}

export function ReviewPaperList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const legacyPaperId = searchParams.get("paperId");
  const [papers, setPapers] = useState<AdminMockExamReviewPaperListPayload>(EMPTY_PAPERS);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const deferredKeyword = useDeferredValue(keyword.trim());

  useEffect(() => {
    if (!legacyPaperId) return;
    navigate(`/adminpg/papers/${legacyPaperId}`, { replace: true });
  }, [legacyPaperId, navigate]);

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

        toast.error(error instanceof Error ? error.message : "加载试卷批改列表失败");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [deferredKeyword]);

  const topPaper = useMemo(
    () =>
      [...papers.list].sort(
        (left, right) =>
          right.reviewSummary.aiPending + right.reviewSummary.manualPending - (left.reviewSummary.aiPending + left.reviewSummary.manualPending),
      )[0] ?? null,
    [papers.list],
  );

  if (legacyPaperId) {
    return null;
  }

  return (
    <div className="space-y-8 p-8">
      <section className="overflow-hidden rounded-[36px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_35%),linear-gradient(135deg,#ffffff_0%,#f8fafc_100%)] px-7 py-7 shadow-[0_30px_80px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-600">
              试卷一级页面
            </p>
            <h1 className="mt-4 text-[36px] font-semibold tracking-[-0.06em] text-slate-900">先选试卷，再进入二级批改</h1>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              这里一级页面只显示试卷卡片，一排放五个。点击某张试卷后，再进入该试卷自己的二级页面，在里面切换待批改、批改中、待人工发送、已发送。
            </p>
          </div>
          <div className="w-full max-w-[360px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索试卷标题 / 编号"
                className="h-11 rounded-full bg-white px-4 pl-9"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard title="试卷总数" value={papers.summary.totalPapers} hint="当前参与主观题批改流程的试卷数" tone="slate" icon={FileCheck2} />
          <SummaryCard title="待批改" value={papers.summary.aiPending} hint="交卷后等待进入批改的记录" tone="amber" icon={Bot} />
          <SummaryCard title="批改中" value={papers.summary.aiProcessing} hint="正在生成评分与批注" tone="sky" icon={Clock3} />
          <SummaryCard title="待人工发送" value={papers.summary.manualPending} hint="结果已生成，等待人工核对发送" tone="violet" icon={Send} />
          <SummaryCard title="已发送" value={papers.summary.published} hint="已经下发给学生的批改结果" tone="emerald" icon={Send} />
        </div>
      </section>

      {topPaper ? (
        <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">优先处理</p>
              <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.05em] text-slate-900">{topPaper.title}</h2>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                这张卷子当前有 {topPaper.reviewSummary.aiPending} 份待批改、{topPaper.reviewSummary.manualPending} 份待人工发送，适合优先进入处理。
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/adminpg/papers/${topPaper.id}`)}
              className="inline-flex h-11 items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              进入这张试卷
            </button>
          </div>
        </section>
      ) : null}

      <section className="space-y-5">
        <div>
          <h2 className="text-[28px] font-semibold tracking-[-0.05em] text-slate-900">试卷卡片</h2>
          <p className="mt-2 text-sm leading-7 text-slate-500">只展示已开启主观题批改的试卷。点击任一试卷卡片后，再进入该试卷的二级批改页面。</p>
        </div>

        {loading ? (
          <div className="rounded-[30px] border border-slate-200 bg-white px-6 py-20 text-center text-sm text-slate-500 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            试卷列表加载中...
          </div>
        ) : papers.list.length === 0 ? (
          <div className="rounded-[30px] border border-dashed border-slate-300 bg-white px-6 py-20 text-center text-sm text-slate-500 shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
            当前没有开启批改的主观题试卷
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {papers.list.map((paper) => (
              <ReviewPaperCard key={paper.id} paper={paper} onOpen={() => navigate(`/adminpg/papers/${paper.id}`)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
