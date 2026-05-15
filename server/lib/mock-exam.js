import { config } from "./config.js";
import { formatDateTime } from "./time.js";
import { getReadableObjectUrl } from "./upload.js";
import { sanitizeReviewExposureText } from "./mock-exam-ai-review.js";
import { normalizeDisplayText } from "./text.js";

const DEFAULT_OBJECTIVE_PAPER_COVER = "/mock-exam/default-objective-cover.svg";
const DEFAULT_SUBJECTIVE_PAPER_COVER = "/mock-exam/default-subjective-cover.svg";

const subjectiveQuestionType = "subjective_case";

const questionTypeMeta = {
  single_choice: {
    label: "单选题",
    maxSelections: 1,
    sectionDescription: "每题所设选项中只有一个正确答案，错选、不选均不得分。",
  },
  multiple_choice: {
    label: "多选题",
    maxSelections: 99,
    sectionDescription: "每题所设选项中至少有两个正确答案，多选、少选、错选或不选均不得分。",
  },
  uncertain_choice: {
    label: "不定项选择题",
    maxSelections: 99,
    sectionDescription: "每题所设选项中至少有一个正确答案，多选、少选、错选或不选均不得分。",
  },
  subjective_case: {
    label: "主观题",
    maxSelections: 0,
    sectionDescription: "请在对应的答题区域内作答，系统会自动保存答案。",
  },
};

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getManualReviewerDisplayName = (value) => normalizeDisplayText(`${value ?? ""}`.trim()) || "其他老师";

const MANUAL_REVIEW_LOCK_MINUTES = 15;
const STALE_AI_PROCESSING_MIN_RECOVERY_MS = 5 * 60 * 1000;
const STALE_AI_PROCESSING_EXTRA_BUFFER_MS = 60 * 1000;
const STALE_AI_PROCESSING_ERROR_MESSAGE = "AI批改任务异常中断，已恢复为待处理状态，请重新批改";

