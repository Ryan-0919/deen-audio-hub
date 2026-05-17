import { ArrowLeft, CalendarDays, CheckCircle2, ChevronDown, ChevronUp, Circle, Clock3, LayoutGrid, Pause, Play, Volume2, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { AnnotatedAnswerText } from "../../components/AnnotatedAnswerText";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../../components/ui/sheet";
import type {
  MockExamQuestion,
  MockExamRecordDetail,
  MockExamReviewWorkflowStatus,
  MockExamSubjectiveSubQuestion,
} from "../../lib/mockData";
import { mockApi } from "../../lib/mockData";
import { getMockExamHomePath } from "./mockExamLaunchShared";

const pageFontStyle = {
  fontFamily: '"Microsoft YaHei","PingFang SC","Hiragino Sans GB","Noto Sans SC",sans-serif',
};

const handwritingStyle = {
  fontFamily: '"KaiTi","STKaiti","Kaiti SC",serif',
};
const REVIEW_CROSS_ICON = "https://hd-correct.oss-cn-beijing.aliyuncs.com/common/xcx-icons/%E5%8F%89%E5%8F%B7.png";

const stripHtml = (value: string) => value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const truncateText = (value: string, limit = 68) => (value.length > limit ? `${value.slice(0, limit)}...` : value);

const isPlaceholderMissedPointTitle = (value: string) => {
  const compact = stripHtml(value).replace(/\s+/g, "");
  if (!compact) {
    return true;
  }

  if (compact === "遗漏点") {
    return true;
  }

  return /^遗漏点(?:[0-9一二三四五六七八九十]+|[（(][0-9一二三四五六七八九十]+[）)])$/.test(compact);
};

const formatDateText = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  const second = `${date.getSeconds()}`.padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
};

const formatClockText = (seconds?: number | null) => {
  const safe = Math.max(0, Number(seconds ?? 0) || 0);
  const minutes = Math.floor(safe / 60);
  const remainSeconds = safe % 60;
  return `${minutes}:${remainSeconds.toString().padStart(2, "0")}`;
};

const formatDurationText = (seconds?: number | null) => {
  const safe = Math.max(0, Number(seconds ?? 0) || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainSeconds = safe % 60;
  return [hours, minutes, remainSeconds].map((value) => `${value}`.padStart(2, "0")).join(":");
};

const isSubjectiveQuestion = (question: MockExamQuestion) => question.type === "subjective_case";

const getQuestionPreview = (question: MockExamQuestion) => {
  const preview = stripHtml(question.material ? `${question.material} ${question.stem}` : question.stem);
  return preview || `第${question.sortOrder}题`;
};

const getQuestionPrompt = (question: MockExamQuestion, subQuestion: MockExamSubjectiveSubQuestion, index: number) => {
  const caseMaterial = stripHtml(question.material);
  const stem = stripHtml(question.stem);
  const title = stripHtml(subQuestion.title) || `第${index + 1}问`;
  const intro = [caseMaterial, stem].filter(Boolean).join("\n\n");

  return {
    intro,
    title,
  };
};

function FoldBlock({
  title,
  defaultExpanded = false,
  children,
}: {
  title: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#ececf1] bg-white shadow-[0_14px_30px_rgba(15,23,42,0.05)]">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-[#fafafa]"
      >
        <span className="text-[18px] font-semibold text-[#18181b]">{title}</span>
        {expanded ? <ChevronUp className="size-5 text-[#71717a]" /> : <ChevronDown className="size-5 text-[#71717a]" />}
      </button>
      {expanded ? <div className="border-t border-[#eef0f3] px-5 py-5">{children}</div> : null}
    </section>
  );
}

function ReviewVoicePlayer({
  url,
  durationSeconds,
}: {
  url: string;
  durationSeconds?: number;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePause = () => setPlaying(false);
    const handlePlay = () => setPlaying(true);
    const handleEnded = () => setPlaying(false);

    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [url]);

  return (
    <div className="rounded-[20px] border border-[#e4e4e7] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[17px] font-semibold text-[#18181b]">
          <Volume2 className="size-5 text-[#e11d48]" />
          本题语音点评
        </div>
        <span className="text-[15px] text-[#71717a]">{formatClockText(durationSeconds)}</span>
      </div>
      <div className="mt-4">
        <Button
          type="button"
          variant="outline"
          className="rounded-full border-[#e4e4e7] bg-white text-[#18181b] hover:bg-[#fafafa]"
          onClick={async () => {
            const audio = audioRef.current;
            if (!audio) return;
            if (audio.paused) {
              try {
                await audio.play();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "语音播放失败");
              }
              return;
            }
            audio.pause();
          }}
        >
          {playing ? "暂停播放" : "播放语音"}
        </Button>
      </div>
    </div>
  );
}

