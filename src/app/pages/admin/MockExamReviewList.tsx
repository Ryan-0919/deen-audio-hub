import { ArrowLeft, Check, LoaderCircle, Minus, Plus, Search, Send, Trash2, Upload, X } from "lucide-react";
import type { ChangeEvent, ReactNode } from "react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { AnnotatedAnswerText } from "../../components/AnnotatedAnswerText";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Textarea } from "../../components/ui/textarea";
import type {
  AdminMockExamPaperListPayload,
  AdminMockExamReviewDetail,
  AdminMockExamReviewPaperListPayload,
  AdminMockExamReviewPaperSummary,
  AdminMockExamReviewQuestionScoreInput,
  AdminMockExamReviewStatus,
  AdminMockExamReviewSummary,
  MockExamMissedPoint,
  MockExamRubricPoint,
  MockExamSubjectiveAnswerMark,
} from "../../lib/mockData";
import { mockApi } from "../../lib/mockData";

const PAGE_SIZE = 20;

const reviewStatusMeta: Record<AdminMockExamReviewStatus, { label: string; className: string }> = {
  ai_pending: { label: "待批改", className: "bg-amber-100 text-amber-800" },
  ai_processing: { label: "批改中", className: "bg-sky-100 text-sky-700" },
  manual_reviewing: { label: "我正在批改", className: "bg-rose-100 text-rose-700" },
  manual_pending: { label: "待人工发送", className: "bg-violet-100 text-violet-700" },
  published: { label: "已发送", className: "bg-emerald-100 text-emerald-700" },
};

const reviewStageCards: Array<{
  status: AdminMockExamReviewStatus;
  label: string;
  description: string;
  activeClassName: string;
  idleClassName: string;
}> = [
  {
    status: "ai_pending",
    label: "待批改",
    description: "刚交卷，等待进入批改流程",
    activeClassName: "border-amber-300 bg-amber-50 text-amber-900 shadow-[0_18px_40px_rgba(217,119,6,0.10)]",
    idleClassName: "border-slate-200 bg-white text-slate-700 hover:border-amber-200 hover:bg-amber-50/60",
  },
  {
    status: "ai_processing",
    label: "批改中",
    description: "正在分析答案并生成批注",
    activeClassName: "border-sky-300 bg-sky-50 text-sky-900 shadow-[0_18px_40px_rgba(14,165,233,0.10)]",
    idleClassName: "border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50/60",
  },
  {
    status: "manual_reviewing",
    label: "我正在批改",
    description: "已经领取，当前由你继续编辑",
    activeClassName: "border-rose-300 bg-rose-50 text-rose-900 shadow-[0_18px_40px_rgba(244,63,94,0.10)]",
    idleClassName: "border-slate-200 bg-white text-slate-700 hover:border-rose-200 hover:bg-rose-50/60",
  },
  {
    status: "manual_pending",
    label: "待人工发送",
    description: "结果已生成，待老师核对后发送",
    activeClassName: "border-violet-300 bg-violet-50 text-violet-900 shadow-[0_18px_40px_rgba(139,92,246,0.10)]",
    idleClassName: "border-slate-200 bg-white text-slate-700 hover:border-violet-200 hover:bg-violet-50/60",
  },
  {
    status: "published",
    label: "已发送",
    description: "批改结果已经发送给学生",
    activeClassName: "border-emerald-300 bg-emerald-50 text-emerald-900 shadow-[0_18px_40px_rgba(16,185,129,0.10)]",
    idleClassName: "border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/60",
  },
];

const unknownReviewStatusMeta = {
  label: "待处理",
  className: "bg-slate-100 text-slate-700",
};

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

const EMPTY_REVIEWS = {
  list: [] as AdminMockExamReviewSummary[],
  pagination: { total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 },
  summary: { total: 0, aiPending: 0, aiProcessing: 0, manualReviewing: 0, manualPending: 0, published: 0 },
};

const normalizeReviewStatus = (status: string | null | undefined): AdminMockExamReviewStatus | null => {
  if (!status) return null;

  if (status in reviewStatusMeta) {
    return status as AdminMockExamReviewStatus;
  }

  if (status === "reviewed" || status === "not_required") {
    return "published";
  }

  if (status === "pending") {
    return "manual_pending";
  }

  return null;
};