const buildManualReviewLockToken = () =>
  `review_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;

const getStaleAiProcessingRecoveryThresholdMs = (timeoutMs) => {
  const normalizedTimeoutMs = Number(timeoutMs);
  const safeTimeoutMs = Number.isFinite(normalizedTimeoutMs) ? Math.max(0, normalizedTimeoutMs) : 120000;
  return Math.max(safeTimeoutMs + STALE_AI_PROCESSING_EXTRA_BUFFER_MS, STALE_AI_PROCESSING_MIN_RECOVERY_MS);
};

const resolveMockExamAiReviewTimeoutMs = async (db) => {
  const fallbackTimeoutMs = Number(config?.mockExamAiReview?.timeoutMs ?? 120000) || 120000;

  try {
    if (typeof db?.systemConfig?.findUnique !== "function") {
      return fallbackTimeoutMs;
    }

    const systemConfig = await db.systemConfig.findUnique({
      where: { id: 1 },
      select: {
        mockExamAiReviewConfigJson: true,
      },
    });

    const parsed = parseJsonSafely(systemConfig?.mockExamAiReviewConfigJson ?? null, null);
    const timeoutMs = Number(parsed?.timeoutMs);
    return Number.isFinite(timeoutMs) && timeoutMs >= 0 ? timeoutMs : fallbackTimeoutMs;
  } catch (_error) {
    return fallbackTimeoutMs;
  }
};

export const recoverStaleAiProcessingMockExamReviews = async ({
  db,
  recordId = "",
  paperId = "",
  currentTime = new Date(),
}) => {
  if (typeof db?.mockExamRecord?.updateMany !== "function") {
    return {
      recovered: 0,
      thresholdMs: getStaleAiProcessingRecoveryThresholdMs(config?.mockExamAiReview?.timeoutMs ?? 120000),
    };
  }

  const timeoutMs = await resolveMockExamAiReviewTimeoutMs(db);
  const thresholdMs = getStaleAiProcessingRecoveryThresholdMs(timeoutMs);
  const staleBefore = new Date(currentTime.getTime() - thresholdMs);
  const normalizedRecordId = `${recordId ?? ""}`.trim();
  const normalizedPaperId = `${paperId ?? ""}`.trim();
  const baseWhere = {
    status: "submitted",
    reviewWorkflowStatus: "ai_processing",
    aiReviewFinishedAt: null,
    aiReviewStartedAt: {
      lt: staleBefore,
    },
    ...(normalizedRecordId ? { id: normalizedRecordId } : {}),
    ...(normalizedPaperId ? { paperId: normalizedPaperId } : {}),
  };
  const baseData = {
    aiReviewStartedAt: null,
    aiReviewFinishedAt: null,
    lastAiReviewError: STALE_AI_PROCESSING_ERROR_MESSAGE,
  };

  const [publishedResult, manualPendingResult, aiPendingResult] = await Promise.all([
    db.mockExamRecord.updateMany({
      where: {
        ...baseWhere,
        publishedAt: {
          not: null,
        },
      },
      data: {
        ...baseData,
        reviewWorkflowStatus: "published",
      },
    }),
    db.mockExamRecord.updateMany({
      where: {
        ...baseWhere,
        publishedAt: null,
        reviewedAt: {
          not: null,
        },
      },
      data: {
        ...baseData,
        reviewWorkflowStatus: "manual_pending",
      },
    }),
    db.mockExamRecord.updateMany({
      where: {
        ...baseWhere,
        publishedAt: null,
        reviewedAt: null,
      },
      data: {
        ...baseData,
        reviewWorkflowStatus: "ai_pending",
      },
    }),
  ]);

  return {
    recovered:
      Number(publishedResult?.count ?? 0) + Number(manualPendingResult?.count ?? 0) + Number(aiPendingResult?.count ?? 0),
    thresholdMs,
  };
};

const parseJsonSafely = (value, fallback) => {
  if (!value) return fallback;

  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
};

const normalizeAnswerKeys = (answerKeys = []) =>
  Array.from(
    new Set(
      (Array.isArray(answerKeys) ? answerKeys : [])
        .map((item) => `${item ?? ""}`.trim().toUpperCase())
        .filter(Boolean),
    ),
  ).sort();

const normalizePlainText = (value) => `${value ?? ""}`.replace(/\r\n/g, "\n").trimEnd();

const parseObjectiveAnswerJson = (value) => {
  if (!value) return [];
  return normalizeAnswerKeys(parseJsonSafely(value, []));
};

const inferPaperTypeFromQuestions = (questions = []) =>
  questions.some((question) => `${question?.type ?? ""}`.trim() === subjectiveQuestionType) ? "subjective" : "objective";

const getMockExamPaperCoverUrl = (paper, fallbackPaperType = null) => {
  const paperType = paper?.paperType ?? fallbackPaperType ?? inferPaperTypeFromQuestions(paper?.questions ?? []);
  return (
    getReadableObjectUrl({
      objectKey: paper?.coverObjectKey ?? "",
      fallbackUrl: paper?.coverUrl ?? "",
    }) || (paperType === "subjective" ? DEFAULT_SUBJECTIVE_PAPER_COVER : DEFAULT_OBJECTIVE_PAPER_COVER)
  );
};

const getQuestionLessonAudioUrl = (question) =>
  getReadableObjectUrl({
    objectKey: question?.lessonAudioObjectKey ?? "",
    fallbackUrl: question?.lessonAudioUrl ?? "",
  });

const getQuestionReviewVoiceUrl = (reviewJson) =>
  getReadableObjectUrl({
    objectKey: reviewJson?.reviewVoiceObjectKey ?? "",
    fallbackUrl: reviewJson?.reviewVoiceUrl ?? "",
  });

const getQuestionDisplayVoice = (question, reviewJson) => {
  const reviewVoiceUrl = getQuestionReviewVoiceUrl(reviewJson);
  if (reviewVoiceUrl) {
    return {
      url: reviewVoiceUrl,
      objectKey: `${reviewJson?.reviewVoiceObjectKey ?? ""}`.trim(),
      durationSeconds: Number(reviewJson?.reviewVoiceDurationSeconds ?? 0) || 0,
      source: "review",
    };
  }

  return {
    url: getQuestionLessonAudioUrl(question),
    objectKey: `${question?.lessonAudioObjectKey ?? ""}`.trim(),
    durationSeconds: Number(question?.lessonAudioDurationSeconds ?? 0) || 0,
    source: "lesson",
  };
};

const buildRecordPaperSnapshot = (paper) =>
  JSON.stringify({
    paper: {
      id: paper.id,
      code: paper.code,
      title: paper.title,
      subtitle: paper.subtitle ?? "",
      coverUrl: paper.coverUrl ?? "",
      coverObjectKey: paper.coverObjectKey ?? "",
      paperType: paper.paperType ?? inferPaperTypeFromQuestions(paper.questions ?? []),
      year: Number(paper.year ?? 0),
      phase: paper.phase ?? "",
      durationMinutes: Number(paper.durationMinutes ?? 0),
      maxAttempts: Number(paper.maxAttempts ?? 0),
      reviewEnabled: isReviewEnabledForPaper(paper),
      totalScore: Number(paper.totalScore ?? 0),
      questionCount: Number(paper.questionCount ?? 0),
      passScore: Number(paper.passScore ?? 0),
      description: paper.description ?? "",
    },
    questions: (paper.questions ?? []).map((question) => ({
      id: question.id,
      sortOrder: Number(question.sortOrder ?? 0),
      type: question.type,
      score: Number(question.score ?? 0),
      material: question.material ?? "",
      stem: question.stem,
      analysis: question.analysis ?? "",
      lessonAudioUrl: question.lessonAudioUrl ?? "",
      lessonAudioObjectKey: question.lessonAudioObjectKey ?? "",
      lessonAudioDurationSeconds: Number(question.lessonAudioDurationSeconds ?? 0) || 0,
      correctAnswerJson: question.correctAnswerJson,
      questionMetaJson: question.questionMetaJson ?? null,
      options: (question.options ?? []).map((option) => ({
        id: option.id,
        optionKey: option.optionKey,
        content: option.content,
        sortOrder: Number(option.sortOrder ?? 0),
      })),
    })),
  });

const parseRecordPaperSnapshot = (record) => {
  const raw = parseJsonSafely(record?.paperSnapshotJson, null);
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const paper = raw.paper && typeof raw.paper === "object" ? raw.paper : {};
  const questions = Array.isArray(raw.questions) ? raw.questions : [];

  return {
    id: `${paper.id ?? record?.paperId ?? ""}`.trim(),
    code: `${paper.code ?? ""}`.trim(),
    title: `${paper.title ?? ""}`.trim(),
    subtitle: `${paper.subtitle ?? ""}`.trim(),
    coverUrl: `${paper.coverUrl ?? ""}`.trim(),
    coverObjectKey: `${paper.coverObjectKey ?? ""}`.trim(),
    paperType: `${paper.paperType ?? inferPaperTypeFromQuestions(questions)}`.trim() || inferPaperTypeFromQuestions(questions),
    year: Number(paper.year ?? 0),
    phase: `${paper.phase ?? ""}`.trim(),
    durationMinutes: Number(paper.durationMinutes ?? 0),
    maxAttempts: Number(paper.maxAttempts ?? 0),
    reviewEnabled: typeof paper.reviewEnabled === "boolean" ? paper.reviewEnabled : questions.some((question) => `${question?.type ?? ""}`.trim() === subjectiveQuestionType),
    totalScore: Number(paper.totalScore ?? 0),
    questionCount: Number(paper.questionCount ?? questions.length),
    passScore: Number(paper.passScore ?? 0),
    description: `${paper.description ?? ""}`.trim(),
    questions: questions
      .map((question) => ({
        id: `${question?.id ?? ""}`.trim(),
        sortOrder: Number(question?.sortOrder ?? 0),
        type: `${question?.type ?? ""}`.trim(),
        score: Number(question?.score ?? 0),
        material: `${question?.material ?? ""}`,
        stem: `${question?.stem ?? ""}`,
        analysis: `${question?.analysis ?? ""}`,
        lessonAudioUrl: `${question?.lessonAudioUrl ?? ""}`,
        lessonAudioObjectKey: `${question?.lessonAudioObjectKey ?? ""}`,
        lessonAudioDurationSeconds: Number(question?.lessonAudioDurationSeconds ?? 0) || 0,
        correctAnswerJson: `${question?.correctAnswerJson ?? "[]"}`,
        questionMetaJson: question?.questionMetaJson ? `${question.questionMetaJson}` : null,
        options: Array.isArray(question?.options)
          ? question.options
              .map((option) => ({
                id: `${option?.id ?? ""}`.trim(),
                optionKey: `${option?.optionKey ?? ""}`.trim(),
                content: `${option?.content ?? ""}`,
                sortOrder: Number(option?.sortOrder ?? 0),
              }))
              .sort((left, right) => left.sortOrder - right.sortOrder)
          : [],
      }))
      .filter((question) => question.id && question.type)
      .sort((left, right) => left.sortOrder - right.sortOrder),
  };
};

const getPreferredQuestionLessonAudio = (question) => {
  const sourceBankItem = question?.sourceBankItem ?? null;
  const sourceLessonAudioUrl = `${sourceBankItem?.lessonAudioUrl ?? ""}`.trim();
  const sourceLessonAudioObjectKey = `${sourceBankItem?.lessonAudioObjectKey ?? ""}`.trim();
  const sourceLessonAudioDurationSeconds = Number(sourceBankItem?.lessonAudioDurationSeconds ?? 0) || 0;

  if (sourceLessonAudioUrl || sourceLessonAudioObjectKey || sourceLessonAudioDurationSeconds > 0) {
    return {
      lessonAudioUrl: sourceLessonAudioUrl,
      lessonAudioObjectKey: sourceLessonAudioObjectKey,
      lessonAudioDurationSeconds: sourceLessonAudioDurationSeconds,
    };
  }

  return {
    lessonAudioUrl: `${question?.lessonAudioUrl ?? ""}`.trim(),
    lessonAudioObjectKey: `${question?.lessonAudioObjectKey ?? ""}`.trim(),
    lessonAudioDurationSeconds: Number(question?.lessonAudioDurationSeconds ?? 0) || 0,
  };
};

const mergeSnapshotQuestionLessonAudio = (snapshotQuestion, liveQuestion) => {
  if (!snapshotQuestion && !liveQuestion) {
    return null;
  }

  if (!liveQuestion) {
    return snapshotQuestion;
  }

  const preferredLessonAudio = getPreferredQuestionLessonAudio(liveQuestion);
  const hasPreferredLessonAudio =
    Boolean(preferredLessonAudio.lessonAudioUrl) ||
    Boolean(preferredLessonAudio.lessonAudioObjectKey) ||
    preferredLessonAudio.lessonAudioDurationSeconds > 0;

  if (!snapshotQuestion) {
    return {
      ...liveQuestion,
      ...preferredLessonAudio,
    };
  }

  if (hasPreferredLessonAudio) {
    return {
      ...snapshotQuestion,
      ...preferredLessonAudio,
    };
  }

  return snapshotQuestion;
};

const mergeSnapshotPaperWithLivePaper = (snapshotPaper, livePaper) => {
  if (!snapshotPaper) {
    return livePaper;
  }

  if (!livePaper || !Array.isArray(snapshotPaper.questions) || !Array.isArray(livePaper.questions)) {
    return snapshotPaper;
  }

  const liveQuestionMap = new Map(
    livePaper.questions.map((question) => [`${question?.id ?? ""}`.trim(), question]),
  );

  return {
    ...snapshotPaper,
    questions: snapshotPaper.questions.map((question) =>
      mergeSnapshotQuestionLessonAudio(question, liveQuestionMap.get(question.id)),
    ),
  };
};

const getRecordPaper = (record) => mergeSnapshotPaperWithLivePaper(parseRecordPaperSnapshot(record), record?.paper ?? null);

const isSubjectiveQuestionType = (type) => type === subjectiveQuestionType;
const isSubjectiveQuestion = (question) => isSubjectiveQuestionType(question?.type);

const isSameAnswer = (left, right) => {
  if (left.length !== right.length) return false;
  return left.every((item, index) => item === right[index]);
};

const buildMockExamActiveKey = (paperId, userId) => `${paperId}:${userId}`;

const isUniqueConstraintError = (error, fieldName) => {
  const targets = Array.isArray(error?.meta?.target) ? error.meta.target : [`${error?.meta?.target ?? ""}`];
  return error?.code === "P2002" && targets.some((target) => `${target}`.includes(fieldName));
};

const buildDefaultSubjectiveSubQuestion = (question) => [
  {
    id: `${question.id}_default`,
    title: question.stem || `第 ${question.sortOrder} 题`,
    placeholder: "请在此输入答案。",
    sortOrder: 1,
  },
];

const buildDefaultReviewComment = ({ question, subQuestion, score, maxScore }) => {
  if (score >= maxScore && maxScore > 0) {
    return "作答完整，核心要点覆盖到位。";
  }

  if (score <= 0) {
    return "答案未覆盖得分要点，建议补充法条依据、构成要件或结论。";
  }

  return `已覆盖部分要点，但还可围绕“${subQuestion.title || question.stem.slice(0, 18)}”补充细节。`;
};

const buildDefaultReferenceAnswer = ({ question, subQuestion }) => {
  const questionMeta = getQuestionMeta(question);
  const prefix = questionMeta.sectionLabel || "参考答案";
  return `${prefix}：围绕“${subQuestion.title || question.stem}”展开，写明结论、依据和分析过程。`;
};

const normalizeAnswerMarks = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      const normalizedStatus = ["correct", "wrong", "score", "neutral"].includes(`${item?.status ?? ""}`.trim()) ? `${item?.status}`.trim() : "wrong";
      const rawScore = Number(item?.score);
      const rawStart = Number(item?.start);
      const rawEnd = Number(item?.end);
      return {
        id: `${item?.id ?? `mark_${index + 1}`}`.trim(),
        highlight: `${item?.highlight ?? ""}`.trim(),
        comment: `${item?.comment ?? ""}`.trim(),
        status: normalizedStatus,
        score: (normalizedStatus === "score" || normalizedStatus === "correct") && Number.isFinite(rawScore) ? rawScore : null,
        start: Number.isInteger(rawStart) && rawStart >= 0 ? rawStart : null,
        end: Number.isInteger(rawEnd) && rawEnd > rawStart ? rawEnd : null,
      };
    })
    .filter((item) => item.highlight);
};

const syncAnswerMarkScoresWithExpectedScore = (value, expectedScore) => {
  const normalizedMarks = normalizeAnswerMarks(value);
  const safeExpectedScore = Number(expectedScore);
  const positiveMarks = normalizedMarks.filter((item) => item.status === "correct" || item.status === "score");

  if (positiveMarks.length === 0) {
    return normalizedMarks;
  }

  if (!Number.isFinite(safeExpectedScore) || safeExpectedScore < 0) {
    return normalizedMarks.map((item) =>
      item.status === "correct" || item.status === "score"
        ? {
            ...item,
            status: "correct",
            score: item.score ?? null,
          }
        : item,
    );
  }

  const remainingScores = positiveMarks.map((item) => (Number.isFinite(Number(item.score)) ? Math.max(0, Number(item.score)) : null));
  let remainingTotal = Math.max(0, Math.round(safeExpectedScore));
  let unresolvedCount = remainingScores.filter((item) => item === null).length;

  return normalizedMarks.map((item) => {
    if (item.status !== "correct" && item.status !== "score") {
      return item;
    }

    const resolvedScore = Number.isFinite(Number(item.score)) ? Math.max(0, Number(item.score)) : null;
    if (resolvedScore !== null) {
      remainingTotal = Math.max(0, remainingTotal - resolvedScore);
      if (unresolvedCount > 0) {
        unresolvedCount -= 1;
      }
      return {
        ...item,
        status: "correct",
        score: resolvedScore,
      };
    }

    const nextScore = unresolvedCount > 0 ? remainingTotal : 0;
    remainingTotal = Math.max(0, remainingTotal - nextScore);
    if (unresolvedCount > 0) {
      unresolvedCount -= 1;
    }

    return {
      ...item,
      status: "correct",
      score: nextScore,
    };
  });
};

const normalizeRubricKeywords = (value) =>
  Array.from(
    new Set(
      (Array.isArray(value) ? value : `${value ?? ""}`.split(/[\n,，、；;]/))
        .map((item) => `${item ?? ""}`.trim())
        .filter(Boolean),
    ),
  );

const normalizeRubricPoints = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => ({
      id: `${item?.id ?? `point_${index + 1}`}`.trim(),
      title: `${item?.title ?? ""}`.trim(),
      score: Math.max(0, Number.parseInt(`${item?.score ?? ""}`, 10) || 0),
      description: `${item?.description ?? ""}`.trim(),
      keywords: normalizeRubricKeywords(item?.keywords),
      hit: typeof item?.hit === "boolean" ? item.hit : undefined,
      awardedScore: Number.isFinite(Number(item?.awardedScore)) ? Number(item.awardedScore) : undefined,
      matchedText: `${item?.matchedText ?? ""}`.trim(),
      sortOrder: Number(item?.sortOrder ?? index + 1),
    }))
    .filter((item) => item.title)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((item, index) => ({
      id: item.id || `point_${index + 1}`,
      title: item.title,
      score: item.score,
      description: item.description,
      keywords: item.keywords,
      hit: item.hit,
      awardedScore: item.awardedScore,
      matchedText: item.matchedText,
      sortOrder: index + 1,
    }));
};

const normalizeMissedPoints = (value) =>
  (Array.isArray(value) ? value : [])
    .map((item, index) => ({
      id: `${item?.id ?? `missed_${index + 1}`}`.trim(),
      title: `${item?.title ?? ""}`.trim(),
      description: `${item?.description ?? ""}`.trim(),
      score: Number.isFinite(Number(item?.score)) ? Number(item.score) : 0,
      sortOrder: Number(item?.sortOrder ?? index + 1),
    }))
    .filter((item) => item.title || item.description)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      score: item.score,
    }));

const normalizeReviewProvider = (value) => {
  const provider = `${value ?? ""}`.trim().toLowerCase();
  if (provider === "openai-compatible") {
    return "openai-compatible";
  }
  if (provider === "rules") {
    return "rules";
  }
  return "";
};

const buildSubjectiveSubQuestionAllocations = (question) => {
  const questionMeta = getQuestionMeta(question);
  const subQuestions = questionMeta.subQuestions.length > 0 ? questionMeta.subQuestions : buildDefaultSubjectiveSubQuestion(question);
  const totalScore = Math.max(0, Number(question?.score ?? 0));
  const count = subQuestions.length || 1;
  const baseScore = count > 0 ? Math.floor(totalScore / count) : totalScore;
  const remainder = count > 0 ? totalScore % count : 0;

  return subQuestions.map((subQuestion, index) => {
    const maxScore = Math.max(0, baseScore + (index < remainder ? 1 : 0));
    return {
      ...subQuestion,
      maxScore,
    };
  });
};

const buildSubjectiveReviewJson = ({ question, answer, source = "system", subQuestionScores = null }) => {
  const allocations = buildSubjectiveSubQuestionAllocations(question);
  const answerMap = parseSubjectiveAnswerMap(answer?.answerJson, question);
  const subQuestionCount = allocations.length || 1;
  const totalScore = Number(answer?.score ?? 0);
  const maxScore = Number(question.score ?? 0);
  const baseScore = subQuestionCount > 0 ? Math.floor(totalScore / subQuestionCount) : totalScore;
  const remainder = subQuestionCount > 0 ? totalScore % subQuestionCount : 0;
  const scoreMap =
    subQuestionScores && typeof subQuestionScores === "object" && !Array.isArray(subQuestionScores)
      ? new Map(Object.entries(subQuestionScores).map(([key, value]) => [`${key}`.trim(), Number(value)]))
      : null;

  return {
    source,
    totalScore,
    maxScore,
    subQuestions: allocations.map((subQuestion, index) => {
      const score = scoreMap && scoreMap.has(subQuestion.id)
        ? Math.max(0, Math.min(Number(subQuestion.maxScore ?? 0), Number(scoreMap.get(subQuestion.id) ?? 0)))
        : Math.max(0, Math.min(Number(subQuestion.maxScore ?? 0), baseScore + (index < remainder ? 1 : 0)));
      const answerText = answerMap[subQuestion.id] ?? "";

      return {
        id: subQuestion.id,
        title: subQuestion.title,
        answer: answerText,
        score,
        maxScore: Number(subQuestion.maxScore ?? 0),
        reviewComment: buildDefaultReviewComment({ question, subQuestion, score, maxScore: Number(subQuestion.maxScore ?? 0) }),
        referenceAnswer: buildDefaultReferenceAnswer({ question, subQuestion }),
        reviewSource: source,
        abilityLabel: subQuestion.title || `问题(${index + 1})`,
        rubricGuidance: subQuestion.rubricGuidance || "",
        rubricPoints: normalizeRubricPoints(subQuestion.rubricPoints),
        missedPoints: [],
        answerMarks: [],
      };
    }),
    reviewSource: source,
  };
};

const getQuestionMeta = (question) => {
  const raw = parseJsonSafely(question?.questionMetaJson, {});
  const subQuestions = Array.isArray(raw?.subQuestions)
    ? raw.subQuestions
        .map((item, index) => ({
          id: `${item?.id ?? `${question.id}_sub_${index + 1}`}`.trim(),
          title: `${item?.title ?? `问题(${index + 1})`}`.trim(),
          placeholder: `${item?.placeholder ?? "请在此输入答案。"}`.trim(),
          abilityLabel: `${item?.abilityLabel ?? ""}`.trim(),
          referenceAnswer: `${item?.referenceAnswer ?? ""}`.trim(),
          rubricGuidance: `${item?.rubricGuidance ?? ""}`.trim(),
          rubricPoints: normalizeRubricPoints(item?.rubricPoints),
          sortOrder: Number(item?.sortOrder ?? index + 1),
        }))
        .filter((item) => item.id && item.title)
        .sort((left, right) => left.sortOrder - right.sortOrder)
    : [];

  const normalizedSubQuestions =
    subQuestions.length > 0 ? subQuestions : isSubjectiveQuestion(question) ? buildDefaultSubjectiveSubQuestion(question) : [];

  return {
    sectionLabel:
      `${raw?.sectionLabel ?? ""}`.trim() ||
      questionTypeMeta[question?.type]?.label ||
      `${question?.type ?? "题目"}`.trim(),
    sectionDescription:
      `${raw?.sectionDescription ?? ""}`.trim() || questionTypeMeta[question?.type]?.sectionDescription || "",
    questionTitle: `${raw?.questionTitle ?? ""}`.trim() || `${question?.stem ?? ""}`.trim(),
    subQuestions: normalizedSubQuestions,
  };
};

const parseSubjectiveAnswerMap = (value, question) => {
  const questionMeta = getQuestionMeta(question);
  const raw = parseJsonSafely(value, {});
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};

  return Object.fromEntries(
    questionMeta.subQuestions.map((item) => [item.id, normalizePlainText(source[item.id])]),
  );
};

const getQuestionAnswerState = (question, answerJson) => {
  if (!isSubjectiveQuestion(question)) {
    return parseObjectiveAnswerJson(answerJson).length > 0 ? "answered" : "unanswered";
  }

  const answerMap = parseSubjectiveAnswerMap(answerJson, question);
  const questionMeta = getQuestionMeta(question);
  const filledCount = questionMeta.subQuestions.filter((item) => answerMap[item.id]).length;

  if (filledCount === 0) {
    return "unanswered";
  }

  if (filledCount >= questionMeta.subQuestions.length) {
    return "answered";
  }

  return "partial";
};

const getElapsedSeconds = (record, currentTime = new Date()) => {
  if (record.status === "submitted") {
    return Math.max(0, Math.floor(record.consumedSeconds ?? 0));
  }

  const consumedSeconds = Math.max(0, Math.floor(record.consumedSeconds ?? 0));
  if (record.isPaused) {
    return consumedSeconds;
  }

  const elapsed = Math.floor((currentTime.getTime() - new Date(record.startedAt).getTime()) / 1000);
  return Math.max(0, consumedSeconds + elapsed);
};

const getAnsweredQuestionCount = (questions = [], answers = []) => {
  const answerMap = new Map((answers ?? []).map((item) => [item.questionId, item.answerJson]));
  return questions.filter((question) => getQuestionAnswerState(question, answerMap.get(question.id)) === "answered").length;
};

const serializeQuestion = (question, answer, revealAnswer) => {
  const questionMeta = getQuestionMeta(question);
  const answerState = getQuestionAnswerState(question, answer?.answerJson);

  if (isSubjectiveQuestion(question)) {
    const allocations = buildSubjectiveSubQuestionAllocations(question);
    const answerMap = parseSubjectiveAnswerMap(answer?.answerJson, question);
    const reviewJson = parseJsonSafely(answer?.reviewJson, null);
    const displayVoice = getQuestionDisplayVoice(question, reviewJson);
    const reviewSource = `${reviewJson?.source ?? "system"}`.trim() || "system";
    const reviewProvider = normalizeReviewProvider(reviewJson?.reviewProvider ?? reviewJson?.provider ?? "");

    return {
      id: question.id,
      sortOrder: question.sortOrder,
      type: question.type,
      typeLabel: questionTypeMeta[question.type]?.label ?? question.type,
      score: question.score,
      material: question.material ?? "",
      stem: question.stem,
      analysis: revealAnswer ? question.analysis ?? "" : "",
      options: [],
      userAnswerKeys: [],
      correctAnswerKeys: [],
      isCorrect: null,
      earnedScore: revealAnswer ? Number(answer?.score ?? 0) : 0,
      answerState,
      sectionLabel: questionMeta.sectionLabel,
      sectionDescription: questionMeta.sectionDescription,
      reviewSource,
      reviewProvider: reviewProvider || undefined,
      subjectiveSubQuestions: allocations.map((item) => {
        const text = answerMap[item.id] ?? "";
        const reviewItem = Array.isArray(reviewJson?.subQuestions)
          ? reviewJson.subQuestions.find((entry) => `${entry?.id ?? ""}` === item.id)
          : null;
        const subQuestionReviewProvider = normalizeReviewProvider(reviewItem?.reviewProvider ?? reviewProvider);
        const normalizedRubricPointList = normalizeRubricPoints(reviewItem?.rubricPoints ?? item.rubricPoints);
        const maxSubQuestionScore = Number(reviewItem?.maxScore ?? item.maxScore ?? 0);
        const rubricAwardedScore = normalizedRubricPointList.reduce(
          (sum, point) => sum + (Number.isFinite(Number(point.awardedScore)) ? Number(point.awardedScore) : 0),
          0,
        );
        const explicitReviewScore = Number(reviewItem?.score);
        const normalizedSubQuestionScore = Math.max(
          0,
          Math.min(
            maxSubQuestionScore,
            Number.isFinite(explicitReviewScore) ? explicitReviewScore : rubricAwardedScore,
          ),
        );

      return {
        id: item.id,
        title: item.title,
        placeholder: item.placeholder,
        answer: text,
        wordCount: text.length,
        score: normalizedSubQuestionScore,
        maxScore: Number(reviewItem?.maxScore ?? item.maxScore ?? 0),
        reviewComment: sanitizeReviewExposureText(normalizeDisplayText(`${reviewItem?.reviewComment ?? ""}`.trim())),
        referenceAnswer: sanitizeReviewExposureText(`${reviewItem?.referenceAnswer ?? item.referenceAnswer ?? ""}`.trim()),
        reviewSource: reviewItem?.reviewSource ?? reviewSource,
        reviewProvider: subQuestionReviewProvider || undefined,
        isReviewed: Boolean(reviewItem),
        abilityLabel: sanitizeReviewExposureText(`${reviewItem?.abilityLabel ?? item.title ?? `问题(${item.sortOrder ?? 1})`}`.trim()),
        abilityScoreRate:
          Number(item.maxScore ?? 0) > 0
            ? Number((((normalizedSubQuestionScore / Number(item.maxScore ?? 0)) || 0) * 100).toFixed(1))
            : 0,
        rubricGuidance: sanitizeReviewExposureText(`${reviewItem?.rubricGuidance ?? item.rubricGuidance ?? ""}`.trim()),
        rubricPoints: normalizedRubricPointList,
        missedPoints: normalizeMissedPoints(reviewItem?.missedPoints ?? []).map((point) => ({
          ...point,
          title: sanitizeReviewExposureText(point.title),
          description: sanitizeReviewExposureText(point.description),
        })),
        skippedReview: Boolean(reviewItem?.skippedReview),
        skippedReviewReason: `${reviewItem?.skippedReviewReason ?? ""}`.trim(),
        answerMarks: normalizeAnswerMarks(reviewItem?.answerMarks).map((mark) => ({
          ...mark,
          comment: sanitizeReviewExposureText(normalizeDisplayText(`${mark.comment ?? ""}`.trim())),
        })),
      };
    }),
      reviewFeedbackStars: Number(reviewJson?.feedbackStars ?? 0) || 0,
      reviewFeedbackSubmittedAt: reviewJson?.feedbackSubmittedAt ? formatDateTime(reviewJson.feedbackSubmittedAt) : "",
      lessonAudioUrl: getQuestionLessonAudioUrl(question),
      lessonAudioObjectKey: `${question.lessonAudioObjectKey ?? ""}`.trim(),
      lessonAudioDurationSeconds: Number(question.lessonAudioDurationSeconds ?? 0) || 0,
      reviewVoiceUrl: displayVoice.url,
      reviewVoiceObjectKey: displayVoice.objectKey,
      reviewVoiceDurationSeconds: displayVoice.durationSeconds,
    };
  }

  const userAnswerKeys = parseObjectiveAnswerJson(answer?.answerJson);

  return {
    id: question.id,
    sortOrder: question.sortOrder,
    type: question.type,
    typeLabel: questionTypeMeta[question.type]?.label ?? question.type,
    score: question.score,
    material: question.material ?? "",
    stem: question.stem,
    analysis: revealAnswer ? question.analysis ?? "" : "",
    options: (question.options ?? []).map((option) => ({
      id: option.id,
      key: option.optionKey,
      content: option.content,
    })),
    userAnswerKeys,
    correctAnswerKeys: revealAnswer ? parseObjectiveAnswerJson(question.correctAnswerJson) : [],
    isCorrect: revealAnswer ? answer?.isCorrect ?? false : null,
    earnedScore: revealAnswer ? Number(answer?.score ?? 0) : 0,
    answerState,
    sectionLabel: questionMeta.sectionLabel,
    sectionDescription: questionMeta.sectionDescription,
    subjectiveSubQuestions: [],
    reviewSource: "system",
    reviewFeedbackStars: 0,
    reviewFeedbackSubmittedAt: "",
    lessonAudioUrl: getQuestionLessonAudioUrl(question),
    lessonAudioObjectKey: `${question.lessonAudioObjectKey ?? ""}`.trim(),
    lessonAudioDurationSeconds: Number(question.lessonAudioDurationSeconds ?? 0) || 0,
    reviewVoiceUrl: "",
    reviewVoiceObjectKey: "",
    reviewVoiceDurationSeconds: 0,
  };
};

export const getRemainingSeconds = (record, currentTime = new Date()) =>
  Math.max(0, Math.floor(record.allottedSeconds ?? 0) - getElapsedSeconds(record, currentTime));

export const buildMockExamSections = (questions = []) =>
  Object.entries(questionTypeMeta)
    .map(([type, meta]) => {
      const matched = questions.filter((item) => item.type === type);
      return {
        type,
        label: meta.label,
        count: matched.length,
        totalScore: matched.reduce((sum, item) => sum + Number(item.score ?? 0), 0),
      };
    })
    .filter((item) => item.count > 0);

const getSubjectiveQuestionCount = (questions = []) => questions.filter((question) => isSubjectiveQuestionType(question.type)).length;

const isReviewEnabledForPaper = (paper) => {
  if (typeof paper?.reviewEnabled === "boolean") {
    return paper.reviewEnabled;
  }

  return getSubjectiveQuestionCount(paper?.questions ?? []) > 0;
};

const getMockExamRecordReviewWorkflowStatus = (record) => {
  const explicitStatus = `${record?.reviewWorkflowStatus ?? ""}`.trim();
  const paper = getRecordPaper(record);
  const requiresReview =
    getSubjectiveQuestionCount(paper?.questions ?? []) > 0 &&
    isReviewEnabledForPaper(paper);

  if (explicitStatus && explicitStatus !== "not_required") {
    return explicitStatus;
  }

  if (record?.status !== "submitted") {
    return "not_required";
  }

  if (!requiresReview) {
    return explicitStatus || "published";
  }

  if (record?.publishedAt) {
    return "published";
  }

  if (record?.aiReviewStartedAt && !record?.aiReviewFinishedAt) {
    return "ai_processing";
  }

  if (record?.reviewedAt) {
    return "manual_pending";
  }

  return "ai_pending";
};

const isManualReviewLockActive = (record, currentTime = new Date()) => {
  const expiresAt = record?.manualReviewLockExpiresAt ? new Date(record.manualReviewLockExpiresAt) : null;
  return Boolean(
    record?.manualReviewLockToken &&
      record?.manualReviewerId &&
      expiresAt &&
      Number.isFinite(expiresAt.getTime()) &&
      expiresAt.getTime() > currentTime.getTime(),
  );
};

const isManualReviewLockedByAdmin = (record, adminId, currentTime = new Date()) =>
  Boolean(adminId) && isManualReviewLockActive(record, currentTime) && `${record?.manualReviewerId ?? ""}`.trim() === `${adminId}`.trim();

const getManualReviewLockMeta = (record, adminId = "", currentTime = new Date()) => {
  const active = isManualReviewLockActive(record, currentTime);
  const ownedByCurrentAdmin = active && isManualReviewLockedByAdmin(record, adminId, currentTime);
  return {
    active,
    ownedByCurrentAdmin,
    reviewerId: active ? `${record?.manualReviewerId ?? ""}`.trim() : "",
    reviewerName: active ? getManualReviewerDisplayName(record?.manualReviewerName) : "",
    lockToken: ownedByCurrentAdmin ? `${record?.manualReviewLockToken ?? ""}`.trim() : "",
    claimedAt: active && record?.manualReviewClaimedAt ? formatDateTime(record.manualReviewClaimedAt) : "",
    expiresAt: active && record?.manualReviewLockExpiresAt ? formatDateTime(record.manualReviewLockExpiresAt) : "",
    version: Number(record?.manualReviewVersion ?? 0) || 0,
  };
};

const clearManualReviewLockData = () => ({
  manualReviewerId: null,
  manualReviewerName: null,
  manualReviewLockToken: null,
  manualReviewClaimedAt: null,
  manualReviewLockExpiresAt: null,
});

const isMockExamRecordPublishedToUser = (record) => {
  const workflowStatus = getMockExamRecordReviewWorkflowStatus(record);
  if (workflowStatus === "published") {
    return true;
  }

  const paper = getRecordPaper(record);
  return record?.status === "submitted" && !isReviewEnabledForPaper(paper);
};

const isMockExamRecordReviewPending = (record) =>
  record?.status === "submitted" &&
  getSubjectiveQuestionCount(getRecordPaper(record)?.questions ?? []) > 0 &&
  isReviewEnabledForPaper(getRecordPaper(record)) &&
  !isMockExamRecordPublishedToUser(record);

const getAdminMockExamReviewStatus = (record, adminId = "", currentTime = new Date()) => {
  const workflowStatus = getMockExamRecordReviewWorkflowStatus(record);
  if (workflowStatus === "published") return "published";
  if (workflowStatus === "manual_pending") return "manual_pending";
  if (isManualReviewLockedByAdmin(record, adminId, currentTime)) return "manual_reviewing";
  if (workflowStatus === "ai_processing") return "ai_processing";
  return "ai_pending";
};

const buildCurrentAdminActiveReviewLockWhere = (currentAdminId = "", currentTime = new Date()) => {
  const normalizedAdminId = `${currentAdminId ?? ""}`.trim();
  if (!normalizedAdminId) {
    return null;
  }

  return {
    manualReviewerId: normalizedAdminId,
    manualReviewLockToken: {
      not: null,
    },
    manualReviewLockExpiresAt: {
      gt: currentTime,
    },
  };
};

const buildAdminMockExamReviewStatusWhere = ({
  reviewStatus = "all",
  currentAdminId = "",
  currentTime = new Date(),
}) => {
  const activeCurrentAdminLockWhere = buildCurrentAdminActiveReviewLockWhere(currentAdminId, currentTime);

  if (reviewStatus === "manual_reviewing") {
    if (!activeCurrentAdminLockWhere) {
      return {
        id: "__never__",
      };
    }

    return {
      ...activeCurrentAdminLockWhere,
      NOT: {
        reviewWorkflowStatus: {
          in: ["manual_pending", "published"],
        },
      },
    };
  }

  if (reviewStatus === "manual_pending") {
    return {
      reviewWorkflowStatus: "manual_pending",
    };
  }

  if (reviewStatus === "published") {
    return {
      reviewWorkflowStatus: "published",
    };
  }

  if (reviewStatus === "ai_processing") {
    return {
      reviewWorkflowStatus: "ai_processing",
      ...(activeCurrentAdminLockWhere
        ? {
            NOT: activeCurrentAdminLockWhere,
          }
        : {}),
    };
  }

  if (reviewStatus === "ai_pending") {
    const excludedFilters = [
      {
        reviewWorkflowStatus: {
          in: ["ai_processing", "manual_pending", "published"],
        },
      },
    ];

    if (activeCurrentAdminLockWhere) {
      excludedFilters.push(activeCurrentAdminLockWhere);
    }

    return {
      NOT: excludedFilters,
    };
  }

  return {};
};

const serializeRecordSummary = (record, currentTime = new Date()) => {
  if (!record) return null;

  const remainingSeconds = getRemainingSeconds(record, currentTime);
  const consumedSeconds =
    record.status === "submitted"
      ? Math.max(0, Math.floor(record.consumedSeconds ?? 0))
      : Math.max(0, Math.floor(record.allottedSeconds ?? 0) - remainingSeconds);

  return {
    id: record.id,
    status: record.status,
    attemptNo: record.attemptNo,
    questionCount: record.questionCount,
    answeredCount: record.answeredCount,
    correctCount: record.correctCount,
    totalScore: record.totalScore,
    allottedSeconds: record.allottedSeconds,
    consumedSeconds,
    remainingSeconds,
    startedAt: formatDateTime(record.startedAt),
    submittedAt: record.submittedAt ? formatDateTime(record.submittedAt) : "",
    reviewedAt: record.reviewedAt ? formatDateTime(record.reviewedAt) : "",
    reviewWorkflowStatus: getMockExamRecordReviewWorkflowStatus(record),
    canResume: record.status === "in_progress" && remainingSeconds > 0,
  };
};

export const serializeMockExamPaperSummary = ({ paper, activeRecord = null, latestRecord = null, currentTime = new Date() }) => ({
  id: paper.id,
  code: paper.code,
  seriesId: paper.seriesId ?? "",
  seriesName: paper.series?.name ?? "",
  title: paper.title,
  subtitle: paper.subtitle ?? "",
  coverUrl: getMockExamPaperCoverUrl(paper, paper.paperType),
  coverObjectKey: paper.coverObjectKey ?? "",
  year: paper.year ?? 0,
  phase: paper.phase ?? "",
  durationMinutes: paper.durationMinutes,
  maxAttempts: Number(paper.maxAttempts ?? 0),
  reviewEnabled: isReviewEnabledForPaper(paper),
  permissionRequired: Boolean(paper.permissionRequired),
  totalScore: paper.totalScore,
  questionCount: paper.questionCount,
  passScore: paper.passScore,
  description: paper.description ?? "",
  sections: buildMockExamSections(paper.questions ?? []),
  activeRecord: serializeRecordSummary(activeRecord, currentTime),
  latestRecord: serializeRecordSummary(latestRecord, currentTime),
});

const createLeaderboardPaperPayload = (paper) => ({
  id: paper?.id ?? "",
  code: paper?.code ?? "",
  title: paper?.title ?? "",
  phase: paper?.phase ?? "",
  year: Number(paper?.year ?? 0),
  coverUrl: getMockExamPaperCoverUrl(paper, paper?.paperType),
  totalScore: Number(paper?.totalScore ?? 0),
  passScore: Number(paper?.passScore ?? 0),
  questionCount: Number(paper?.questionCount ?? 0),
  paperType:
    paper?.paperType ??
    (getSubjectiveQuestionCount(paper?.questions ?? []) > 0 ? "subjective" : "objective"),
});

const normalizeManualRankValue = (value) => {
  const parsed = Number.parseInt(`${value ?? ""}`.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const buildMockExamLeaderboardRows = (records = [], leaderboardEntries = [], currentUserId = "") => {
  const normalizedCurrentUserId = `${currentUserId ?? ""}`.trim();
  const bestByUser = new Map();

  records.forEach((record) => {
    const userId = `${record?.userId ?? record?.user?.id ?? ""}`.trim();
    if (!userId) {
      return;
    }

    const existing = bestByUser.get(userId);
    const nextScore = Number(record?.totalScore ?? 0);
    const nextSubmittedAt = record?.submittedAt ? new Date(record.submittedAt).getTime() : 0;
    const existingScore = existing ? Number(existing.totalScore ?? 0) : Number.NEGATIVE_INFINITY;
    const existingSubmittedAt = existing?.submittedAt ? new Date(existing.submittedAt).getTime() : Number.POSITIVE_INFINITY;

    if (
      !existing ||
      nextScore > existingScore ||
      (nextScore === existingScore && nextSubmittedAt < existingSubmittedAt)
    ) {
      bestByUser.set(userId, record);
    }
  });

  const manualRankMap = new Map(
    (Array.isArray(leaderboardEntries) ? leaderboardEntries : []).map((item) => [
      `${item?.userId ?? ""}`.trim(),
      normalizeManualRankValue(item?.manualRank),
    ]),
  );

  const rows = Array.from(bestByUser.values())
    .map((record) => {
      const userId = `${record?.userId ?? record?.user?.id ?? ""}`.trim();
      return {
        userId,
        userPhone: `${record?.user?.phone ?? ""}`.trim(),
        recordId: `${record?.id ?? ""}`.trim(),
        score: Number(record?.totalScore ?? 0),
        submittedAt: record?.submittedAt ? formatDateTime(record.submittedAt) : "",
        submittedAtMs: record?.submittedAt ? new Date(record.submittedAt).getTime() : Number.MAX_SAFE_INTEGER,
        publishedAt: record?.publishedAt ? formatDateTime(record.publishedAt) : "",
        attemptNo: Number(record?.attemptNo ?? 0),
        reviewStatus: isMockExamRecordPublishedToUser(record) ? "published" : getMockExamRecordReviewWorkflowStatus(record),
        manualRank: manualRankMap.get(userId) ?? null,
        isCurrentUser: Boolean(normalizedCurrentUserId) && userId === normalizedCurrentUserId,
      };
    })
    .sort((left, right) => {
      const leftManualRank = left.manualRank ?? Number.MAX_SAFE_INTEGER;
      const rightManualRank = right.manualRank ?? Number.MAX_SAFE_INTEGER;
      if (leftManualRank !== rightManualRank) {
        return leftManualRank - rightManualRank;
      }
      if (left.score !== right.score) {
        return right.score - left.score;
      }
      if (left.submittedAtMs !== right.submittedAtMs) {
        return left.submittedAtMs - right.submittedAtMs;
      }
      return left.userId.localeCompare(right.userId);
    })
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

  return rows;
};

export const serializeAdminMockExamPaperSummary = (paper) => {
  const sections = buildMockExamSections(paper.questions ?? []);
  const questionCount = Number(paper.questionCount ?? 0) || (paper.questions ?? []).length;
  const totalScore = Number(paper.totalScore ?? 0) || sections.reduce((sum, section) => sum + Number(section.totalScore ?? 0), 0);
  const paperType = paper.paperType ?? (sections.some((section) => section.type === subjectiveQuestionType) ? "subjective" : "objective");

  return {
    id: paper.id,
    code: paper.code,
    seriesId: paper.seriesId ?? "",
    seriesName: paper.series?.name ?? "",
    title: paper.title,
    subtitle: paper.subtitle ?? "",
    coverUrl: getMockExamPaperCoverUrl(paper, paperType),
    coverObjectKey: paper.coverObjectKey ?? "",
    year: Number(paper.year ?? 0),
    phase: paper.phase ?? "",
    paperType,
    status: paper.status,
    durationMinutes: Number(paper.durationMinutes ?? 0),
    maxAttempts: Number(paper.maxAttempts ?? 0),
    reviewEnabled: isReviewEnabledForPaper(paper),
    permissionRequired: Boolean(paper.permissionRequired),
    totalScore,
    questionCount,
    passScore: Number(paper.passScore ?? 0),
    sortOrder: Number(paper.sortOrder ?? 0),
    sections,
    canDelete: Number(paper._count?.records ?? 0) <= 0,
    updatedAt: formatDateTime(paper.updatedAt),
  };
};

export const listAdminMockExamPapers = async ({ db }) => {
  const papers = await db.mockExamPaper.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      series: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          records: true,
        },
      },
      questions: {
        where: {
          isActive: true,
        },
        select: {
          type: true,
          score: true,
        },
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  });

  const list = papers.map((paper) => serializeAdminMockExamPaperSummary(paper));

  return {
    list,
    summary: {
      total: list.length,
      published: list.filter((paper) => paper.status === "published").length,
      draft: list.filter((paper) => paper.status === "draft").length,
      objective: list.filter((paper) => paper.paperType === "objective").length,
      subjective: list.filter((paper) => paper.paperType === "subjective").length,
    },
  };
};

const adminPaperDefaultDurationMap = {
  objective: 90,
  subjective: 240,
};

const normalizeAdminText = (value) => `${value ?? ""}`.replace(/\r\n/g, "\n").trim();
const toNullableAdminText = (value) => {
  const normalized = normalizeAdminText(value);
  return normalized || null;
};

const toAdminPaperType = (value) => (`${value ?? ""}`.trim() === "subjective" ? "subjective" : "objective");
const toAdminPaperStatus = (value) => (`${value ?? ""}`.trim() === "published" ? "published" : "draft");

const parsePositiveIntOrNull = (value) => {
  const parsed = Number.parseInt(`${value ?? ""}`.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const parseNonNegativeIntOrNull = (value) => {
  const parsed = Number.parseInt(`${value ?? ""}`.trim(), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const getPaperTotalScore = (questions = []) => questions.reduce((sum, question) => sum + Number(question.score ?? 0), 0);
const inferAdminPaperTypeFromQuestions = (questions = []) =>
  questions.some((question) => isSubjectiveQuestionType(question.type)) ? "subjective" : "objective";

const getDefaultPassScore = (totalScore) => (totalScore > 0 ? Math.max(1, Math.round(totalScore * 0.6)) : 0);
const generateAdminPaperCode = () => `paper_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const buildForkedPaperCode = (code) => {
  const suffix = `v${Date.now().toString(36)}`;
  const normalizedCode = normalizeAdminText(code) || "paper";
  const maxBaseLength = Math.max(1, 64 - suffix.length - 1);
  return `${normalizedCode.slice(0, maxBaseLength)}_${suffix}`;
};
const buildForkedPaperTitle = (title) => `${normalizeAdminText(title) || "试卷"}（新版）`;

