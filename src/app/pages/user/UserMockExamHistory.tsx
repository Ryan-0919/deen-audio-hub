import { BookOpenText, FileText, PenSquare, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { AppLogo } from "../../components/branding/AppLogo";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { cn } from "../../components/ui/utils";
import { type UserMockExamHistoryItem, mockApi } from "../../lib/mockData";

type PrimaryGroup = "review" | "practice";
type PracticeGroup = "objective" | "subjective";

const isReviewRecord = (item: UserMockExamHistoryItem) => item.subjectiveQuestionCount > 0 && item.reviewEnabled;
const isObjectivePracticeRecord = (item: UserMockExamHistoryItem) => item.subjectiveQuestionCount <= 0;
const isSubjectivePracticeRecord = (item: UserMockExamHistoryItem) => item.subjectiveQuestionCount > 0 && !item.reviewEnabled;

const getHistoryStatusMeta = (item: UserMockExamHistoryItem) => {
  if (isReviewRecord(item)) {
    return item.reviewVisibleToUser
      ? {
          label: "批改中",
          category: "主观题 · 批改记录",
          className: "border-amber-200 bg-amber-50 text-amber-700",
        }
      : {
          label: "已批改",
          category: "主观题 · 批改记录",
          className: "border-emerald-200 bg-emerald-50 text-emerald-700",
        };
  }

  if (isObjectivePracticeRecord(item)) {
    return {
      label: "客观题",
      category: "做题记录",
      className: "border-sky-200 bg-sky-50 text-sky-700",
    };
  }

  return {
    label: "主观题",
    category: "做题记录",
    className: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
  };
};

function HistoryCard({ item, index, onOpen }: { item: UserMockExamHistoryItem; index: number; onOpen: (recordId: string) => void }) {
  const statusMeta = getHistoryStatusMeta(item);

  return (
    <motion.button
      type="button"
      onClick={() => onOpen(item.id)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay: 0.04 + index * 0.04 }}
      className="group text-left"
    >
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/18 shadow-[0_24px_90px_rgba(0,0,0,0.22)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-white/16 hover:bg-black/22">
        <div className="relative aspect-[16/9] overflow-hidden rounded-[28px] bg-[#0a101d]">
          <img
            src={item.paper.coverUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-42 blur-3xl"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,8,22,0.24)_0%,rgba(4,8,22,0.04)_40%,rgba(4,8,22,0.34)_100%)]" />
          <img
            src={item.paper.coverUrl}
            alt={item.paper.title}
            className="relative h-full w-full object-contain transition duration-700 group-hover:scale-[1.025]"
          />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,rgba(4,8,22,0)_0%,rgba(4,8,22,0.62)_68%,rgba(4,8,22,0.9)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-10 md:px-5 md:pb-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className={`rounded-full border px-3 py-1 text-[12px] font-semibold ${statusMeta.className}`}>{statusMeta.label}</Badge>
              <span className="text-[11px] font-medium tracking-[0.16em] text-white/62">{statusMeta.category}</span>
            </div>
            <h2 className="line-clamp-2 text-[20px] font-semibold leading-[1.15] tracking-[-0.04em] text-white md:text-[24px]">
              {item.paper.title}
            </h2>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

export function UserMockExamHistory() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<UserMockExamHistoryItem[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [primaryGroup, setPrimaryGroup] = useState<PrimaryGroup>("review");
  const [practiceGroup, setPracticeGroup] = useState<PracticeGroup>("objective");

  useEffect(() => {
    let disposed = false;

    const load = async () => {
      try {
        setErrorMessage("");
        const list = await mockApi.getUserMockExamHistory();
        if (!disposed) {
          setRecords(list);
        }
      } catch (error) {
        if (!disposed) {
          setRecords([]);
          setErrorMessage(error instanceof Error ? error.message : "加载我的考试失败");
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
  }, []);

  const reviewRecords = useMemo(() => records.filter(isReviewRecord), [records]);
  const objectivePracticeRecords = useMemo(() => records.filter(isObjectivePracticeRecord), [records]);
  const subjectivePracticeRecords = useMemo(() => records.filter(isSubjectivePracticeRecord), [records]);

  useEffect(() => {
    if (primaryGroup === "review" && reviewRecords.length === 0 && (objectivePracticeRecords.length > 0 || subjectivePracticeRecords.length > 0)) {
      setPrimaryGroup("practice");
      return;
    }

    if (primaryGroup === "practice" && objectivePracticeRecords.length === 0 && subjectivePracticeRecords.length === 0 && reviewRecords.length > 0) {
      setPrimaryGroup("review");
    }
  }, [objectivePracticeRecords.length, primaryGroup, reviewRecords.length, subjectivePracticeRecords.length]);

  useEffect(() => {
    if (practiceGroup === "objective" && objectivePracticeRecords.length === 0 && subjectivePracticeRecords.length > 0) {
      setPracticeGroup("subjective");
      return;
    }

    if (practiceGroup === "subjective" && subjectivePracticeRecords.length === 0 && objectivePracticeRecords.length > 0) {
      setPracticeGroup("objective");
    }
  }, [objectivePracticeRecords.length, practiceGroup, subjectivePracticeRecords.length]);

  const visibleRecords = primaryGroup === "review" ? reviewRecords : practiceGroup === "objective" ? objectivePracticeRecords : subjectivePracticeRecords;
  const emptyTitle =
    primaryGroup === "review"
      ? "暂无主观题批改记录"
      : practiceGroup === "objective"
        ? "暂无客观题做题记录"
        : "暂无主观题做题记录";
  const emptyDescription =
    primaryGroup === "review"
      ? "进入批改流程的主观题试卷，会统一显示在这里。"
      : practiceGroup === "objective"
        ? "你完成过的客观题机考记录，会统一显示在这里。"
        : "主观题后续作答但不参与批改的记录，会统一显示在这里。";

  if (loading) {
    return (
      <div className="relative min-h-full overflow-hidden bg-[#040816] px-5 py-12 text-white md:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,166,255,0.18),transparent_24%),linear-gradient(180deg,#07111d_0%,#040816_52%,#09172b_100%)]" />
        <div className="relative mx-auto flex max-w-7xl items-center justify-center rounded-[30px] border border-white/10 bg-white/[0.04] px-8 py-24 backdrop-blur-xl">
          <div className="text-sm uppercase tracking-[0.28em] text-white/58">Loading Exams</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-[#040816] pb-24 text-white selection:bg-[#dff8ff] selection:text-[#061120]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,166,255,0.18),transparent_24%),radial-gradient(circle_at_82%_16%,rgba(120,255,235,0.12),transparent_18%),linear-gradient(180deg,#07111d_0%,#040816_48%,#0a1629_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-[320px] h-[420px] w-[920px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.12),transparent_62%)] blur-3xl" />

      <div className="relative mx-auto max-w-[1320px] px-5 pb-10 pt-5 md:px-8 md:pt-8 xl:px-10">
        <div className="mb-5 md:hidden">
          <AppLogo compact className="text-white" />
        </div>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="relative z-10"
        >
          <div className="mx-auto max-w-[1560px]">
            <div className="mb-6">
              <div className="text-[11px] uppercase tracking-[0.28em] text-white/36">DE EN FA KAO</div>
              <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.06em] text-white md:text-[40px]">我的考试</h1>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPrimaryGroup("review")}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                    primaryGroup === "review"
                      ? "border-white bg-white text-slate-950 shadow-[0_14px_34px_rgba(255,255,255,0.14)]"
                      : "border-white/10 bg-white/[0.05] text-white/62 hover:bg-white/[0.08] hover:text-white",
                  )}
                >
                  <Sparkles className="size-4" />
                  <span>批改记录</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", primaryGroup === "review" ? "bg-[#fff1df] text-[#b45309]" : "bg-white/8 text-white/60")}>
                    {reviewRecords.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrimaryGroup("practice")}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                    primaryGroup === "practice"
                      ? "border-white bg-white text-slate-950 shadow-[0_14px_34px_rgba(255,255,255,0.14)]"
                      : "border-white/10 bg-white/[0.05] text-white/62 hover:bg-white/[0.08] hover:text-white",
                  )}
                >
                  <FileText className="size-4" />
                  <span>做题记录</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", primaryGroup === "practice" ? "bg-[#dbeafe] text-[#1d4ed8]" : "bg-white/8 text-white/60")}>
                    {objectivePracticeRecords.length + subjectivePracticeRecords.length}
                  </span>
                </button>
              </div>

              {primaryGroup === "practice" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPracticeGroup("objective")}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
                      practiceGroup === "objective"
                        ? "border-[#8fd6ff] bg-[#0d2238] text-[#8fd6ff]"
                        : "border-white/10 bg-white/[0.03] text-white/56 hover:bg-white/[0.06] hover:text-white",
                    )}
                  >
                    <BookOpenText className="size-4" />
                    <span>客观题</span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{objectivePracticeRecords.length}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPracticeGroup("subjective")}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
                      practiceGroup === "subjective"
                        ? "border-[#ffd39a] bg-[#2c1b0b] text-[#ffd39a]"
                        : "border-white/10 bg-white/[0.03] text-white/56 hover:bg-white/[0.06] hover:text-white",
                    )}
                  >
                    <PenSquare className="size-4" />
                    <span>主观题</span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{subjectivePracticeRecords.length}</span>
                  </button>
                </div>
              ) : null}
            </div>

            <div>
              {errorMessage ? (
                <section className="rounded-[28px] border border-rose-400/16 bg-rose-500/[0.08] px-6 py-16 text-center">
                  <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-rose-300/14 bg-white/[0.04] text-rose-200">
                    <FileText className="size-6" />
                  </div>
                  <p className="mt-4 text-lg font-medium text-white">我的考试加载失败</p>
                  <p className="mt-2 text-sm leading-7 text-white/58">{errorMessage}</p>
                </section>
              ) : records.length === 0 ? (
                <section className="rounded-[28px] border border-dashed border-white/14 bg-white/[0.03] px-6 py-16 text-center">
                  <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/42">
                    <FileText className="size-6" />
                  </div>
                  <p className="mt-4 text-lg font-medium text-white">暂时还没有可查看的考试记录</p>
                  <p className="mt-2 text-sm leading-7 text-white/56">考试交卷并生成可查看结果后，这里会自动显示对应的考试记录与详情入口。</p>
                  <Button
                    type="button"
                    onClick={() => navigate("/user/mock-exams")}
                    className="mt-6 h-11 rounded-full bg-white px-5 text-slate-950 hover:bg-slate-100"
                  >
                    去我的试卷
                  </Button>
                </section>
              ) : visibleRecords.length === 0 ? (
                <section className="rounded-[28px] border border-dashed border-white/14 bg-white/[0.03] px-6 py-16 text-center">
                  <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/42">
                    {primaryGroup === "review" ? <Sparkles className="size-6" /> : practiceGroup === "objective" ? <BookOpenText className="size-6" /> : <PenSquare className="size-6" />}
                  </div>
                  <p className="mt-4 text-lg font-medium text-white">{emptyTitle}</p>
                  <p className="mt-2 text-sm leading-7 text-white/56">{emptyDescription}</p>
                </section>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleRecords.map((item, index) => (
                    <HistoryCard
                      key={item.id}
                      item={item}
                      index={index}
                      onOpen={(recordId) =>
                        navigate(item.reviewVisibleToUser ? `/user/mock-exams/records/${recordId}/review-pending` : `/user/mock-exams/records/${recordId}/result`)
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