const getReviewStatusMeta = (status: string | null | undefined) => {
  const normalizedStatus = normalizeReviewStatus(status);
  return normalizedStatus ? reviewStatusMeta[normalizedStatus] : unknownReviewStatusMeta;
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

type DraftState = {
  scores: Record<string, string>;
  comments: Record<string, string>;
  references: Record<string, string>;
  abilities: Record<string, string>;
  marks: Record<string, EditableAnswerMark[]>;
  rubricGuidance: Record<string, string>;
  rubricPoints: Record<string, EditableRubricPoint[]>;
  missedPoints: Record<string, EditableMissedPoint[]>;
  reviewVoices: Record<string, EditableReviewVoice>;
};

type EditableAnswerMark = {
  id: string;
  highlight: string;
  comment: string;
  status: "correct" | "wrong" | "score" | "neutral";
  score: string;
};

type EditableRubricPoint = {
  id: string;
  title: string;
  description: string;
  score: string;
  keywords: string;
  hit: boolean;
  awardedScore: string;
  matchedText: string;
};

type EditableMissedPoint = {
  id: string;
  title: string;
  description: string;
  score: string;
};

type EditableReviewVoice = {
  url: string;
  objectKey: string;
  durationSeconds: number;
  source?: "lesson" | "review";
};

const getSubQuestionKey = (questionId: string, subQuestionId: string) => `${questionId}::${subQuestionId}`;

const buildDraftState = (detail: AdminMockExamReviewDetail): DraftState => {
  const scores: Record<string, string> = {};
  const comments: Record<string, string> = {};
  const references: Record<string, string> = {};
  const abilities: Record<string, string> = {};
  const marks: Record<string, EditableAnswerMark[]> = {};
  const rubricGuidance: Record<string, string> = {};
  const rubricPoints: Record<string, EditableRubricPoint[]> = {};
  const missedPoints: Record<string, EditableMissedPoint[]> = {};
  const reviewVoices: Record<string, EditableReviewVoice> = {};

  for (const question of detail.questions.filter((item) => item.type === "subjective_case")) {
    const lessonAudioUrl = (question.lessonAudioUrl ?? "").trim();
    const lessonAudioObjectKey = (question.lessonAudioObjectKey ?? "").trim();
    const reviewVoiceUrl = (question.reviewVoiceUrl ?? "").trim();
    const reviewVoiceObjectKey = (question.reviewVoiceObjectKey ?? "").trim();
    const isUsingLessonAudioFallback =
      Boolean(reviewVoiceUrl) &&
      ((!reviewVoiceObjectKey && !lessonAudioObjectKey && reviewVoiceUrl === lessonAudioUrl) ||
        (Boolean(reviewVoiceObjectKey) && Boolean(lessonAudioObjectKey) && reviewVoiceObjectKey === lessonAudioObjectKey));

    reviewVoices[question.id] = {
      url: question.reviewVoiceUrl ?? "",
      objectKey: question.reviewVoiceObjectKey ?? "",
      durationSeconds: Number(question.reviewVoiceDurationSeconds ?? 0) || 0,
      source: isUsingLessonAudioFallback ? "lesson" : reviewVoiceUrl ? "review" : undefined,
    };

    for (const subQuestion of question.subjectiveSubQuestions) {
      const key = getSubQuestionKey(question.id, subQuestion.id);
      scores[key] = `${subQuestion.score ?? 0}`;
      comments[key] = subQuestion.reviewComment ?? "";
      references[key] = subQuestion.referenceAnswer ?? "";
      abilities[key] = subQuestion.abilityLabel ?? subQuestion.title ?? "";
      rubricGuidance[key] = subQuestion.rubricGuidance ?? "";
      marks[key] = (subQuestion.answerMarks ?? []).map((mark, index) => ({
        id: mark.id || `${key}_mark_${index + 1}`,
        highlight: mark.highlight ?? "",
        comment: mark.comment ?? "",
        status: mark.status === "correct" || mark.status === "score" || mark.status === "neutral" ? mark.status : "wrong",
        score: Number.isFinite(Number(mark.score)) ? `${Number(mark.score)}` : "",
      }));
      rubricPoints[key] = (subQuestion.rubricPoints ?? []).map((point, index) => ({
        id: point.id || `${key}_rubric_${index + 1}`,
        title: point.title ?? "",
        description: point.description ?? "",
        score: Number.isFinite(Number(point.score)) ? `${Number(point.score)}` : "",
        keywords: Array.isArray(point.keywords) ? point.keywords.join("，") : "",
        hit: Boolean(point.hit),
        awardedScore: Number.isFinite(Number(point.awardedScore)) ? `${Number(point.awardedScore)}` : "",
        matchedText: point.matchedText ?? "",
      }));
      missedPoints[key] = (subQuestion.missedPoints ?? []).map((point, index) => ({
        id: point.id || `${key}_missed_${index + 1}`,
        title: point.title ?? "",
        description: point.description ?? "",
        score: Number.isFinite(Number(point.score)) ? `${Number(point.score)}` : "",
      }));
    }
  }

  return { scores, comments, references, abilities, marks, rubricGuidance, rubricPoints, missedPoints, reviewVoices };
};

const getPaperStageCount = (paper: AdminMockExamReviewPaperSummary | null, status: AdminMockExamReviewStatus) => {
  if (!paper) return 0;

  if (status === "ai_pending") return paper.reviewSummary.aiPending;
  if (status === "ai_processing") return paper.reviewSummary.aiProcessing;
  if (status === "manual_reviewing") return paper.reviewSummary.manualReviewing;
  if (status === "manual_pending") return paper.reviewSummary.manualPending;
  return paper.reviewSummary.published;
};

const getDefaultReviewStatus = (paper: AdminMockExamReviewPaperSummary | null): AdminMockExamReviewStatus => {
  if (!paper) return "manual_pending";
  return reviewStageCards.find((item) => getPaperStageCount(paper, item.status) > 0)?.status ?? "ai_pending";
};

type SubjectiveQuestion = AdminMockExamReviewDetail["questions"][number];
type SubjectiveSubQuestion = SubjectiveQuestion["subjectiveSubQuestions"][number];

function QuestionReviewVoicePanel({
  reviewVoice,
  reviewVoiceUploading,
  onReviewVoiceUpload,
  onReviewVoiceClear,
}: {
  reviewVoice: EditableReviewVoice;
  reviewVoiceUploading: boolean;
  onReviewVoiceUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onReviewVoiceClear: () => void;
}) {
  const voiceInputRef = useRef<HTMLInputElement | null>(null);
  const reviewVoiceSource = reviewVoice.source ?? (reviewVoice.url ? "review" : undefined);

  return (
    <section className="mt-1 rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h4 className="text-base font-semibold text-slate-900">本题语音点评</h4>
          <p className="mt-1 text-sm text-slate-500">
            {reviewVoiceSource === "lesson"
              ? "当前默认复用题目已关联音频，无需重复上传；如需替换，可重新上传覆盖。"
              : "同一道大题只保留这一份语音点评，也可直接复用题目已关联音频。"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={voiceInputRef} type="file" accept="audio/*" className="hidden" onChange={onReviewVoiceUpload} />
          <Button type="button" variant="outline" onClick={() => voiceInputRef.current?.click()} disabled={reviewVoiceUploading}>
            <Upload className="mr-2 size-4" />
            {reviewVoiceUploading ? "上传中..." : reviewVoiceSource === "lesson" ? "重新上传覆盖" : "上传语音"}
          </Button>
          <Button type="button" variant="outline" className="text-red-500 hover:text-red-600" onClick={onReviewVoiceClear} disabled={!reviewVoice.url && !reviewVoice.objectKey}>
            <Trash2 className="mr-2 size-4" />
            {reviewVoiceSource === "lesson" ? "取消覆盖" : "清空"}
          </Button>
        </div>
      </div>
      <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
        {reviewVoice.url ? (
          <div className="space-y-2">
            <div>{reviewVoiceSource === "lesson" ? "已关联题目音频" : "已上传语音点评"}</div>
            <div>时长：{reviewVoice.durationSeconds > 0 ? `${reviewVoice.durationSeconds} 秒` : "未识别"}</div>
            <audio controls src={reviewVoice.url} className="w-full" />
          </div>
        ) : (
          <div>当前还没有可播放音频，可直接上传老师点评语音。</div>
        )}
      </div>
    </section>
  );
}

const createDraftAnswerMark = (highlight = "", status: EditableAnswerMark["status"] = "wrong"): EditableAnswerMark => ({
  id: `draft_mark_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  highlight,
  comment: "",
  status,
  score: "",
});

const getQuestionAnchorId = (questionId: string) => `review-question-${questionId}`;

const getQuestionDraftScore = (question: SubjectiveQuestion, drafts: DraftState) =>
  question.subjectiveSubQuestions.reduce((sum, subQuestion) => {
    const next = Number.parseInt(drafts.scores[getSubQuestionKey(question.id, subQuestion.id)] ?? "0", 10);
    return sum + (Number.isFinite(next) ? next : 0);
  }, 0);

const getReviewSourceLabel = (source?: AdminMockExamReviewDetail["reviewSource"]) => {
  if (source === "ai") return "远程阅卷";
  if (source === "rule") return "自动判分";
  if (source === "manual") return "人工批改";
  return "批改结果";
};

const formatDurationLabel = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0 分钟";
  }

  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${totalMinutes} 分钟`;
  }

  if (minutes === 0) {
    return `${hours} 小时`;
  }

  return `${hours} 小时 ${minutes} 分钟`;
};

const normalizeDraftAnswerMarksForSave = ({
  marks,
  questionSortOrder,
  subQuestionTitle,
}: {
  marks: EditableAnswerMark[];
  questionSortOrder: number;
  subQuestionTitle: string;
}): MockExamSubjectiveAnswerMark[] => {
  return marks
    .map((mark, index) => {
      const highlight = mark.highlight.trim();
      const comment = mark.comment.trim();
      if (!highlight) {
        if (comment || mark.score.trim()) {
          throw new Error(`第 ${questionSortOrder} 题 ${subQuestionTitle} 的第 ${index + 1} 条划线批注缺少划线文本`);
        }
        return null;
      }

      if (mark.status === "score") {
        const parsedScore = Number.parseInt(mark.score.trim(), 10);
        if (!Number.isInteger(parsedScore) || parsedScore < 0) {
          throw new Error(`第 ${questionSortOrder} 题 ${subQuestionTitle} 的第 ${index + 1} 条得分批注分值不合法`);
        }

        return {
          id: mark.id,
          highlight,
          comment,
          status: "score",
          score: parsedScore,
        } satisfies MockExamSubjectiveAnswerMark;
      }

      return {
        id: mark.id,
        highlight,
        comment,
        status: mark.status,
      } satisfies MockExamSubjectiveAnswerMark;
    })
    .filter((item): item is MockExamSubjectiveAnswerMark => Boolean(item));
};

const createEditableRubricPoint = (): EditableRubricPoint => ({
  id: `draft_rubric_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  title: "",
  description: "",
  score: "",
  keywords: "",
  hit: false,
  awardedScore: "",
  matchedText: "",
});

const createEditableMissedPoint = (): EditableMissedPoint => ({
  id: `draft_missed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  title: "",
  description: "",
  score: "",
});

const normalizeDraftRubricPointsForSave = (points: EditableRubricPoint[]): MockExamRubricPoint[] =>
  points
    .map((point) => {
      const title = point.title.trim();
      const description = point.description.trim();
      const matchedText = point.matchedText.trim();
      const score = Number.parseInt(point.score.trim() || "0", 10);
      const awardedScore = Number.parseInt(point.awardedScore.trim() || "0", 10);
      const keywords = point.keywords
        .split(/[，,\n]/)
        .map((item) => item.trim())
        .filter(Boolean);

      if (!title && !description && !matchedText && !keywords.length && !point.score.trim() && !point.awardedScore.trim()) {
        return null;
      }

      return {
        id: point.id,
        title,
        description,
        score: Number.isFinite(score) ? score : 0,
        keywords,
        hit: Boolean(point.hit),
        awardedScore: Number.isFinite(awardedScore) ? awardedScore : 0,
        matchedText,
      } satisfies MockExamRubricPoint;
    })
    .filter((item): item is MockExamRubricPoint => Boolean(item));

const normalizeDraftMissedPointsForSave = (points: EditableMissedPoint[]): MockExamMissedPoint[] =>
  points
    .map((point) => {
      const title = point.title.trim();
      const description = point.description.trim();
      const score = Number.parseInt(point.score.trim() || "0", 10);

      if (!title && !description && !point.score.trim()) {
        return null;
      }

      return {
        id: point.id,
        title,
        description,
        score: Number.isFinite(score) ? score : 0,
      } satisfies MockExamMissedPoint;
    })
    .filter((item): item is MockExamMissedPoint => Boolean(item));

function WorkbenchMetric({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "blue" | "amber" | "emerald";
}) {
  const toneMap = {
    slate: "border-slate-200 bg-slate-50 text-slate-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
  } as const;

  return (
    <div className={`rounded-2xl border px-3 py-3 ${toneMap[tone]}`}>
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] opacity-70">{label}</p>
      <p className="mt-2 text-lg font-semibold tracking-[-0.03em]">{value}</p>
    </div>
  );
}

function DetailSummaryCard({
  label,
  value,
  hint,
  badge,
}: {
  label: string;
  value: string;
  hint?: string;
  badge?: ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <p className="mt-2 truncate text-[20px] font-semibold tracking-[-0.04em] text-slate-900">{value}</p>
          {hint ? <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p> : null}
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
    </div>
  );
}

function RubricPanel({ subQuestion }: { subQuestion: SubjectiveSubQuestion }) {
  const rubricPoints = subQuestion.rubricPoints ?? [];

  if (!subQuestion.rubricGuidance && rubricPoints.length === 0) {
    return (
      <div className="rounded-[22px] border border-dashed border-slate-200 bg-white px-4 py-6 text-sm leading-7 text-slate-500">
        当前没有配置采分参考。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {subQuestion.rubricGuidance ? (
        <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
          {subQuestion.rubricGuidance}
        </div>
      ) : null}

      {rubricPoints.length > 0 ? (
        <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
          {rubricPoints.map((point, index) => (
            <div
              key={point.id ?? `${point.title}_${index}`}
              className={[
                "border-b border-slate-100 px-4 py-3 last:border-b-0",
                Number(point.awardedScore ?? 0) > 0
                  ? "bg-emerald-50/35"
                  : point.hit
                    ? "bg-sky-50/35"
                    : "bg-rose-50/40",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <span
                  className={[
                    "mt-1 block size-3 shrink-0 rounded-full",
                    Number(point.awardedScore ?? 0) > 0
                      ? "bg-emerald-500"
                      : point.hit
                        ? "bg-sky-500"
                        : "bg-rose-400",
                  ].join(" ")}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{index + 1}：{point.title || `采分点 ${index + 1}`}</p>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-white text-slate-700">{Number(point.awardedScore ?? 0)} / {point.score} 分</Badge>
                      <Badge
                        className={
                          Number(point.awardedScore ?? 0) > 0
                            ? "bg-emerald-100 text-emerald-700"
                            : point.hit
                              ? "bg-sky-100 text-sky-700"
                              : "bg-rose-100 text-rose-700"
                        }
                      >
                        {Number(point.awardedScore ?? 0) > 0 ? "已得分" : point.hit ? "已识别" : "未命中"}
                      </Badge>
                    </div>
                  </div>

                  {point.description ? <p className="mt-1.5 text-sm leading-6 text-slate-600">{point.description}</p> : null}

                  {point.matchedText ? (
                    <div className="mt-2 rounded-2xl bg-white/90 px-3 py-2 text-sm leading-6 text-slate-600">
                      命中内容：<span className="font-medium text-slate-900">{point.matchedText}</span>
                    </div>
                  ) : null}

                  {point.keywords?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {point.keywords.map((keyword) => (
                        <span key={keyword} className="rounded-full bg-white px-3 py-1 text-xs text-slate-500 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)]">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MissedPointsPanel({ subQuestion }: { subQuestion: SubjectiveSubQuestion }) {
  const missedPoints = (subQuestion.missedPoints ?? []).filter((item) => item.title?.trim() || item.description?.trim());

  if (missedPoints.length === 0) {
    return (
      <div className="rounded-[22px] border border-dashed border-slate-200 bg-white px-4 py-6 text-sm leading-7 text-slate-500">
        当前没有可展示的遗漏点。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {missedPoints.map((point, index) => (
        <div key={point.id ?? `${point.title}_${index}`} className="rounded-[20px] border border-rose-200 bg-[linear-gradient(135deg,rgba(255,244,244,0.96),rgba(255,249,249,0.96))] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#e2485a]">{point.title || `遗漏点 ${index + 1}`}</p>
            {Number.isFinite(Number(point.score)) ? <Badge className="bg-white text-[#e2485a]">{point.score} 分</Badge> : null}
          </div>
          {point.description ? <p className="mt-1.5 text-sm leading-6 text-[#cc4758]">{point.description}</p> : null}
        </div>
      ))}
    </div>
  );
}

function AnswerMarkEditor({
  answer,
  marks,
  onChange,
}: {
  answer: string;
  marks: EditableAnswerMark[];
  onChange: (marks: EditableAnswerMark[]) => void;
}) {
  const [selectionHint, setSelectionHint] = useState("");

  const appendMarkFromSelection = () => {
    const selection = typeof window !== "undefined" ? window.getSelection()?.toString().trim() ?? "" : "";
    if (!selection) {
      toast.error("请先在学生答案里选中要划线的文字");
      return;
    }
    if (answer && !answer.includes(selection)) {
      toast.error("划线内容必须来自学生原答案");
      return;
    }
    onChange([...marks, createDraftAnswerMark(selection)]);
    setSelectionHint(selection);
  };

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-base font-semibold text-slate-900">划线批注编辑</h4>
          <p className="mt-1 text-sm text-slate-500">
            先在左侧学生答案里选中文字，再点“从选中文字新增”。也可以直接修改已有划线、对勾、叉号和加分批注。
          </p>
          {selectionHint ? <p className="mt-2 text-xs text-blue-600">最近一次新增划线：{selectionHint}</p> : null}
        </div>
        <Button type="button" variant="outline" className="shrink-0" onClick={appendMarkFromSelection}>
          <Plus className="mr-2 size-4" />
          从选中文字新增
        </Button>
      </div>

      <div className="mt-4 space-y-4">
        {marks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm leading-7 text-slate-500">
            当前还没有划线批注。你可以先选中学生答案中的一段文字，再新增一条批注。
          </div>
        ) : (
          marks.map((mark, index) => (
            <div key={mark.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">批注 {index + 1}</p>
                <button
                  type="button"
                  onClick={() => onChange(marks.filter((item) => item.id !== mark.id))}
                  className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-rose-600"
                >
                  <Trash2 className="size-4" />
                  删除
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-900">划线文字</p>
                  <Textarea
                    className="min-h-[88px] text-[15px] leading-7"
                    value={mark.highlight}
                    onChange={(event) =>
                      onChange(
                        marks.map((item) => (item.id === mark.id ? { ...item, highlight: event.target.value } : item)),
                      )
                    }
                  />
                </div>

                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-2 text-sm font-semibold text-slate-900">批注类型</p>
                      <select
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                        value={mark.status}
                        onChange={(event) =>
                          onChange(
                            marks.map((item) =>
                              item.id === mark.id
                                ? { ...item, status: event.target.value as EditableAnswerMark["status"], score: event.target.value === "score" ? item.score : "" }
                                : item,
                            ),
                          )
                        }
                      >
                        <option value="wrong">叉号</option>
                        <option value="correct">对勾</option>
                        <option value="score">加分</option>
                      </select>
                    </div>

                    <div>
                      <p className="mb-2 text-sm font-semibold text-slate-900">加分数值</p>
                      <Input
                        className="h-11"
                        disabled={mark.status !== "score"}
                        value={mark.score}
                        onChange={(event) =>
                          onChange(
                            marks.map((item) => (item.id === mark.id ? { ...item, score: event.target.value } : item)),
                          )
                        }
                        placeholder={mark.status === "score" ? "如 1" : "仅加分用"}
                      />
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-semibold text-slate-900">局部评语</p>
                    <Textarea
                      className="min-h-[120px] text-[15px] leading-7"
                      value={mark.comment}
                      onChange={(event) =>
                        onChange(
                          marks.map((item) => (item.id === mark.id ? { ...item, comment: event.target.value } : item)),
                        )
                      }
                      placeholder={mark.status === "wrong" ? "指出这段哪里错了、漏了什么，以及建议怎么改" : "可选，补充这段命中或得分说明"}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function RubricPointEditor({
  points,
  onChange,
}: {
  points: EditableRubricPoint[];
  onChange: (points: EditableRubricPoint[]) => void;
}) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-slate-900">采分点编辑</h4>
          <p className="mt-1 text-sm text-slate-500">这里维护本小问展示给老师和学生的采分点命中结果。</p>
        </div>
        <Button type="button" variant="outline" onClick={() => onChange([...points, createEditableRubricPoint()])}>
          <Plus className="mr-2 size-4" />
          新增采分点
        </Button>
      </div>

      <div className="mt-4 space-y-4">
        {points.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm leading-7 text-slate-500">
            当前还没有采分点，点击右上角新增。
          </div>
        ) : (
          points.map((point, index) => (
            <div key={point.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">采分点 {index + 1}</p>
                <button type="button" className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-rose-600" onClick={() => onChange(points.filter((item) => item.id !== point.id))}>
                  <Trash2 className="size-4" />
                  删除
                </button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900">标题</p>
                  <Input value={point.title} onChange={(event) => onChange(points.map((item) => (item.id === point.id ? { ...item, title: event.target.value } : item)))} />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900">关键词</p>
                  <Input value={point.keywords} onChange={(event) => onChange(points.map((item) => (item.id === point.id ? { ...item, keywords: event.target.value } : item)))} placeholder="多个关键词用逗号分隔" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900">分值</p>
                  <Input value={point.score} onChange={(event) => onChange(points.map((item) => (item.id === point.id ? { ...item, score: event.target.value } : item)))} />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900">已得分</p>
                  <Input value={point.awardedScore} onChange={(event) => onChange(points.map((item) => (item.id === point.id ? { ...item, awardedScore: event.target.value } : item)))} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <p className="text-sm font-semibold text-slate-900">命中内容</p>
                  <Textarea value={point.matchedText} onChange={(event) => onChange(points.map((item) => (item.id === point.id ? { ...item, matchedText: event.target.value } : item)))} className="min-h-[88px] text-[15px] leading-7" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <p className="text-sm font-semibold text-slate-900">说明</p>
                  <Textarea value={point.description} onChange={(event) => onChange(points.map((item) => (item.id === point.id ? { ...item, description: event.target.value } : item)))} className="min-h-[100px] text-[15px] leading-7" />
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={point.hit} onChange={(event) => onChange(points.map((item) => (item.id === point.id ? { ...item, hit: event.target.checked } : item)))} />
                  标记为已识别
                </label>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function MissedPointEditor({
  points,
  onChange,
}: {
  points: EditableMissedPoint[];
  onChange: (points: EditableMissedPoint[]) => void;
}) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-slate-900">遗漏点编辑</h4>
          <p className="mt-1 text-sm text-slate-500">这里维护学生端右侧便利贴里的遗漏点内容。</p>
        </div>
        <Button type="button" variant="outline" onClick={() => onChange([...points, createEditableMissedPoint()])}>
          <Plus className="mr-2 size-4" />
          新增遗漏点
        </Button>
      </div>

      <div className="mt-4 space-y-4">
        {points.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm leading-7 text-slate-500">
            当前还没有遗漏点，点击右上角新增。
          </div>
        ) : (
          points.map((point, index) => (
            <div key={point.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">遗漏点 {index + 1}</p>
                <button type="button" className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-rose-600" onClick={() => onChange(points.filter((item) => item.id !== point.id))}>
                  <Trash2 className="size-4" />
                  删除
                </button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900">标题</p>
                  <Input value={point.title} onChange={(event) => onChange(points.map((item) => (item.id === point.id ? { ...item, title: event.target.value } : item)))} />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900">对应分值</p>
                  <Input value={point.score} onChange={(event) => onChange(points.map((item) => (item.id === point.id ? { ...item, score: event.target.value } : item)))} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <p className="text-sm font-semibold text-slate-900">说明</p>
                  <Textarea value={point.description} onChange={(event) => onChange(points.map((item) => (item.id === point.id ? { ...item, description: event.target.value } : item)))} className="min-h-[100px] text-[15px] leading-7" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function SubQuestionReviewWorkbench({
  question,
  subQuestion,
  scoreValue,
  abilityValue,
  commentValue,
  referenceValue,
  rubricGuidanceValue,
  rubricPoints,
  missedPoints,
  reviewVoice,
  reviewVoiceUploading,
  onReviewVoiceUpload,
  onReviewVoiceClear,
  marks,
  onScoreChange,
  onAbilityChange,
  onCommentChange,
  onReferenceChange,
  onRubricGuidanceChange,
  onRubricPointsChange,
  onMissedPointsChange,
  onMarksChange,
}: {
  question: SubjectiveQuestion;
  subQuestion: SubjectiveSubQuestion;
  scoreValue: string;
  abilityValue: string;
  commentValue: string;
  referenceValue: string;
  rubricGuidanceValue: string;
  rubricPoints: EditableRubricPoint[];
  missedPoints: EditableMissedPoint[];
  reviewVoice: EditableReviewVoice;
  reviewVoiceUploading: boolean;
  onReviewVoiceUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onReviewVoiceClear: () => void;
  marks: EditableAnswerMark[];
  onScoreChange: (value: string) => void;
  onAbilityChange: (value: string) => void;
  onCommentChange: (value: string) => void;
  onReferenceChange: (value: string) => void;
  onRubricGuidanceChange: (value: string) => void;
  onRubricPointsChange: (points: EditableRubricPoint[]) => void;
  onMissedPointsChange: (points: EditableMissedPoint[]) => void;
  onMarksChange: (marks: EditableAnswerMark[]) => void;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const voiceInputRef = useRef<HTMLInputElement | null>(null);
  const hasAnswer = Boolean(subQuestion.answer?.trim());
  const maxScore = subQuestion.maxScore ?? question.score;
  const commentLength = commentValue.trim().length;
  const localWrongMarks = marks.filter((mark) => mark.status === "wrong").length;
  const localPositiveMarks = marks.filter((mark) => mark.status !== "wrong").length;
  const reviewVoiceSource = reviewVoice.source ?? (reviewVoice.url ? "review" : undefined);

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.04)]">
      <div className="border-b border-slate-100 pb-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-blue-50 text-blue-700">{subQuestion.title}</Badge>
              <Badge className="bg-amber-50 text-amber-800">本问满分 {maxScore} 分</Badge>
              <Badge className="bg-white text-slate-600">{hasAnswer ? "已作答" : "未作答"}</Badge>
            </div>
            {subQuestion.placeholder ? <p className="mt-2 text-sm leading-7 text-slate-500">{subQuestion.placeholder}</p> : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:w-[330px]">
              <WorkbenchMetric label="本问得分" value={`${scoreValue || 0} 分`} tone="amber" />
              <WorkbenchMetric label="作答字数" value={`${subQuestion.wordCount || 0} 字`} tone="blue" />
              <WorkbenchMetric label="批注数量" value={`${marks.length} 条`} tone="emerald" />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_500px]">
        <div className="space-y-5">
          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-slate-900">学员作答（当前得分：{scoreValue || 0}分）</h4>
                <p className="mt-1 text-sm text-slate-500">主界面直接展示整问批改结果，编辑动作单独进入批改面板。</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-white text-slate-600">错点 {localWrongMarks}</Badge>
                <Badge className="bg-white text-slate-600">得分点 {localPositiveMarks}</Badge>
                <Button type="button" variant="ghost" size="sm" className="h-auto px-2 text-blue-600 hover:bg-blue-50 hover:text-blue-700" onClick={() => setEditorOpen(true)}>
                  编辑批改
                </Button>
              </div>
            </div>
            <div className="mt-4 rounded-[22px] border border-dashed border-slate-200 bg-slate-50/60 px-4 py-4">
              <div className="max-h-[430px] overflow-y-auto pr-1">
                <AnnotatedAnswerText
                  answer={subQuestion.answer || ""}
                  marks={marks.map((mark) => ({
                    id: mark.id,
                    highlight: mark.highlight,
                    comment: mark.comment,
                    status: mark.status,
                    score: mark.status === "score" && Number.isFinite(Number(mark.score)) ? Number(mark.score) : undefined,
                  }))}
                  paragraphClassName="whitespace-pre-wrap text-[16px] leading-[2.15] text-slate-800"
                />
              </div>
            </div>
            <div className="mt-4 rounded-[22px] bg-slate-50 px-4 py-3 text-[15px] leading-8 text-slate-700">
              {subQuestion.answer || "学生未作答"}
            </div>
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-slate-900">老师点评</h4>
                <p className="mt-1 text-sm text-slate-500">这里展示本小问整体点评，老师可在编辑批改里继续修订。</p>
              </div>
              <Badge className="bg-slate-100 text-slate-700">当前 {commentLength} 字</Badge>
            </div>
            <Textarea className="mt-4 min-h-[150px] text-[15px] leading-7" value={commentValue} onChange={(event) => onCommentChange(event.target.value)} />
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-slate-900">本题语音点评</h4>
                <p className="mt-1 text-sm text-slate-500">
                  {reviewVoiceSource === "lesson" ? "当前默认复用题目已关联音频，无需重复上传；如需替换，可重新上传覆盖。" : "当前可直接复用题目已关联音频，也可重新上传老师点评语音进行覆盖。"}
                </p>
              </div>
              <div className="flex gap-2">
                <input ref={voiceInputRef} type="file" accept="audio/*" className="hidden" onChange={onReviewVoiceUpload} />
                <Button type="button" variant="outline" onClick={() => voiceInputRef.current?.click()} disabled={reviewVoiceUploading}>
                  <Upload className="mr-2 size-4" />
                  {reviewVoiceUploading ? "上传中..." : reviewVoiceSource === "lesson" ? "重新上传覆盖" : "上传语音"}
                </Button>
                <Button type="button" variant="outline" className="text-red-500 hover:text-red-600" onClick={onReviewVoiceClear} disabled={!reviewVoice.url && !reviewVoice.objectKey}>
                  <Trash2 className="mr-2 size-4" />
                  {reviewVoiceSource === "lesson" ? "取消覆盖" : "清空"}
                </Button>
              </div>
            </div>
            <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
              {reviewVoice.url ? (
                <div className="space-y-2">
                  <div>{reviewVoiceSource === "lesson" ? "已关联题目音频" : "已上传语音点评"}</div>
                  <div>时长：{reviewVoice.durationSeconds > 0 ? `${reviewVoice.durationSeconds} 秒` : "未识别"}</div>
                  <audio controls src={reviewVoice.url} className="w-full" />
                </div>
              ) : (
                <div>当前还没有可播放音频，可直接上传老师点评语音。</div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-5 xl:sticky xl:top-4 xl:self-start">
          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <h4 className="text-base font-semibold text-slate-900">得分点批改结果</h4>
            <p className="mt-1 text-sm text-slate-500">右侧按采分点直接展示命中、失分和点评，尽量做到一屏看完。</p>
            <div className="mt-4 max-h-[520px] overflow-y-auto pr-1">
              <RubricPanel subQuestion={subQuestion} />
            </div>

            <div className="mt-4 border-t border-slate-200 pt-4">
              <h5 className="text-sm font-semibold text-slate-900">遗漏点</h5>
              <div className="mt-3 max-h-[180px] overflow-y-auto pr-1">
                <MissedPointsPanel subQuestion={subQuestion} />
              </div>
            </div>
          </section>
        </div>
      </div>

      {editorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6">
          <div className="flex h-[min(88vh,860px)] w-[min(92vw,1240px)] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">编辑本问批改</h3>
                <p className="mt-1 text-sm text-slate-500">{question.sortOrder} 题 · {subQuestion.title}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" className="h-9 px-3 text-slate-500 hover:bg-slate-100 hover:text-slate-900" onClick={() => setEditorOpen(false)}>
                关闭
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
                <section className="space-y-4">
                  <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                    <h4 className="text-base font-semibold text-slate-900">评分信息</h4>
                    <div className="mt-4 space-y-4">
                      <div>
                        <p className="mb-2 text-sm font-semibold text-slate-900">本问得分</p>
                        <Input className="h-12 text-base" value={scoreValue} onChange={(event) => onScoreChange(event.target.value)} />
                      </div>
                      <div>
                        <p className="mb-2 text-sm font-semibold text-slate-900">能力标签</p>
                        <Input className="h-12 text-base" value={abilityValue} onChange={(event) => onAbilityChange(event.target.value)} />
                      </div>
                      <div>
                        <p className="mb-2 text-sm font-semibold text-slate-900">参考答案</p>
                        <Textarea className="min-h-[200px] text-[15px] leading-7" value={referenceValue} onChange={(event) => onReferenceChange(event.target.value)} />
                      </div>
                      <div>
                        <p className="mb-2 text-sm font-semibold text-slate-900">采分说明</p>
                        <Textarea className="min-h-[160px] text-[15px] leading-7" value={rubricGuidanceValue} onChange={(event) => onRubricGuidanceChange(event.target.value)} />
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <AnswerMarkEditor answer={subQuestion.answer || ""} marks={marks} onChange={onMarksChange} />
                  <RubricPointEditor points={rubricPoints} onChange={onRubricPointsChange} />
                  <MissedPointEditor points={missedPoints} onChange={onMissedPointsChange} />

                  <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                    <h4 className="text-base font-semibold text-slate-900">总点评编辑</h4>
                    <Textarea className="mt-4 min-h-[220px] text-[15px] leading-7" value={commentValue} onChange={(event) => onCommentChange(event.target.value)} />
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InlineSubQuestionReviewWorkbench({
  question,
  subQuestion,
  scoreValue,
  abilityValue,
  commentValue,
  marks,
  onScoreChange,
  onAbilityChange,
  onCommentChange,
  onMarksChange,
}: {
  question: SubjectiveQuestion;
  subQuestion: SubjectiveSubQuestion;
  scoreValue: string;
  abilityValue: string;
  commentValue: string;
  marks: EditableAnswerMark[];
  onScoreChange: (value: string) => void;
  onAbilityChange: (value: string) => void;
  onCommentChange: (value: string) => void;
  onMarksChange: (marks: EditableAnswerMark[]) => void;
}) {
  const hasAnswer = Boolean(subQuestion.answer?.trim());
  const maxScore = subQuestion.maxScore ?? question.score;
  const commentLength = commentValue.trim().length;
  const localWrongMarks = marks.filter((mark) => mark.status === "wrong").length;
  const localPositiveMarks = marks.filter((mark) => mark.status !== "wrong").length;

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.04)]">
      <div className="border-b border-slate-100 pb-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-blue-50 text-blue-700">{subQuestion.title}</Badge>
              <Badge className="bg-amber-50 text-amber-800">本问满分 {maxScore} 分</Badge>
              <Badge className="bg-white text-slate-600">{hasAnswer ? "已作答" : "未作答"}</Badge>
            </div>
            {subQuestion.placeholder ? <p className="mt-2 text-sm leading-7 text-slate-500">{subQuestion.placeholder}</p> : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:w-[330px]">
            <WorkbenchMetric label="本问得分" value={`${scoreValue || 0} 分`} tone="amber" />
            <WorkbenchMetric label="作答字数" value={`${subQuestion.wordCount || 0} 字`} tone="blue" />
            <WorkbenchMetric label="批注数量" value={`${marks.length} 条`} tone="emerald" />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]">
        <div className="space-y-5">
          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-slate-900">学员作答（当前得分：{scoreValue || 0}分）</h4>
                <p className="mt-1 text-sm text-slate-500">左侧直接查看答案与渲染效果，右侧同屏完成评分、划线和采分点修订。</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-white text-slate-600">错误批注 {localWrongMarks}</Badge>
                <Badge className="bg-white text-slate-600">命中批注 {localPositiveMarks}</Badge>
              </div>
            </div>
            <div className="mt-4 rounded-[22px] border border-dashed border-slate-200 bg-slate-50/60 px-4 py-4">
              <div className="max-h-[430px] overflow-y-auto pr-1">
                <AnnotatedAnswerText
                  answer={subQuestion.answer || ""}
                  marks={marks.map((mark) => ({
                    id: mark.id,
                    highlight: mark.highlight,
                    comment: mark.comment,
                    status: mark.status,
                    score: mark.status === "score" && Number.isFinite(Number(mark.score)) ? Number(mark.score) : undefined,
                  }))}
                  paragraphClassName="whitespace-pre-wrap text-[16px] leading-[2.15] text-slate-800"
                />
              </div>
            </div>
            <div className="mt-4 rounded-[22px] bg-slate-50 px-4 py-3 text-[15px] leading-8 text-slate-700">
              {subQuestion.answer || "学生未作答"}
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold text-slate-900">老师总评</h4>
                  <p className="mt-1 text-sm text-slate-500">这里直接维护本小问的整体点评，学生端会按这里的内容展示。</p>
                </div>
                <Badge className="bg-slate-100 text-slate-700">当前 {commentLength} 字</Badge>
              </div>
              <Textarea className="mt-4 min-h-[220px] text-[15px] leading-7" value={commentValue} onChange={(event) => onCommentChange(event.target.value)} />
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <div>
                <h4 className="text-base font-semibold text-slate-900">本题语音点评</h4>
                <p className="mt-1 text-sm text-slate-500">
                  {reviewVoiceSource === "lesson" ? "当前默认复用题目已关联音频，无需重复上传；如需替换，可重新上传覆盖。" : "同一道大题的语音点评共用；当前也可直接复用题目已关联音频。"}
                </p>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <input ref={voiceInputRef} type="file" accept="audio/*" className="hidden" onChange={onReviewVoiceUpload} />
                <Button type="button" variant="outline" onClick={() => voiceInputRef.current?.click()} disabled={reviewVoiceUploading}>
                  <Upload className="mr-2 size-4" />
                  {reviewVoiceUploading ? "上传中..." : reviewVoiceSource === "lesson" ? "重新上传覆盖" : "上传语音"}
                </Button>
                <Button type="button" variant="outline" className="text-red-500 hover:text-red-600" onClick={onReviewVoiceClear} disabled={!reviewVoice.url && !reviewVoice.objectKey}>
                  <Trash2 className="mr-2 size-4" />
                  {reviewVoiceSource === "lesson" ? "取消覆盖" : "清空"}
                </Button>
              </div>
              <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
                {reviewVoice.url ? (
                  <div className="space-y-2">
                    <div>{reviewVoiceSource === "lesson" ? "已关联题目音频" : "已上传语音点评"}</div>
                    <div>时长：{reviewVoice.durationSeconds > 0 ? `${reviewVoice.durationSeconds} 秒` : "未识别"}</div>
                    <audio controls src={reviewVoice.url} className="w-full" />
                  </div>
                ) : (
                  <div>当前还没有可播放音频，可直接上传老师点评语音。</div>
                )}
              </div>
            </section>
          </div>

          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-slate-900">学员端展示预览</h4>
                <p className="mt-1 text-sm text-slate-500">这里直接按学生端逻辑预览采分点命中和遗漏点，老师保存前可以先核一遍。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-emerald-50 text-emerald-700">已得分 {awardedRubricCount}</Badge>
                <Badge className="bg-rose-50 text-rose-700">遗漏点 {previewMissedPoints.length}</Badge>
              </div>
            </div>

            <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-4">
                <RubricPanel subQuestion={previewSubQuestion} />
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-900">遗漏点便利贴预览</p>
                <MissedPointsPanel subQuestion={previewSubQuestion} />
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-5 2xl:sticky 2xl:top-4 2xl:self-start">
          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-slate-900">评分与参考内容</h4>
                <p className="mt-1 text-sm text-slate-500">这里集中录入分数、能力标签、参考答案和采分说明，不再跳二级层。</p>
              </div>
              <Badge className="bg-slate-100 text-slate-700">主工作台直编</Badge>
            </div>

            <div className="mt-4 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-900">本问得分</p>
                  <Input className="h-12 text-base" value={scoreValue} onChange={(event) => onScoreChange(event.target.value)} />
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-900">能力标签</p>
                  <Input className="h-12 text-base" value={abilityValue} onChange={(event) => onAbilityChange(event.target.value)} />
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-slate-900">参考答案</p>
                <Textarea className="min-h-[180px] text-[15px] leading-7" value={referenceValue} onChange={(event) => onReferenceChange(event.target.value)} />
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-slate-900">采分说明</p>
                <Textarea className="min-h-[140px] text-[15px] leading-7" value={rubricGuidanceValue} onChange={(event) => onRubricGuidanceChange(event.target.value)} />
              </div>
            </div>
          </section>

          <AnswerMarkEditor answer={subQuestion.answer || ""} marks={marks} onChange={onMarksChange} />
          <RubricPointEditor points={rubricPoints} onChange={onRubricPointsChange} />
          <MissedPointEditor points={missedPoints} onChange={onMissedPointsChange} />
        </div>
      </div>
    </div>
  );
}

function CompactInlineSubQuestionReviewWorkbench({
  question,
  subQuestion,
  scoreValue,
  abilityValue,
  commentValue,
  marks,
  onScoreChange,
  onAbilityChange,
  onCommentChange,
  onMarksChange,
}: {
  question: SubjectiveQuestion;
  subQuestion: SubjectiveSubQuestion;
  scoreValue: string;
  abilityValue: string;
  commentValue: string;
  marks: EditableAnswerMark[];
  onScoreChange: (value: string) => void;
  onAbilityChange: (value: string) => void;
  onCommentChange: (value: string) => void;
  onMarksChange: (marks: EditableAnswerMark[]) => void;
}) {
  const hasAnswer = Boolean(subQuestion.answer?.trim());
  const maxScore = subQuestion.maxScore ?? question.score;
  const commentLength = commentValue.trim().length;
  const wrongMarkCount = marks.filter((mark) => mark.status === "wrong").length;
  const positiveMarkCount = marks.filter((mark) => mark.status === "correct" || mark.status === "score").length;
  const [selectionHint, setSelectionHint] = useState("");
  const markTypeMeta: Array<{
    value: EditableAnswerMark["status"];
    label: string;
    shortLabel: string;
    className: string;
    icon: ReactNode;
  }> = [
    {
      value: "correct",
      label: "对勾",
      shortLabel: "对",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
      icon: <Check className="size-4" />,
    },
    {
      value: "wrong",
      label: "叉号",
      shortLabel: "错",
      className: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
      icon: <X className="size-4" />,
    },
    {
      value: "neutral",
      label: "横杠",
      shortLabel: "漏",
      className: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
      icon: <Minus className="size-4" />,
    },
    {
      value: "score",
      label: "加分",
      shortLabel: "分",
      className: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100",
      icon: <Plus className="size-4" />,
    },
  ];

  const appendMarkFromSelection = (status: EditableAnswerMark["status"]) => {
    const selection = typeof window !== "undefined" ? window.getSelection()?.toString().trim() ?? "" : "";
    if (!selection) {
      toast.error("请先在左侧学员作答里选中要标注的文字");
      return;
    }
    if (subQuestion.answer && !subQuestion.answer.includes(selection)) {
      toast.error("标注内容必须来自学员原答案");
      return;
    }
    onMarksChange([...marks, createDraftAnswerMark(selection, status)]);
    setSelectionHint(selection);
  };

  const updateMark = (markId: string, updater: (mark: EditableAnswerMark) => EditableAnswerMark) =>
    onMarksChange(marks.map((item) => (item.id === markId ? updater(item) : item)));

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.04)]">
      <div className="border-b border-slate-100 pb-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-blue-50 text-blue-700">{subQuestion.title}</Badge>
              <Badge className="bg-amber-50 text-amber-800">本问满分 {maxScore} 分</Badge>
              <Badge className="bg-white text-slate-600">{hasAnswer ? "已作答" : "未作答"}</Badge>
            </div>
            {subQuestion.placeholder ? <p className="mt-2 text-sm leading-7 text-slate-500">{subQuestion.placeholder}</p> : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:w-[330px]">
            <WorkbenchMetric label="本问得分" value={`${scoreValue || 0} 分`} tone="amber" />
            <WorkbenchMetric label="作答字数" value={`${subQuestion.wordCount || 0} 字`} tone="blue" />
            <WorkbenchMetric label="批注数量" value={`${marks.length} 条`} tone="emerald" />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]">
        <div className="space-y-5">
          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-slate-900">学员作答（当前得分：{scoreValue || 0}分）</h4>
                <p className="mt-1 text-sm text-slate-500">这里只保留答案展示和划线结果，不再重复显示预览、采分点编辑、遗漏点编辑和小问语音。</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-white text-slate-600">错误批注 {wrongMarkCount}</Badge>
                <Badge className="bg-white text-slate-600">得分批注 {positiveMarkCount}</Badge>
              </div>
            </div>
            <div className="mt-4 rounded-[22px] border border-dashed border-slate-200 bg-slate-50/60 px-4 py-4">
              <div className="max-h-[430px] overflow-y-auto pr-1">
                <AnnotatedAnswerText
                  answer={subQuestion.answer || ""}
                  marks={marks.map((mark) => ({
                    id: mark.id,
                    highlight: mark.highlight,
                    comment: mark.comment,
                    status: mark.status,
                    score: mark.status === "score" && Number.isFinite(Number(mark.score)) ? Number(mark.score) : undefined,
                  }))}
                  paragraphClassName="whitespace-pre-wrap text-[16px] leading-[2.15] text-slate-800"
                />
              </div>
            </div>
            <div className="mt-4 rounded-[22px] bg-slate-50 px-4 py-3 text-[15px] leading-8 text-slate-700">
              {subQuestion.answer || "学生未作答"}
            </div>
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-slate-900">老师点评</h4>
                <p className="mt-1 text-sm text-slate-500">这里保留整问点评，学生端就按这里展示。</p>
              </div>
              <Badge className="bg-slate-100 text-slate-700">当前 {commentLength} 字</Badge>
            </div>
            <Textarea className="mt-4 min-h-[220px] text-[15px] leading-7" value={commentValue} onChange={(event) => onCommentChange(event.target.value)} />
          </section>
        </div>

        <div className="space-y-5 2xl:sticky 2xl:top-4 2xl:self-start">
          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-slate-900">录分信息</h4>
                <p className="mt-1 text-sm text-slate-500">这里只保留录分和批注编辑，减少批改时的干扰。</p>
              </div>
              <Badge className="bg-slate-100 text-slate-700">工作区</Badge>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-900">本问得分</p>
                <Input className="h-12 text-base" value={scoreValue} onChange={(event) => onScoreChange(event.target.value)} />
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-900">能力标签</p>
                <Input className="h-12 text-base" value={abilityValue} onChange={(event) => onAbilityChange(event.target.value)} />
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <div>
              <h4 className="text-base font-semibold text-slate-900">局部批注</h4>
              <p className="mt-1 text-sm text-slate-500">先在左侧选中一段文字，再点下面的对勾、叉号、横杠或加分，系统会自动生成一条局部批注。</p>
              {selectionHint ? <p className="mt-2 text-xs text-blue-600">最近一次选中：{selectionHint}</p> : null}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              {markTypeMeta.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => appendMarkFromSelection(item.value)}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-full border text-sm font-medium transition ${item.className}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-4">
              {marks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm leading-7 text-slate-500">
                  当前还没有局部批注。你可以先选中左侧答案中的一段文字，再点上面的批注按钮。
                </div>
              ) : (
                marks.map((mark, index) => (
                  <div
                    key={mark.id}
                    className={`rounded-[22px] border p-4 ${
                      mark.status === "wrong"
                        ? "border-rose-100 bg-rose-50/70"
                        : mark.status === "neutral"
                          ? "border-amber-100 bg-amber-50/55"
                          : mark.status === "score"
                            ? "border-sky-100 bg-sky-50/55"
                            : "border-emerald-100 bg-emerald-50/55"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">批注 {index + 1}</p>
                      <div className="flex items-center gap-2">
                        {markTypeMeta.map((item) => (
                          <button
                            key={`${mark.id}_${item.value}`}
                            type="button"
                            onClick={() =>
                              updateMark(mark.id, (current) => ({
                                ...current,
                                status: item.value,
                                score: item.value === "score" ? current.score : "",
                              }))
                            }
                            className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition ${
                              mark.status === item.value ? item.className : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                            }`}
                            aria-label={item.label}
                            title={item.label}
                          >
                            {item.icon}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => onMarksChange(marks.filter((item) => item.id !== mark.id))}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                          aria-label="删除"
                          title="删除"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 space-y-4">
                      <div>
                        <p className="mb-2 text-sm font-semibold text-slate-900">对应原文</p>
                        <Textarea
                          className="min-h-[78px] rounded-2xl border-slate-200 bg-white text-[15px] leading-7"
                          value={mark.highlight}
                          onChange={(event) => updateMark(mark.id, (item) => ({ ...item, highlight: event.target.value }))}
                        />
                      </div>

                      {mark.status === "score" ? (
                        <div>
                          <p className="mb-2 text-sm font-semibold text-slate-900">加分数值</p>
                          <Input
                            className="h-11 rounded-2xl bg-white"
                            value={mark.score}
                            onChange={(event) => updateMark(mark.id, (item) => ({ ...item, score: event.target.value }))}
                            placeholder="如 1"
                          />
                        </div>
                      ) : null}

                      <div>
                        <p className="mb-2 text-sm font-semibold text-slate-900">局部评语</p>
                        <Textarea
                          className="min-h-[120px] rounded-2xl border-slate-200 bg-white text-[15px] leading-7"
                          value={mark.comment}
                          onChange={(event) => updateMark(mark.id, (item) => ({ ...item, comment: event.target.value }))}
                          placeholder={
                            mark.status === "wrong"
                              ? "这里具体错在哪、漏了什么，以及建议怎么改"
                              : mark.status === "neutral"
                                ? "这里没有答到哪个点，建议补哪一层"
                                : mark.status === "score"
                                  ? "补充这段为什么可以得分"
                                  : "补充这段答得好的地方"
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function MockExamReviewList() {
  const navigate = useNavigate();
  const { paperId = "" } = useParams();
  const [papers, setPapers] = useState<AdminMockExamReviewPaperListPayload>(EMPTY_PAPERS);
  const [reviews, setReviews] = useState(EMPTY_REVIEWS);
  const [keyword, setKeyword] = useState("");
  const [reviewStatus, setReviewStatus] = useState<AdminMockExamReviewStatus>("manual_pending");
  const [page, setPage] = useState(1);
  const [loadingPapers, setLoadingPapers] = useState(true);
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiScoring, setAiScoring] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [claimingRecordId, setClaimingRecordId] = useState("");
  const [uploadingVoiceQuestionId, setUploadingVoiceQuestionId] = useState("");
  const [selectedDetail, setSelectedDetail] = useState<AdminMockExamReviewDetail | null>(null);
  const renewLockTimerRef = useRef<number | null>(null);
  const [drafts, setDrafts] = useState<DraftState>({
    scores: {},
    comments: {},
    references: {},
    abilities: {},
    marks: {},
    rubricGuidance: {},
    rubricPoints: {},
    missedPoints: {},
    reviewVoices: {},
  });
  const deferredKeyword = useDeferredValue(keyword.trim());
  const currentLockToken = selectedDetail?.manualReviewLock?.lockToken ?? "";
  const currentLockVersion = selectedDetail?.manualReviewLock?.version ?? 0;

  const activePaper = useMemo(() => papers.list.find((item) => item.id === paperId) ?? null, [paperId, papers.list]);
  const subjectiveQuestions = useMemo(
    () => (selectedDetail?.questions ?? []).filter((item) => item.type === "subjective_case"),
    [selectedDetail],
  );

  useEffect(() => {
    const loadPapers = async () => {
      setLoadingPapers(true);
      try {
        const next = await mockApi.getAdminMockExamReviewPapers();
        setPapers(next);
      } catch (error) {
        const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: unknown }).status ?? 0) : 0;

        if (status === 404) {
          const paperList: AdminMockExamPaperListPayload = await mockApi.getAdminMockExamPapers();
          setPapers(buildFallbackReviewPaperPayload(paperList));
        } else {
          toast.error(error instanceof Error ? error.message : "加载试卷失败");
        }
      } finally {
        setLoadingPapers(false);
      }
    };

    void loadPapers();
  }, []);

  useEffect(() => {
    if (!activePaper) return;
    setReviewStatus(getDefaultReviewStatus(activePaper));
    setKeyword("");
    setPage(1);
  }, [paperId, activePaper?.id]);

  useEffect(() => {
    if (!paperId) return;
    const loadReviews = async () => {
      setLoading(true);
      try {
        const next = await mockApi.getAdminMockExamReviews({
          keyword: deferredKeyword,
          reviewStatus,
          paperId,
          page,
          pageSize: PAGE_SIZE,
        });
        setReviews(next);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "加载批改记录失败");
      } finally {
        setLoading(false);
      }
    };

    void loadReviews();
  }, [deferredKeyword, paperId, reviewStatus, page]);

  useEffect(() => {
    setPage(1);
  }, [deferredKeyword, reviewStatus, paperId]);

  const stopRenewLock = () => {
    if (renewLockTimerRef.current !== null) {
      window.clearInterval(renewLockTimerRef.current);
      renewLockTimerRef.current = null;
    }
  };

  const releaseCurrentLock = async () => {
    if (!selectedDetail?.id || !currentLockToken) return;

    try {
      await mockApi.releaseAdminMockExamReviewLock(selectedDetail.id, currentLockToken);
    } catch (_error) {
      // ignore
    }
  };

  const loadDetail = async (recordId: string) => {
    try {
      setDetailLoading(true);
      setClaimingRecordId(recordId);
      const detail = await mockApi.claimAdminMockExamReview(recordId);
      setSelectedDetail(detail);
      setDrafts(buildDraftState(detail));
      setDetailOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "领取试卷失败");
    } finally {
      setClaimingRecordId("");
      setDetailLoading(false);
    }
  };

  const refreshQueues = async () => {
    const nextPapers = await mockApi.getAdminMockExamReviewPapers().catch(async (error) => {
      const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: unknown }).status ?? 0) : 0;
      if (status === 404) {
        const paperList: AdminMockExamPaperListPayload = await mockApi.getAdminMockExamPapers();
        return buildFallbackReviewPaperPayload(paperList);
      }
      throw error;
    });

    setPapers(nextPapers);

    const nextReviews = await mockApi.getAdminMockExamReviews({
      keyword: deferredKeyword,
      reviewStatus,
      paperId,
      page,
      pageSize: PAGE_SIZE,
    });
    setReviews(nextReviews);
  };

  useEffect(() => {
    stopRenewLock();

    if (!detailOpen || !selectedDetail?.id || !selectedDetail.manualReviewLock?.ownedByCurrentAdmin || !currentLockToken) {
      return undefined;
    }

    renewLockTimerRef.current = window.setInterval(() => {
      void mockApi
        .renewAdminMockExamReviewLock(selectedDetail.id, currentLockToken)
        .then((detail) => {
          setSelectedDetail(detail);
        })
        .catch((error) => {
          stopRenewLock();
          toast.error(error instanceof Error ? error.message : "批改锁已失效，请重新进入");
          setDetailOpen(false);
          setSelectedDetail(null);
        });
    }, 60 * 1000);

    return () => {
      stopRenewLock();
    };
  }, [currentLockToken, detailOpen, selectedDetail?.id, selectedDetail?.manualReviewLock?.ownedByCurrentAdmin]);

  const handleSave = async () => {
    if (!selectedDetail) return;

    try {
      const items: AdminMockExamReviewQuestionScoreInput[] = subjectiveQuestions.map((question) => ({
        questionId: question.id,
        reviewVoiceUrl: (drafts.reviewVoices[question.id]?.url ?? "").trim(),
        reviewVoiceObjectKey: (drafts.reviewVoices[question.id]?.objectKey ?? "").trim(),
        reviewVoiceDurationSeconds: Number(drafts.reviewVoices[question.id]?.durationSeconds ?? 0) || 0,
        subQuestions: question.subjectiveSubQuestions.map((subQuestion) => {
          const key = getSubQuestionKey(question.id, subQuestion.id);
          const score = Number.parseInt(drafts.scores[key] ?? "0", 10);
          if (!Number.isInteger(score)) {
            throw new Error(`第 ${question.sortOrder} 题的小问分数必须是整数`);
          }
          return {
            subQuestionId: subQuestion.id,
            score,
            reviewComment: (drafts.comments[key] ?? "").trim(),
            referenceAnswer: (drafts.references[key] ?? "").trim(),
            abilityLabel: (drafts.abilities[key] ?? "").trim() || subQuestion.title || "",
            rubricGuidance: (drafts.rubricGuidance[key] ?? "").trim(),
            rubricPoints: normalizeDraftRubricPointsForSave(drafts.rubricPoints[key] ?? []),
            missedPoints: normalizeDraftMissedPointsForSave(drafts.missedPoints[key] ?? []),
            answerMarks: normalizeDraftAnswerMarksForSave({
              marks: drafts.marks[key] ?? [],
              questionSortOrder: question.sortOrder,
              subQuestionTitle: subQuestion.title,
            }),
          };
        }),
      }));

      setSaving(true);
      const detail = await mockApi.submitAdminMockExamReview(selectedDetail.id, {
        items,
        lockToken: currentLockToken,
        version: currentLockVersion,
      });
      setSelectedDetail(detail);
      setDrafts(buildDraftState(detail));
      toast.success("批改结果已保存到待发送队列");
      await refreshQueues();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存批改失败");
    } finally {
      setSaving(false);
    }
  };

  const handleAiScore = async () => {
    if (!selectedDetail) return;
    try {
      setAiScoring(true);
      const detail = await mockApi.aiScoreAdminMockExamReview(selectedDetail.id);
      setSelectedDetail(detail);
      setDrafts(buildDraftState(detail));
      toast.success("批改结果已更新");
      await refreshQueues();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "批改失败");
    } finally {
      setAiScoring(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedDetail) return;
    try {
      setPublishing(true);
      const detail = await mockApi.publishAdminMockExamReview(selectedDetail.id, {
        lockToken: currentLockToken,
        version: currentLockVersion,
      });
      setSelectedDetail(detail);
      setDrafts(buildDraftState(detail));
      toast.success("已发送给学生");
      await refreshQueues();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "发送给学生失败");
    } finally {
      setPublishing(false);
    }
  };

  const handleReviewVoiceUpload = async (event: ChangeEvent<HTMLInputElement>, questionId: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingVoiceQuestionId(questionId);
      const uploaded = await mockApi.uploadMockExamReviewVoice(file);
      setDrafts((current) => ({
        ...current,
        reviewVoices: {
          ...current.reviewVoices,
          [questionId]: {
            url: uploaded.readableUrl ?? uploaded.url,
            objectKey: uploaded.objectKey,
            durationSeconds: Number(uploaded.durationSeconds ?? 0) || 0,
            source: "review",
          },
        },
      }));
      toast.success("语音点评已上传");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "上传语音点评失败");
    } finally {
      setUploadingVoiceQuestionId("");
      event.target.value = "";
    }
  };

  const handleReviewVoiceClear = (questionId: string) => {
    const question = subjectiveQuestions.find((item) => item.id === questionId);
    const lessonAudioUrl = (question?.lessonAudioUrl ?? "").trim();
    const lessonAudioObjectKey = (question?.lessonAudioObjectKey ?? "").trim();
    const lessonAudioDurationSeconds = Number(question?.lessonAudioDurationSeconds ?? 0) || 0;

    setDrafts((current) => ({
      ...current,
      reviewVoices: {
        ...current.reviewVoices,
        [questionId]: {
          url: lessonAudioUrl,
          objectKey: lessonAudioObjectKey,
          durationSeconds: lessonAudioDurationSeconds,
          source: lessonAudioUrl || lessonAudioObjectKey ? "lesson" : undefined,
        },
      },
    }));
  };

  if (!paperId) {
    return null;
  }

  return (
    <div className="space-y-6 p-8">
      <section className="overflow-hidden rounded-[34px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_38%),linear-gradient(135deg,#ffffff_0%,#f8fafc_100%)] p-6 shadow-[0_24px_60px_rgba(15,23,42,0.06)]">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <button
              type="button"
              onClick={() => navigate("/adminpg/papers")}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-4 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              <ArrowLeft className="size-4" />
              返回试卷列表
            </button>

            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">单卷批改队列</p>

            {loadingPapers ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                <LoaderCircle className="size-4 animate-spin" />
                试卷信息加载中...
              </div>
            ) : activePaper ? (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge className="bg-slate-100 text-slate-700">{activePaper.phase || "主观题"}</Badge>
                  {activePaper.year ? <Badge className="bg-white text-slate-600">{activePaper.year} 年</Badge> : null}
                  <Badge className="bg-white text-slate-600">共 {activePaper.reviewSummary.total} 份记录</Badge>
                </div>
                <h1 className="mt-4 text-[34px] font-semibold tracking-[-0.06em] text-slate-900">{activePaper.title}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
                  这里不再混合所有试卷。你现在看到的就是这张试卷自己的批改队列，按阶段切换后，只显示这张卷子在对应阶段下的全部记录。
                </p>
              </>
            ) : (
              <>
                <h1 className="mt-4 text-[32px] font-semibold tracking-[-0.06em] text-slate-900">试卷不存在或未开启批改</h1>
                <p className="mt-3 text-sm leading-7 text-slate-500">当前这张试卷没有出现在批改队列里。你可以返回试卷列表，重新选择需要处理的试卷。</p>
              </>
            )}
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
            {activePaper ? (
              <>
                <div className="overflow-hidden rounded-[22px] bg-slate-100">
                  <img src={activePaper.coverUrl} alt={activePaper.title} className="aspect-[16/9] w-full object-cover" />
                </div>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">试卷编号</span>
                    <span className="text-sm text-slate-500">{activePaper.code}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">当前阶段</span>
                    <Badge className={reviewStatusMeta[reviewStatus].className}>{reviewStatusMeta[reviewStatus].label}</Badge>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex min-h-[280px] items-center justify-center rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm leading-7 text-slate-500">
                当前试卷无法进入批改队列
              </div>
            )}
          </div>
        </div>
      </section>

      <Card className="rounded-[32px] border-slate-200 shadow-[0_20px_50px_rgba(15,23,42,0.05)]">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <CardTitle className="text-[24px] font-semibold tracking-[-0.04em] text-slate-900">
                {activePaper ? `${activePaper.title} · 批改记录` : "批改记录"}
              </CardTitle>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                二级页面按阶段处理这张试卷的所有记录。你点哪一个阶段，下面就只显示对应阶段的数据。
              </p>
            </div>
            <div className="w-full max-w-[340px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input className="h-11 rounded-full pl-9" placeholder="按手机号搜索" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {reviewStageCards.map((item) => {
              const count = getPaperStageCount(activePaper, item.status);
              const active = reviewStatus === item.status;

              return (
                <button
                  key={item.status}
                  type="button"
                  onClick={() => setReviewStatus(item.status)}
                  className={[
                    "rounded-[24px] border p-4 text-left transition-all",
                    active ? item.activeClassName : item.idleClassName,
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{item.label}</p>
                    <span className="text-2xl font-semibold tracking-[-0.05em]">{count}</span>
                  </div>
                  <p className="mt-2 text-xs leading-6 opacity-75">{item.description}</p>
                </button>
              );
            })}
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {loading ? (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 px-6 py-16 text-center text-sm text-slate-500">批改记录加载中...</div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>学生手机号</TableHead>
                    <TableHead>主观题数</TableHead>
                    <TableHead>当前总分</TableHead>
                    <TableHead>交卷时间</TableHead>
                    <TableHead>最新时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviews.list.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center text-sm text-slate-500">
                        当前这张试卷在“{reviewStatusMeta[reviewStatus].label}”阶段下没有记录
                      </TableCell>
                    </TableRow>
                  ) : (
                    reviews.list.map((item) => {
                      const statusMeta = getReviewStatusMeta(item.reviewStatus);
                      const normalizedStatus = normalizeReviewStatus(item.reviewStatus);
                      const lockedByOther = item.manualReviewLock.active && !item.manualReviewLock.ownedByCurrentAdmin;
                      const isClaiming = claimingRecordId === item.id;

                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium text-slate-900">
                            <div className="space-y-1">
                              <p>{item.user.phone}</p>
                              <Badge className={statusMeta.className}>{statusMeta.label}</Badge>
                              {lockedByOther ? <p className="text-xs text-rose-600">{item.manualReviewLock.reviewerName || "其他老师"}正在批改</p> : null}
                            </div>
                          </TableCell>
                          <TableCell>{item.subjectiveQuestionCount}</TableCell>
                          <TableCell>{item.totalScore} / {item.paper.totalScore}</TableCell>
                          <TableCell>{item.submittedAt || "-"}</TableCell>
                          <TableCell>{item.publishedAt || item.reviewedAt || item.submittedAt || "-"}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isClaiming || lockedByOther}
                              onClick={() => void loadDetail(item.id)}
                            >
                              {isClaiming ? "领取中..." : normalizedStatus === "published" ? "查看批改" : "进入处理"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          if (!open) {
            stopRenewLock();
            void releaseCurrentLock();
            setSelectedDetail(null);
          }
          setDetailOpen(open);
        }}
      >
        <DialogContent className="flex h-[calc(100vh-2rem)] w-[min(96vw,1600px)] max-w-none flex-col overflow-hidden p-0 sm:max-w-none">
          <DialogHeader className="border-b border-slate-200 px-6 py-5">
            <DialogTitle>主观题批改</DialogTitle>
            <DialogDescription>{selectedDetail ? `${selectedDetail.user.phone} · ${selectedDetail.paper.title}` : "加载中..."}</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {detailLoading || !selectedDetail ? (
              <div className="flex items-center justify-center py-16 text-sm text-slate-500"><LoaderCircle className="mr-2 size-4 animate-spin" />批改详情加载中...</div>
            ) : (
              <div className="space-y-6">
                {(() => {
                  const detailStatusMeta = getReviewStatusMeta(selectedDetail.reviewStatus);
                  const submittedTime = selectedDetail.submittedAt || "-";
                  const consumedTimeLabel = formatDurationLabel(selectedDetail.consumedSeconds ?? 0);

                  return (
                    <div className="rounded-[26px] border border-slate-200 bg-[linear-gradient(135deg,rgba(248,250,252,0.92),rgba(255,255,255,0.98))] p-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400">阅卷摘要</p>
                          <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.05em] text-slate-900">
                            {selectedDetail.paper.title}
                          </h2>
                          <p className="mt-1 text-sm leading-6 text-slate-500">
                            当前为整问批改总览页，左看作答，右看采分点与失分情况。
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="bg-slate-100 text-slate-700">第 {selectedDetail.attemptNo} 次作答</Badge>
                          <Badge className={detailStatusMeta.className}>{detailStatusMeta.label}</Badge>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <DetailSummaryCard label="学生账号" value={selectedDetail.user.phone} hint="当前进入的是这位学生的主观题批改记录" />
                        <DetailSummaryCard
                          label="结果类型"
                          value={getReviewSourceLabel(selectedDetail.reviewSource)}
                          hint="本次结果来源于当前批改流程"
                        />
                        <DetailSummaryCard
                          label="主观得分"
                          value={`${selectedDetail.scoring.subjectiveScore} 分`}
                          hint={`共 ${selectedDetail.scoring.subjectiveQuestionCount} 道主观题`}
                        />
                        <DetailSummaryCard
                          label="交卷信息"
                          value={submittedTime}
                          hint={`答题用时 ${consumedTimeLabel}`}
                        />
                      </div>
                    </div>
                  );
                })()}

                <div className="sticky top-0 z-10 rounded-[24px] border border-slate-200 bg-white/94 px-4 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.05)] backdrop-blur">
                  <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">题号导航</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">按题号快速跳转，右侧分值会实时反映当前录入情况。</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {subjectiveQuestions.map((question) => {
                        const draftScore = getQuestionDraftScore(question, drafts);
                        return (
                          <button
                            key={question.id}
                            type="button"
                            onClick={() => {
                              const target = document.getElementById(getQuestionAnchorId(question.id));
                              target?.scrollIntoView({ behavior: "smooth", block: "start" });
                            }}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                          >
                            <span>第 {question.sortOrder} 题</span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{draftScore}/{question.score}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {subjectiveQuestions.map((question) => (
                  <div id={getQuestionAnchorId(question.id)} key={question.id} className="rounded-[28px] border border-slate-200 bg-white scroll-mt-6">
                    <div className="border-b border-slate-200 px-5 py-4">
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="bg-slate-100 text-slate-700">第 {question.sortOrder} 题</Badge>
                            <Badge className="bg-blue-50 text-blue-700">{question.typeLabel}</Badge>
                            <Badge className="bg-white text-slate-600">{question.subjectiveSubQuestions.length} 个小问</Badge>
                            <Badge className="bg-amber-50 text-amber-800">满分 {question.score} 分</Badge>
                          </div>
                          {question.material ? (
                            <div className="mt-3 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                              {question.material}
                            </div>
                          ) : null}
                          <p className="mt-3 whitespace-pre-wrap text-[16px] font-semibold leading-7 text-slate-900">{question.stem}</p>
                        </div>

                        <div className="flex shrink-0 flex-col items-start gap-1.5 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 xl:min-w-[200px]">
                          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-400">本题录入得分</p>
                          <p className="text-[24px] font-semibold tracking-[-0.05em] text-slate-900">
                            {getQuestionDraftScore(question, drafts)}
                            <span className="ml-1 text-base font-medium text-slate-500">/ {question.score}</span>
                          </p>
                          <p className="text-xs leading-5 text-slate-500">按小问分别录分，系统这里汇总展示。</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 px-5 py-4">
                      <QuestionReviewVoicePanel
                        reviewVoice={drafts.reviewVoices[question.id] ?? { url: "", objectKey: "", durationSeconds: 0 }}
                        reviewVoiceUploading={uploadingVoiceQuestionId === question.id}
                        onReviewVoiceUpload={(event) => void handleReviewVoiceUpload(event, question.id)}
                        onReviewVoiceClear={() => handleReviewVoiceClear(question.id)}
                      />

                      {question.subjectiveSubQuestions.map((subQuestion) => {
                        const key = getSubQuestionKey(question.id, subQuestion.id);
                        return (
                          <CompactInlineSubQuestionReviewWorkbench
                            key={subQuestion.id}
                            question={question}
                            subQuestion={subQuestion}
                            scoreValue={drafts.scores[key] ?? ""}
                            abilityValue={drafts.abilities[key] ?? ""}
                            commentValue={drafts.comments[key] ?? ""}
                            marks={drafts.marks[key] ?? []}
                            onScoreChange={(value) =>
                              setDrafts((current) => ({
                                ...current,
                                scores: { ...current.scores, [key]: value },
                              }))
                            }
                            onAbilityChange={(value) =>
                              setDrafts((current) => ({
                                ...current,
                                abilities: { ...current.abilities, [key]: value },
                              }))
                            }
                            onCommentChange={(value) =>
                              setDrafts((current) => ({
                                ...current,
                                comments: { ...current.comments, [key]: value },
                              }))
                            }
                            onMarksChange={(value) =>
                              setDrafts((current) => ({
                                ...current,
                                marks: { ...current.marks, [key]: value },
                              }))
                            }
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-slate-200 px-6 py-4">
            <Button
              variant="outline"
              onClick={() => {
                stopRenewLock();
                void releaseCurrentLock();
                setSelectedDetail(null);
                setDetailOpen(false);
              }}
            >
              关闭
            </Button>
            <Button variant="outline" disabled={detailLoading || aiScoring || !selectedDetail} onClick={() => void handleAiScore()}>
              {aiScoring ? "批改中..." : "重新批改"}
            </Button>
            <Button disabled={detailLoading || saving || !selectedDetail} onClick={() => void handleSave()}>
              {saving ? "保存中..." : "保存到待发送"}
            </Button>
            <Button className="bg-slate-900 text-white hover:bg-slate-800" disabled={detailLoading || publishing || !selectedDetail || normalizeReviewStatus(selectedDetail.reviewStatus) !== "manual_pending"} onClick={() => void handlePublish()}>
              {publishing ? "发送中..." : <><Send className="mr-2 size-4" />发送给学生</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