const ensurePaperTypeMatchesQuestions = (paperType, questions = []) => {
  if (paperType === "objective" && questions.some((question) => isSubjectiveQuestionType(question.type))) {
    throw createHttpError("客观题试卷不能加入主观题");
  }

  if (paperType === "subjective" && questions.some((question) => !isSubjectiveQuestionType(question.type))) {
    throw createHttpError("主观题试卷只能加入主观题");
  }
};

const ensurePaperCanPublish = ({ status, questionCount }) => {
  if (status === "published" && questionCount <= 0) {
    throw createHttpError("空白试卷不能发布，请先添加题目");
  }
};

const parseSeriesIdOrNull = (value) => {
  const normalized = normalizeAdminText(value);
  return normalized || null;
};

const syncSeriesPaperPermissions = async ({ tx, paperId, seriesId }) => {
  const normalizedPaperId = `${paperId ?? ""}`.trim();
  const normalizedSeriesId = `${seriesId ?? ""}`.trim();

  if (!normalizedPaperId || !normalizedSeriesId) {
    return;
  }

  const seriesPermissionRows = await tx.userMockExamSeriesPermission.findMany({
    where: {
      seriesId: normalizedSeriesId,
    },
    select: {
      userId: true,
    },
  });

  if (seriesPermissionRows.length <= 0) {
    return;
  }

  await tx.userMockExamPermission.createMany({
    data: seriesPermissionRows.map((item) => ({
      userId: item.userId,
      paperId: normalizedPaperId,
      manualAttemptLimit: null,
      manualAttemptUsed: 0,
      currentRecordStartedAt: null,
    })),
    skipDuplicates: true,
  });
};