function LessonAudioInlinePlayer({
  url,
  durationSeconds,
}: {
  url: string;
  durationSeconds?: number;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePause = () => setPlaying(false);
    const handlePlay = () => setPlaying(true);
    const handleEnded = () => setPlaying(false);

    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [url]);

  return (
    <div className="mt-4 flex justify-start">
      <div className="inline-flex max-w-full items-center gap-4 rounded-full border border-[#ececf1] bg-[#fcfcfd] px-4 py-3 text-[#433b35] shadow-[0_10px_22px_rgba(24,24,27,0.05)]">
        <audio ref={audioRef} src={url} preload="metadata" className="hidden" />
        <span className="text-[18px] font-medium text-[#433b35]">微课</span>
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#18181b] text-white transition hover:bg-[#2b2b31]"
          onClick={async () => {
            const audio = audioRef.current;
            if (!audio) return;
            if (audio.paused) {
              try {
                await audio.play();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "语音播放失败");
              }
              return;
            }
            audio.pause();
          }}
        >
          {playing ? <Pause className="ml-[1px] size-5" /> : <Play className="ml-[2px] size-5 fill-current" />}
        </button>
        <div className="flex min-w-[132px] items-center gap-[5px]">
          {Array.from({ length: 10 }).map((_, index) => (
            <span
              key={index}
              className="w-[3px] shrink-0 rounded-full bg-[#e2485a]"
              style={{
                height: `${14 + [8, 18, 12, 22, 14, 24, 16, 20, 12, 18][index]}px`,
                opacity: playing ? 0.96 : 0.56,
              }}
            />
          ))}
        </div>
        <span className="shrink-0 text-[15px] font-medium tracking-[0.04em] text-[#71717a]">{formatClockText(durationSeconds)}</span>
      </div>
    </div>
  );
}

function PaperSectionTitle({ title }: { title: string }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="h-[10px] w-[10px] rounded-full bg-[#f43f5e]" />
      <h3 className="text-[22px] font-bold text-[#18181b]">{title}</h3>
    </div>
  );
}

type ReportCardStatus = "correct" | "wrong" | "partial" | "pending";

const getReportCardStatus = ({
  question,
  finalScorePending,
}: {
  question: MockExamQuestion;
  finalScorePending: boolean;
}): ReportCardStatus => {
  if (question.answerState === "unanswered") {
    return "pending";
  }

  if (isSubjectiveQuestion(question)) {
    if (finalScorePending) {
      return "pending";
    }

    if (question.score > 0 && question.earnedScore >= question.score) {
      return "correct";
    }

    if (question.earnedScore > 0) {
      return "partial";
    }

    return "wrong";
  }

  return question.isCorrect ? "correct" : "wrong";
};

const reportCardStatusMeta: Record<
  ReportCardStatus,
  {
    label: string;
    className: string;
  }
> = {
  correct: {
    label: "正确",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-[0_10px_18px_rgba(16,185,129,0.08)]",
  },
  wrong: {
    label: "错误",
    className: "border-rose-200 bg-rose-50 text-rose-700 shadow-[0_10px_18px_rgba(244,63,94,0.08)]",
  },
  partial: {
    label: "部分得分",
    className: "border-amber-200 bg-amber-50 text-amber-700 shadow-[0_10px_18px_rgba(245,158,11,0.08)]",
  },
  pending: {
    label: "未作答",
    className: "border-[#dbe4f5] bg-white text-[#8a98b5] shadow-[0_10px_18px_rgba(184,198,224,0.08)]",
  },
};

const reviewWorkflowStatusMeta: Record<
  MockExamReviewWorkflowStatus,
  {
    label: string;
    className: string;
    dotClassName: string;
    description: string;
  }
