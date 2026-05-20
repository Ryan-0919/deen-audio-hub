import { ArrowRight, CheckCircle2, Eye, RefreshCcw, Target } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import {
  type BookQuestionBankDetailPayload,
  type BookQuestionBankItemStatusFilter,
  mockApi,
} from "../../lib/mockData";

const statusOptions: Array<{ value: BookQuestionBankItemStatusFilter; label: string }> = [
  { value: "all", label: "全部题目" },
  { value: "unanswered", label: "未作答" },
  { value: "answered", label: "已作答" },
  { value: "viewed", label: "已看答案" },
  { value: "mastered", label: "已掌握" },
  { value: "redo", label: "待重做" },
];

export function BookQuestionBankDetail() {
  const navigate = useNavigate();
  const { bookId = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<BookQuestionBankDetailPayload | null>(null);
  const [subjectId, setSubjectId] = useState("all");
  const [statusFilter, setStatusFilter] = useState<BookQuestionBankItemStatusFilter>("all");

  const load = async (nextSubjectId = subjectId, nextStatusFilter = statusFilter) => {
    if (!bookId) return;
    try {
      setLoading(true);
      const detail = await mockApi.getUserBookQuestionBankDetail(bookId, {
        subjectId: nextSubjectId === "all" ? "" : nextSubjectId,
        statusFilter: nextStatusFilter,
      });
      setPayload(detail);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "加载题库详情失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load("all", "all");
  }, [bookId]);

  const progressBadges = useMemo(
    () =>
      payload
        ? [
            { label: "已作答", value: payload.progress.answeredCount, icon: CheckCircle2, color: "text-emerald-300" },
            { label: "已看答案", value: payload.progress.viewedAnswerCount, icon: Eye, color: "text-sky-300" },
            { label: "已掌握", value: payload.progress.masteredCount, icon: Target, color: "text-amber-300" },
            { label: "待重做", value: payload.progress.redoCount, icon: RefreshCcw, color: "text-rose-300" },
          ]
        : [],
    [payload],
  );

  if (loading && !payload) {
    return (
      <div className="relative min-h-screen bg-[#040816] px-4 py-10 text-white">
        <div className="mx-auto max-w-6xl rounded-[28px] border border-white/10 bg-white/[0.04] px-8 py-24 text-center text-sm uppercase tracking-[0.28em] text-white/58">
          Loading Detail
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#040816] pb-24 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,166,255,0.18),transparent_24%),radial-gradient(circle_at_82%_16%,rgba(120,255,235,0.12),transparent_18%),linear-gradient(180deg,#07111d_0%,#040816_48%,#0a1629_100%)]" />

      <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-6 md:px-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-white/36">Book Practice</div>
            <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.05em] text-white md:text-[38px]">{payload?.book.name || "我的题库"}</h1>
            <p className="mt-3 text-sm leading-7 text-white/58">{payload?.book.description || "按科目筛题、继续练习、看参考答案，不走考试流程。"}</p>
          </div>
          <Button
            variant="outline"
            className="border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.10] hover:text-white"
            onClick={async () => {
              const resume = await mockApi.getUserBookQuestionBankResumeTarget(bookId);
              if (resume.bookItemId) {
                navigate(`/user/book-question-banks/${bookId}/items/${resume.bookItemId}`);
              }
            }}
          >
            继续练习
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          {progressBadges.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-[22px] border border-white/10 bg-white/[0.05] p-4 backdrop-blur-xl">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-white/36">
                  <Icon className={`size-4 ${item.color}`} />
                  {item.label}
                </div>
                <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">{item.value}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <span className="text-sm text-white/56">按科目筛选</span>
            <Select
              value={subjectId}
              onValueChange={(value) => {
                setSubjectId(value);
                void load(value, statusFilter);
              }}
            >
              <SelectTrigger className="border-white/10 bg-white/[0.05] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部科目</SelectItem>
                {payload?.subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <span className="text-sm text-white/56">按状态筛选</span>
            <Select
              value={statusFilter}
              onValueChange={(value: BookQuestionBankItemStatusFilter) => {
                setStatusFilter(value);
                void load(subjectId, value);
              }}
            >
              <SelectTrigger className="border-white/10 bg-white/[0.05] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          {payload?.items.map((item, index) => (
            <motion.button
              key={item.id}
              type="button"
              onClick={() => navigate(`/user/book-question-banks/${bookId}/items/${item.id}`)}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index * 0.02 }}
              className="rounded-[24px] border border-white/10 bg-white/[0.05] p-5 text-left backdrop-blur-xl transition hover:-translate-y-1 hover:border-white/20"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-0 bg-white/10 text-white shadow-none">{item.subjectName}</Badge>
                    {item.questionNo ? <Badge className="border-0 bg-white/8 text-white/70 shadow-none">{item.questionNo}</Badge> : null}
                    {item.answerState?.isAnswered ? <Badge className="border-0 bg-emerald-400/16 text-emerald-200 shadow-none">已作答</Badge> : null}
                    {item.answerState?.hasViewedAnswer ? <Badge className="border-0 bg-sky-400/16 text-sky-200 shadow-none">已看答案</Badge> : null}
                  </div>
                  <h2 className="mt-3 text-xl font-semibold tracking-[-0.04em] text-white">{item.title}</h2>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/52">
                    <span>{item.questionTypeLabel}</span>
                    <span>{item.score} 分</span>
                    {item.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm font-medium text-[#8fd6ff]">
                  <span>进入做题</span>
                  <ArrowRight className="size-4" />
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