const cleanupDetachedSeriesPaperPermissions = async ({ tx, paperId, nextSeriesId }) => {
  const normalizedPaperId = `${paperId ?? ""}`.trim();
  if (!normalizedPaperId) {
    return;
  }

  const permissionRows = await tx.userMockExamPermission.findMany({
    where: {
      paperId: normalizedPaperId,
    },
    select: {
      userId: true,
    },
  });

  if (permissionRows.length <= 0) {
    return;
  }

  const userIds = permissionRows.map((item) => item.userId);
  const normalizedNextSeriesId = `${nextSeriesId ?? ""}`.trim();
  const nextSeriesPermissionRows = normalizedNextSeriesId
    ? await tx.userMockExamSeriesPermission.findMany({
        where: {
          userId: {
            in: userIds,
          },
          seriesId: normalizedNextSeriesId,
        },
        select: {
          userId: true,
        },
      })
    : [];

  const protectedUserIds = new Set(nextSeriesPermissionRows.map((item) => item.userId));
  const removableUserIds = userIds.filter((userId) => !protectedUserIds.has(userId));

  if (removableUserIds.length <= 0) {
    return;
  }

  await tx.userMockExamPermission.deleteMany({
    where: {
      paperId: normalizedPaperId,
      userId: {
        in: removableUserIds,
      },
    },
  });
};

const buildAdminPaperCreateData = ({ payload, maxSortOrder = 0 }) => {
  const title = normalizeAdminText(payload?.title);
  if (!title) {
    throw createHttpError("试卷标题不能为空");
  }

  const paperType = toAdminPaperType(payload?.paperType);
  const status = toAdminPaperStatus(payload?.status);
  ensurePaperCanPublish({ status, questionCount: 0 });

  return {
    seriesId: parseSeriesIdOrNull(payload?.seriesId),
    code: normalizeAdminText(payload?.code) || generateAdminPaperCode(),
    title,
    subtitle: toNullableAdminText(payload?.subtitle),
    coverUrl: toNullableAdminText(payload?.coverUrl),
    coverObjectKey: toNullableAdminText(payload?.coverObjectKey),
    paperType,
    year: parsePositiveIntOrNull(payload?.year),
    phase: toNullableAdminText(payload?.phase) ?? (paperType === "subjective" ? "主观题" : "客观题"),
    durationMinutes: parsePositiveIntOrNull(payload?.durationMinutes) ?? adminPaperDefaultDurationMap[paperType],
    maxAttempts: parseNonNegativeIntOrNull(payload?.maxAttempts) ?? 0,
    reviewEnabled: payload?.reviewEnabled === undefined ? paperType === "subjective" : `${payload?.reviewEnabled}` !== "false",
    permissionRequired: `${payload?.permissionRequired ?? ""}` === "true",
    totalScore: 0,
    questionCount: 0,
    passScore: 0,
    description: toNullableAdminText(payload?.description),
    status,
    sortOrder: parsePositiveIntOrNull(payload?.sortOrder) ?? maxSortOrder + 1,
  };
};

const buildAdminPaperUpdateData = ({ payload, paper }) => {
  const questions = paper.questions ?? [];
  const questionCount = questions.length;
  const totalScore = getPaperTotalScore(questions);
  const paperType = payload?.paperType === undefined ? paper.paperType ?? inferAdminPaperTypeFromQuestions(questions) : toAdminPaperType(payload?.paperType);
  ensurePaperTypeMatchesQuestions(paperType, questions);

  const title = payload?.title === undefined ? normalizeAdminText(paper.title) : normalizeAdminText(payload?.title);
  if (!title) {
    throw createHttpError("试卷标题不能为空");
  }

  const status = payload?.status === undefined ? paper.status : toAdminPaperStatus(payload?.status);
  ensurePaperCanPublish({ status, questionCount });

  const passScoreInput = payload?.passScore === undefined ? Number(paper.passScore ?? 0) : parseNonNegativeIntOrNull(payload?.passScore) ?? 0;
  let passScore = passScoreInput;

  if (totalScore <= 0) {
    passScore = 0;
  } else if (passScore <= 0) {
    passScore = getDefaultPassScore(totalScore);
  } else if (passScore > totalScore) {
    if (payload?.passScore !== undefined) {
      throw createHttpError("及格线不能高于试卷总分");
    }

    passScore = getDefaultPassScore(totalScore);
  }

  return {
    seriesId: payload?.seriesId === undefined ? paper.seriesId ?? null : parseSeriesIdOrNull(payload?.seriesId),
    code: payload?.code === undefined ? paper.code : normalizeAdminText(payload?.code) || paper.code,
    title,
    subtitle: payload?.subtitle === undefined ? paper.subtitle ?? null : toNullableAdminText(payload?.subtitle),
    coverUrl: payload?.coverUrl === undefined ? paper.coverUrl ?? null : toNullableAdminText(payload?.coverUrl),
    coverObjectKey: payload?.coverObjectKey === undefined ? paper.coverObjectKey ?? null : toNullableAdminText(payload?.coverObjectKey),
    paperType,
    year: payload?.year === undefined ? paper.year ?? null : parsePositiveIntOrNull(payload?.year),
    phase: payload?.phase === undefined ? paper.phase ?? null : toNullableAdminText(payload?.phase),
    durationMinutes:
      payload?.durationMinutes === undefined
        ? Number(paper.durationMinutes ?? 0) || adminPaperDefaultDurationMap[paperType]
        : parsePositiveIntOrNull(payload?.durationMinutes) ?? adminPaperDefaultDurationMap[paperType],
    maxAttempts: payload?.maxAttempts === undefined ? Number(paper.maxAttempts ?? 0) : parseNonNegativeIntOrNull(payload?.maxAttempts) ?? 0,
    reviewEnabled:
      payload?.reviewEnabled === undefined
        ? Boolean(paper.reviewEnabled ?? isReviewEnabledForPaper({ ...paper, questions }))
        : `${payload?.reviewEnabled}` !== "false",
    permissionRequired:
      payload?.permissionRequired === undefined ? Boolean(paper.permissionRequired) : `${payload?.permissionRequired}` === "true",
    totalScore,
    questionCount,
    passScore,
    description: payload?.description === undefined ? paper.description ?? null : toNullableAdminText(payload?.description),
    status,
    sortOrder: payload?.sortOrder === undefined ? Number(paper.sortOrder ?? 0) : parsePositiveIntOrNull(payload?.sortOrder) ?? Number(paper.sortOrder ?? 0),
  };
};

const serializeAdminMockExamPaperQuestion = (question) => {
  const questionMeta = getQuestionMeta(question);

  return {
    id: question.id,
    sourceBankItemId: question.sourceBankItemId ?? "",
    sourceFolderName: question.sourceBankItem?.folder?.name ?? "",
    sortOrder: Number(question.sortOrder ?? 0),
    questionType: question.type,
    questionTypeLabel: questionTypeMeta[question.type]?.label ?? question.type,
    score: Number(question.score ?? 0),
    stem: question.stem,
    material: question.material ?? "",
    analysis: question.analysis ?? "",
    correctAnswerKeys: isSubjectiveQuestion(question) ? [] : parseObjectiveAnswerJson(question.correctAnswerJson),
    options: (question.options ?? []).map((option) => ({
      id: option.id,
      key: option.optionKey,
      content: option.content,
    })),
    sectionLabel: questionMeta.sectionLabel,
    sectionDescription: questionMeta.sectionDescription,
    subjectiveSubQuestions: questionMeta.subQuestions.map((item) => ({
      id: item.id,
      title: item.title,
      placeholder: item.placeholder,
      abilityLabel: item.abilityLabel,
      referenceAnswer: item.referenceAnswer,
      rubricGuidance: item.rubricGuidance,
      rubricPoints: item.rubricPoints,
      sortOrder: item.sortOrder,
    })),
    updatedAt: formatDateTime(question.updatedAt),
  };
};

export const serializeAdminMockExamPaperDetail = (paper) => ({
  ...serializeAdminMockExamPaperSummary(paper),
  description: paper.description ?? "",
  createdAt: formatDateTime(paper.createdAt),
  questions: (paper.questions ?? []).map(serializeAdminMockExamPaperQuestion),
});