> = {
  not_required: {
    label: "可查看结果",
    className: "border-[#e4e4e7] bg-white text-[#52525b]",
    dotClassName: "bg-[#a1a1aa]",
    description: "本次作答已直接生成考试结果，可查看答案与解析。",
  },
  ai_pending: {
    label: "待批改",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    dotClassName: "bg-amber-500",
    description: "试卷已提交，系统正在排队进入批改流程。",
  },
  ai_processing: {
    label: "批改中",
    className: "border-sky-200 bg-sky-50 text-sky-700",
    dotClassName: "bg-sky-500",
    description: "系统正在生成分问批注和总点评。",
  },
  manual_pending: {
    label: "待老师核对",
    className: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
    dotClassName: "bg-fuchsia-500",
    description: "结果已生成，正在等待人工复核后发布。",
  },
  published: {
    label: "批改已发布",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dotClassName: "bg-emerald-500",
    description: "本次试卷的批改结果已经可以正式查看。",
  },
};

function SubjectiveQuestionBlock({
  question,
  subQuestion,
  activeSubQuestionIndex,
}: {
  question: MockExamQuestion;
  subQuestion: MockExamSubjectiveSubQuestion;
  activeSubQuestionIndex: number;
}) {
  const prompt = getQuestionPrompt(question, subQuestion, activeSubQuestionIndex);
  const displayAudioUrl = question.lessonAudioUrl || question.reviewVoiceUrl || "";
  const displayAudioDurationSeconds =
    Number(question.lessonAudioDurationSeconds ?? 0) > 0
      ? Number(question.lessonAudioDurationSeconds ?? 0)
      : Number(question.reviewVoiceDurationSeconds ?? 0);

  return (
    <section className="rounded-[24px] border border-[#ececf1] bg-white px-5 py-5 shadow-[0_14px_30px_rgba(15,23,42,0.05)]">
      <PaperSectionTitle title={`当前小问（满分：${Number(subQuestion.maxScore ?? 0)}分）`} />
      <div className="mb-4 text-[16px] text-[#71717a]">本题总分 {Number(question.score ?? 0)} 分，当前查看第 {activeSubQuestionIndex + 1} 问</div>
      {prompt.intro ? (
        <div className="rounded-[18px] border border-[#eef0f3] bg-[#fcfcfd] px-5 py-5 text-[18px] leading-9 text-[#52525b]">
          <div className="whitespace-pre-wrap">{prompt.intro}</div>
        </div>
      ) : null}
      {displayAudioUrl ? <LessonAudioInlinePlayer url={displayAudioUrl} durationSeconds={displayAudioDurationSeconds} /> : null}
      <div className={prompt.intro ? "mt-4" : ""}>
        <div className="whitespace-pre-wrap text-[20px] leading-[2] text-[#18181b]">{prompt.title}</div>
      </div>
    </section>
  );
}