const getAdminPaperWithQuestions = async (db, paperId) => {
  const paper = await db.mockExamPaper.findUnique({
    where: { id: paperId },
    include: {
      series: {
        select: {
          id: true,
          name: true,
        },
      },
      questions: {
        where: {
          isActive: true,
        },
        orderBy: { sortOrder: "asc" },
        include: {
          options: {
            orderBy: { sortOrder: "asc" },
          },
          sourceBankItem: {
            select: {
              folder: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!paper) {
    throw createHttpError("试卷不存在", 404);
  }

  return paper;
};

const syncAdminPaperDerivedFields = async ({ tx, paperId, paperTypeFallback = null }) => {
  const paper = await tx.mockExamPaper.findUnique({
    where: { id: paperId },
    select: {
      id: true,
      status: true,
      passScore: true,
      paperType: true,
      questions: {
        where: {
          isActive: true,
        },
        select: {
          type: true,
          score: true,
        },
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  });

  if (!paper) {
    throw createHttpError("试卷不存在", 404);
  }

  const questionCount = paper.questions.length;
  const totalScore = getPaperTotalScore(paper.questions);
  const nextPaperType = paper.paperType ?? paperTypeFallback ?? inferAdminPaperTypeFromQuestions(paper.questions);
  const currentPassScore = Number(paper.passScore ?? 0);
  const nextPassScore =
    totalScore <= 0 ? 0 : currentPassScore > 0 && currentPassScore <= totalScore ? currentPassScore : getDefaultPassScore(totalScore);
  const nextStatus = questionCount === 0 && paper.status === "published" ? "draft" : paper.status;

  await tx.mockExamPaper.update({
    where: { id: paperId },
    data: {
      paperType: nextPaperType,
      totalScore,
      questionCount,
      passScore: nextPassScore,
      status: nextStatus,
    },
  });
};

const snapshotExistingRecordsForPaper = async ({ tx, paperId }) => {
  const pendingSnapshotCount = await tx.mockExamRecord.count({
    where: {
      paperId,
      paperSnapshotJson: null,
    },
  });

  if (pendingSnapshotCount <= 0) {
    return 0;
  }

  const paper = await tx.mockExamPaper.findUnique({
    where: { id: paperId },
    include: {
      questions: {
        where: {
          isActive: true,
        },
        orderBy: {
          sortOrder: "asc",
        },
        include: {
          options: {
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
      },
    },
  });

  if (!paper) {
    throw createHttpError("试卷不存在", 404);
  }

  const snapshotJson = buildRecordPaperSnapshot({
    ...paper,
    totalScore: getPaperTotalScore(paper.questions ?? []),
    questionCount: (paper.questions ?? []).length,
  });

  const result = await tx.mockExamRecord.updateMany({
    where: {
      paperId,
      paperSnapshotJson: null,
    },
    data: {
      paperSnapshotJson: snapshotJson,
    },
  });

  return Number(result?.count ?? 0);
};

const ensurePaperQuestionsEditable = async ({ tx, paperId }) => {
  const recordCount = await tx.mockExamRecord.count({
    where: {
      paperId,
    },
  });

  if (recordCount > 0) {
    throw createHttpError("该试卷已有考试记录，不能再修改题目结构，请新建一套试卷");
  }
};

const cloneAdminMockExamPaperForEditing = async ({ tx, paperId }) => {
  const sourcePaper = await tx.mockExamPaper.findUnique({
    where: { id: paperId },
    include: {
      questions: {
        orderBy: {
          sortOrder: "asc",
        },
        include: {
          options: {
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
      },
    },
  });

  if (!sourcePaper) {
    throw createHttpError("试卷不存在", 404);
  }

  const maxSortPaper = await tx.mockExamPaper.findFirst({
    orderBy: {
      sortOrder: "desc",
    },
    select: {
      sortOrder: true,
    },
  });

  const clonedPaper = await tx.mockExamPaper.create({
    data: {
      code: buildForkedPaperCode(sourcePaper.code),
      title: buildForkedPaperTitle(sourcePaper.title),
      subtitle: sourcePaper.subtitle ?? null,
      coverUrl: sourcePaper.coverUrl ?? null,
      coverObjectKey: sourcePaper.coverObjectKey ?? null,
      paperType: sourcePaper.paperType ?? inferAdminPaperTypeFromQuestions(sourcePaper.questions),
      year: sourcePaper.year ?? null,
      phase: sourcePaper.phase ?? null,
      durationMinutes: Number(sourcePaper.durationMinutes ?? 0),
      maxAttempts: Number(sourcePaper.maxAttempts ?? 0),
      reviewEnabled: Boolean(sourcePaper.reviewEnabled ?? isReviewEnabledForPaper(sourcePaper)),
      permissionRequired: Boolean(sourcePaper.permissionRequired),
      totalScore: Number(sourcePaper.totalScore ?? 0),
      questionCount: Number(sourcePaper.questionCount ?? 0),
      passScore: Number(sourcePaper.passScore ?? 0),
      description: sourcePaper.description ?? null,
      status: "draft",
      sortOrder: Number(maxSortPaper?.sortOrder ?? 0) + 1,
    },
    select: {
      id: true,
      title: true,
    },
  });

  const questionIdMap = new Map();

  for (const question of sourcePaper.questions) {
    const createdQuestion = await tx.mockExamQuestion.create({
      data: {
        paperId: clonedPaper.id,
        sourceBankItemId: question.sourceBankItemId ?? null,
        type: question.type,
        stem: question.stem,
        material: question.material ?? null,
        analysis: question.analysis ?? null,
        lessonAudioUrl: question.lessonAudioUrl ?? null,
        lessonAudioObjectKey: question.lessonAudioObjectKey ?? null,
        lessonAudioDurationSeconds: Number(question.lessonAudioDurationSeconds ?? 0) || 0,
        score: Number(question.score ?? 0),
        sortOrder: Number(question.sortOrder ?? 0),
        correctAnswerJson: question.correctAnswerJson,
        questionMetaJson: question.questionMetaJson,
        options: {
          create: (question.options ?? []).map((option) => ({
            optionKey: option.optionKey,
            content: option.content,
            sortOrder: Number(option.sortOrder ?? 0),
          })),
        },
      },
      select: {
        id: true,
      },
    });

    questionIdMap.set(question.id, createdQuestion.id);
  }

  return {
    paperId: clonedPaper.id,
    paperTitle: clonedPaper.title,
    forkedFromPaperId: sourcePaper.id,
    forkedFromTitle: sourcePaper.title,
    questionIdMap,
  };
};

const getEditableAdminPaperTarget = async ({ tx, paperId }) => {
  const recordCount = await tx.mockExamRecord.count({
    where: {
      paperId,
    },
  });

  if (recordCount <= 0) {
    return {
      paperId,
      paperTitle: "",
      forkedFromPaperId: null,
      forkedFromTitle: "",
      questionIdMap: new Map(),
    };
  }

  return cloneAdminMockExamPaperForEditing({
    tx,
    paperId,
  });
};

export const getAdminMockExamPaperDetail = async ({ db, paperId }) => serializeAdminMockExamPaperDetail(await getAdminPaperWithQuestions(db, paperId));

export const createAdminMockExamPaper = async ({ db, payload }) => {
  const maxSortPaper = await db.mockExamPaper.findFirst({
    orderBy: {
      sortOrder: "desc",
    },
    select: {
      sortOrder: true,
    },
  });

  try {
    const created = await db.$transaction(async (tx) => {
      const createdPaper = await tx.mockExamPaper.create({
        data: buildAdminPaperCreateData({
          payload,
          maxSortOrder: Number(maxSortPaper?.sortOrder ?? 0),
        }),
        include: {
          series: {
            select: {
              id: true,
              name: true,
            },
          },
          questions: {
            include: {
              options: {
                orderBy: { sortOrder: "asc" },
              },
              sourceBankItem: {
                select: {
                  folder: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      await syncSeriesPaperPermissions({
        tx,
        paperId: createdPaper.id,
        seriesId: createdPaper.seriesId,
      });

      return createdPaper;
    });

    return serializeAdminMockExamPaperDetail(created);
  } catch (error) {
    if (isUniqueConstraintError(error, "code")) {
      throw createHttpError("试卷编号已存在，请修改后重试");
    }

    throw error;
  }
};

export const updateAdminMockExamPaper = async ({ db, paperId, payload }) => {
  await db.$transaction(async (tx) => {
    const paper = await tx.mockExamPaper.findUnique({
      where: { id: paperId },
      include: {
        series: {
          select: {
            id: true,
          },
        },
        questions: {
          where: {
            isActive: true,
          },
          select: {
            type: true,
            score: true,
          },
        },
      },
    });

    if (!paper) {
      throw createHttpError("试卷不存在", 404);
    }

    await snapshotExistingRecordsForPaper({
      tx,
      paperId,
    });

    try {
      const previousSeriesId = paper.seriesId ?? null;
      const updatedPaper = await tx.mockExamPaper.update({
        where: { id: paperId },
        data: buildAdminPaperUpdateData({
          payload,
          paper,
        }),
        select: {
          id: true,
          seriesId: true,
        },
      });

      if ((previousSeriesId ?? "") !== (updatedPaper.seriesId ?? "")) {
        await cleanupDetachedSeriesPaperPermissions({
          tx,
          paperId: updatedPaper.id,
          nextSeriesId: updatedPaper.seriesId,
        });
      }

      await syncSeriesPaperPermissions({
        tx,
        paperId: updatedPaper.id,
        seriesId: updatedPaper.seriesId,
      });
    } catch (error) {
      if (isUniqueConstraintError(error, "code")) {
        throw createHttpError("试卷编号已存在，请修改后重试");
      }

      throw error;
    }
  });

  return getAdminMockExamPaperDetail({
    db,
    paperId,
  });


};

export const deleteAdminMockExamPaper = async ({ db, paperId }) => {
  const paper = await db.mockExamPaper.findUnique({
    where: { id: paperId },
    select: {
      id: true,
      title: true,
    },
  });

  if (!paper) {
    throw createHttpError("试卷不存在", 404);
  }

  await db.mockExamPaper.delete({
    where: { id: paperId },
  });

  return {
    success: true,
    paperId: paper.id,
    title: paper.title,
  };
};

export const addAdminMockExamPaperQuestionsFromBank = async ({ db, paperId, itemIds }) => {
  const normalizedItemIds = Array.from(new Set((Array.isArray(itemIds) ? itemIds : []).map((item) => `${item ?? ""}`.trim()).filter(Boolean)));
  if (normalizedItemIds.length === 0) {
    throw createHttpError("请至少选择一道题目");
  }

  await db.$transaction(async (tx) => {
    await snapshotExistingRecordsForPaper({
      tx,
      paperId,
    });

    const paper = await tx.mockExamPaper.findUnique({
      where: { id: paperId },
      include: {
        questions: {
          where: {
            isActive: true,
          },
          select: {
            id: true,
            type: true,
            sortOrder: true,
          },
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });

    if (!paper) {
      throw createHttpError("试卷不存在", 404);
    }

    const selectedItems = await tx.questionBankItem.findMany({
      where: {
        id: {
          in: normalizedItemIds,
        },
      },
      include: {
        options: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });

    if (selectedItems.length !== normalizedItemIds.length) {
      throw createHttpError("部分题目不存在或已被删除");
    }

    const orderedItems = normalizedItemIds
      .map((id) => selectedItems.find((item) => item.id === id))
      .filter(Boolean);

    const incomingPaperType = inferAdminPaperTypeFromQuestions(orderedItems);
    ensurePaperTypeMatchesQuestions(incomingPaperType, orderedItems);

    const targetPaperType = paper.paperType ?? (paper.questions.length > 0 ? inferAdminPaperTypeFromQuestions(paper.questions) : incomingPaperType);
    ensurePaperTypeMatchesQuestions(targetPaperType, orderedItems);

    let sortOrderCursor = Math.max(0, ...paper.questions.map((question) => Number(question.sortOrder ?? 0)));

    for (const item of orderedItems) {
      sortOrderCursor += 1;
      await tx.mockExamQuestion.create({
        data: {
          paperId,
          sourceBankItemId: item.id,
          type: item.type,
          stem: item.stem,
          material: item.material ?? null,
          analysis: item.analysis ?? null,
          lessonAudioUrl: item.lessonAudioUrl ?? null,
          lessonAudioObjectKey: item.lessonAudioObjectKey ?? null,
          lessonAudioDurationSeconds: Number(item.lessonAudioDurationSeconds ?? 0) || 0,
          score: Number(item.score ?? 0),
          sortOrder: sortOrderCursor,
          correctAnswerJson: item.correctAnswerJson,
          questionMetaJson: item.questionMetaJson,
          options: {
            create: (item.options ?? []).map((option) => ({
              optionKey: option.optionKey,
              content: option.content,
              sortOrder: Number(option.sortOrder ?? 0),
            })),
          },
        },
      });
    }

    await syncAdminPaperDerivedFields({
      tx,
      paperId,
      paperTypeFallback: targetPaperType,
    });
  });

  return getAdminMockExamPaperDetail({
    db,
    paperId,
  });


};

export const removeAdminMockExamPaperQuestion = async ({ db, paperId, questionId }) => {
  await db.$transaction(async (tx) => {
    await snapshotExistingRecordsForPaper({
      tx,
      paperId,
    });

    const paper = await tx.mockExamPaper.findUnique({
      where: { id: paperId },
      select: {
        id: true,
      },
    });

    if (!paper) {
      throw createHttpError("试卷不存在", 404);
    }

    const question = await tx.mockExamQuestion.findUnique({
      where: { id: questionId },
      select: {
        id: true,
        paperId: true,
        isActive: true,
      },
    });

    if (!question || question.paperId !== paperId || !question.isActive) {
      throw createHttpError("试卷题目不存在", 404);
    }

    await tx.mockExamQuestion.update({
      where: { id: questionId },
      data: {
        isActive: false,
      },
    });

    const remainingQuestions = await tx.mockExamQuestion.findMany({
      where: {
        paperId,
        isActive: true,
      },
      select: {
        id: true,
      },
      orderBy: {
        sortOrder: "asc",
      },
    });

    await Promise.all(
      remainingQuestions.map((item, index) =>
        tx.mockExamQuestion.update({
          where: { id: item.id },
          data: {
            sortOrder: index + 1,
          },
        }),
      ),
    );

    await syncAdminPaperDerivedFields({
      tx,
      paperId,
    });
  });

  return getAdminMockExamPaperDetail({
    db,
    paperId,
  });


};

export const serializeMockExamRecordDetail = (record, currentTime = new Date()) => {
  const paper = getRecordPaper(record);
  const isPublishedToUser = isMockExamRecordPublishedToUser(record);
  const revealAnswer = record.status === "submitted" && isPublishedToUser;
  const answerMap = new Map((record.answers ?? []).map((item) => [item.questionId, item]));
  const remainingSeconds = getRemainingSeconds(record, currentTime);
  const consumedSeconds =
    record.status === "submitted"
      ? Math.max(0, Math.floor(record.consumedSeconds ?? 0))
      : Math.max(0, Math.floor(record.allottedSeconds ?? 0) - remainingSeconds);

  const serializedQuestions = (paper.questions ?? []).map((question) =>
    serializeQuestion(question, answerMap.get(question.id), revealAnswer),
  );
  const subjectiveQuestionCount = serializedQuestions.filter((question) => isSubjectiveQuestionType(question.type)).length;
  const objectiveQuestionCount = serializedQuestions.length - subjectiveQuestionCount;
  const answeredCount = serializedQuestions.filter((question) => question.answerState === "answered").length;
  const objectiveAnsweredCount = serializedQuestions.filter(
    (question) => !isSubjectiveQuestionType(question.type) && question.userAnswerKeys.length > 0,
  ).length;
  const finalScorePending =
    record.status === "submitted" &&
    getSubjectiveQuestionCount(getRecordPaper(record)?.questions ?? []) > 0 &&
    isReviewEnabledForPaper(getRecordPaper(record)) &&
    !isPublishedToUser;

  return {
    id: record.id,
    status: record.status,
    attemptNo: record.attemptNo,
    questionCount: record.questionCount,
    answeredCount,
    correctCount: record.correctCount,
    totalScore: record.totalScore,
    allottedSeconds: record.allottedSeconds,
    consumedSeconds,
    remainingSeconds,
    startedAt: formatDateTime(record.startedAt),
    submittedAt: record.submittedAt ? formatDateTime(record.submittedAt) : "",
    reviewedAt: record.reviewedAt ? formatDateTime(record.reviewedAt) : "",
    publishedAt: record.publishedAt ? formatDateTime(record.publishedAt) : "",
    reviewWorkflowStatus: getMockExamRecordReviewWorkflowStatus(record),
    paper: {
      id: paper.id,
      code: paper.code,
      title: paper.title,
      subtitle: paper.subtitle ?? "",
      year: paper.year ?? 0,
      phase: paper.phase ?? "",
      durationMinutes: paper.durationMinutes,
      maxAttempts: Number(paper.maxAttempts ?? 0),
      reviewEnabled: isReviewEnabledForPaper(paper),
      totalScore: paper.totalScore,
      questionCount: paper.questionCount,
      passScore: paper.passScore,
      description: paper.description ?? "",
      sections: buildMockExamSections(paper.questions ?? []),
    },
    summary: {
      accuracyRate: objectiveQuestionCount > 0 ? Number(((record.correctCount / objectiveQuestionCount) * 100).toFixed(1)) : 0,
      wrongCount: Math.max(0, objectiveAnsweredCount - record.correctCount),
      unfinishedCount: Math.max(0, record.questionCount - answeredCount),
      pendingReviewCount: finalScorePending ? subjectiveQuestionCount : 0,
      finalScorePending,
      isPassed: finalScorePending ? null : record.totalScore >= paper.passScore,
    },
    questions: serializedQuestions,
    reviewEnabled: isReviewEnabledForPaper(paper),
  };
};

const getRecordWithPaper = (db, recordId) =>
  db.mockExamRecord.findUnique({
    where: { id: recordId },
    include: {
      paper: {
        include: {
          questions: {
            where: {
              isActive: true,
            },
            orderBy: { sortOrder: "asc" },
            include: {
              options: {
                orderBy: { sortOrder: "asc" },
              },
              sourceBankItem: {
                select: {
                  lessonAudioUrl: true,
                  lessonAudioObjectKey: true,
                  lessonAudioDurationSeconds: true,
                },
              },
            },
          },
        },
      },
      answers: true,
    },
  });

const assertMockExamPaperPermission = async ({ db, userId, paperId }) => {
  const paper = await db.mockExamPaper.findUnique({
    where: {
      id: paperId,
    },
    select: {
      id: true,
      seriesId: true,
      permissionRequired: true,
    },
  });

  if (!paper) {
    throw createHttpError("试卷不存在", 404);
  }

  if (!paper.permissionRequired) {
    return null;
  }

  const permission = await db.userMockExamPermission.findUnique({
    where: {
      userId_paperId: {
        userId,
        paperId,
      },
    },
    select: {
      paperId: true,
      manualAttemptLimit: true,
      manualAttemptUsed: true,
      currentRecordStartedAt: true,
    },
  });

  const seriesPermission = paper.seriesId
    ? await db.userMockExamSeriesPermission.findUnique({
        where: {
          userId_seriesId: {
            userId,
            seriesId: paper.seriesId,
          },
        },
        select: {
          seriesId: true,
        },
      })
    : null;

  if (!permission && !seriesPermission) {
    throw createHttpError("你暂未开通这张试卷", 403);
  }

  return permission;
};

const getReviewRecordWithPaper = (db, recordId) =>
  db.mockExamRecord.findUnique({
    where: { id: recordId },
    include: {
      user: {
        select: {
          id: true,
          phone: true,
        },
      },
      paper: {
        include: {
          questions: {
            where: {
              isActive: true,
            },
            orderBy: { sortOrder: "asc" },
            include: {
              options: {
                orderBy: { sortOrder: "asc" },
              },
              sourceBankItem: {
                select: {
                  lessonAudioUrl: true,
                  lessonAudioObjectKey: true,
                  lessonAudioDurationSeconds: true,
                },
              },
            },
          },
        },
      },
      answers: true,
    },
  });

const getInitialReviewWorkflowStatusForPaper = (paper) => {
  const subjectiveQuestionCount = getSubjectiveQuestionCount(paper?.questions ?? []);
  if (subjectiveQuestionCount <= 0) {
    return "not_required";
  }

  if (!isReviewEnabledForPaper(paper)) {
    return "published";
  }

  return "ai_pending";
};

const getBoundedConsumedSeconds = (record, currentTime = new Date()) =>
  Math.min(Math.max(0, getElapsedSeconds(record, currentTime)), Math.max(0, Math.floor(record.allottedSeconds ?? 0)));

const resumeMockExamRecordIfNeeded = async ({ db, record, currentTime = new Date() }) => {
  if (!record || record.status !== "in_progress" || !record.isPaused) {
    return record;
  }

  await db.mockExamRecord.update({
    where: { id: record.id },
    data: {
      isPaused: false,
      startedAt: currentTime,
    },
  });

  return getRecordWithPaper(db, record.id);
};

export const serializeMockExamReviewSummary = (record, options = {}) => {
  const currentTime = options.currentTime instanceof Date ? options.currentTime : new Date();
  const currentAdminId = `${options.currentAdminId ?? ""}`.trim();
  const manualReviewLock = getManualReviewLockMeta(record, currentAdminId, currentTime);

  return {
    id: record.id,
    attemptNo: record.attemptNo,
    totalScore: Number(record.totalScore ?? 0),
    questionCount: record.questionCount,
    subjectiveQuestionCount: getSubjectiveQuestionCount(getRecordPaper(record)?.questions ?? []),
    submittedAt: record.submittedAt ? formatDateTime(record.submittedAt) : "",
    reviewedAt: record.reviewedAt ? formatDateTime(record.reviewedAt) : "",
    publishedAt: record.publishedAt ? formatDateTime(record.publishedAt) : "",
    reviewStatus: getAdminMockExamReviewStatus(record, currentAdminId, currentTime),
    manualReviewLock,
    user: {
      id: record.user?.id ?? "",
      phone: record.user?.phone ?? "",
    },
    paper: {
      id: getRecordPaper(record)?.id ?? "",
      code: getRecordPaper(record)?.code ?? "",
      title: getRecordPaper(record)?.title ?? "",
      coverUrl: getMockExamPaperCoverUrl(getRecordPaper(record), getRecordPaper(record)?.paperType),
      coverObjectKey: getRecordPaper(record)?.coverObjectKey ?? "",
      phase: getRecordPaper(record)?.phase ?? "",
      year: Number(getRecordPaper(record)?.year ?? 0),
      totalScore: Number(getRecordPaper(record)?.totalScore ?? 0),
      passScore: Number(getRecordPaper(record)?.passScore ?? 0),
    },
  };
};

export const serializeUserMockExamHistoryItem = (record) => ({
  id: record.id,
  status: record.status,
  attemptNo: record.attemptNo,
  totalScore: Number(record.totalScore ?? 0),
  questionCount: Number(record.questionCount ?? 0),
  subjectiveQuestionCount: getSubjectiveQuestionCount(getRecordPaper(record)?.questions ?? []),
  reviewStatus: isMockExamRecordPublishedToUser(record) ? "published" : getMockExamRecordReviewWorkflowStatus(record),
  reviewEnabled: isReviewEnabledForPaper(getRecordPaper(record)),
  submittedAt: record.submittedAt ? formatDateTime(record.submittedAt) : "",
  reviewedAt: record.reviewedAt ? formatDateTime(record.reviewedAt) : "",
  publishedAt: record.publishedAt ? formatDateTime(record.publishedAt) : "",
  paper: {
    id: getRecordPaper(record)?.id ?? "",
    code: getRecordPaper(record)?.code ?? "",
    title: getRecordPaper(record)?.title ?? "",
    coverUrl: getMockExamPaperCoverUrl(getRecordPaper(record), getRecordPaper(record)?.paperType),
    coverObjectKey: getRecordPaper(record)?.coverObjectKey ?? "",
    phase: getRecordPaper(record)?.phase ?? "",
    year: Number(getRecordPaper(record)?.year ?? 0),
    totalScore: Number(getRecordPaper(record)?.totalScore ?? 0),
    passScore: Number(getRecordPaper(record)?.passScore ?? 0),
  },
});

export const listUserVisibleMockExamRecords = async ({ db, userId }) => {
  const records = await db.mockExamRecord.findMany({
    where: {
      userId,
      status: "submitted",
    },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    include: {
      paper: {
        include: {
          questions: {
            where: {
              isActive: true,
            },
            select: {
              type: true,
              score: true,
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });

  return records
    .filter(
      (record) =>
        getSubjectiveQuestionCount(getRecordPaper(record)?.questions ?? []) > 0 &&
        isMockExamRecordPublishedToUser(record),
    )
    .map((record) => serializeUserMockExamHistoryItem(record));
};

export const listUserVisibleMockExamLeaderboardPapers = async ({ db, userId }) => {
  const normalizedUserId = `${userId ?? ""}`.trim();
  if (!normalizedUserId) {
    return [];
  }

  const records = await db.mockExamRecord.findMany({
    where: {
      userId: normalizedUserId,
      status: "submitted",
    },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    include: {
      paper: {
        include: {
          questions: {
            where: {
              isActive: true,
            },
            select: {
              type: true,
              score: true,
            },
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
      },
    },
  });

  const paperMap = new Map();
  records.forEach((record) => {
    if (!isMockExamRecordPublishedToUser(record)) {
      return;
    }
    const paper = getRecordPaper(record);
    if (!paper?.id || paperMap.has(paper.id)) {
      return;
    }
    paperMap.set(paper.id, createLeaderboardPaperPayload(paper));
  });

  return Array.from(paperMap.values()).sort((left, right) => {
    if ((left.year ?? 0) !== (right.year ?? 0)) {
      return Number(right.year ?? 0) - Number(left.year ?? 0);
    }
    return `${left.title ?? ""}`.localeCompare(`${right.title ?? ""}`, "zh-CN");
  });
};

export const getUserMockExamLeaderboardDetail = async ({ db, userId, paperId }) => {
  const normalizedUserId = `${userId ?? ""}`.trim();
  const normalizedPaperId = `${paperId ?? ""}`.trim();
  if (!normalizedUserId || !normalizedPaperId) {
    throw createHttpError("缺少排行榜参数", 400);
  }

  const paper = await db.mockExamPaper.findUnique({
    where: {
      id: normalizedPaperId,
    },
    include: {
      questions: {
        where: {
          isActive: true,
        },
        select: {
          type: true,
          score: true,
        },
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  });

  if (!paper) {
    throw createHttpError("试卷不存在", 404);
  }

  const currentUserRecords = await db.mockExamRecord.findMany({
    where: {
      paperId: normalizedPaperId,
      userId: normalizedUserId,
      status: "submitted",
    },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    include: {
      paper: {
        include: {
          questions: {
            where: {
              isActive: true,
            },
            select: {
              type: true,
              score: true,
            },
          },
        },
      },
    },
  });

  const records = await db.mockExamRecord.findMany({
    where: {
      paperId: normalizedPaperId,
      status: "submitted",
      publishedAt: {
        not: null,
      },
    },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    include: {
      user: {
        select: {
          id: true,
          phone: true,
        },
      },
      paper: {
        include: {
          questions: {
            where: {
              isActive: true,
            },
            select: {
              type: true,
              score: true,
            },
          },
        },
      },
    },
  });

  const hasParticipated = currentUserRecords.length > 0;
  if (!hasParticipated) {
    throw createHttpError("你还没有参加过该试卷，暂时无法进入排行榜", 403);
  }

  const leaderboardEntries = await db.mockExamLeaderboardEntry.findMany({
    where: {
      paperId: normalizedPaperId,
    },
    select: {
      userId: true,
      manualRank: true,
    },
  });

  const leaderboard = buildMockExamLeaderboardRows(records, leaderboardEntries, normalizedUserId);
  const currentUserEntry =
    leaderboard.find((item) => item.userId === normalizedUserId) ??
    (() => {
      const bestCurrentUserRecord = currentUserRecords.reduce((best, record) => {
        if (!best) return record;
        const bestScore = Number(best?.totalScore ?? 0);
        const nextScore = Number(record?.totalScore ?? 0);
        if (nextScore > bestScore) return record;
        if (nextScore < bestScore) return best;
        const bestSubmittedAt = best?.submittedAt ? new Date(best.submittedAt).getTime() : Number.MAX_SAFE_INTEGER;
        const nextSubmittedAt = record?.submittedAt ? new Date(record.submittedAt).getTime() : Number.MAX_SAFE_INTEGER;
        return nextSubmittedAt < bestSubmittedAt ? record : best;
      }, null);

      if (!bestCurrentUserRecord) {
        return null;
      }

      return {
        rank: null,
        score: Number(bestCurrentUserRecord.totalScore ?? 0),
      };
    })();

  return {
    paper: createLeaderboardPaperPayload(paper),
    currentUserBestScore: currentUserEntry ? Number(currentUserEntry.score ?? 0) : null,
    currentUserBestRank: currentUserEntry && Number.isFinite(Number(currentUserEntry.rank)) ? Number(currentUserEntry.rank ?? 0) : null,
    totalParticipants: leaderboard.length,
    leaderboard: leaderboard.map((item) => ({
      rank: item.rank,
      manualRank: item.manualRank,
      userId: item.userId,
      userPhone: item.userPhone,
      score: item.score,
      submittedAt: item.submittedAt,
      attemptNo: item.attemptNo,
      isCurrentUser: item.isCurrentUser,
    })),
  };
};

export const getAdminMockExamPaperScoreDetail = async ({ db, paperId }) => {
  const normalizedPaperId = `${paperId ?? ""}`.trim();
  if (!normalizedPaperId) {
    throw createHttpError("缺少试卷参数", 400);
  }

  const paper = await db.mockExamPaper.findUnique({
    where: {
      id: normalizedPaperId,
    },
    include: {
      questions: {
        where: {
          isActive: true,
        },
        select: {
          type: true,
          score: true,
        },
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  });

  if (!paper) {
    throw createHttpError("试卷不存在", 404);
  }

  const [records, leaderboardEntries] = await Promise.all([
    db.mockExamRecord.findMany({
      where: {
        paperId: normalizedPaperId,
        status: "submitted",
      },
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      include: {
        user: {
          select: {
            id: true,
            phone: true,
          },
        },
        paper: {
          include: {
            questions: {
              where: {
                isActive: true,
              },
              select: {
                type: true,
                score: true,
              },
            },
          },
        },
      },
    }),
    db.mockExamLeaderboardEntry.findMany({
      where: {
        paperId: normalizedPaperId,
      },
      select: {
        userId: true,
        manualRank: true,
      },
    }),
  ]);

  const leaderboard = buildMockExamLeaderboardRows(
    records.filter((record) => isMockExamRecordPublishedToUser(record)),
    leaderboardEntries,
  );
  const leaderboardRankMap = new Map(leaderboard.map((item) => [item.userId, item.rank]));
  const manualRankMap = new Map(leaderboardEntries.map((item) => [`${item.userId ?? ""}`.trim(), normalizeManualRankValue(item.manualRank)]));
  const sortedItems = records
    .map((record) => ({
      userId: `${record?.userId ?? record?.user?.id ?? ""}`.trim(),
      userPhone: `${record?.user?.phone ?? ""}`.trim(),
      recordId: `${record?.id ?? ""}`.trim(),
      totalScore: Number(record?.totalScore ?? 0),
      submittedAt: record?.submittedAt ? formatDateTime(record.submittedAt) : "",
      publishedAt: record?.publishedAt ? formatDateTime(record.publishedAt) : "",
      attemptNo: Number(record?.attemptNo ?? 0),
      reviewStatus: isMockExamRecordPublishedToUser(record) ? "published" : getMockExamRecordReviewWorkflowStatus(record),
      manualRank: manualRankMap.get(`${record?.userId ?? ""}`.trim()) ?? null,
      displayRank: leaderboardRankMap.get(`${record?.userId ?? ""}`.trim()) ?? 0,
      submittedAtMs: record?.submittedAt ? new Date(record.submittedAt).getTime() : Number.MAX_SAFE_INTEGER,
    }))
    .sort((left, right) => {
      const leftRank = left.displayRank || Number.MAX_SAFE_INTEGER;
      const rightRank = right.displayRank || Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      if (left.totalScore !== right.totalScore) {
        return right.totalScore - left.totalScore;
      }
      return left.submittedAtMs - right.submittedAtMs;
    })
    .map(({ submittedAtMs, ...item }) => item);

  const scoreList = records.map((record) => Number(record?.totalScore ?? 0));
  const participantCount = records.length;
  const publishedCount = records.filter((record) => isMockExamRecordPublishedToUser(record)).length;
  const averageScore =
    participantCount > 0 ? Number((scoreList.reduce((sum, score) => sum + score, 0) / participantCount).toFixed(1)) : 0;

  return {
    paper: createLeaderboardPaperPayload(paper),
    stats: {
      participantCount,
      publishedCount,
      highestScore: participantCount > 0 ? Math.max(...scoreList) : 0,
      lowestScore: participantCount > 0 ? Math.min(...scoreList) : 0,
      averageScore,
    },
    items: sortedItems,
  };
};

export const updateAdminMockExamLeaderboardRanks = async ({ db, paperId, items = [] }) => {
  const normalizedPaperId = `${paperId ?? ""}`.trim();
  if (!normalizedPaperId) {
    throw createHttpError("缺少试卷参数", 400);
  }

  const normalizedItems = (Array.isArray(items) ? items : [])
    .map((item) => ({
      userId: `${item?.userId ?? ""}`.trim(),
      manualRank: item?.manualRank === null || `${item?.manualRank ?? ""}`.trim?.() === "" ? null : normalizeManualRankValue(item?.manualRank),
    }))
    .filter((item) => item.userId);

  const duplicateRankSet = new Set();
  normalizedItems.forEach((item) => {
    if (item.manualRank !== null) {
      if (duplicateRankSet.has(item.manualRank)) {
        throw createHttpError("手动排名不能重复", 400);
      }
      duplicateRankSet.add(item.manualRank);
    }
  });

  await db.$transaction(async (tx) => {
    for (const item of normalizedItems) {
      if (item.manualRank === null) {
        await tx.mockExamLeaderboardEntry.deleteMany({
          where: {
            paperId: normalizedPaperId,
            userId: item.userId,
          },
        });
        continue;
      }

      await tx.mockExamLeaderboardEntry.upsert({
        where: {
          paperId_userId: {
            paperId: normalizedPaperId,
            userId: item.userId,
          },
        },
        update: {
          manualRank: item.manualRank,
        },
        create: {
          paperId: normalizedPaperId,
          userId: item.userId,
          manualRank: item.manualRank,
        },
      });
    }
  });

  return getAdminMockExamPaperScoreDetail({
    db,
    paperId: normalizedPaperId,
  });
};

export const serializeMockExamReviewDetail = (record, currentTime = new Date(), options = {}) => {
  const detail = serializeMockExamRecordDetail(record, currentTime);
  const subjectiveQuestions = detail.questions.filter((question) => question.type === subjectiveQuestionType);
  const subjectiveScore = subjectiveQuestions.reduce((sum, question) => sum + Number(question.earnedScore ?? 0), 0);
  const reviewSources = subjectiveQuestions.map((question) => question.reviewSource).filter(Boolean);
  const reviewProviders = subjectiveQuestions.map((question) => question.reviewProvider).filter(Boolean);
  const reviewSource = reviewSources.includes("manual") ? "manual" : reviewSources.includes("rule") ? "rule" : reviewSources.includes("ai") ? "ai" : "system";
  const reviewProvider =
    reviewProviders.includes("openai-compatible") ? "openai-compatible" : reviewProviders.includes("rules") ? "rules" : undefined;
  const currentAdminId = `${options.currentAdminId ?? ""}`.trim();
  const manualReviewLock = getManualReviewLockMeta(record, currentAdminId, currentTime);

  return {
    ...detail,
    reviewStatus: getAdminMockExamReviewStatus(record, currentAdminId, currentTime),
    manualReviewLock,
    user: {
      id: record.user?.id ?? "",
      phone: record.user?.phone ?? "",
    },
    scoring: {
      objectiveScore: Number(detail.totalScore ?? 0) - subjectiveScore,
      subjectiveScore,
      subjectiveQuestionCount: subjectiveQuestions.length,
    },
    reviewSource,
    reviewProvider,
  };
};

export const finalizeMockExamRecord = async ({ db, recordId, userId, currentTime = new Date() }) =>
  db.$transaction(async (tx) => {
    const record = await getRecordWithPaper(tx, recordId);
    if (!record || record.userId !== userId) {
      throw createHttpError("考试记录不存在", 404);
    }

    if (record.status === "submitted") {
      return record;
    }

    const answerMap = new Map((record.answers ?? []).map((item) => [item.questionId, item]));
    const paper = getRecordPaper(record);
    let answeredCount = 0;
    let correctCount = 0;
    let totalScore = 0;

    for (const question of paper.questions ?? []) {
      const currentAnswer = answerMap.get(question.id);
      const answerState = getQuestionAnswerState(question, currentAnswer?.answerJson);

      if (answerState === "answered") {
        answeredCount += 1;
      }

      if (isSubjectiveQuestion(question)) {
        if (currentAnswer) {
          totalScore += Number(currentAnswer.score ?? 0);
          await tx.mockExamAnswer.update({
            where: { id: currentAnswer.id },
            data: {
              isCorrect: null,
            },
          });
        }
        continue;
      }

      const userAnswerKeys = parseObjectiveAnswerJson(currentAnswer?.answerJson);
      const correctAnswerKeys = parseObjectiveAnswerJson(question.correctAnswerJson);
      const isCorrect = userAnswerKeys.length > 0 && isSameAnswer(userAnswerKeys, correctAnswerKeys);
      const score = isCorrect ? Number(question.score ?? 0) : 0;

      if (isCorrect) {
        correctCount += 1;
        totalScore += score;
      }

      if (currentAnswer) {
        await tx.mockExamAnswer.update({
          where: { id: currentAnswer.id },
          data: {
            isCorrect,
            score,
          },
        });
      }
    }

    await tx.mockExamRecord.update({
      where: { id: record.id },
      data: {
        activeKey: null,
        status: "submitted",
        reviewWorkflowStatus: getInitialReviewWorkflowStatusForPaper(paper),
        isPaused: false,
        answeredCount,
        correctCount,
        totalScore,
        consumedSeconds: getBoundedConsumedSeconds(record, currentTime),
        submittedAt: currentTime,
        publishedAt: getInitialReviewWorkflowStatusForPaper(paper) === "published" ? currentTime : null,
      },
    });

    await tx.userMockExamPermission.updateMany({
      where: {
        userId,
        paperId: record.paperId,
      },
      data: {
        currentRecordStartedAt: null,
      },
    });

    return getRecordWithPaper(tx, record.id);
  });

export const syncExpiredMockExamRecords = async ({ db, userId, currentTime = new Date() }) => {
  const activeRecords = await db.mockExamRecord.findMany({
    where: {
      userId,
      status: "in_progress",
    },
  });

  for (const record of activeRecords) {
    if (getRemainingSeconds(record, currentTime) <= 0) {
      await finalizeMockExamRecord({
        db,
        recordId: record.id,
        userId,
        currentTime,
      });
    }
  }
};

export const getMockExamRecordForUser = async ({ db, recordId, userId, currentTime = new Date() }) => {
  let record = await getRecordWithPaper(db, recordId);

  if (!record || record.userId !== userId) {
    throw createHttpError("考试记录不存在", 404);
  }

  await assertMockExamPaperPermission({
    db,
    userId,
    paperId: record.paperId,
  });

  if (`${record.reviewWorkflowStatus ?? ""}`.trim() === "ai_processing") {
    await recoverStaleAiProcessingMockExamReviews({
      db,
      recordId: record.id,
      currentTime,
    });
    record = await getRecordWithPaper(db, recordId);
  }

  if (record.status === "in_progress" && getRemainingSeconds(record, currentTime) <= 0) {
    record = await finalizeMockExamRecord({ db, recordId, userId, currentTime });
  }

  if (record.status === "in_progress" && record.isPaused) {
    record = await resumeMockExamRecordIfNeeded({ db, record, currentTime });
  }

  return record;
};

export const pauseMockExamRecord = async ({ db, recordId, userId, currentTime = new Date() }) => {
  let record = await getRecordWithPaper(db, recordId);

  if (!record || record.userId !== userId) {
    throw createHttpError("è€ƒè¯•è®°å½•ä¸å­˜åœ¨", 404);
  }

  if (record.status !== "in_progress") {
    return record;
  }

  if (getRemainingSeconds(record, currentTime) <= 0) {
    return finalizeMockExamRecord({ db, recordId, userId, currentTime });
  }

  if (record.isPaused) {
    return record;
  }

  await db.mockExamRecord.update({
    where: { id: record.id },
    data: {
      isPaused: true,
      consumedSeconds: getBoundedConsumedSeconds(record, currentTime),
      startedAt: currentTime,
    },
  });

  record = await getRecordWithPaper(db, record.id);
  return record;
};

export const startMockExamRecord = async ({ db, paperId, userId, currentTime = new Date() }) => {
  await syncExpiredMockExamRecords({ db, userId, currentTime });
  const permission = await assertMockExamPaperPermission({
    db,
    userId,
    paperId,
  });

  const paper = await db.mockExamPaper.findFirst({
    where: {
      id: paperId,
      status: "published",
    },
    include: {
      questions: {
        where: {
          isActive: true,
        },
        orderBy: {
          sortOrder: "asc",
        },
        include: {
          options: {
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
      },
    },
  });

  if (!paper) {
    throw createHttpError("试卷不存在", 404);
  }

  const activeKey = buildMockExamActiveKey(paperId, userId);
  let existingRecord = await db.mockExamRecord.findFirst({
    where: {
      paperId,
      userId,
      status: "in_progress",
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  if (existingRecord) {
    if (!existingRecord.activeKey) {
      try {
        await db.mockExamRecord.update({
          where: { id: existingRecord.id },
          data: {
            activeKey,
          },
        });
      } catch (error) {
        if (!isUniqueConstraintError(error, "activeKey")) {
          throw error;
        }

        existingRecord = await db.mockExamRecord.findFirst({
          where: {
            activeKey,
          },
          orderBy: {
            updatedAt: "desc",
          },
        });
      }
    }

    if (existingRecord) {
      return getMockExamRecordForUser({
        db,
        recordId: existingRecord.id,
        userId,
        currentTime,
      });
    }
  }

  const attemptCount = await db.mockExamRecord.count({
    where: {
      paperId,
      userId,
    },
  });

  const permissionAttemptLimit = Number(permission?.manualAttemptLimit ?? 0);
  const permissionAttemptUsed = Number(permission?.manualAttemptUsed ?? 0);
  const maxAttempts = permissionAttemptLimit > 0 ? permissionAttemptLimit : Number(paper.maxAttempts ?? 0);
  const effectiveAttemptCount = permissionAttemptLimit > 0 ? permissionAttemptUsed : attemptCount;

  if (maxAttempts > 0 && effectiveAttemptCount >= maxAttempts) {
    throw createHttpError("该试卷已达到最大考试次数，不能再次进入", 403);
  }

  try {
    const created = await db.mockExamRecord.create({
      data: {
        paperId,
        userId,
        activeKey,
        attemptNo: attemptCount + 1,
        paperSnapshotJson: buildRecordPaperSnapshot({
          ...paper,
          totalScore: getPaperTotalScore(paper.questions ?? []),
          questionCount: (paper.questions ?? []).length,
        }),
        questionCount: (paper.questions ?? []).length,
        allottedSeconds: paper.durationMinutes * 60,
        startedAt: currentTime,
        isPaused: false,
      },
    });

    if (permission) {
      await db.userMockExamPermission.update({
        where: {
          userId_paperId: {
            userId,
            paperId,
          },
        },
        data: {
          manualAttemptUsed: permissionAttemptLimit > 0 ? effectiveAttemptCount + 1 : 0,
          currentRecordStartedAt: currentTime,
        },
      });
    }

    return getMockExamRecordForUser({
      db,
      recordId: created.id,
      userId,
      currentTime,
    });
  } catch (error) {
    if (!isUniqueConstraintError(error, "activeKey")) {
      throw error;
    }

    const activeRecord = await db.mockExamRecord.findFirst({
      where: {
        activeKey,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    if (!activeRecord) {
      throw error;
    }

    return getMockExamRecordForUser({
      db,
      recordId: activeRecord.id,
      userId,
      currentTime,
    });
  }
};

export const saveMockExamAnswer = async ({
  db,
  recordId,
  userId,
  questionId,
  answerKeys,
  answerText,
  subQuestionId,
  currentTime = new Date(),
}) => {
  const currentRecord = await getMockExamRecordForUser({ db, recordId, userId, currentTime });

  if (currentRecord.status !== "in_progress") {
    throw createHttpError("本次考试已交卷，不能继续作答", 409);
  }

  return db.$transaction(async (tx) => {
    const record = await getRecordWithPaper(tx, recordId);

    if (!record || record.userId !== userId) {
      throw createHttpError("考试记录不存在", 404);
    }

    const paper = getRecordPaper(record);
    const question = (paper.questions ?? []).find((item) => item.id === questionId);
    if (!question) {
      throw createHttpError("题目不存在", 404);
    }

    const existingAnswer = (record.answers ?? []).find((item) => item.questionId === questionId);

    if (isSubjectiveQuestion(question)) {
      const questionMeta = getQuestionMeta(question);
      const targetSubQuestionId = `${subQuestionId ?? questionMeta.subQuestions[0]?.id ?? ""}`.trim();

      if (!targetSubQuestionId) {
        throw createHttpError("缺少主观题小问参数", 400);
      }

      if (!questionMeta.subQuestions.some((item) => item.id === targetSubQuestionId)) {
        throw createHttpError("主观题小问不存在", 404);
      }

      const nextAnswerMap = parseSubjectiveAnswerMap(existingAnswer?.answerJson, question);
      const nextText = normalizePlainText(answerText);

      if (nextText) {
        nextAnswerMap[targetSubQuestionId] = nextText;
      } else {
        delete nextAnswerMap[targetSubQuestionId];
      }

      const hasAnyAnswer = Object.values(nextAnswerMap).some(Boolean);

      if (!hasAnyAnswer) {
        if (existingAnswer) {
          await tx.mockExamAnswer.delete({
            where: { id: existingAnswer.id },
          });
        }
      } else if (existingAnswer) {
        await tx.mockExamAnswer.update({
          where: { id: existingAnswer.id },
          data: {
            answerJson: JSON.stringify(nextAnswerMap),
            isCorrect: null,
            score: Number(existingAnswer.score ?? 0),
          },
        });
      } else {
        await tx.mockExamAnswer.create({
          data: {
            recordId,
            questionId,
            answerJson: JSON.stringify(nextAnswerMap),
          },
        });
      }
    } else {
      const nextAnswerKeys = normalizeAnswerKeys(answerKeys);
      const validOptionKeys = new Set((question.options ?? []).map((item) => item.optionKey));

      if (questionTypeMeta[question.type]?.maxSelections === 1 && nextAnswerKeys.length > 1) {
        throw createHttpError("单选题只能选择一个答案", 400);
      }

      if (nextAnswerKeys.some((item) => !validOptionKeys.has(item))) {
        throw createHttpError("答案选项不合法", 400);
      }

      if (nextAnswerKeys.length === 0) {
        if (existingAnswer) {
          await tx.mockExamAnswer.delete({
            where: { id: existingAnswer.id },
          });
        }
      } else if (existingAnswer) {
        await tx.mockExamAnswer.update({
          where: { id: existingAnswer.id },
          data: {
            answerJson: JSON.stringify(nextAnswerKeys),
            isCorrect: null,
            score: 0,
          },
        });
      } else {
        await tx.mockExamAnswer.create({
          data: {
            recordId,
            questionId,
            answerJson: JSON.stringify(nextAnswerKeys),
          },
        });
      }
    }

    const refreshedRecord = await getRecordWithPaper(tx, record.id);
    const answeredCount = getAnsweredQuestionCount(getRecordPaper(refreshedRecord)?.questions ?? [], refreshedRecord.answers ?? []);

    await tx.mockExamRecord.update({
      where: { id: record.id },
      data: {
        answeredCount,
      },
    });

    return getRecordWithPaper(tx, record.id);
  });
};

export const listMockExamReviewRecords = async ({
  db,
  keyword = "",
  reviewStatus = "ai_pending",
  paperId = "",
  currentAdminId = "",
  page = 1,
  pageSize = 20,
  currentTime = new Date(),
}) => {
  await recoverStaleAiProcessingMockExamReviews({
    db,
    paperId,
    currentTime,
  });

  const normalizedKeyword = `${keyword ?? ""}`.trim();
  const normalizedPaperId = `${paperId ?? ""}`.trim();
  const baseWhere = {
    status: "submitted",
    ...(normalizedPaperId ? { paperId: normalizedPaperId } : {}),
      AND: [
        {
          OR: [
            {
              paperSnapshotJson: {
              contains: `"type":"${subjectiveQuestionType}"`,
            },
            },
            {
              paper: {
                paperType: "subjective",
              },
            },
            {
              paper: {
                questions: {
                  some: {
                    type: subjectiveQuestionType,
                  },
                },
              },
            },
          ],
      },
      {
        OR: [
          {
            paperSnapshotJson: {
              contains: '"reviewEnabled":true',
            },
          },
          {
            paper: {
              is: {
                reviewEnabled: true,
              },
            },
          },
        ],
      },
      ...(normalizedKeyword
        ? [
            {
              OR: [
                {
                  paper: {
                    title: {
                      contains: normalizedKeyword,
                    },
                  },
                },
                {
                  paper: {
                    phase: {
                      contains: normalizedKeyword,
                    },
                  },
                },
                {
                  user: {
                    phone: {
                      contains: normalizedKeyword,
                    },
                  },
                },
              ],
            },
          ]
        : []),
    ],
  };
  const aiPendingWhere = buildAdminMockExamReviewStatusWhere({
    reviewStatus: "ai_pending",
    currentAdminId,
    currentTime,
  });
  const aiProcessingWhere = buildAdminMockExamReviewStatusWhere({
    reviewStatus: "ai_processing",
    currentAdminId,
    currentTime,
  });
  const manualReviewingWhere = buildAdminMockExamReviewStatusWhere({
    reviewStatus: "manual_reviewing",
    currentAdminId,
    currentTime,
  });
  const manualPendingWhere = buildAdminMockExamReviewStatusWhere({
    reviewStatus: "manual_pending",
    currentAdminId,
    currentTime,
  });
  const publishedWhere = buildAdminMockExamReviewStatusWhere({
    reviewStatus: "published",
    currentAdminId,
    currentTime,
  });
  const normalizedReviewWhere = buildAdminMockExamReviewStatusWhere({
    reviewStatus,
    currentAdminId,
    currentTime,
  });
  const where = {
    ...baseWhere,
    ...normalizedReviewWhere,
  };

  const [total, aiPendingCount, aiProcessingCount, manualReviewingCount, manualPendingCount, publishedCount, records] = await Promise.all([
    db.mockExamRecord.count({ where }),
    db.mockExamRecord.count({ where: { ...baseWhere, ...aiPendingWhere } }),
    db.mockExamRecord.count({ where: { ...baseWhere, ...aiProcessingWhere } }),
    db.mockExamRecord.count({ where: { ...baseWhere, ...manualReviewingWhere } }),
    db.mockExamRecord.count({ where: { ...baseWhere, ...manualPendingWhere } }),
    db.mockExamRecord.count({ where: { ...baseWhere, ...publishedWhere } }),
    db.mockExamRecord.findMany({
      where,
      orderBy:
        reviewStatus === "published"
          ? [{ publishedAt: "desc" }, { reviewedAt: "desc" }, { submittedAt: "desc" }]
          : reviewStatus === "manual_pending"
            ? [{ reviewedAt: "desc" }, { submittedAt: "desc" }]
            : reviewStatus === "ai_processing"
              ? [{ aiReviewStartedAt: "desc" }, { submittedAt: "desc" }]
              : [{ submittedAt: "desc" }],
      skip: Math.max(0, page - 1) * pageSize,
      take: pageSize,
      include: {
        user: {
          select: {
            id: true,
            phone: true,
          },
        },
        paper: {
          select: {
            id: true,
            code: true,
            title: true,
            coverUrl: true,
            coverObjectKey: true,
            phase: true,
            year: true,
            totalScore: true,
            passScore: true,
            questions: {
              select: {
                id: true,
                type: true,
                score: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    list: records.map((record) =>
      serializeMockExamReviewSummary(record, {
        currentAdminId,
      }),
    ),
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
    },
    summary: {
      total: aiPendingCount + aiProcessingCount + manualReviewingCount + manualPendingCount + publishedCount,
      aiPending: aiPendingCount,
      aiProcessing: aiProcessingCount,
      manualReviewing: manualReviewingCount,
      manualPending: manualPendingCount,
      published: publishedCount,
    },
  };
};

export const listMockExamReviewPaperSummaries = async ({ db, keyword = "", currentAdminId = "", currentTime = new Date() }) => {
  await recoverStaleAiProcessingMockExamReviews({
    db,
    currentTime,
  });

  const normalizedKeyword = `${keyword ?? ""}`.trim();
  const papers = await db.mockExamPaper.findMany({
    where: {
      paperType: "subjective",
      reviewEnabled: true,
      ...(normalizedKeyword
        ? {
            OR: [
              { title: { contains: normalizedKeyword } },
              { phase: { contains: normalizedKeyword } },
              { code: { contains: normalizedKeyword } },
            ],
          }
        : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      questions: {
        where: {
          isActive: true,
        },
        select: {
          id: true,
          type: true,
          score: true,
        },
      },
    },
  });

  const list = await Promise.all(
    papers.map(async (paper) => {
      const baseWhere = {
        paperId: paper.id,
        status: "submitted",
      };
      const aiPendingWhere = buildAdminMockExamReviewStatusWhere({
        reviewStatus: "ai_pending",
        currentAdminId,
        currentTime,
      });
      const aiProcessingWhere = buildAdminMockExamReviewStatusWhere({
        reviewStatus: "ai_processing",
        currentAdminId,
        currentTime,
      });
      const manualReviewingWhere = buildAdminMockExamReviewStatusWhere({
        reviewStatus: "manual_reviewing",
        currentAdminId,
        currentTime,
      });
      const manualPendingWhere = buildAdminMockExamReviewStatusWhere({
        reviewStatus: "manual_pending",
        currentAdminId,
        currentTime,
      });
      const publishedWhere = buildAdminMockExamReviewStatusWhere({
        reviewStatus: "published",
        currentAdminId,
        currentTime,
      });

      const [total, aiPending, aiProcessing, manualReviewing, manualPending, published] = await Promise.all([
        db.mockExamRecord.count({ where: baseWhere }),
        db.mockExamRecord.count({ where: { ...baseWhere, ...aiPendingWhere } }),
        db.mockExamRecord.count({ where: { ...baseWhere, ...aiProcessingWhere } }),
        db.mockExamRecord.count({ where: { ...baseWhere, ...manualReviewingWhere } }),
        db.mockExamRecord.count({ where: { ...baseWhere, ...manualPendingWhere } }),
        db.mockExamRecord.count({ where: { ...baseWhere, ...publishedWhere } }),
      ]);

      return {
        ...serializeAdminMockExamPaperSummary(paper),
        reviewSummary: {
          total,
          aiPending,
          aiProcessing,
          manualReviewing,
          manualPending,
          published,
        },
      };
    }),
  );

  return {
    list,
    summary: {
      totalPapers: list.length,
      totalRecords: list.reduce((sum, item) => sum + Number(item.reviewSummary?.total ?? 0), 0),
      aiPending: list.reduce((sum, item) => sum + Number(item.reviewSummary?.aiPending ?? 0), 0),
      aiProcessing: list.reduce((sum, item) => sum + Number(item.reviewSummary?.aiProcessing ?? 0), 0),
      manualReviewing: list.reduce((sum, item) => sum + Number(item.reviewSummary?.manualReviewing ?? 0), 0),
      manualPending: list.reduce((sum, item) => sum + Number(item.reviewSummary?.manualPending ?? 0), 0),
      published: list.reduce((sum, item) => sum + Number(item.reviewSummary?.published ?? 0), 0),
    },
  };
};

export const getMockExamReviewRecord = async ({ db, recordId, currentTime = new Date() }) => {
  await recoverStaleAiProcessingMockExamReviews({
    db,
    recordId,
    currentTime,
  });

  const record = await getReviewRecordWithPaper(db, recordId);
  if (!record) {
    throw createHttpError("考试记录不存在", 404);
  }

  if (record.status !== "submitted") {
    throw createHttpError("该考试记录尚未交卷", 409);
  }

  if (getSubjectiveQuestionCount(getRecordPaper(record)?.questions ?? []) === 0) {
    throw createHttpError("该考试记录不需要主观题批改", 400);
  }

  if (!isReviewEnabledForPaper(getRecordPaper(record))) {
    throw createHttpError("该试卷未开启人工批改", 400);
  }

  return record;
};

const assertReviewRecordCanBeManuallyHandled = (record) => {
  if (record.status !== "submitted") {
    throw createHttpError("该考试记录尚未交卷", 409);
  }

  if (getSubjectiveQuestionCount(getRecordPaper(record)?.questions ?? []) === 0) {
    throw createHttpError("该考试记录不需要主观题批改", 400);
  }

  if (!isReviewEnabledForPaper(getRecordPaper(record))) {
    throw createHttpError("该试卷未开启人工批改", 400);
  }
};

const assertManualReviewAccess = ({ record, adminId, lockToken, version, currentTime = new Date() }) => {
  assertReviewRecordCanBeManuallyHandled(record);

  if (!isManualReviewLockedByAdmin(record, adminId, currentTime)) {
    const lockMeta = getManualReviewLockMeta(record, adminId, currentTime);
    if (lockMeta.active && !lockMeta.ownedByCurrentAdmin) {
      throw createHttpError(`该试卷正在由${getManualReviewerDisplayName(lockMeta.reviewerName)}批改，请稍后再试`, 409);
    }
    throw createHttpError("请先领取这份试卷后再进行批改", 409);
  }

  if (`${record?.manualReviewLockToken ?? ""}`.trim() !== `${lockToken ?? ""}`.trim()) {
    throw createHttpError("该试卷的批改锁已更新，请刷新后重试", 409);
  }

  const normalizedVersion = Number(version);
  if (!Number.isInteger(normalizedVersion) || normalizedVersion !== Number(record?.manualReviewVersion ?? 0)) {
    throw createHttpError("该试卷已被其他操作更新，请刷新后重试", 409);
  }
};

export const claimMockExamReviewRecord = async ({
  db,
  recordId,
  adminId,
  adminName,
  currentTime = new Date(),
}) =>
  db.$transaction(async (tx) => {
    await recoverStaleAiProcessingMockExamReviews({
      db: tx,
      recordId,
      currentTime,
    });

    const record = await getReviewRecordWithPaper(tx, recordId);
    if (!record) {
      throw createHttpError("考试记录不存在", 404);
    }

    assertReviewRecordCanBeManuallyHandled(record);

    const workflowStatus = getMockExamRecordReviewWorkflowStatus(record);
    if (workflowStatus === "ai_processing") {
      throw createHttpError("该试卷正在自动批改，暂时不能领取", 409);
    }

    if (workflowStatus === "published") {
      return getReviewRecordWithPaper(tx, record.id);
    }

    const lockMeta = getManualReviewLockMeta(record, adminId, currentTime);
    if (lockMeta.active && !lockMeta.ownedByCurrentAdmin) {
      throw createHttpError(`该试卷已由${getManualReviewerDisplayName(lockMeta.reviewerName)}领取，请稍后再试`, 409);
    }

    const nextLockToken = lockMeta.ownedByCurrentAdmin ? `${record.manualReviewLockToken ?? ""}`.trim() : buildManualReviewLockToken();
    const lockExpiresAt = new Date(currentTime.getTime() + MANUAL_REVIEW_LOCK_MINUTES * 60 * 1000);

    await tx.mockExamRecord.update({
      where: { id: record.id },
      data: {
        manualReviewerId: adminId,
        manualReviewerName: adminName,
        manualReviewLockToken: nextLockToken,
        manualReviewClaimedAt: currentTime,
        manualReviewLockExpiresAt: lockExpiresAt,
      },
    });

    return getReviewRecordWithPaper(tx, record.id);
  });

export const renewMockExamReviewLock = async ({
  db,
  recordId,
  adminId,
  lockToken,
  currentTime = new Date(),
}) =>
  db.$transaction(async (tx) => {
    const record = await getReviewRecordWithPaper(tx, recordId);
    if (!record) {
      throw createHttpError("考试记录不存在", 404);
    }

    assertReviewRecordCanBeManuallyHandled(record);

    if (!isManualReviewLockedByAdmin(record, adminId, currentTime)) {
      throw createHttpError("该试卷的批改锁已失效，请重新领取", 409);
    }

    if (`${record?.manualReviewLockToken ?? ""}`.trim() !== `${lockToken ?? ""}`.trim()) {
      throw createHttpError("该试卷的批改锁已更新，请重新领取", 409);
    }

    await tx.mockExamRecord.update({
      where: { id: record.id },
      data: {
        manualReviewLockExpiresAt: new Date(currentTime.getTime() + MANUAL_REVIEW_LOCK_MINUTES * 60 * 1000),
      },
    });

    return getReviewRecordWithPaper(tx, record.id);
  });

export const releaseMockExamReviewLock = async ({
  db,
  recordId,
  adminId,
  lockToken,
  currentTime = new Date(),
}) =>
  db.$transaction(async (tx) => {
    const record = await getReviewRecordWithPaper(tx, recordId);
    if (!record) {
      throw createHttpError("考试记录不存在", 404);
    }

    assertReviewRecordCanBeManuallyHandled(record);

    if (!isManualReviewLockedByAdmin(record, adminId, currentTime)) {
      return getReviewRecordWithPaper(tx, record.id);
    }

    if (`${record?.manualReviewLockToken ?? ""}`.trim() !== `${lockToken ?? ""}`.trim()) {
      return getReviewRecordWithPaper(tx, record.id);
    }

    await tx.mockExamRecord.update({
      where: { id: record.id },
      data: clearManualReviewLockData(),
    });

    return getReviewRecordWithPaper(tx, record.id);
  });

export const reviewMockExamRecord = async ({
  db,
  recordId,
  adminId,
  lockToken,
  version,
  questionScores = [],
  targetWorkflowStatus = "manual_pending",
  currentTime = new Date(),
}) =>
  db.$transaction(async (tx) => {
    const normalizedTargetWorkflowStatus = `${targetWorkflowStatus ?? ""}`.trim() === "manual_reviewing" ? "manual_reviewing" : "manual_pending";
    const record = await getReviewRecordWithPaper(tx, recordId);
    if (!record) {
      throw createHttpError("考试记录不存在", 404);
    }

    assertManualReviewAccess({ record, adminId, lockToken, version, currentTime });

    const paper = getRecordPaper(record);
    const subjectiveQuestions = (paper?.questions ?? []).filter((question) => isSubjectiveQuestion(question));

    const scoreMap = new Map();
    const subQuestionScoreMap = new Map();
    const questionExtraMap = new Map();
    for (const item of Array.isArray(questionScores) ? questionScores : []) {
      const questionId = `${item?.questionId ?? ""}`.trim();
      if (!questionId) continue;
      questionExtraMap.set(questionId, {
        reviewVoiceUrl: `${item?.reviewVoiceUrl ?? ""}`.trim(),
        reviewVoiceObjectKey: `${item?.reviewVoiceObjectKey ?? ""}`.trim(),
        reviewVoiceDurationSeconds: Number(item?.reviewVoiceDurationSeconds ?? 0) || 0,
      });

      const subQuestions = Array.isArray(item?.subQuestions) ? item.subQuestions : [];
      if (subQuestions.length > 0) {
        if (scoreMap.has(questionId) || subQuestionScoreMap.has(questionId)) {
          throw createHttpError("同一道主观题重复提交了分数", 400);
        }
        const itemMap = new Map();
        for (const subItem of subQuestions) {
          const subQuestionId = `${subItem?.subQuestionId ?? ""}`.trim();
          if (!subQuestionId) continue;
          if (itemMap.has(subQuestionId)) {
            throw createHttpError("同一道小问重复提交了分数", 400);
          }
          itemMap.set(subQuestionId, {
            score: subItem?.score,
            reviewComment: `${subItem?.reviewComment ?? ""}`.trim(),
            referenceAnswer: `${subItem?.referenceAnswer ?? ""}`.trim(),
            abilityLabel: `${subItem?.abilityLabel ?? ""}`.trim(),
            rubricGuidance: `${subItem?.rubricGuidance ?? ""}`.trim(),
            rubricPoints: normalizeRubricPoints(subItem?.rubricPoints),
            missedPoints: normalizeMissedPoints(subItem?.missedPoints),
            answerMarks: normalizeAnswerMarks(subItem?.answerMarks),
          });
        }
        subQuestionScoreMap.set(questionId, itemMap);
        continue;
      }

      if (subQuestionScoreMap.has(questionId) || scoreMap.has(questionId)) {
        throw createHttpError("同一道主观题重复提交了分数", 400);
      }
      scoreMap.set(questionId, item?.score);
    }

    if (scoreMap.size !== subjectiveQuestions.length) {
      const hasSubQuestionPayload = subQuestionScoreMap.size > 0;
      if (!hasSubQuestionPayload) {
        throw createHttpError("请完成全部主观题评分后再提交", 400);
      }
    }

    const answerMap = new Map((record.answers ?? []).map((item) => [item.questionId, item]));
    let subjectiveScoreTotal = 0;

    for (const question of subjectiveQuestions) {
      const maxScore = Number(question.score ?? 0);

      const answer = answerMap.get(question.id);
      const subQuestionAllocations = buildSubjectiveSubQuestionAllocations(question);
      const maxScoreMap = new Map(subQuestionAllocations.map((subQuestion) => [subQuestion.id, Number(subQuestion.maxScore ?? 0)]));
      const sourcePayload = subQuestionScoreMap.get(question.id);
      let score = 0;
      const hasLegacyQuestionScore = scoreMap.has(question.id);
      const hasSubQuestionPayload = Boolean(sourcePayload);

      if (!hasLegacyQuestionScore && !hasSubQuestionPayload) {
        throw createHttpError("存在未评分的主观题", 400);
      }

      if (sourcePayload) {
        for (const [subQuestionId, rawSubPayload] of sourcePayload.entries()) {
          const subMaxScore = Number(maxScoreMap.get(subQuestionId) ?? 0);
          const subScore = Number(rawSubPayload?.score);
          if (!Number.isInteger(subScore)) {
            throw createHttpError("主观题小问分数必须为整数", 400);
          }
          if (subScore < 0 || subScore > subMaxScore) {
            throw createHttpError("主观题小问分数超出允许范围", 400);
          }
          score += subScore;
        }
        if (sourcePayload.size !== subQuestionAllocations.length) {
          throw createHttpError("请完成该主观题的全部小问评分后再提交", 400);
        }
      } else {
        const rawScore = scoreMap.get(question.id);
        score = Number(rawScore);
        if (!Number.isInteger(score)) {
          throw createHttpError("主观题分数必须为整数", 400);
        }
        if (score < 0 || score > maxScore) {
          throw createHttpError("主观题分数超出允许范围", 400);
        }
      }

      if (sourcePayload && score > maxScore) {
        throw createHttpError("主观题分数超出允许范围", 400);
      }

      if (!answer && score > 0) {
        throw createHttpError("未作答的主观题不能录入大于 0 的分数", 400);
      }

      subjectiveScoreTotal += score;

      const existingReviewJson = parseJsonSafely(answer?.reviewJson, null);
      const questionExtra = questionExtraMap.get(question.id) ?? {};
      const reviewJson = isSubjectiveQuestion(question)
        ? (() => {
            const built = buildSubjectiveReviewJson({
              question,
              answer: {
                ...(answer ?? {}),
                score,
              },
              source: "manual",
              subQuestionScores: sourcePayload
                ? Object.fromEntries(Array.from(sourcePayload.entries()).map(([subQuestionId, value]) => [subQuestionId, value?.score]))
                : null,
            });

            built.reviewVoiceUrl = questionExtra.reviewVoiceUrl ?? "";
            built.reviewVoiceObjectKey = questionExtra.reviewVoiceObjectKey ?? "";
            built.reviewVoiceDurationSeconds = questionExtra.reviewVoiceDurationSeconds ?? 0;
            built.feedbackStars = Number(existingReviewJson?.feedbackStars ?? 0) || 0;
            built.feedbackSubmittedAt = existingReviewJson?.feedbackSubmittedAt ?? null;
            built.subQuestions = built.subQuestions.map((subQuestion) => {
              const extra = sourcePayload?.get(subQuestion.id);
              const previousSubQuestion = Array.isArray(existingReviewJson?.subQuestions)
                ? existingReviewJson.subQuestions.find((item) => `${item?.id ?? ""}`.trim() === subQuestion.id)
                : null;

              return {
                ...subQuestion,
                reviewComment: extra?.reviewComment || subQuestion.reviewComment,
                referenceAnswer: extra?.referenceAnswer || subQuestion.referenceAnswer,
                abilityLabel: extra?.abilityLabel || subQuestion.abilityLabel || subQuestion.title,
                rubricGuidance:
                  `${extra?.rubricGuidance ?? ""}`.trim() ||
                  `${previousSubQuestion?.rubricGuidance ?? ""}`.trim() ||
                  subQuestion.rubricGuidance,
                rubricPoints:
                  Array.isArray(extra?.rubricPoints) && extra.rubricPoints.length > 0
                    ? normalizeRubricPoints(extra.rubricPoints)
                    : Array.isArray(previousSubQuestion?.rubricPoints) && previousSubQuestion.rubricPoints.length > 0
                    ? normalizeRubricPoints(previousSubQuestion.rubricPoints)
                    : normalizeRubricPoints(subQuestion.rubricPoints),
                missedPoints:
                  Array.isArray(extra?.missedPoints) && extra.missedPoints.length > 0
                    ? normalizeMissedPoints(extra.missedPoints)
                    : Array.isArray(previousSubQuestion?.missedPoints) && previousSubQuestion.missedPoints.length > 0
                    ? normalizeMissedPoints(previousSubQuestion.missedPoints)
                    : Array.isArray(subQuestion.missedPoints)
                      ? normalizeMissedPoints(subQuestion.missedPoints)
                      : [],
                answerMarks: syncAnswerMarkScoresWithExpectedScore(extra?.answerMarks, extra?.score),
              };
            });
            return JSON.stringify(built);
          })()
        : null;

      if (answer) {
        await tx.mockExamAnswer.update({
          where: { id: answer.id },
          data: {
            score,
            reviewJson,
          },
        });
      } else if (reviewJson) {
        await tx.mockExamAnswer.create({
          data: {
            recordId: record.id,
            questionId: question.id,
            score,
            reviewJson,
          },
        });
      }
    }

    const objectiveScore = (paper?.questions ?? []).reduce((sum, question) => {
      if (isSubjectiveQuestion(question)) {
        return sum;
      }

      const answer = answerMap.get(question.id);
      return sum + Number(answer?.score ?? 0);
    }, 0);

    await tx.mockExamRecord.update({
      where: { id: record.id },
      data: {
        totalScore: objectiveScore + subjectiveScoreTotal,
        reviewedAt: currentTime,
        reviewWorkflowStatus: normalizedTargetWorkflowStatus,
        publishedAt: null,
        manualReviewVersion: {
          increment: 1,
        },
      },
    });

    return getReviewRecordWithPaper(tx, record.id);
  });

export const publishMockExamReviewRecord = async ({
  db,
  recordId,
  adminId,
  lockToken,
  version,
  currentTime = new Date(),
}) =>
  db.$transaction(async (tx) => {
    const record = await getReviewRecordWithPaper(tx, recordId);
    if (!record) {
      throw createHttpError("考试记录不存在", 404);
    }

    assertManualReviewAccess({ record, adminId, lockToken, version, currentTime });

    const paper = getRecordPaper(record);

    const workflowStatus = getMockExamRecordReviewWorkflowStatus(record);
    if (workflowStatus !== "manual_pending" && workflowStatus !== "published") {
      throw createHttpError("当前批改结果尚未进入人工核对发送阶段", 400);
    }

    if (!record.reviewedAt) {
      throw createHttpError("请先完成批改后再发送给学生", 400);
    }

    await tx.mockExamRecord.update({
      where: { id: record.id },
      data: {
        reviewWorkflowStatus: "published",
        publishedAt: currentTime,
        manualReviewVersion: {
          increment: 1,
        },
        ...clearManualReviewLockData(),
      },
    });

    return getReviewRecordWithPaper(tx, record.id);
  });

export const saveMockExamReviewFeedback = async ({
  db,
  recordId,
  userId,
  questionId,
  stars,
  currentTime = new Date(),
}) =>
  db.$transaction(async (tx) => {
    const record = await getRecordWithPaper(tx, recordId);
    if (!record || record.userId !== userId) {
      throw createHttpError("考试记录不存在", 404);
    }

    if (record.status !== "submitted") {
      throw createHttpError("该考试记录尚未交卷", 409);
    }

    const paper = getRecordPaper(record);
    const question = (paper?.questions ?? []).find((item) => item.id === questionId);
    if (!question || !isSubjectiveQuestion(question)) {
      throw createHttpError("只能对主观题提交批改满意度", 400);
    }

    const normalizedStars = Number(stars);
    if (!Number.isInteger(normalizedStars) || normalizedStars < 1 || normalizedStars > 5) {
      throw createHttpError("满意度评分必须在 1 到 5 之间", 400);
    }

    const answer = (record.answers ?? []).find((item) => item.questionId === questionId);
    if (!answer) {
      throw createHttpError("该题暂无作答记录", 404);
    }

    const existingReviewJson = parseJsonSafely(answer.reviewJson, null) ?? buildSubjectiveReviewJson({ question, answer, source: "system" });
    const nextReviewJson = {
      ...existingReviewJson,
      feedbackStars: normalizedStars,
      feedbackSubmittedAt: currentTime.toISOString(),
    };

    await tx.mockExamAnswer.update({
      where: { id: answer.id },
      data: {
        reviewJson: JSON.stringify(nextReviewJson),
      },
    });

    return getRecordWithPaper(tx, record.id);
  });