function SubjectiveAnswerReviewBlock({
  subQuestion,
  pending,
}: {
  subQuestion: MockExamSubjectiveSubQuestion;
  pending: boolean;
}) {
  const skippedReview = Boolean(subQuestion.skippedReview);
  const hasAnswerMarks = Array.isArray(subQuestion.answerMarks) && subQuestion.answerMarks.length > 0;
  const hasReviewComment = `${subQuestion.reviewComment ?? ""}`.trim().length > 0;
  const hasMissedPoints = Array.isArray(subQuestion.missedPoints) && subQuestion.missedPoints.length > 0;
  const hasActualReviewContent = Boolean(subQuestion.isReviewed) && (hasAnswerMarks || hasReviewComment || hasMissedPoints);
  const showReviewFeedback = !pending && !skippedReview && hasActualReviewContent;
  const missedRubricPoints = (subQuestion.missedPoints ?? [])
    .map((point, index) => ({
      id: point.id || `missed_${index + 1}`,
      title: stripHtml(point.title || ""),
      description: stripHtml(point.description || ""),
      score: Number(point.score ?? 0) || 0,
    }))
    .filter((point) => point.title && point.description && !isPlaceholderMissedPointTitle(point.title));
  const paragraphs = (showReviewFeedback ? subQuestion.reviewComment || "暂无批改评语" : "")
    .split(/\n+/)
    .filter(Boolean);
  const answerTitle = pending ? (
    "我的答案"
  ) : skippedReview ? (
    "我的答案（本问已直接展示参考答案）"
  ) : (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span>{`我的答案（得分：${Number(subQuestion.score ?? 0)}）点击`}</span>
      <img src={REVIEW_CROSS_ICON} alt="" aria-hidden="true" className="h-[18px] w-[18px] object-contain" />
      <span>查看错误评语</span>
    </span>
  );

  return (
    <section className="rounded-[24px] border border-[#ececf1] bg-white px-5 py-5 shadow-[0_14px_30px_rgba(15,23,42,0.05)]">
      <PaperSectionTitle title={answerTitle} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div>
          <div className="rounded-[18px] border border-[#eef0f3] bg-white px-2 py-2">
            <AnnotatedAnswerText
              answer={subQuestion.answer?.trim() || "未作答"}
              marks={showReviewFeedback ? subQuestion.answerMarks : []}
              paragraphClassName="whitespace-pre-wrap text-[20px] leading-[2.2] text-[#18181b]"
            />
          </div>

          {showReviewFeedback ? (
            <div className="relative mt-6 px-5 py-3">
              <img
                src="/lsyz.png"
                alt="已批注"
                className="pointer-events-none absolute right-5 top-[-4px] h-[65px] w-auto select-none opacity-90"
                style={{ transform: "rotate(-7deg)" }}
              />
              <div className="mb-3 pr-28">
                <div className="text-[18px] font-semibold text-[#18181b]">老师评语：</div>
              </div>
              <div className="space-y-4 pr-2 text-[17px] leading-[32px] text-[#e2485a]" style={handwritingStyle}>
                {(paragraphs.length > 0 ? paragraphs : ["暂无批改评语"]).map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-wrap">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {showReviewFeedback ? (
          <aside className="relative px-1 pt-3 xl:sticky xl:top-6 xl:self-start">
            <div className="relative overflow-hidden rounded-[20px] border border-[#ececf1] bg-white px-5 pb-5 pt-5 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
              <div className="relative">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="pr-2">
                    <div className="text-[18px] leading-none text-[#e11d48]" style={handwritingStyle}>
                      该问遗漏点👇：
                    </div>
                  </div>
                  <span className="rounded-full border border-[#fda4af] bg-[#fff1f2] px-3 py-1 text-[13px] font-semibold text-[#e11d48]">
                    {missedRubricPoints.length} 个
                  </span>
                </div>

                {missedRubricPoints.length > 0 ? (
                  <div className="relative mt-5 space-y-4">
                    {missedRubricPoints.map((point) => (
                      <div key={point.id} className="relative pl-5">
                        <div className="absolute left-[-4px] top-2.5 size-[9px] rounded-full bg-[#f43f5e]" />
                        <div className="border-b border-dashed border-[#ebecef] pb-3 last:border-b-0">
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="text-[16px] font-semibold text-[#e2485a]">{point.title}</div>
                              {point.description ? <p className="mt-2 text-[14px] leading-7 text-[#52525b]">{point.description}</p> : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="relative mt-5">
                    <div className="rounded-[14px] border border-[#ebecef] bg-[#fafafa] px-4 py-4 text-[14px] leading-7 text-[#52525b]">
                      本问暂无遗漏点。
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}

function ObjectiveQuestionCard({
  question,
  innerRef,
  highlighted = false,
}: {
  question: MockExamQuestion;
  innerRef?: (node: HTMLElement | null) => void;
  highlighted?: boolean;
}) {
  const promptText = [stripHtml(question.material), stripHtml(question.stem)].filter(Boolean).join("\n\n");

  return (
    <section
      ref={innerRef}
      className={[
        "scroll-mt-24 rounded-[28px] border border-[#ececf1] bg-white px-5 py-5 shadow-[0_16px_34px_rgba(15,23,42,0.05)] transition md:px-6",
        highlighted ? "ring-2 ring-[#c9d7ff] shadow-[0_24px_46px_rgba(96,129,214,0.12)]" : "",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-[18px] bg-[#18181b] text-[24px] font-black text-white shadow-[0_12px_24px_rgba(24,24,27,0.14)]">
            {question.sortOrder}
          </div>
          <div>
            <div className="text-[23px] font-semibold leading-tight tracking-[-0.04em] text-[#18181b]">第{question.sortOrder}题</div>
            <div className="mt-2 text-[15px] text-[#71717a]">
              {question.typeLabel} · {question.score} 分
            </div>
            {question.sectionLabel ? <div className="mt-2 text-[14px] text-[#a1a1aa]">{question.sectionLabel}</div> : null}
          </div>
        </div>
        <Badge
          className={
            question.isCorrect
              ? "rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1 text-[#1f8a48]"
              : "rounded-full border border-rose-200 bg-rose-50 px-4 py-1 text-[#d04d4d]"
          }
        >
          {question.isCorrect ? "正确" : "错误"}
        </Badge>
      </div>

      <div className="mt-5 rounded-[22px] border border-[#eef0f3] bg-[#fcfcfd] px-5 py-5 text-[18px] leading-9 text-[#27272a]">
        <div className="whitespace-pre-wrap">{promptText || `第${question.sortOrder}题`}</div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-[20px] border border-[#eef0f3] bg-white px-5 py-4">
          <div className="text-[15px] font-medium text-[#8f8f95]">你的答案</div>
          <div className="mt-3 text-[20px] font-semibold text-[#18181b]">{question.userAnswerKeys.join("、") || "未作答"}</div>
        </div>
        <div className="rounded-[20px] border border-[#eef0f3] bg-white px-5 py-4">
          <div className="text-[15px] font-medium text-[#8f8f95]">参考答案</div>
          <div className="mt-3 text-[20px] font-semibold text-[#18181b]">
            {question.correctAnswerKeys.join("、") || "暂无参考答案"}
          </div>
        </div>
      </div>

      {question.analysis ? (
        <div className="mt-5 rounded-[20px] border border-[#ececf1] bg-[#fafafa] px-5 py-4 text-[17px] leading-8 text-[#52525b]">
          <div className="mb-2 text-[17px] font-semibold text-[#18181b]">答案解析</div>
          <div className="whitespace-pre-wrap">{question.analysis}</div>
        </div>
      ) : null}
    </section>
  );
}

function SubjectiveSummaryCard({
  question,
  pending,
  onOpen,
}: {
  question: MockExamQuestion;
  pending: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative flex w-full cursor-pointer flex-col overflow-hidden rounded-[26px] border border-[#ececf1] bg-[linear-gradient(180deg,#ffffff_0%,#fbfbfd_100%)] px-5 py-5 text-left shadow-[0_14px_32px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(15,23,42,0.08)]"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,rgba(226,72,90,0),rgba(226,72,90,0.5),rgba(226,72,90,0))]" />
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-[16px] bg-[#18181b] text-[20px] font-black text-white shadow-[0_10px_18px_rgba(24,24,27,0.18)]">
            {question.sortOrder}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-[22px] font-semibold tracking-[-0.04em] text-[#18181b]">第{question.sortOrder}题</div>
              <span className="rounded-full border border-[#ececf1] bg-white px-3 py-1 text-[13px] font-medium text-[#71717a]">
                本题满分 {question.score} 分
              </span>
            </div>
            <div className="mt-3 text-[16px] leading-8 text-[#3f3f46]">{truncateText(getQuestionPreview(question), 116)}</div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[13px] text-[#8f8f95]">{pending ? "当前状态" : "本题得分"}</div>
          <div className="mt-2 text-[28px] font-semibold tracking-[-0.04em] text-[#18181b]">
            {pending ? "待出分" : `${question.earnedScore}/${question.score}`}
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-[#f1f1f4] pt-4 text-[14px] text-[#71717a]">
        <span>{pending ? "批改完成后可查看完整评语与遗漏点" : "点击进入本题完整批改详情"}</span>
        <span className="font-semibold text-[#e2485a] transition group-hover:translate-x-0.5">查看详情</span>
      </div>
    </button>
  );
}

function StatusPill({
  icon,
  label,
  value,
  accentClassName,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accentClassName: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[20px] border border-[#e5e7eb] bg-white px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${accentClassName}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[13px] text-[#71717a]">{label}</div>
        <div className="truncate text-[20px] font-semibold tracking-[-0.03em] text-[#18181b]">{value}</div>
      </div>
    </div>
  );
}

function SubjectiveReviewSheet({
  record,
  question,
  open,
  onOpenChange,
}: {
  record: MockExamRecordDetail;
  question: MockExamQuestion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [activeSubQuestionIndex, setActiveSubQuestionIndex] = useState(0);

  useEffect(() => {
    setActiveSubQuestionIndex(0);
  }, [question?.id]);

  const currentSubQuestion = question?.subjectiveSubQuestions[activeSubQuestionIndex] ?? null;

  if (!question || !currentSubQuestion) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[92vh] rounded-t-[28px] border-0 bg-[#fafafa] p-0 [&>button]:right-5 [&>button]:top-5"
      >
        <SheetHeader className="border-b border-[#ececec] bg-white px-5 py-4 text-left">
          <SheetTitle className="text-center text-[22px] font-semibold tracking-[-0.04em] text-[#18181b]">批改结果</SheetTitle>
          <SheetDescription className="text-center text-[15px] text-[#71717a]">点击题号切换不同小问的批改详情</SheetDescription>
        </SheetHeader>

        <div className="h-full overflow-y-auto px-4 pb-10 pt-5" style={pageFontStyle}>
          <div className="flex items-center justify-center gap-3 text-[#18181b]">
            <div className="h-[1px] w-[88px] bg-[linear-gradient(90deg,transparent_0%,#d1d5db_100%)]" />
            <span className="text-[19px] font-semibold tracking-[0.02em]">题目解析</span>
            <div className="h-[1px] w-[88px] bg-[linear-gradient(90deg,#d1d5db_0%,transparent_100%)]" />
          </div>

          <div className="mx-auto mt-5 max-w-[1220px] px-0 py-0">
            <div className="grid grid-cols-3 gap-3">
              {question.subjectiveSubQuestions.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSubQuestionIndex(index)}
                  className={[
                    "rounded-[16px] border px-4 py-3 text-[17px] font-medium transition",
                    activeSubQuestionIndex === index
                      ? "border-[#e2485a] bg-[#e2485a] text-white shadow-[0_12px_22px_rgba(226,72,90,0.2)]"
                      : "border-[#e5e7eb] bg-white text-[#52525b] hover:border-[#d1d5db] hover:bg-[#fcfcfd]",
                  ].join(" ")}
                >
                  第{index + 1}问
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-4">
              <SubjectiveQuestionBlock
                question={question}
                subQuestion={currentSubQuestion}
                activeSubQuestionIndex={activeSubQuestionIndex}
              />

              <SubjectiveAnswerReviewBlock subQuestion={currentSubQuestion} pending={record.summary.finalScorePending} />

              <FoldBlock title="参考答案" defaultExpanded>
                <div className="whitespace-pre-wrap text-[18px] leading-9 text-[#433b35]">
                  {record.summary.finalScorePending ? "批改完成后显示参考答案。" : currentSubQuestion.referenceAnswer || "暂无参考答案"}
                </div>
              </FoldBlock>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function MockExamResult() {
  const navigate = useNavigate();
  const { recordId = "" } = useParams();
  const [record, setRecord] = useState<MockExamRecordDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSubjectiveQuestionId, setActiveSubjectiveQuestionId] = useState("");
  const [activeObjectiveQuestionId, setActiveObjectiveQuestionId] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const objectiveQuestionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    let disposed = false;

    const load = async () => {
      setLoading(true);
      try {
        const next = await mockApi.getMockExamRecord(recordId);
        if (!disposed) {
          setRecord(next);
        }
      } catch (error) {
        if (!disposed) {
          toast.error(error instanceof Error ? error.message : "加载机考结果失败");
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
  }, [recordId]);

  const subjectiveQuestions = useMemo(
    () => (record?.questions ?? []).filter((question) => isSubjectiveQuestion(question)),
    [record],
  );

  const objectiveQuestions = useMemo(
    () => (record?.questions ?? []).filter((question) => !isSubjectiveQuestion(question)),
    [record],
  );
  const allQuestions = record?.questions ?? [];
  const questionGroups = useMemo(() => {
    const groupMap = new Map<string, { key: string; label: string; questions: MockExamQuestion[] }>();

    for (const question of allQuestions) {
      const fallbackLabel = isSubjectiveQuestion(question) ? "主观题" : "客观题";
      const label = question.sectionLabel?.trim() || fallbackLabel;
      if (!groupMap.has(label)) {
        groupMap.set(label, {
          key: label,
          label,
          questions: [],
        });
      }
      groupMap.get(label)?.questions.push(question);
    }

    return Array.from(groupMap.values());
  }, [allQuestions]);

  const activeSubjectiveQuestion =
    subjectiveQuestions.find((question) => question.id === activeSubjectiveQuestionId) ?? subjectiveQuestions[0] ?? null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] px-4 py-10" style={pageFontStyle}>
        <div className="mx-auto max-w-6xl rounded-[20px] border border-[#e4e4e7] bg-white px-6 py-8 text-[18px] text-[#71717a] shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
          机考结果加载中...
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="min-h-screen bg-[#fafafa] px-4 py-10" style={pageFontStyle}>
        <div className="mx-auto max-w-6xl rounded-[20px] border border-[#e4e4e7] bg-white px-6 py-8 text-[18px] text-[#71717a] shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
          未找到本次机考结果
        </div>
      </div>
    );
  }

  const latestSyncTime = formatDateText(record.publishedAt || record.reviewedAt || record.submittedAt);
  const workflowMeta = reviewWorkflowStatusMeta[record.reviewWorkflowStatus];
  const subjectivePendingCount = subjectiveQuestions.filter((question) =>
    question.subjectiveSubQuestions.some((item) => !item.isReviewed),
  ).length;

  const handleQuestionNavigate = (question: MockExamQuestion) => {
    if (isSubjectiveQuestion(question)) {
      setActiveSubjectiveQuestionId(question.id);
      setSheetOpen(true);
      return;
    }

    setActiveObjectiveQuestionId(question.id);
    requestAnimationFrame(() => {
      objectiveQuestionRefs.current[question.id]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#ffffff_0%,#f7f7f8_58%,#f2f2f3_100%)] px-4 py-6 md:px-6 md:py-8" style={pageFontStyle}>
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-[#e5e7eb] bg-white/90 text-[#18181b] shadow-[0_10px_24px_rgba(15,23,42,0.04)] backdrop-blur"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="mr-2 size-4" />
              返回
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-[#e5e7eb] bg-white/90 text-[#18181b] shadow-[0_10px_24px_rgba(15,23,42,0.04)] backdrop-blur"
              onClick={() => navigate("/user/my-exams")}
            >
              我的考试
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-[#e5e7eb] bg-white/90 text-[#18181b] shadow-[0_10px_24px_rgba(15,23,42,0.04)] backdrop-blur"
              onClick={() => navigate(getMockExamHomePath(record.paper))}
            >
              返回机考试卷
            </Button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_380px]">
          <section className="overflow-hidden rounded-[32px] border border-white/80 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.08)]">
            <div className="relative overflow-hidden border-b border-[#eef0f3] px-5 pb-7 pt-6 md:px-8 xl:px-10">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.12),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.08),transparent_26%)]" />
              <div className="relative">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge className={`rounded-full border px-4 py-1.5 text-[13px] font-semibold ${workflowMeta.className}`}>
                        <span className={`mr-2 inline-block size-2 rounded-full ${workflowMeta.dotClassName}`} />
                        {workflowMeta.label}
                      </Badge>
                      <span className="text-[13px] tracking-[0.16em] text-[#8f8f95]">机考结果</span>
                    </div>
                    <h1 className="mt-4 text-[30px] font-semibold tracking-[-0.05em] text-[#18181b] md:text-[38px]">
                      {record.paper.title}
                    </h1>
                    <p className="mt-3 max-w-[860px] text-[15px] leading-7 text-[#6b7280]">{workflowMeta.description}</p>
                  </div>

                  {record.paper.coverUrl ? (
                    <div className="hidden h-[138px] w-[232px] shrink-0 overflow-hidden rounded-[24px] border border-white/80 bg-[#f4f4f5] shadow-[0_20px_40px_rgba(15,23,42,0.08)] md:block">
                      <img src={record.paper.coverUrl} alt={record.paper.title} className="h-full w-full object-cover" />
                    </div>
                  ) : null}
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <StatusPill
                    icon={<CheckCircle2 className="size-5 text-[#e11d48]" />}
                    label="总分"
                    value={record.summary.finalScorePending ? "待出分" : `${record.totalScore} / ${record.paper.totalScore}`}
                    accentClassName="bg-[#fff1f2]"
                  />
                  <StatusPill
                    icon={<Clock3 className="size-5 text-[#2563eb]" />}
                    label="考试用时"
                    value={formatDurationText(record.consumedSeconds)}
                    accentClassName="bg-[#eff6ff]"
                  />
                  <StatusPill
                    icon={<CalendarDays className="size-5 text-[#7c3aed]" />}
                    label="交卷时间"
                    value={formatDateText(record.submittedAt)}
                    accentClassName="bg-[#f5f3ff]"
                  />
                  <StatusPill
                    icon={<LayoutGrid className="size-5 text-[#0f766e]" />}
                    label="答题情况"
                    value={`${record.answeredCount}/${record.questionCount} 题`}
                    accentClassName="bg-[#ecfeff]"
                  />
                </div>
              </div>
            </div>

            <div className="px-5 py-6 md:px-8 xl:px-10">
              {subjectiveQuestions.length > 0 ? (
                <section>
                  <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <div className="text-[13px] tracking-[0.14em] text-[#8f8f95]">主观题</div>
                      <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.04em] text-[#18181b]">
                        {record.reviewWorkflowStatus === "not_required" ? "答案解析" : "批改结果"}
                      </h2>
                    </div>
                    <div className="text-[14px] text-[#71717a]">
                      共 {subjectiveQuestions.length} 题
                      {record.summary.finalScorePending
                        ? `，待完成 ${subjectivePendingCount} 题`
                        : record.reviewWorkflowStatus === "not_required"
                          ? "，可直接查看答案与解析"
                          : "，可查看完整评语"}
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    {subjectiveQuestions.map((question) => (
                      <SubjectiveSummaryCard
                        key={question.id}
                        question={question}
                        pending={record.summary.finalScorePending}
                        onOpen={() => {
                          setActiveSubjectiveQuestionId(question.id);
                          setSheetOpen(true);
                        }}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              {objectiveQuestions.length > 0 ? (
                <section className={subjectiveQuestions.length > 0 ? "mt-8 border-t border-[#eef0f3] pt-8" : ""}>
                  <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <div className="text-[13px] tracking-[0.14em] text-[#8f8f95]">客观题</div>
                      <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.04em] text-[#18181b]">答案解析</h2>
                    </div>
                    <div className="text-[14px] text-[#71717a]">点击右侧答题卡题号，直接定位对应题目。</div>
                  </div>
                  <div className="space-y-4">
                    {objectiveQuestions.map((question) => (
                      <ObjectiveQuestionCard
                        key={question.id}
                        question={question}
                        highlighted={activeObjectiveQuestionId === question.id}
                        innerRef={(node) => {
                          objectiveQuestionRefs.current[question.id] = node;
                        }}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </section>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            <div className="overflow-hidden rounded-[30px] border border-white/80 bg-white shadow-[0_24px_64px_rgba(15,23,42,0.08)]">
              <div className="border-b border-[#eef0f3] px-5 pb-5 pt-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[13px] tracking-[0.14em] text-[#8f8f95]">快速定位</div>
                    <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.04em] text-[#18181b]">答题卡</h2>
                  </div>
                  <div className="rounded-full border border-[#ececf1] bg-[#fafafa] px-3 py-1 text-[13px] font-medium text-[#71717a]">
                    共 {record.questionCount} 题
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-[13px] text-[#71717a]">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-[#1f8a48]" />
                    <span>正确</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Circle className="size-4 text-[#b7791f]" />
                    <span>部分得分</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="size-4 text-[#c24149]" />
                    <span>错误</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Circle className="size-4 text-[#a1a1aa]" />
                    <span>未作答</span>
                  </div>
                </div>
              </div>

              <div className="max-h-[calc(100vh-220px)] overflow-y-auto px-5 py-5">
                <div className="space-y-4">
                  {questionGroups.map((group) => (
                    <div key={group.key} className="rounded-[22px] border border-[#ececf1] bg-[#fafafa] px-4 py-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="text-[17px] font-semibold text-[#18181b]">{group.label}</div>
                        <div className="text-[13px] text-[#8f8f95]">{group.questions.length} 题</div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        {group.questions.map((question) => {
                          const status = getReportCardStatus({
                            question,
                            finalScorePending: record.summary.finalScorePending,
                          });
                          const meta = reportCardStatusMeta[status];
                          const isActiveObjective = activeObjectiveQuestionId === question.id;

                          return (
                            <button
                              key={question.id}
                              type="button"
                              title={getQuestionPreview(question)}
                              onClick={() => handleQuestionNavigate(question)}
                              className={[
                                "flex h-[50px] min-w-[50px] cursor-pointer items-center justify-center rounded-[16px] border px-3 text-[16px] font-bold transition hover:-translate-y-0.5 hover:shadow-[0_12px_18px_rgba(15,23,42,0.08)]",
                                meta.className,
                                isActiveObjective ? "ring-2 ring-[#c9d7ff]" : "",
                              ].join(" ")}
                            >
                              {question.sortOrder}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-[20px] border border-[#ececf1] bg-white px-4 py-4 text-[13px] leading-6 text-[#71717a]">
                  最近同步时间：{latestSyncTime}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <SubjectiveReviewSheet
        record={record}
        question={activeSubjectiveQuestion}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}
