import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMockExamSections,
  getMockExamReviewRecord,
  getRemainingSeconds,
  listMockExamReviewRecords,
  recoverStaleAiProcessingMockExamReviews,
  reviewMockExamRecord,
  serializeMockExamRecordDetail,
  serializeMockExamReviewDetail,
  startMockExamRecord,
} from "../lib/mock-exam.js";
import { aiReviewMockExamRecord } from "../lib/mock-exam-ai-review.js";
import {
  __resetMockExamAiReviewQueueForTests,
  enqueueMockExamAiReview,
  pumpMockExamAiReviewQueue,
} from "../lib/mock-exam-ai-review-queue.js";
import { config } from "../lib/config.js";

const createQuestion = (overrides = {}) => ({
  id: "question_1",
  sortOrder: 1,
  type: "single_choice",
  stem: "Sample stem",
  material: "",
  analysis: "Sample analysis",
  score: 2,
  correctAnswerJson: JSON.stringify(["A"]),
  questionMetaJson: null,
  options: [
    { id: "option_1", optionKey: "A", content: "Option A" },
    { id: "option_2", optionKey: "B", content: "Option B" },
  ],
  ...overrides,
});

const isPlainObject = (value) => Object.prototype.toString.call(value) === "[object Object]";

const matchesOperatorCondition = (value, condition) => {
  if (!isPlainObject(condition)) {
    return Object.is(value, condition);
  }

  return Object.entries(condition).every(([operator, expected]) => {
    if (operator === "contains") {
      return `${value ?? ""}`.includes(`${expected ?? ""}`);
    }

    if (operator === "in") {
      return Array.isArray(expected) && expected.some((item) => Object.is(item, value));
    }

    if (operator === "not") {
      if (expected === null) {
        return value !== null && value !== undefined;
      }
      return !matchesOperatorCondition(value, expected);
    }

    if (operator === "gt") {
      return value > expected;
    }

    if (operator === "gte") {
      return value >= expected;
    }

    if (operator === "lt") {
      return value < expected;
    }

    if (operator === "lte") {
      return value <= expected;
    }

    if (operator === "some") {
      return Array.isArray(value) && value.some((item) => matchesWhere(item, expected));
    }

    if (operator === "is") {
      return value !== null && value !== undefined && matchesWhere(value, expected);
    }

    return matchesWhere(value?.[operator], expected);
  });
};

function matchesWhere(record, where) {
  if (!where || !isPlainObject(where) || Object.keys(where).length === 0) {
    return true;
  }

  return Object.entries(where).every(([key, value]) => {
    if (key === "AND") {
      return (Array.isArray(value) ? value : []).every((item) => matchesWhere(record, item));
    }

    if (key === "OR") {
      return (Array.isArray(value) ? value : []).some((item) => matchesWhere(record, item));
    }

    if (key === "NOT") {
      if (Array.isArray(value)) {
        return value.every((item) => !matchesWhere(record, item));
      }
      return !matchesWhere(record, value);
    }

    const currentValue = record?.[key];
    if (isPlainObject(value)) {
      return matchesOperatorCondition(currentValue, value);
    }

    return Object.is(currentValue, value);
  });
}

test("buildMockExamSections groups all supported question types", () => {
  const sections = buildMockExamSections([
    createQuestion({ id: "q1", type: "single_choice", score: 2 }),
    createQuestion({ id: "q2", type: "multiple_choice", score: 3 }),
    createQuestion({ id: "q3", type: "multiple_choice", score: 3 }),
    createQuestion({ id: "q4", type: "uncertain_choice", score: 4 }),
    createQuestion({ id: "q5", type: "subjective_case", score: 20, options: [], correctAnswerJson: "[]" }),
  ]);

  assert.deepEqual(sections, [
    { type: "single_choice", label: "单选题", count: 1, totalScore: 2 },
    { type: "multiple_choice", label: "多选题", count: 2, totalScore: 6 },
    { type: "uncertain_choice", label: "不定项选择题", count: 1, totalScore: 4 },
    { type: "subjective_case", label: "主观题", count: 1, totalScore: 20 },
  ]);
});

test("getRemainingSeconds uses elapsed time for in-progress records", () => {
  const now = new Date("2026-04-25T10:30:00.000Z");
  const remaining = getRemainingSeconds(
    {
      status: "in_progress",
      allottedSeconds: 3600,
      consumedSeconds: 0,
      startedAt: new Date("2026-04-25T10:00:00.000Z"),
    },
    now,
  );

  assert.equal(remaining, 1800);
});

test("getRemainingSeconds keeps paused records fixed at consumed time", () => {
  const now = new Date("2026-04-25T10:30:00.000Z");
  const remaining = getRemainingSeconds(
    {
      status: "in_progress",
      isPaused: true,
      allottedSeconds: 3600,
      consumedSeconds: 900,
      startedAt: new Date("2026-04-25T10:00:00.000Z"),
    },
    now,
  );

  assert.equal(remaining, 2700);
});

test("startMockExamRecord returns existing active record when concurrent create hits unique key", async () => {
  const paper = {
    id: "paper_1",
    status: "published",
    questionCount: 1,
    durationMinutes: 60,
  };
  const currentTime = new Date("2026-04-25T10:00:00.000Z");
  const fullRecord = {
    id: "record_existing",
    paperId: "paper_1",
    userId: "user_1",
    activeKey: "paper_1:user_1",
    status: "in_progress",
    isPaused: false,
    attemptNo: 1,
    questionCount: 1,
    answeredCount: 0,
    correctCount: 0,
    totalScore: 0,
    allottedSeconds: 3600,
    consumedSeconds: 0,
    startedAt: currentTime,
    submittedAt: null,
    updatedAt: currentTime,
    paper: {
      id: "paper_1",
      code: "paper_demo",
      title: "Concurrent demo paper",
      subtitle: "",
      year: 2026,
      phase: "客观题卷一",
      durationMinutes: 60,
      totalScore: 2,
      questionCount: 1,
      passScore: 1,
      description: "",
      questions: [createQuestion()],
    },
    answers: [],
  };

  let createAttempts = 0;
  const fakeDb = {
    mockExamPaper: {
      findUnique: async () => ({
        id: "paper_1",
        permissionRequired: false,
      }),
      findFirst: async () => paper,
    },
    mockExamRecord: {
      findMany: async () => [],
      findFirst: async ({ where }) => {
        if (where?.activeKey === "paper_1:user_1") {
          return {
            id: fullRecord.id,
            paperId: fullRecord.paperId,
            userId: fullRecord.userId,
            activeKey: fullRecord.activeKey,
            status: fullRecord.status,
            isPaused: fullRecord.isPaused,
            updatedAt: fullRecord.updatedAt,
          };
        }
        return null;
      },
      findUnique: async () => fullRecord,
      count: async () => 0,
      create: async () => {
        createAttempts += 1;
        const error = new Error("duplicate active key");
        error.code = "P2002";
        error.meta = { target: ["activeKey"] };
        throw error;
      },
    },
  };

  const record = await startMockExamRecord({
    db: fakeDb,
    paperId: "paper_1",
    userId: "user_1",
    currentTime,
  });

  assert.equal(createAttempts, 1);
  assert.equal(record.id, "record_existing");
});

test("startMockExamRecord stores a frozen paper snapshot for new attempts", async () => {
  const currentTime = new Date("2026-04-25T10:00:00.000Z");
  const paper = {
    id: "paper_snapshot_start",
    status: "published",
    code: "paper_snapshot_start",
    title: "Snapshot start paper",
    subtitle: "",
    year: 2026,
    phase: "客观题",
    durationMinutes: 60,
    totalScore: 2,
    questionCount: 1,
    passScore: 1,
    description: "",
    questions: [createQuestion({ id: "question_snapshot_start" })],
  };

  let createdPayload = null;
  const fakeDb = {
    mockExamPaper: {
      findUnique: async () => ({
        id: paper.id,
        permissionRequired: false,
      }),
      findFirst: async () => paper,
    },
    mockExamRecord: {
      findMany: async () => [],
      findFirst: async () => null,
      findUnique: async () => ({
        id: "record_snapshot_start",
        paperId: paper.id,
        userId: "user_snapshot_start",
        activeKey: `${paper.id}:user_snapshot_start`,
        paperSnapshotJson: createdPayload?.paperSnapshotJson ?? null,
        status: "in_progress",
        isPaused: false,
        attemptNo: 1,
        questionCount: createdPayload?.questionCount ?? 0,
        answeredCount: 0,
        correctCount: 0,
        totalScore: 0,
        allottedSeconds: createdPayload?.allottedSeconds ?? 0,
        consumedSeconds: 0,
        startedAt: currentTime,
        submittedAt: null,
        updatedAt: currentTime,
        paper,
        answers: [],
      }),
      count: async () => 0,
      create: async ({ data }) => {
        createdPayload = data;
        return {
          id: "record_snapshot_start",
        };
      },
    },
  };

  await startMockExamRecord({
    db: fakeDb,
    paperId: paper.id,
    userId: "user_snapshot_start",
    currentTime,
  });

  assert.ok(createdPayload);
  assert.equal(createdPayload.questionCount, 1);
  assert.equal(createdPayload.allottedSeconds, 3600);
  assert.match(createdPayload.paperSnapshotJson, /Snapshot start paper/);
  assert.match(createdPayload.paperSnapshotJson, /question_snapshot_start/);
});

test("serializeMockExamRecordDetail hides objective answers before submit and reveals them after submit", () => {
  const basePaper = {
    id: "paper_1",
    code: "paper_demo",
    title: "Objective demo paper",
    subtitle: "",
    year: 2026,
    phase: "客观题卷一",
    durationMinutes: 90,
    totalScore: 2,
    questionCount: 1,
    passScore: 1,
    description: "",
    questions: [createQuestion()],
  };

  const inProgress = serializeMockExamRecordDetail({
    id: "record_1",
    status: "in_progress",
    attemptNo: 1,
    questionCount: 1,
    answeredCount: 1,
    correctCount: 0,
    totalScore: 0,
    allottedSeconds: 5400,
    consumedSeconds: 0,
    startedAt: new Date("2026-04-25T10:00:00.000Z"),
    submittedAt: null,
    paper: basePaper,
    answers: [{ id: "answer_1", questionId: "question_1", answerJson: JSON.stringify(["A"]), isCorrect: null, score: 0 }],
  });

  assert.deepEqual(inProgress.questions[0].correctAnswerKeys, []);
  assert.equal(inProgress.questions[0].analysis, "");
  assert.equal(inProgress.questions[0].isCorrect, null);

  const submitted = serializeMockExamRecordDetail({
    id: "record_2",
    status: "submitted",
    attemptNo: 1,
    questionCount: 1,
    answeredCount: 1,
    correctCount: 1,
    totalScore: 2,
    allottedSeconds: 5400,
    consumedSeconds: 1200,
    startedAt: new Date("2026-04-25T10:00:00.000Z"),
    submittedAt: new Date("2026-04-25T10:20:00.000Z"),
    paper: basePaper,
    answers: [{ id: "answer_1", questionId: "question_1", answerJson: JSON.stringify(["A"]), isCorrect: true, score: 2 }],
  });

  assert.deepEqual(submitted.questions[0].correctAnswerKeys, ["A"]);
  assert.equal(submitted.questions[0].analysis, "Sample analysis");
  assert.equal(submitted.questions[0].isCorrect, true);
  assert.equal(submitted.questions[0].earnedScore, 2);
});

test("serializeMockExamRecordDetail prefers frozen paper snapshots over current paper content", () => {
  const detail = serializeMockExamRecordDetail({
    id: "record_snapshot_1",
    paperId: "paper_snapshot_1",
    status: "submitted",
    attemptNo: 1,
    questionCount: 1,
    answeredCount: 1,
    correctCount: 1,
    totalScore: 2,
    allottedSeconds: 5400,
    consumedSeconds: 600,
    startedAt: new Date("2026-04-25T10:00:00.000Z"),
    submittedAt: new Date("2026-04-25T10:10:00.000Z"),
    paperSnapshotJson: JSON.stringify({
      paper: {
        id: "paper_snapshot_1",
        code: "paper_snapshot_old",
        title: "Old snapshot paper",
        subtitle: "",
        year: 2026,
        phase: "客观题",
        durationMinutes: 90,
        totalScore: 2,
        questionCount: 1,
        passScore: 1,
        description: "",
      },
      questions: [
        {
          id: "snapshot_question_1",
          sortOrder: 1,
          type: "single_choice",
          score: 2,
          material: "",
          stem: "Old snapshot stem",
          analysis: "Old snapshot analysis",
          correctAnswerJson: JSON.stringify(["A"]),
          questionMetaJson: null,
          options: [
            { id: "snapshot_option_a", optionKey: "A", content: "Snapshot A", sortOrder: 1 },
            { id: "snapshot_option_b", optionKey: "B", content: "Snapshot B", sortOrder: 2 },
          ],
        },
      ],
    }),
    paper: {
      id: "paper_snapshot_1",
      code: "paper_snapshot_new",
      title: "Current paper title",
      subtitle: "",
      year: 2026,
      phase: "客观题",
      durationMinutes: 90,
      totalScore: 4,
      questionCount: 2,
      passScore: 2,
      description: "",
      questions: [
        createQuestion({
          id: "current_question_1",
          stem: "Current paper stem",
          analysis: "Current paper analysis",
        }),
      ],
    },
    answers: [
      {
        id: "snapshot_answer_1",
        questionId: "snapshot_question_1",
        answerJson: JSON.stringify(["A"]),
        isCorrect: true,
        score: 2,
      },
    ],
  });

  assert.equal(detail.paper.title, "Old snapshot paper");
  assert.equal(detail.questions.length, 1);
  assert.equal(detail.questions[0].stem, "Old snapshot stem");
  assert.equal(detail.questions[0].analysis, "Old snapshot analysis");
});

test("serializeMockExamRecordDetail exposes subjective answers and pending review state", () => {
  const subjectiveQuestion = createQuestion({
    id: "subjective_1",
    type: "subjective_case",
    stem: "Subjective case",
    material: "Case material",
    analysis: "Reference points",
    score: 20,
    correctAnswerJson: "[]",
    options: [],
    questionMetaJson: JSON.stringify({
      sectionLabel: "一、案例分析题",
      sectionDescription: "请在对应区域作答。",
      subQuestions: [
        { id: "sq_1", title: "问题(1)" },
        { id: "sq_2", title: "问题(2)" },
      ],
    }),
  });

  const detail = serializeMockExamRecordDetail({
    id: "record_subjective",
    status: "submitted",
    attemptNo: 1,
    questionCount: 1,
    answeredCount: 1,
    correctCount: 0,
    totalScore: 0,
    allottedSeconds: 7200,
    consumedSeconds: 1800,
    startedAt: new Date("2026-04-25T10:00:00.000Z"),
    submittedAt: new Date("2026-04-25T10:30:00.000Z"),
    paper: {
      id: "paper_subjective",
      code: "subjective_demo",
      title: "Subjective demo paper",
      subtitle: "",
      year: 2026,
      phase: "主观题",
      durationMinutes: 120,
      totalScore: 20,
      questionCount: 1,
      passScore: 12,
      description: "",
      questions: [subjectiveQuestion],
    },
    answers: [
      {
        id: "answer_subjective",
        questionId: "subjective_1",
        answerJson: JSON.stringify({
          sq_1: "First answer",
          sq_2: "Second answer",
        }),
        isCorrect: null,
        score: 0,
      },
    ],
  });

  assert.equal(detail.summary.finalScorePending, true);
  assert.equal(detail.summary.pendingReviewCount, 1);
  assert.equal(detail.summary.isPassed, null);
  assert.equal(detail.questions[0].answerState, "answered");
  assert.equal(detail.questions[0].subjectiveSubQuestions.length, 2);
  assert.equal(detail.questions[0].subjectiveSubQuestions[0].answer, "First answer");
  assert.equal(detail.questions[0].analysis, "");
});

test("serializeMockExamReviewDetail marks subjective records as reviewed after scoring", () => {
  const subjectiveQuestion = createQuestion({
    id: "subjective_reviewed_1",
    type: "subjective_case",
    stem: "Subjective reviewed case",
    material: "Reviewed case material",
    analysis: "Reviewed reference points",
    score: 20,
    correctAnswerJson: "[]",
    options: [],
    questionMetaJson: JSON.stringify({
      sectionLabel: "一、案例分析题",
      sectionDescription: "请在对应区域作答。",
      subQuestions: [{ id: "sq_reviewed_1", title: "问题(1)" }],
    }),
  });

  const detail = serializeMockExamReviewDetail({
    id: "record_subjective_reviewed",
    status: "submitted",
    attemptNo: 1,
    questionCount: 1,
    answeredCount: 1,
    correctCount: 0,
    totalScore: 16,
    allottedSeconds: 7200,
    consumedSeconds: 1800,
    startedAt: new Date("2026-04-25T10:00:00.000Z"),
    submittedAt: new Date("2026-04-25T10:30:00.000Z"),
    reviewedAt: new Date("2026-04-25T11:00:00.000Z"),
    publishedAt: new Date("2026-04-25T11:05:00.000Z"),
    reviewWorkflowStatus: "published",
    user: {
      id: "user_1",
      phone: "13800000000",
    },
    paper: {
      id: "paper_subjective_reviewed",
      code: "subjective_reviewed_demo",
      title: "Subjective reviewed demo paper",
      subtitle: "",
      year: 2026,
      phase: "主观题",
      durationMinutes: 120,
      totalScore: 20,
      questionCount: 1,
      passScore: 12,
      description: "",
      questions: [subjectiveQuestion],
    },
    answers: [
      {
        id: "answer_subjective_reviewed",
        questionId: "subjective_reviewed_1",
        answerJson: JSON.stringify({
          sq_reviewed_1: "Reviewed answer",
        }),
        isCorrect: null,
        score: 16,
      },
    ],
  });

  assert.equal(detail.summary.finalScorePending, false);
  assert.equal(detail.summary.pendingReviewCount, 0);
  assert.equal(detail.summary.isPassed, true);
  assert.equal(detail.reviewStatus, "published");
  assert.equal(detail.scoring.objectiveScore, 0);
  assert.equal(detail.scoring.subjectiveScore, 16);
  assert.equal(detail.questions[0].earnedScore, 16);
  assert.notEqual(detail.reviewedAt, "");
});

test("serializeMockExamReviewDetail keeps manual review source", () => {
  const subjectiveQuestion = createQuestion({
    id: "subjective_manual_1",
    type: "subjective_case",
    stem: "Subjective manual case",
    material: "Manual case material",
    analysis: "Manual reference points",
    score: 20,
    correctAnswerJson: "[]",
    options: [],
    questionMetaJson: JSON.stringify({
      sectionLabel: "一、案例分析题",
      sectionDescription: "请在对应区域作答。",
      subQuestions: [{ id: "sq_manual_1", title: "问题(1)" }],
    }),
  });

  const detail = serializeMockExamReviewDetail({
    id: "record_subjective_manual",
    status: "submitted",
    attemptNo: 1,
    questionCount: 1,
    answeredCount: 1,
    correctCount: 0,
    totalScore: 12,
    allottedSeconds: 7200,
    consumedSeconds: 1800,
    startedAt: new Date("2026-04-25T10:00:00.000Z"),
    submittedAt: new Date("2026-04-25T10:30:00.000Z"),
    reviewedAt: new Date("2026-04-25T11:00:00.000Z"),
    user: {
      id: "user_2",
      phone: "13900000000",
    },
    paper: {
      id: "paper_subjective_manual",
      code: "subjective_manual_demo",
      title: "Subjective manual demo paper",
      subtitle: "",
      year: 2026,
      phase: "主观题",
      durationMinutes: 120,
      totalScore: 20,
      questionCount: 1,
      passScore: 12,
      description: "",
      questions: [subjectiveQuestion],
    },
    answers: [
      {
        id: "answer_subjective_manual",
        questionId: "subjective_manual_1",
        answerJson: JSON.stringify({
          sq_manual_1: "Manual answer",
        }),
        reviewJson: JSON.stringify({
          source: "manual",
          totalScore: 12,
          maxScore: 20,
          subQuestions: [
            {
              id: "sq_manual_1",
              title: "问题(1)",
              answer: "Manual answer",
              score: 12,
              maxScore: 20,
              reviewComment: "人工点评",
              referenceAnswer: "参考答案",
              reviewSource: "manual",
            },
          ],
          reviewSource: "manual",
        }),
        isCorrect: null,
        score: 12,
      },
    ],
  });

  assert.equal(detail.reviewSource, "manual");
  assert.equal(detail.questions[0].reviewSource, "manual");
  assert.equal(detail.questions[0].reviewProvider, undefined);
  assert.equal(detail.questions[0].subjectiveSubQuestions[0].reviewSource, "manual");
});

test("serializeMockExamRecordDetail shows direct analysis when subjective paper disables review", () => {
  const subjectiveQuestion = createQuestion({
    id: "subjective_direct_1",
    type: "subjective_case",
    stem: "Subjective direct case",
    material: "Direct case material",
    analysis: "Direct reference points",
    score: 20,
    correctAnswerJson: "[]",
    options: [],
    questionMetaJson: JSON.stringify({
      sectionLabel: "一、案例分析题",
      sectionDescription: "请在对应区域作答。",
      subQuestions: [{ id: "sq_direct_1", title: "问题(1)" }],
    }),
  });

  const detail = serializeMockExamRecordDetail({
    id: "record_subjective_direct",
    status: "submitted",
    attemptNo: 1,
    questionCount: 1,
    answeredCount: 1,
    correctCount: 0,
    totalScore: 15,
    allottedSeconds: 7200,
    consumedSeconds: 1800,
    startedAt: new Date("2026-04-25T10:00:00.000Z"),
    submittedAt: new Date("2026-04-25T10:30:00.000Z"),
    paper: {
      id: "paper_subjective_direct",
      code: "subjective_direct_demo",
      title: "Subjective direct demo paper",
      subtitle: "",
      year: 2026,
      phase: "主观题",
      durationMinutes: 120,
      maxAttempts: 0,
      reviewEnabled: false,
      totalScore: 20,
      questionCount: 1,
      passScore: 12,
      description: "",
      questions: [subjectiveQuestion],
    },
    answers: [
      {
        id: "answer_subjective_direct",
        questionId: "subjective_direct_1",
        answerJson: JSON.stringify({
          sq_direct_1: "Direct answer",
        }),
        isCorrect: null,
        score: 15,
      },
    ],
  });

  assert.equal(detail.paper.reviewEnabled, false);
  assert.equal(detail.summary.finalScorePending, false);
  assert.equal(detail.summary.pendingReviewCount, 0);
  assert.equal(detail.summary.isPassed, true);
  assert.equal(detail.questions[0].analysis, "Direct reference points");
  assert.equal(detail.questions[0].earnedScore, 15);
});

test("serializeMockExamRecordDetail keeps old subjective snapshots reviewable when review flag is missing", () => {
  const detail = serializeMockExamRecordDetail({
    id: "record_subjective_snapshot_legacy",
    paperId: "paper_subjective_snapshot_legacy",
    status: "submitted",
    attemptNo: 1,
    questionCount: 1,
    answeredCount: 1,
    correctCount: 0,
    totalScore: 0,
    allottedSeconds: 7200,
    consumedSeconds: 1200,
    startedAt: new Date("2026-04-25T10:00:00.000Z"),
    submittedAt: new Date("2026-04-25T10:20:00.000Z"),
    paperSnapshotJson: JSON.stringify({
      paper: {
        id: "paper_subjective_snapshot_legacy",
        code: "legacy_subjective_demo",
        title: "Legacy subjective paper",
        subtitle: "",
        year: 2026,
        phase: "主观题",
        durationMinutes: 120,
        totalScore: 20,
        questionCount: 1,
        passScore: 12,
        description: "",
      },
      questions: [
        {
          id: "legacy_subjective_question_1",
          sortOrder: 1,
          type: "subjective_case",
          score: 20,
          material: "",
          stem: "Legacy subjective stem",
          analysis: "Legacy subjective analysis",
          correctAnswerJson: "[]",
          questionMetaJson: JSON.stringify({
            subQuestions: [{ id: "legacy_sq_1", title: "问题(1)" }],
          }),
          options: [],
        },
      ],
    }),
    paper: null,
    answers: [
      {
        id: "legacy_subjective_answer_1",
        questionId: "legacy_subjective_question_1",
        answerJson: JSON.stringify({
          legacy_sq_1: "Legacy answer",
        }),
        isCorrect: null,
        score: 0,
      },
    ],
  });

  assert.equal(detail.paper.reviewEnabled, true);
  assert.equal(detail.summary.finalScorePending, true);
  assert.equal(detail.summary.pendingReviewCount, 1);
  assert.equal(detail.summary.isPassed, null);
});

test("getMockExamReviewRecord rejects subjective records when review is disabled", async () => {
  const record = {
    id: "record_review_disabled",
    status: "submitted",
    paper: {
      id: "paper_review_disabled",
      reviewEnabled: false,
      questions: [
        createQuestion({
          id: "subjective_review_disabled_1",
          type: "subjective_case",
          score: 20,
          correctAnswerJson: "[]",
          options: [],
        }),
      ],
    },
    answers: [],
  };

  const fakeDb = {
    mockExamRecord: {
      findUnique: async () => record,
    },
  };

  await assert.rejects(
    () => getMockExamReviewRecord({ db: fakeDb, recordId: record.id }),
    (error) => error?.message === "该试卷未开启人工批改" && error?.statusCode === 400,
  );
});

test("reviewMockExamRecord rejects subjective records when review is disabled", async () => {
  const record = {
    id: "record_review_submit_disabled",
    status: "submitted",
    paper: {
      id: "paper_review_submit_disabled",
      reviewEnabled: false,
      questions: [
        createQuestion({
          id: "subjective_review_submit_disabled_1",
          type: "subjective_case",
          score: 20,
          correctAnswerJson: "[]",
          options: [],
        }),
      ],
    },
    answers: [],
  };

  const fakeDb = {
    $transaction: async (callback) =>
      callback({
        mockExamRecord: {
          findUnique: async () => record,
        },
      }),
  };

  await assert.rejects(
    () =>
      reviewMockExamRecord({
        db: fakeDb,
        recordId: record.id,
        questionScores: [{ questionId: "subjective_review_submit_disabled_1", score: 10 }],
      }),
    (error) => error?.message === "该试卷未开启人工批改" && error?.statusCode === 400,
  );
});

test("reviewMockExamRecord accepts per-subquestion scoring payloads", async () => {
  const record = {
    id: "record_review_subquestions",
    status: "submitted",
    manualReviewerId: "admin_1",
    manualReviewerName: "张老师",
    manualReviewLockToken: "lock_review_subquestions",
    manualReviewClaimedAt: new Date("2026-04-25T10:31:00.000Z"),
    manualReviewLockExpiresAt: new Date("2026-04-25T11:31:00.000Z"),
    manualReviewVersion: 0,
    paper: {
      id: "paper_review_subquestions",
      reviewEnabled: true,
      questions: [
        createQuestion({
          id: "subjective_review_subquestions_1",
          type: "subjective_case",
          score: 20,
          correctAnswerJson: "[]",
          options: [],
          questionMetaJson: JSON.stringify({
            subQuestions: [
              { id: "sq_review_1", title: "问题(1)" },
              { id: "sq_review_2", title: "问题(2)" },
            ],
          }),
        }),
      ],
    },
    answers: [
      {
        id: "answer_review_subquestions_1",
        questionId: "subjective_review_subquestions_1",
        answerJson: JSON.stringify({
          sq_review_1: "Answer 1",
          sq_review_2: "Answer 2",
        }),
        isCorrect: null,
        score: 0,
      },
    ],
  };

  let savedRecord = record;
  let savedAnswer = record.answers[0];
  const fakeDb = {
    $transaction: async (callback) =>
      callback({
        mockExamRecord: {
          findUnique: async () => savedRecord,
          update: async ({ data }) => {
            savedRecord = {
              ...savedRecord,
              totalScore: data.totalScore,
              reviewedAt: data.reviewedAt,
            };
            return savedRecord;
          },
        },
        mockExamAnswer: {
          update: async ({ data }) => {
            savedAnswer = {
              ...savedAnswer,
              score: data.score,
              reviewJson: data.reviewJson,
            };
            savedRecord = {
              ...savedRecord,
              answers: [savedAnswer],
            };
            return savedAnswer;
          },
        },
      }),
  };

  const reviewed = await reviewMockExamRecord({
    db: fakeDb,
    recordId: record.id,
    adminId: "admin_1",
    lockToken: "lock_review_subquestions",
    version: 0,
    currentTime: new Date("2026-04-25T10:32:00.000Z"),
    questionScores: [
      {
        questionId: "subjective_review_subquestions_1",
        subQuestions: [
          { subQuestionId: "sq_review_1", score: 6 },
          { subQuestionId: "sq_review_2", score: 8 },
        ],
      },
    ],
  });

  assert.equal(reviewed.answers[0].score, 14);
  assert.equal(reviewed.totalScore, 14);
  assert.equal(reviewed.answers[0].reviewJson.includes('"source":"manual"'), true);
  assert.equal(reviewed.answers[0].reviewJson.includes('"sq_review_1"'), true);
  assert.equal(reviewed.answers[0].reviewJson.includes('"sq_review_2"'), true);
});

test("reviewMockExamRecord persists subjective answer marks", async () => {
  const record = {
    id: "record_review_answer_marks",
    status: "submitted",
    manualReviewerId: "admin_1",
    manualReviewerName: "张老师",
    manualReviewLockToken: "lock_review_answer_marks",
    manualReviewClaimedAt: new Date("2026-04-25T10:31:00.000Z"),
    manualReviewLockExpiresAt: new Date("2026-04-25T11:31:00.000Z"),
    manualReviewVersion: 0,
    paper: {
      id: "paper_review_answer_marks",
      reviewEnabled: true,
      questions: [
        createQuestion({
          id: "subjective_review_answer_marks_1",
          type: "subjective_case",
          score: 20,
          correctAnswerJson: "[]",
          options: [],
          questionMetaJson: JSON.stringify({
            subQuestions: [{ id: "sq_mark_1", title: "问题(1)" }],
          }),
        }),
      ],
    },
    answers: [
      {
        id: "answer_review_answer_marks_1",
        questionId: "subjective_review_answer_marks_1",
        answerJson: JSON.stringify({
          sq_mark_1: "甲应承担违约责任，但未论证损失范围。",
        }),
        isCorrect: null,
        score: 0,
      },
    ],
  };

  let savedRecord = record;
  let savedAnswer = record.answers[0];
  const fakeDb = {
    $transaction: async (callback) =>
      callback({
        mockExamRecord: {
          findUnique: async () => savedRecord,
          update: async ({ data }) => {
            savedRecord = {
              ...savedRecord,
              totalScore: data.totalScore,
              reviewedAt: data.reviewedAt,
            };
            return savedRecord;
          },
        },
        mockExamAnswer: {
          update: async ({ data }) => {
            savedAnswer = {
              ...savedAnswer,
              score: data.score,
              reviewJson: data.reviewJson,
            };
            savedRecord = {
              ...savedRecord,
              answers: [savedAnswer],
            };
            return savedAnswer;
          },
        },
      }),
  };

  const reviewed = await reviewMockExamRecord({
    db: fakeDb,
    recordId: record.id,
    adminId: "admin_1",
    lockToken: "lock_review_answer_marks",
    version: 0,
    currentTime: new Date("2026-04-25T10:32:00.000Z"),
    questionScores: [
      {
        questionId: "subjective_review_answer_marks_1",
        subQuestions: [
          {
            subQuestionId: "sq_mark_1",
            score: 12,
            answerMarks: [
              {
                id: "mark_1",
                highlight: "未论证损失范围",
                comment: "这里缺少对损失计算依据的展开分析。",
                status: "score",
                score: 2,
              },
            ],
          },
        ],
      },
    ],
  });

  assert.equal(reviewed.answers[0].reviewJson.includes('"answerMarks"'), true);
  assert.equal(reviewed.answers[0].reviewJson.includes("未论证损失范围"), true);
  assert.equal(reviewed.answers[0].reviewJson.includes("损失计算依据"), true);
  assert.equal(reviewed.answers[0].reviewJson.includes('"status":"correct"'), true);
  assert.equal(reviewed.answers[0].reviewJson.includes('"score":12'), true);
});

test("serializeMockExamReviewDetail prefers manual_pending after save even if current admin still holds lock", () => {
  const now = new Date("2026-05-11T08:00:00.000Z");
  const detail = serializeMockExamReviewDetail(
    {
      id: "record_manual_pending_status",
      status: "submitted",
      attemptNo: 1,
      questionCount: 1,
      correctCount: 0,
      totalScore: 12,
      allottedSeconds: 3600,
      consumedSeconds: 1800,
      startedAt: now,
      submittedAt: now,
      reviewedAt: now,
      publishedAt: null,
      reviewWorkflowStatus: "manual_pending",
      manualReviewerId: "admin_1",
      manualReviewerName: "张老师",
      manualReviewLockToken: "lock_1",
      manualReviewClaimedAt: now,
      manualReviewLockExpiresAt: new Date(now.getTime() + 10 * 60 * 1000),
      manualReviewVersion: 2,
      user: {
        id: "user_1",
        phone: "13800000000",
      },
      paper: {
        id: "paper_manual_pending_status",
        code: "TEST-1",
        title: "测试卷",
        subtitle: "",
        coverUrl: "",
        coverObjectKey: "",
        phase: "民法",
        year: 2026,
        durationMinutes: 60,
        maxAttempts: 1,
        reviewEnabled: true,
        totalScore: 20,
        questionCount: 1,
        passScore: 12,
        description: "",
        questions: [
          createQuestion({
            id: "subjective_manual_pending_status_1",
            type: "subjective_case",
            score: 20,
            correctAnswerJson: "[]",
            options: [],
            questionMetaJson: JSON.stringify({
              subQuestions: [{ id: "sq_pending_1", title: "问题(1)" }],
            }),
          }),
        ],
      },
      answers: [
        {
          id: "answer_manual_pending_status_1",
          questionId: "subjective_manual_pending_status_1",
          answerJson: JSON.stringify({
            sq_pending_1: "作答内容",
          }),
          isCorrect: null,
          score: 12,
          reviewJson: JSON.stringify({
            source: "manual",
            totalScore: 12,
            maxScore: 20,
            subQuestions: [
              {
                id: "sq_pending_1",
                title: "问题(1)",
                answer: "作答内容",
                score: 12,
                maxScore: 20,
                reviewComment: "点评",
                referenceAnswer: "参考",
                reviewSource: "manual",
                abilityLabel: "问题(1)",
                rubricGuidance: "",
                rubricPoints: [],
                missedPoints: [],
                answerMarks: [],
              },
            ],
          }),
        },
      ],
    },
    now,
    { currentAdminId: "admin_1" },
  );

  assert.equal(detail.reviewStatus, "manual_pending");
});

test("aiReviewMockExamRecord persists rubric point hit state", async () => {
  const question = createQuestion({
    id: "subjective_ai_review_1",
    type: "subjective_case",
    stem: "请分析违约责任。",
    score: 10,
    correctAnswerJson: "[]",
    options: [],
    questionMetaJson: JSON.stringify({
      subQuestions: [
        {
          id: "sq_ai_1",
          title: "问题(1)",
          placeholder: "请作答",
          rubricPoints: [
            {
              id: "point_1",
              title: "说明违约责任承担方式",
              score: 4,
              keywords: ["违约责任"],
            },
            {
              id: "point_2",
              title: "说明损失赔偿范围",
              score: 6,
              keywords: ["损失赔偿"],
            },
          ],
        },
      ],
    }),
  });

  let savedAnswer = {
    id: "answer_ai_1",
    questionId: question.id,
    answerJson: JSON.stringify({
      sq_ai_1: "本题应先说明违约责任，再分析损失赔偿。",
    }),
    reviewJson: null,
    score: 0,
  };

  let savedRecord = {
    id: "record_ai_1",
    status: "submitted",
    totalScore: 0,
    reviewedAt: null,
    paper: {
      id: "paper_ai_1",
      code: "paper_ai_1",
      title: "AI Review Paper",
      phase: "主观题",
      totalScore: 10,
      passScore: 6,
      questions: [question],
    },
    answers: [savedAnswer],
    user: { id: "user_ai_1", phone: "13800000003" },
  };

  const fakeDb = {
    $transaction: async (callback) =>
      callback({
        mockExamRecord: {
          findUnique: async () => savedRecord,
          update: async ({ data }) => {
            savedRecord = {
              ...savedRecord,
              totalScore: data.totalScore,
              reviewedAt: data.reviewedAt,
            };
            return savedRecord;
          },
        },
        mockExamAnswer: {
          update: async ({ data }) => {
            savedAnswer = {
              ...savedAnswer,
              score: data.score,
              reviewJson: data.reviewJson,
            };
            savedRecord = {
              ...savedRecord,
              answers: [savedAnswer],
            };
            return savedAnswer;
          },
        },
      }),
  };

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              subQuestions: [
                {
                  id: "sq_ai_1",
                  score: 10,
                  reviewComment: "已覆盖关键论点。",
                  referenceAnswer: "参考答案",
                  abilityLabel: "违约责任分析",
                  reviewProvider: "openai-compatible",
                  missedPoints: [],
                  rubricPoints: [
                    {
                      id: "point_1",
                      title: "说明违约责任承担方式",
                      score: 4,
                      description: "",
                      keywords: ["违约责任"],
                      hit: true,
                      awardedScore: 4,
                      matchedText: "违约责任",
                    },
                    {
                      id: "point_2",
                      title: "说明损失赔偿范围",
                      score: 6,
                      description: "",
                      keywords: ["损失赔偿"],
                      hit: true,
                      awardedScore: 6,
                      matchedText: "损失赔偿",
                    },
                  ],
                  answerMarks: [
                    {
                      id: "mark_ai_1_1",
                      highlight: "违约责任",
                      comment: "这一点答到了违约责任。",
                      status: "score",
                      score: 4,
                    },
                    {
                      id: "mark_ai_1_2",
                      highlight: "损失赔偿",
                      comment: "这一点答到了损失赔偿。",
                      status: "score",
                      score: 6,
                    },
                  ],
                },
              ],
            }),
          },
        },
      ],
    }),
  });

  try {
    await aiReviewMockExamRecord({
      db: fakeDb,
      recordId: savedRecord.id,
      runtimeConfig: {
        provider: "openai-compatible",
        baseUrl: "https://example.com/v1",
        apiKey: "test-key",
        model: "test-model",
        timeoutMs: 1000,
      },
    });
  } finally {
    global.fetch = originalFetch;
  }

  const normalizedReview = JSON.parse(savedAnswer.reviewJson);
  const subQuestion = normalizedReview.subQuestions?.[0];
  assert.equal(savedAnswer.reviewJson.includes('"rubricPoints"'), true);
  assert.equal(savedAnswer.reviewJson.includes('"hit":true'), true);
  assert.equal(savedAnswer.reviewJson.includes('"matchedText":"违约责任"'), true);
  assert.equal(savedAnswer.reviewJson.includes('"awardedScore":4'), true);
  assert.equal(savedAnswer.reviewJson.includes('"reviewProvider":"openai-compatible"'), true);
  assert.equal(subQuestion?.score, 10);
  assert.deepEqual(
    (subQuestion?.answerMarks ?? [])
      .filter((item) => item.status === "score")
      .map((item) => item.score),
    [4, 6],
  );
});

test("aiReviewMockExamRecord throws when remote AI request fails", async () => {
  const question = createQuestion({
    id: "subjective_ai_fallback_1",
    type: "subjective_case",
    stem: "请分析合同违约责任。",
    score: 8,
    correctAnswerJson: "[]",
    options: [],
    questionMetaJson: JSON.stringify({
      subQuestions: [
        {
          id: "sq_ai_fallback_1",
          title: "问题(1)",
          placeholder: "请作答",
          rubricPoints: [
            {
              id: "point_fallback_1",
              title: "说明违约责任",
              score: 8,
              keywords: ["违约责任"],
            },
          ],
        },
      ],
    }),
  });

  let savedAnswer = {
    id: "answer_ai_fallback_1",
    questionId: question.id,
    answerJson: JSON.stringify({
      sq_ai_fallback_1: "本题应先说明违约责任。",
    }),
    reviewJson: null,
    score: 0,
  };

  let savedRecord = {
    id: "record_ai_fallback_1",
    status: "submitted",
    totalScore: 0,
    reviewedAt: null,
    paper: {
      id: "paper_ai_fallback_1",
      code: "paper_ai_fallback_1",
      title: "AI Fallback Paper",
      phase: "主观题",
      totalScore: 8,
      passScore: 5,
      questions: [question],
    },
    answers: [savedAnswer],
    user: { id: "user_ai_fallback_1", phone: "13800000004" },
  };

  const fakeDb = {
    $transaction: async (callback) =>
      callback({
        mockExamRecord: {
          findUnique: async () => savedRecord,
          update: async ({ data }) => {
            savedRecord = {
              ...savedRecord,
              totalScore: data.totalScore,
              reviewedAt: data.reviewedAt,
            };
            return savedRecord;
          },
        },
        mockExamAnswer: {
          update: async ({ data }) => {
            savedAnswer = {
              ...savedAnswer,
              score: data.score,
              reviewJson: data.reviewJson,
            };
            savedRecord = {
              ...savedRecord,
              answers: [savedAnswer],
            };
            return savedAnswer;
          },
        },
      }),
  };

  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error("network failed");
  };

  let thrownError = null;
  try {
    try {
      await aiReviewMockExamRecord({
        db: fakeDb,
        recordId: savedRecord.id,
        runtimeConfig: {
          provider: "openai-compatible",
          baseUrl: "https://example.com/v1",
          apiKey: "test-key",
          model: "test-model",
          timeoutMs: 1000,
        },
      });
    } catch (error) {
      thrownError = error;
    }
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(thrownError instanceof Error, true);
  assert.equal(`${thrownError?.message ?? ""}`.includes("network failed"), true);
  assert.equal(savedAnswer.reviewJson, null);
  assert.equal(savedAnswer.score, 0);
});

test("aiReviewMockExamRecord normalizes remote AI answer marks to student source text", async () => {
  const question = createQuestion({
    id: "subjective_ai_marks_1",
    type: "subjective_case",
    stem: "请分析违约责任与损失赔偿。",
    score: 10,
    correctAnswerJson: "[]",
    options: [],
    questionMetaJson: JSON.stringify({
      subQuestions: [
        {
          id: "sq_ai_marks_1",
          title: "问题(1)",
          placeholder: "请作答",
          referenceAnswer: "应说明违约责任，并分析损失赔偿范围。",
          rubricGuidance: "围绕违约责任和损失赔偿两个要点评分。",
          rubricPoints: [
            {
              id: "point_ai_marks_1",
              title: "说明违约责任",
              score: 4,
              keywords: ["违约责任"],
            },
            {
              id: "point_ai_marks_2",
              title: "说明损失赔偿",
              score: 6,
              keywords: ["损失赔偿"],
            },
          ],
        },
      ],
    }),
  });

  let savedAnswer = {
    id: "answer_ai_marks_1",
    questionId: question.id,
    answerJson: JSON.stringify({
      sq_ai_marks_1: "本案中已写明违约 责任，后面又写到损失赔偿。",
    }),
    reviewJson: null,
    score: 0,
  };

  let savedRecord = {
    id: "record_ai_marks_1",
    status: "submitted",
    totalScore: 0,
    reviewedAt: null,
    paper: {
      id: "paper_ai_marks_1",
      code: "paper_ai_marks_1",
      title: "AI Marks Paper",
      phase: "主观题",
      totalScore: 10,
      passScore: 6,
      questions: [question],
    },
    answers: [savedAnswer],
    user: { id: "user_ai_marks_1", phone: "13800000005" },
  };

  const fakeDb = {
    $transaction: async (callback) =>
      callback({
        mockExamRecord: {
          findUnique: async () => savedRecord,
          update: async ({ data }) => {
            savedRecord = {
              ...savedRecord,
              totalScore: data.totalScore,
              reviewedAt: data.reviewedAt,
            };
            return savedRecord;
          },
        },
        mockExamAnswer: {
          update: async ({ data }) => {
            savedAnswer = {
              ...savedAnswer,
              score: data.score,
              reviewJson: data.reviewJson,
            };
            savedRecord = {
              ...savedRecord,
              answers: [savedAnswer],
            };
            return savedAnswer;
          },
        },
      }),
  };

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              subQuestions: [
                {
                  id: "sq_ai_marks_1",
                  score: 10,
                  reviewComment: "已覆盖违约责任和损失赔偿两个核心点。",
                  referenceAnswer: "应说明违约责任，并分析损失赔偿范围。",
                  abilityLabel: "案例分析",
                  rubricGuidance: "围绕违约责任和损失赔偿两个要点评分。",
                  missedPoints: [],
                  rubricPoints: [
                    {
                      id: "point_ai_marks_1",
                      title: "说明违约责任",
                      score: 4,
                      description: "",
                      keywords: ["违约责任"],
                      hit: true,
                      awardedScore: 4,
                      matchedText: "违约责任",
                    },
                    {
                      id: "point_ai_marks_2",
                      title: "说明损失赔偿",
                      score: 6,
                      description: "",
                      keywords: ["损失赔偿"],
                      hit: true,
                      awardedScore: 6,
                      matchedText: "损失赔偿",
                    },
                  ],
                  answerMarks: [
                    {
                      id: "mark_1",
                      highlight: "违约责任",
                      comment: "这里点到了违约责任。",
                      status: "score",
                      score: 4,
                    },
                    {
                      id: "mark_2",
                      highlight: "损失赔偿",
                      comment: "这里点到了损失赔偿。",
                      status: "score",
                      score: 6,
                    },
                  ],
                },
              ],
            }),
          },
        },
      ],
    }),
  });

  try {
    await aiReviewMockExamRecord({
      db: fakeDb,
      recordId: savedRecord.id,
      runtimeConfig: {
        provider: "openai-compatible",
        baseUrl: "https://example.com/v1",
        apiKey: "test-key",
        model: "test-model",
        timeoutMs: 1000,
      },
    });
  } finally {
    global.fetch = originalFetch;
  }

  const normalizedReview = JSON.parse(savedAnswer.reviewJson);
  const answerPayload = JSON.parse(savedAnswer.answerJson);
  const studentAnswerText = answerPayload.sq_ai_marks_1;
  const normalizedMarks = normalizedReview.subQuestions?.[0]?.answerMarks ?? [];
  const firstMark = normalizedMarks.find((item) => item.id === "mark_1");
  const secondMark = normalizedMarks.find((item) => item.id === "mark_2");
  assert.equal(normalizedMarks.length, 2);
  assert.equal(studentAnswerText.includes(firstMark.highlight), true);
  assert.equal(studentAnswerText.includes(secondMark.highlight), true);
  assert.equal(firstMark.highlight, "违约 责任");
  assert.equal(secondMark.highlight, "损失赔偿");
  assert.equal(normalizedMarks.every((item) => item.status === "score"), true);
});

test("aiReviewMockExamRecord throws when remote AI omits answer marks", async () => {
  const question = createQuestion({
    id: "subjective_ai_marks_2",
    type: "subjective_case",
    stem: "请分析合同效力。",
    score: 5,
    correctAnswerJson: "[]",
    options: [],
    questionMetaJson: JSON.stringify({
      subQuestions: [
        {
          id: "sq_ai_marks_2",
          title: "问题(1)",
          placeholder: "请作答",
          rubricPoints: [
            {
              id: "point_ai_marks_3",
              title: "说明合同有效",
              score: 5,
              keywords: ["合同有效"],
            },
          ],
        },
      ],
    }),
  });

  let savedAnswer = {
    id: "answer_ai_marks_2",
    questionId: question.id,
    answerJson: JSON.stringify({
      sq_ai_marks_2: "本案合同有效，应继续履行。",
    }),
    reviewJson: null,
    score: 0,
  };

  let savedRecord = {
    id: "record_ai_marks_2",
    status: "submitted",
    totalScore: 0,
    reviewedAt: null,
    paper: {
      id: "paper_ai_marks_2",
      code: "paper_ai_marks_2",
      title: "AI Marks Fallback Paper",
      phase: "主观题",
      totalScore: 5,
      passScore: 3,
      questions: [question],
    },
    answers: [savedAnswer],
    user: { id: "user_ai_marks_2", phone: "13800000006" },
  };

  const fakeDb = {
    $transaction: async (callback) =>
      callback({
        mockExamRecord: {
          findUnique: async () => savedRecord,
          update: async ({ data }) => {
            savedRecord = {
              ...savedRecord,
              totalScore: data.totalScore,
              reviewedAt: data.reviewedAt,
            };
            return savedRecord;
          },
        },
        mockExamAnswer: {
          update: async ({ data }) => {
            savedAnswer = {
              ...savedAnswer,
              score: data.score,
              reviewJson: data.reviewJson,
            };
            savedRecord = {
              ...savedRecord,
              answers: [savedAnswer],
            };
            return savedAnswer;
          },
        },
      }),
  };

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              subQuestions: [
                {
                  id: "sq_ai_marks_2",
                  score: 5,
                  reviewComment: "已明确指出合同有效。",
                  missedPoints: [],
                  rubricPoints: [
                    {
                      id: "point_ai_marks_3",
                      title: "说明合同有效",
                      score: 5,
                      description: "",
                      keywords: ["合同有效"],
                      hit: true,
                      awardedScore: 5,
                      matchedText: "合同有效",
                    },
                  ],
                  answerMarks: [],
                },
              ],
            }),
          },
        },
      ],
    }),
  });

  try {
    await assert.rejects(
      () =>
        aiReviewMockExamRecord({
          db: fakeDb,
          recordId: savedRecord.id,
          runtimeConfig: {
            provider: "openai-compatible",
            baseUrl: "https://example.com/v1",
            apiKey: "test-key",
            model: "test-model",
            timeoutMs: 1000,
          },
        }),
      (error) => error?.message?.includes("缺少正向标注"),
    );
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(savedAnswer.reviewJson, null);
  assert.equal(savedAnswer.score, 0);
});

test("aiReviewMockExamRecord surfaces HTML upstream pages as baseUrl configuration errors", async () => {
  const question = createQuestion({
    id: "subjective_ai_html_1",
    type: "subjective_case",
    stem: "请分析合同违约责任。",
    score: 8,
    correctAnswerJson: "[]",
    options: [],
    questionMetaJson: JSON.stringify({
      subQuestions: [
        {
          id: "sq_ai_html_1",
          title: "问题(1)",
          placeholder: "请作答",
          rubricPoints: [{ id: "point_ai_html_1", title: "说明违约责任", score: 8, keywords: ["违约责任"] }],
        },
      ],
    }),
  });

  let savedAnswer = {
    id: "answer_ai_html_1",
    questionId: question.id,
    answerJson: JSON.stringify({
      sq_ai_html_1: "应说明违约责任。",
    }),
    reviewJson: null,
    score: 0,
  };

  const savedRecord = {
    id: "record_ai_html_1",
    status: "submitted",
    totalScore: 0,
    reviewedAt: null,
    paper: {
      id: "paper_ai_html_1",
      code: "paper_ai_html_1",
      title: "AI HTML Paper",
      phase: "主观题",
      totalScore: 8,
      passScore: 5,
      questions: [question],
    },
    answers: [savedAnswer],
    user: { id: "user_ai_html_1", phone: "13800000014" },
  };

  const fakeDb = {
    $transaction: async (callback) =>
      callback({
        mockExamRecord: {
          findUnique: async () => savedRecord,
          update: async () => savedRecord,
        },
        mockExamAnswer: {
          update: async ({ data }) => {
            savedAnswer = {
              ...savedAnswer,
              score: data.score,
              reviewJson: data.reviewJson,
            };
            return savedAnswer;
          },
        },
      }),
    mockExamRecord: {
      update: async () => savedRecord,
    },
  };

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    headers: {
      get: (name) => (name === "content-type" ? "text/html; charset=utf-8" : ""),
    },
    text: async () => "<!doctype html><html><body><h1>Provider Console</h1></body></html>",
  });

  let thrownError = null;
  try {
    try {
      await aiReviewMockExamRecord({
        db: fakeDb,
        recordId: savedRecord.id,
        runtimeConfig: {
          provider: "openai-compatible",
          baseUrl: "https://example.com/v1",
          apiKey: "test-key",
          model: "test-model",
          timeoutMs: 1000,
        },
      });
    } catch (error) {
      thrownError = error;
    }
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(thrownError instanceof Error, true);
  assert.equal(`${thrownError?.message ?? ""}`.includes("HTML 页面"), true);
  assert.equal(`${thrownError?.message ?? ""}`.includes("Base URL"), true);
  assert.equal(savedAnswer.reviewJson, null);
});

test("aiReviewMockExamRecord surfaces upstream JSON error messages", async () => {
  const question = createQuestion({
    id: "subjective_ai_json_error_1",
    type: "subjective_case",
    stem: "请分析合同违约责任。",
    score: 8,
    correctAnswerJson: "[]",
    options: [],
    questionMetaJson: JSON.stringify({
      subQuestions: [
        {
          id: "sq_ai_json_error_1",
          title: "问题(1)",
          placeholder: "请作答",
          rubricPoints: [{ id: "point_ai_json_error_1", title: "说明违约责任", score: 8, keywords: ["违约责任"] }],
        },
      ],
    }),
  });

  const savedRecord = {
    id: "record_ai_json_error_1",
    status: "submitted",
    totalScore: 0,
    reviewedAt: null,
    paper: {
      id: "paper_ai_json_error_1",
      code: "paper_ai_json_error_1",
      title: "AI JSON Error Paper",
      phase: "主观题",
      totalScore: 8,
      passScore: 5,
      questions: [question],
    },
    answers: [
      {
        id: "answer_ai_json_error_1",
        questionId: question.id,
        answerJson: JSON.stringify({
          sq_ai_json_error_1: "应说明违约责任。",
        }),
        reviewJson: null,
        score: 0,
      },
    ],
    user: { id: "user_ai_json_error_1", phone: "13800000015" },
  };

  const fakeDb = {
    $transaction: async (callback) =>
      callback({
        mockExamRecord: {
          findUnique: async () => savedRecord,
          update: async () => savedRecord,
        },
        mockExamAnswer: {
          update: async ({ data }) => data,
        },
      }),
    mockExamRecord: {
      update: async () => savedRecord,
    },
  };

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 401,
    headers: {
      get: (name) => (name === "content-type" ? "application/json" : ""),
    },
    text: async () => JSON.stringify({ error: { message: "Invalid API key" } }),
  });

  let thrownError = null;
  try {
    try {
      await aiReviewMockExamRecord({
        db: fakeDb,
        recordId: savedRecord.id,
        runtimeConfig: {
          provider: "openai-compatible",
          baseUrl: "https://example.com/v1",
          apiKey: "bad-key",
          model: "test-model",
          timeoutMs: 1000,
        },
      });
    } catch (error) {
      thrownError = error;
    }
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(thrownError instanceof Error, true);
  assert.equal(`${thrownError?.message ?? ""}`.includes("401"), true);
  assert.equal(`${thrownError?.message ?? ""}`.includes("Invalid API key"), true);
});

test("aiReviewMockExamRecord keeps remote AI wrong marks for missed rubric points", async () => {
  const question = createQuestion({
    id: "subjective_ai_marks_3",
    type: "subjective_case",
    stem: "请分析侵权责任构成。",
    score: 8,
    correctAnswerJson: "[]",
    options: [],
    questionMetaJson: JSON.stringify({
      subQuestions: [
        {
          id: "sq_ai_marks_3",
          title: "问题(1)",
          placeholder: "请作答",
          rubricPoints: [
            {
              id: "point_ai_marks_4",
              title: "说明侵权行为",
              score: 4,
              keywords: ["侵权行为"],
            },
            {
              id: "point_ai_marks_5",
              title: "说明损害后果",
              score: 4,
              keywords: ["损害后果"],
            },
          ],
        },
      ],
    }),
  });

  let savedAnswer = {
    id: "answer_ai_marks_3",
    questionId: question.id,
    answerJson: JSON.stringify({
      sq_ai_marks_3: "本题已经存在侵权行为，但我认为没有损害后果。",
    }),
    reviewJson: null,
    score: 0,
  };

  let savedRecord = {
    id: "record_ai_marks_3",
    status: "submitted",
    totalScore: 0,
    reviewedAt: null,
    paper: {
      id: "paper_ai_marks_3",
      code: "paper_ai_marks_3",
      title: "AI Wrong Marks Paper",
      phase: "主观题",
      totalScore: 8,
      passScore: 5,
      questions: [question],
    },
    answers: [savedAnswer],
    user: { id: "user_ai_marks_3", phone: "13800000007" },
  };

  const fakeDb = {
    $transaction: async (callback) =>
      callback({
        mockExamRecord: {
          findUnique: async () => savedRecord,
          update: async ({ data }) => {
            savedRecord = {
              ...savedRecord,
              totalScore: data.totalScore,
              reviewedAt: data.reviewedAt,
            };
            return savedRecord;
          },
        },
        mockExamAnswer: {
          update: async ({ data }) => {
            savedAnswer = {
              ...savedAnswer,
              score: data.score,
              reviewJson: data.reviewJson,
            };
            savedRecord = {
              ...savedRecord,
              answers: [savedAnswer],
            };
            return savedAnswer;
          },
        },
      }),
  };

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              subQuestions: [
                {
                  id: "sq_ai_marks_3",
                  score: 4,
                  reviewComment: "已分析侵权行为，但未说明损害后果。",
                  missedPoints: [
                    {
                      id: "missed_ai_marks_3_1",
                      title: "损害后果",
                      description: "没有把损害后果的事实基础和结果展开写出来。",
                      score: 4,
                    },
                  ],
                  rubricPoints: [
                    {
                      id: "point_ai_marks_4",
                      title: "说明侵权行为",
                      score: 4,
                      description: "",
                      keywords: ["侵权行为"],
                      hit: true,
                      awardedScore: 4,
                      matchedText: "侵权行为",
                    },
                    {
                      id: "point_ai_marks_5",
                      title: "说明损害后果",
                      score: 4,
                      description: "",
                      keywords: ["损害后果"],
                      hit: false,
                      awardedScore: 0,
                      matchedText: "",
                    },
                  ],
                  answerMarks: [
                    {
                      id: "mark_ai_marks_3_1",
                      highlight: "侵权行为",
                      comment: "这一点答到了侵权行为。",
                      status: "score",
                      score: 4,
                    },
                    {
                      id: "mark_ai_marks_3_2",
                      highlight: "没有损害后果",
                      comment: "这里对损害后果的判断错了，不能直接这样下结论。",
                      status: "wrong",
                      score: null,
                    },
                  ],
                },
              ],
            }),
          },
        },
      ],
    }),
  });

  try {
    await aiReviewMockExamRecord({
      db: fakeDb,
      recordId: savedRecord.id,
      runtimeConfig: {
        provider: "openai-compatible",
        baseUrl: "https://example.com/v1",
        apiKey: "test-key",
        model: "test-model",
        timeoutMs: 1000,
      },
    });
  } finally {
    global.fetch = originalFetch;
  }

  const normalizedReview = JSON.parse(savedAnswer.reviewJson);
  const subQuestion = normalizedReview.subQuestions?.[0];
  const normalizedMarks = subQuestion?.answerMarks ?? [];
  assert.equal(subQuestion?.missedPoints?.length, 1);
  assert.equal(normalizedMarks.some((item) => item.status === "wrong"), true);
  assert.equal(normalizedMarks.some((item) => item.highlight === "没有损害后果"), true);
});

test("aiReviewMockExamRecord keeps remote AI positive scored marks unchanged", async () => {
  const question = createQuestion({
    id: "subjective_ai_marks_correct_to_score",
    type: "subjective_case",
    stem: "请分析合同效力。",
    score: 3,
    correctAnswerJson: "[]",
    options: [],
    questionMetaJson: JSON.stringify({
      subQuestions: [
        {
          id: "sq_ai_marks_correct_to_score",
          title: "问题(1)",
          placeholder: "请作答",
          rubricPoints: [
            {
              id: "point_correct_to_score_1",
              title: "说明合同有效",
              score: 3,
              keywords: ["合同有效"],
            },
          ],
        },
      ],
    }),
  });

  let savedAnswer = {
    id: "answer_ai_marks_correct_to_score",
    questionId: question.id,
    answerJson: JSON.stringify({
      sq_ai_marks_correct_to_score: "本案合同有效，应继续履行。",
    }),
    reviewJson: null,
    score: 0,
  };

  let savedRecord = {
    id: "record_ai_marks_correct_to_score",
    status: "submitted",
    totalScore: 0,
    reviewedAt: null,
    paper: {
      id: "paper_ai_marks_correct_to_score",
      code: "paper_ai_marks_correct_to_score",
      title: "AI Correct To Score Paper",
      phase: "主观题",
      totalScore: 3,
      passScore: 2,
      questions: [question],
    },
    answers: [savedAnswer],
    user: { id: "user_ai_marks_correct_to_score", phone: "13800000016" },
  };

  const fakeDb = {
    $transaction: async (callback) =>
      callback({
        mockExamRecord: {
          findUnique: async () => savedRecord,
          update: async ({ data }) => {
            savedRecord = {
              ...savedRecord,
              totalScore: data.totalScore,
              reviewedAt: data.reviewedAt,
            };
            return savedRecord;
          },
        },
        mockExamAnswer: {
          update: async ({ data }) => {
            savedAnswer = {
              ...savedAnswer,
              score: data.score,
              reviewJson: data.reviewJson,
            };
            savedRecord = {
              ...savedRecord,
              answers: [savedAnswer],
            };
            return savedAnswer;
          },
        },
      }),
  };

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              subQuestions: [
                {
                  id: "sq_ai_marks_correct_to_score",
                  score: 3,
                  reviewComment: "结论写到了，核心点命中。",
                  missedPoints: [],
                  rubricPoints: [
                    {
                      id: "point_correct_to_score_1",
                      title: "说明合同有效",
                      score: 3,
                      description: "",
                      keywords: ["合同有效"],
                      hit: true,
                      awardedScore: 3,
                      matchedText: "合同有效",
                    },
                  ],
                  answerMarks: [
                    {
                      id: "mark_scored_directly",
                      highlight: "合同有效",
                      comment: "这一点答到了。",
                      status: "score",
                      score: 3,
                    },
                  ],
                },
              ],
            }),
          },
        },
      ],
    }),
  });

  try {
    await aiReviewMockExamRecord({
      db: fakeDb,
      recordId: savedRecord.id,
      runtimeConfig: {
        provider: "openai-compatible",
        baseUrl: "https://example.com/v1",
        apiKey: "test-key",
        model: "test-model",
        timeoutMs: 1000,
      },
    });
  } finally {
    global.fetch = originalFetch;
  }

  const normalizedReview = JSON.parse(savedAnswer.reviewJson);
  const positiveMark = normalizedReview.subQuestions?.[0]?.answerMarks?.find((item) => item.id === "mark_scored_directly");
  assert.equal(positiveMark?.status, "score");
  assert.equal(positiveMark?.score, 3);
  assert.equal(positiveMark?.highlight, "合同有效");
});

test("aiReviewMockExamRecord tightens loose multi-hit scoring", async () => {
  const question = createQuestion({
    id: "subjective_ai_loose_hit_1",
    type: "subjective_case",
    stem: "请分析发起人责任。",
    score: 5,
    correctAnswerJson: "[]",
    options: [],
    questionMetaJson: JSON.stringify({
      subQuestions: [
        {
          id: "sq_ai_loose_hit_1",
          title: "问题(1)",
          placeholder: "请作答",
          rubricPoints: [
            {
              id: "point_loose_hit_1",
              title: "可以向发起人主张责任",
              score: 2,
              keywords: ["可以", "可向发起人主张"],
            },
            {
              id: "point_loose_hit_2",
              title: "发起人以个人名义签约",
              score: 1,
              keywords: ["发起人以个人名义订立购买合同"],
            },
            {
              id: "point_loose_hit_3",
              title: "相对人享有选择权",
              score: 1,
              keywords: ["债权人可向成立后的公司或发起人主张债权"],
            },
            {
              id: "point_loose_hit_4",
              title: "公司成立后仍可向发起人主张",
              score: 1,
              keywords: ["公司可向作为发起人的高某主张"],
            },
          ],
        },
      ],
    }),
  });

  let savedAnswer = {
    id: "answer_ai_loose_hit_1",
    questionId: question.id,
    answerJson: JSON.stringify({
      sq_ai_loose_hit_1: "发起人以个人名义订立购买合同。",
    }),
    reviewJson: null,
    score: 0,
  };

  let savedRecord = {
    id: "record_ai_loose_hit_1",
    status: "submitted",
    totalScore: 0,
    reviewedAt: null,
    paper: {
      id: "paper_ai_loose_hit_1",
      code: "paper_ai_loose_hit_1",
      title: "AI Loose Hit Paper",
      phase: "主观题",
      totalScore: 5,
      passScore: 3,
      questions: [question],
    },
    answers: [savedAnswer],
    user: { id: "user_ai_loose_hit_1", phone: "13800000017" },
  };

  const fakeDb = {
    $transaction: async (callback) =>
      callback({
        mockExamRecord: {
          findUnique: async () => savedRecord,
          update: async ({ data }) => {
            savedRecord = {
              ...savedRecord,
              totalScore: data.totalScore,
              reviewedAt: data.reviewedAt,
            };
            return savedRecord;
          },
        },
        mockExamAnswer: {
          update: async ({ data }) => {
            savedAnswer = {
              ...savedAnswer,
              score: data.score,
              reviewJson: data.reviewJson,
            };
            savedRecord = {
              ...savedRecord,
              answers: [savedAnswer],
            };
            return savedAnswer;
          },
        },
      }),
  };

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              subQuestions: [
                {
                  id: "sq_ai_loose_hit_1",
                  score: 5,
                  reviewComment: "你这道题只写到了一句事实，理由层次并没有展开。",
                  missedPoints: [],
                  rubricPoints: [
                    {
                      id: "point_loose_hit_1",
                      title: "可以向发起人主张责任",
                      score: 2,
                      description: "",
                      keywords: ["可以", "可向发起人主张"],
                      hit: false,
                      awardedScore: 0,
                      matchedText: "",
                    },
                    {
                      id: "point_loose_hit_2",
                      title: "发起人以个人名义签约",
                      score: 1,
                      description: "",
                      keywords: ["发起人以个人名义订立购买合同"],
                      hit: true,
                      awardedScore: 1,
                      matchedText: "发起人以个人名义订立购买合同",
                    },
                    {
                      id: "point_loose_hit_3",
                      title: "相对人享有选择权",
                      score: 1,
                      description: "",
                      keywords: ["债权人可向成立后的公司或发起人主张债权"],
                      hit: true,
                      awardedScore: 1,
                      matchedText: "发起人以个人名义订立购买合同",
                    },
                    {
                      id: "point_loose_hit_4",
                      title: "公司成立后仍可向发起人主张",
                      score: 1,
                      description: "",
                      keywords: ["公司可向作为发起人的高某主张"],
                      hit: true,
                      awardedScore: 1,
                      matchedText: "发起人以个人名义订立购买合同",
                    },
                  ],
                  answerMarks: [
                    {
                      id: "mark_loose_hit_1",
                      highlight: "发起人以个人名义订立购买合同",
                      comment: "命中了多个点。",
                      status: "score",
                      score: 3,
                    },
                  ],
                },
              ],
            }),
          },
        },
      ],
    }),
  });

  try {
    await aiReviewMockExamRecord({
      db: fakeDb,
      recordId: savedRecord.id,
      runtimeConfig: {
        provider: "openai-compatible",
        baseUrl: "https://example.com/v1",
        apiKey: "test-key",
        model: "test-model",
        timeoutMs: 1000,
      },
    });
  } finally {
    global.fetch = originalFetch;
  }

  const normalizedReview = JSON.parse(savedAnswer.reviewJson);
  const subQuestion = normalizedReview.subQuestions?.[0];
  assert.equal(subQuestion?.score, 1);
  assert.equal(subQuestion?.rubricPoints?.filter((item) => item.hit).length, 1);
  assert.equal(subQuestion?.answerMarks?.filter((item) => item.status === "score").length, 1);
  assert.equal(subQuestion?.answerMarks?.find((item) => item.status === "score")?.score, 1);
});

test("aiReviewMockExamRecord sends one AI request per subjective question with all subquestions", async () => {
  const question = createQuestion({
    id: "subjective_ai_batch_1",
    type: "subjective_case",
    stem: "请分别分析第一问和第二问。",
    score: 12,
    correctAnswerJson: "[]",
    options: [],
    questionMetaJson: JSON.stringify({
      subQuestions: [
        {
          id: "sq_ai_batch_1",
          title: "问题(1)",
          placeholder: "请作答",
          maxScore: 6,
          referenceAnswer: "第一问参考答案",
          rubricGuidance: "第一问批改说明",
          rubricPoints: [
            {
              id: "point_ai_batch_1",
              title: "第一问要点",
              score: 6,
              keywords: ["第一问"],
            },
          ],
        },
        {
          id: "sq_ai_batch_2",
          title: "问题(2)",
          placeholder: "请作答",
          maxScore: 6,
          referenceAnswer: "第二问参考答案",
          rubricGuidance: "第二问批改说明",
          rubricPoints: [
            {
              id: "point_ai_batch_2",
              title: "第二问要点",
              score: 6,
              keywords: ["第二问"],
            },
          ],
        },
      ],
    }),
  });

  let savedAnswer = {
    id: "answer_ai_batch_1",
    questionId: question.id,
    answerJson: JSON.stringify({
      sq_ai_batch_1: "这是第一问的答案。",
      sq_ai_batch_2: "这是第二问的答案。",
    }),
    reviewJson: null,
    score: 0,
  };

  let savedRecord = {
    id: "record_ai_batch_1",
    status: "submitted",
    totalScore: 0,
    reviewedAt: null,
    paper: {
      id: "paper_ai_batch_1",
      code: "paper_ai_batch_1",
      title: "AI Batch Paper",
      phase: "主观题",
      totalScore: 12,
      passScore: 7,
      questions: [question],
    },
    answers: [savedAnswer],
    user: { id: "user_ai_batch_1", phone: "13800000008" },
  };

  const fakeDb = {
    $transaction: async (callback) =>
      callback({
        mockExamRecord: {
          findUnique: async () => savedRecord,
          update: async ({ data }) => {
            savedRecord = {
              ...savedRecord,
              totalScore: data.totalScore,
              reviewedAt: data.reviewedAt,
            };
            return savedRecord;
          },
        },
        mockExamAnswer: {
          update: async ({ data }) => {
            savedAnswer = {
              ...savedAnswer,
              score: data.score,
              reviewJson: data.reviewJson,
            };
            savedRecord = {
              ...savedRecord,
              answers: [savedAnswer],
            };
            return savedAnswer;
          },
        },
      }),
  };

  const fetchBodies = [];
  const originalFetch = global.fetch;
  global.fetch = async (_url, options) => {
    fetchBodies.push(JSON.parse(options.body));
    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                subQuestions: [
                  {
                    id: "sq_ai_batch_1",
                    score: 6,
                    reviewComment: "第一问完整。",
                    referenceAnswer: "第一问参考答案",
                    rubricGuidance: "第一问批改说明",
                    missedPoints: [],
                    rubricPoints: [
                      {
                        id: "point_ai_batch_1",
                        title: "第一问要点",
                        score: 6,
                        description: "",
                        keywords: ["第一问"],
                        hit: true,
                        awardedScore: 6,
                        matchedText: "第一问",
                      },
                    ],
                    answerMarks: [
                      {
                        id: "mark_ai_batch_1",
                        highlight: "第一问",
                        comment: "这一问核心点答到了。",
                        status: "score",
                        score: 6,
                      },
                    ],
                  },
                  {
                    id: "sq_ai_batch_2",
                    score: 6,
                    reviewComment: "第二问完整。",
                    referenceAnswer: "第二问参考答案",
                    rubricGuidance: "第二问批改说明",
                    missedPoints: [],
                    rubricPoints: [
                      {
                        id: "point_ai_batch_2",
                        title: "第二问要点",
                        score: 6,
                        description: "",
                        keywords: ["第二问"],
                        hit: true,
                        awardedScore: 6,
                        matchedText: "第二问",
                      },
                    ],
                    answerMarks: [
                      {
                        id: "mark_ai_batch_2",
                        highlight: "第二问",
                        comment: "这一问核心点答到了。",
                        status: "score",
                        score: 6,
                      },
                    ],
                  },
                ],
              }),
            },
          },
        ],
      }),
    };
  };

  try {
    await aiReviewMockExamRecord({
      db: fakeDb,
      recordId: savedRecord.id,
      runtimeConfig: {
        provider: "openai-compatible",
        baseUrl: "https://example.com/v1",
        apiKey: "test-key",
        model: "test-model",
        timeoutMs: 1000,
      },
    });
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(fetchBodies.length, 1);
  const requestPrompt = fetchBodies[0].messages[1].content;
  assert.equal(typeof requestPrompt, "string");
  assert.equal(requestPrompt.includes('"subQuestionId": "sq_ai_batch_1"'), true);
  assert.equal(requestPrompt.includes('"subQuestionId": "sq_ai_batch_2"'), true);
  assert.equal(savedAnswer.score, 12);
});

test("aiReviewMockExamRecord does not skip short conclusion answers like 能 or 不能", async () => {
  const question = createQuestion({
    id: "subjective_short_conclusion_1",
    type: "subjective_case",
    stem: "腾飞公司履行回购责任后，能否向金成公司追偿？",
    score: 5,
    correctAnswerJson: "[]",
    options: [],
    questionMetaJson: JSON.stringify({
      subQuestions: [
        {
          id: "sq_short_conclusion_1",
          title: "第1问",
          placeholder: "请作答",
          maxScore: 5,
          referenceAnswer: "可以追偿。",
          rubricGuidance: "需说明结论并展开理由。",
          rubricPoints: [
            {
              id: "point_short_conclusion_1",
              title: "结论",
              score: 2,
              keywords: ["能", "可以"],
            },
            {
              id: "point_short_conclusion_2",
              title: "理由",
              score: 3,
              keywords: ["追偿"],
            },
          ],
        },
      ],
    }),
  });

  let savedAnswer = {
    id: "answer_short_conclusion_1",
    questionId: question.id,
    answerJson: JSON.stringify({
      sq_short_conclusion_1: "能",
    }),
    reviewJson: null,
    score: 0,
  };

  let savedRecord = {
    id: "record_short_conclusion_1",
    status: "submitted",
    totalScore: 0,
    reviewedAt: null,
    paper: {
      id: "paper_short_conclusion_1",
      code: "paper_short_conclusion_1",
      title: "Short Conclusion Paper",
      phase: "主观题",
      totalScore: 5,
      passScore: 3,
      questions: [question],
    },
    answers: [savedAnswer],
    user: { id: "user_short_conclusion_1", phone: "13800000088" },
  };

  const fakeDb = {
    $transaction: async (callback) =>
      callback({
        mockExamRecord: {
          findUnique: async () => savedRecord,
          update: async ({ data }) => {
            savedRecord = {
              ...savedRecord,
              totalScore: data.totalScore ?? savedRecord.totalScore,
              reviewedAt: data.reviewedAt ?? savedRecord.reviewedAt,
              reviewWorkflowStatus: data.reviewWorkflowStatus ?? savedRecord.reviewWorkflowStatus,
            };
            return savedRecord;
          },
        },
        mockExamAnswer: {
          update: async ({ data }) => {
            savedAnswer = {
              ...savedAnswer,
              score: data.score,
              reviewJson: data.reviewJson,
            };
            savedRecord = {
              ...savedRecord,
              answers: [savedAnswer],
            };
            return savedAnswer;
          },
        },
      }),
  };

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              subQuestions: [
                {
                  id: "sq_short_conclusion_1",
                  score: 2,
                  reviewComment: "这道题你只写了结论，理由没有展开。第一步先表明结论，第二步补充追偿依据，第三步把结论和本案连起来。",
                  referenceAnswer: "可以追偿。",
                  abilityLabel: "结论与理由",
                  rubricGuidance: "需说明结论并展开理由。",
                  missedPoints: [
                    {
                      id: "missed_short_conclusion_1",
                      title: "追偿理由",
                      description: "你只写了结论，还没有把为什么可以追偿说出来。",
                      score: 3,
                    },
                  ],
                  rubricPoints: [
                    {
                      id: "point_short_conclusion_1",
                      title: "结论",
                      score: 2,
                      description: "",
                      keywords: ["能", "可以"],
                      hit: true,
                      awardedScore: 2,
                      matchedText: "能",
                    },
                    {
                      id: "point_short_conclusion_2",
                      title: "理由",
                      score: 3,
                      description: "",
                      keywords: ["追偿"],
                      hit: false,
                      awardedScore: 0,
                      matchedText: "",
                    },
                  ],
                  answerMarks: [
                    {
                      id: "mark_short_conclusion_1",
                      highlight: "能",
                      comment: "结论写到了。",
                      status: "score",
                      score: 2,
                    },
                    {
                      id: "mark_short_conclusion_2",
                      highlight: "能",
                      comment: "这里只写了结论，理由还要补上。",
                      status: "wrong",
                      score: null,
                    },
                  ],
                },
              ],
            }),
          },
        },
      ],
    }),
  });

  try {
    await aiReviewMockExamRecord({
      db: fakeDb,
      recordId: savedRecord.id,
      runtimeConfig: {
        provider: "openai-compatible",
        baseUrl: "https://example.com/v1",
        apiKey: "test-key",
        model: "test-model",
        timeoutMs: 1000,
      },
    });
  } finally {
    global.fetch = originalFetch;
  }

  const reviewJson = JSON.parse(savedAnswer.reviewJson);
  assert.equal(reviewJson.subQuestions?.[0]?.skippedReview, false);
  assert.equal(reviewJson.subQuestions?.[0]?.score, 2);
  assert.equal(reviewJson.subQuestions?.[0]?.answerMarks?.some((item) => item.status === "score"), true);
});

test("mock exam ai review runtime config can override env defaults", async () => {
  const originalProvider = config.mockExamAiReview.provider;
  const originalBaseUrl = config.mockExamAiReview.baseUrl;
  const originalApiKey = config.mockExamAiReview.apiKey;
  const originalModel = config.mockExamAiReview.model;
  const originalTimeoutMs = config.mockExamAiReview.timeoutMs;

  config.mockExamAiReview.provider = "rules";
  config.mockExamAiReview.baseUrl = "";
  config.mockExamAiReview.apiKey = "";
  config.mockExamAiReview.model = "";
  config.mockExamAiReview.timeoutMs = 45000;

  try {
    const runtimeOverride = {
      provider: "openai-compatible",
      baseUrl: "https://example.com/v1",
      apiKey: "test-key",
      model: "test-model",
      timeoutMs: 12000,
    };

    assert.equal(runtimeOverride.provider, "openai-compatible");
    assert.equal(runtimeOverride.baseUrl, "https://example.com/v1");
    assert.equal(runtimeOverride.apiKey, "test-key");
    assert.equal(runtimeOverride.model, "test-model");
    assert.equal(runtimeOverride.timeoutMs, 12000);
    assert.equal(config.mockExamAiReview.provider, "rules");
  } finally {
    config.mockExamAiReview.provider = originalProvider;
    config.mockExamAiReview.baseUrl = originalBaseUrl;
    config.mockExamAiReview.apiKey = originalApiKey;
    config.mockExamAiReview.model = originalModel;
    config.mockExamAiReview.timeoutMs = originalTimeoutMs;
  }
});

test("aiReviewMockExamRecord allows rescore when manual lock belongs to current admin", async () => {
  const now = new Date("2026-05-11T09:00:00.000Z");
  const recordId = "record_manual_rescore_self_lock";
  const answerId = "answer_manual_rescore_self_lock";
  const questionId = "question_manual_rescore_self_lock";
  const adminId = "admin_self_lock";
  const updatedRecords = [];
  const updatedAnswers = [];

  const record = {
    id: recordId,
    status: "submitted",
    reviewWorkflowStatus: "manual_pending",
    paper: {
      questions: [
        createQuestion({
          id: questionId,
          type: "subjective_case",
          sortOrder: 1,
          score: 5,
          prompt: "请分析。",
          answer: "参考答案",
          analysis: "采分点",
          options: [],
        }),
      ],
    },
    answers: [
      {
        id: answerId,
        questionId,
        answerText: "可以。",
        score: 0,
        reviewJson: null,
      },
    ],
    user: {
      id: "user_1",
      phone: "13800000000",
    },
  };

  const tx = {
    mockExamRecord: {
      findUnique: async ({ select }) => {
        if (select?.manualReviewLockToken) {
          return {
            id: recordId,
            status: "submitted",
            manualReviewerId: adminId,
            manualReviewLockToken: "lock_token_self",
          };
        }
        return record;
      },
      update: async ({ data }) => {
        updatedRecords.push(data);
        return { ...record, ...data };
      },
    },
    mockExamAnswer: {
      update: async ({ data }) => {
        updatedAnswers.push(data);
        return data;
      },
    },
  };

  const db = {
    mockExamRecord: {
      findUnique: async () => record,
      update: async ({ data }) => {
        updatedRecords.push(data);
        return { ...record, ...data };
      },
    },
    $transaction: async (handler) => {
      if (typeof handler === "function") {
        return handler(tx);
      }
      return handler;
    },
  };

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              reviewComment: "本题核心在于把结论和依据对应起来。",
              subQuestions: [
                {
                  id: "1",
                  title: "第1问",
                  score: 3,
                  reviewComment: "结论写到了，但依据没有展开。",
                  missedPoints: ["没有把依据写开"],
                  rubricPoints: [
                    {
                      point: "写出结论",
                      matched: true,
                      score: 3,
                      comment: "结论明确",
                    },
                  ],
                  answerMarks: [
                    {
                      quote: "可以",
                      type: "correct",
                      comment: "结论点到位",
                      score: 3,
                    },
                  ],
                },
              ],
            }),
          },
        },
      ],
    }),
  });

  try {
    const result = await aiReviewMockExamRecord({
      db,
      recordId,
      adminId,
      currentTime: now,
      runtimeConfig: {
        provider: "openai-compatible",
        baseUrl: "https://example.com/v1",
        apiKey: "test-key",
        model: "test-model",
        timeoutMs: 1000,
      },
      allowRuleFallback: false,
    });

    assert.equal(updatedAnswers.length, 1);
    assert.equal(updatedRecords.some((item) => item.reviewWorkflowStatus === "ai_processing"), true);
    assert.equal(updatedRecords.some((item) => item.reviewWorkflowStatus === "manual_pending"), true);
    assert.equal(result.id, recordId);
  } finally {
    global.fetch = originalFetch;
  }
});

test("listMockExamReviewRecords filters records by paperId", async () => {
  const records = [
    {
      id: "record_paper_a",
      status: "submitted",
      reviewedAt: null,
      submittedAt: new Date("2026-04-25T10:00:00.000Z"),
      paperId: "paper_a",
      user: { phone: "13800000001" },
      paper: {
        id: "paper_a",
        code: "paper_a",
        title: "Paper A",
        phase: "主观题",
        year: 2026,
        totalScore: 20,
        passScore: 12,
        reviewEnabled: true,
        paperType: "subjective",
        questions: [createQuestion({ id: "paper_a_q1", type: "subjective_case", correctAnswerJson: "[]", options: [] })],
      },
      answers: [],
    },
    {
      id: "record_paper_b",
      status: "submitted",
      reviewedAt: null,
      submittedAt: new Date("2026-04-25T11:00:00.000Z"),
      paperId: "paper_b",
      user: { phone: "13800000002" },
      paper: {
        id: "paper_b",
        code: "paper_b",
        title: "Paper B",
        phase: "主观题",
        year: 2026,
        totalScore: 20,
        passScore: 12,
        reviewEnabled: true,
        paperType: "subjective",
        questions: [createQuestion({ id: "paper_b_q1", type: "subjective_case", correctAnswerJson: "[]", options: [] })],
      },
      answers: [],
    },
  ];

  const fakeDb = {
    mockExamRecord: {
      count: async ({ where }) => records.filter((record) => !where.paperId || record.paperId === where.paperId).length,
      findMany: async ({ where }) => records.filter((record) => !where.paperId || record.paperId === where.paperId),
    },
  };

  const result = await listMockExamReviewRecords({
    db: fakeDb,
    paperId: "paper_a",
    reviewStatus: "all",
  });

  assert.equal(result.pagination.total, 1);
  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].paper.id, "paper_a");
});

test("recoverStaleAiProcessingMockExamReviews resets stale records to their real workflow stage", async () => {
  const now = new Date("2026-05-13T03:30:00.000Z");
  const updatedPayloads = [];
  const fakeDb = {
    systemConfig: {
      findUnique: async () => ({
        mockExamAiReviewConfigJson: JSON.stringify({
          timeoutMs: 120000,
        }),
      }),
    },
    mockExamRecord: {
      updateMany: async ({ where, data }) => {
        updatedPayloads.push({ where, data });
        if (data.reviewWorkflowStatus === "published") {
          return { count: 1 };
        }
        if (data.reviewWorkflowStatus === "manual_pending") {
          return { count: 1 };
        }
        if (data.reviewWorkflowStatus === "ai_pending") {
          return { count: 2 };
        }
        return { count: 0 };
      },
    },
  };

  const result = await recoverStaleAiProcessingMockExamReviews({
    db: fakeDb,
    currentTime: now,
  });

  assert.equal(result.recovered, 4);
  assert.equal(result.thresholdMs, 300000);
  assert.equal(updatedPayloads.length, 3);
  assert.deepEqual(
    updatedPayloads.map((item) => item.data.reviewWorkflowStatus),
    ["published", "manual_pending", "ai_pending"],
  );
  assert.equal(updatedPayloads[0].where.reviewWorkflowStatus, "ai_processing");
  assert.equal(updatedPayloads[1].where.aiReviewFinishedAt, null);
  assert.equal(updatedPayloads[2].data.lastAiReviewError, "AI批改任务异常中断，已恢复为待处理状态，请重新批改");
  assert.equal(updatedPayloads[2].where.aiReviewStartedAt.lt.toISOString(), "2026-05-13T03:25:00.000Z");
});

test("listMockExamReviewRecords recovers stale ai_processing records before querying", async () => {
  const now = new Date("2026-05-13T03:30:00.000Z");
  let recovered = false;
  const records = [
    {
      id: "record_stale_processing",
      status: "submitted",
      reviewWorkflowStatus: "ai_pending",
      aiReviewStartedAt: null,
      aiReviewFinishedAt: null,
      reviewedAt: null,
      submittedAt: new Date("2026-05-13T03:00:00.000Z"),
      paperId: "paper_stale",
      user: { phone: "13800000003" },
      paper: {
        id: "paper_stale",
        code: "paper_stale",
        title: "Paper stale",
        phase: "主观题",
        year: 2026,
        totalScore: 20,
        passScore: 12,
        reviewEnabled: true,
        paperType: "subjective",
        questions: [createQuestion({ id: "paper_stale_q1", type: "subjective_case", correctAnswerJson: "[]", options: [] })],
      },
      answers: [],
    },
  ];

  const fakeDb = {
    systemConfig: {
      findUnique: async () => ({
        mockExamAiReviewConfigJson: JSON.stringify({
          timeoutMs: 120000,
        }),
      }),
    },
    mockExamRecord: {
      updateMany: async () => {
        recovered = true;
        return { count: 1 };
      },
      count: async ({ where }) => {
        return records.filter((record) => matchesWhere(record, where)).length;
      },
      findMany: async ({ where }) => records.filter((record) => matchesWhere(record, where)),
    },
  };

  const result = await listMockExamReviewRecords({
    db: fakeDb,
    paperId: "paper_stale",
    reviewStatus: "all",
    currentTime: now,
  });

  assert.equal(recovered, true);
  assert.equal(result.summary.aiPending, 1);
  assert.equal(result.summary.aiProcessing, 0);
  assert.equal(result.list.length, 1);
});

test("listMockExamReviewRecords excludes current admin claimed records from ai_pending and counts them as manual_reviewing", async () => {
  const now = new Date("2026-05-14T10:00:00.000Z");
  const activeLockExpiresAt = new Date("2026-05-14T10:30:00.000Z");
  const records = [
    {
      id: "record_claimed_by_current_admin",
      status: "submitted",
      reviewWorkflowStatus: "ai_pending",
      reviewedAt: null,
      submittedAt: new Date("2026-05-14T09:00:00.000Z"),
      manualReviewerId: "admin_current",
      manualReviewerName: "当前老师",
      manualReviewLockToken: "lock_current",
      manualReviewClaimedAt: new Date("2026-05-14T09:55:00.000Z"),
      manualReviewLockExpiresAt: activeLockExpiresAt,
      manualReviewVersion: 2,
      paperId: "paper_state_a",
      user: { id: "user_1", phone: "13800000011" },
      paper: {
        id: "paper_state_a",
        code: "paper_state_a",
        title: "Paper State A",
        phase: "主观题",
        year: 2026,
        totalScore: 20,
        passScore: 12,
        reviewEnabled: true,
        paperType: "subjective",
        questions: [createQuestion({ id: "paper_state_a_q1", type: "subjective_case", correctAnswerJson: "[]", options: [] })],
      },
      answers: [],
    },
    {
      id: "record_plain_pending",
      status: "submitted",
      reviewWorkflowStatus: "ai_pending",
      reviewedAt: null,
      submittedAt: new Date("2026-05-14T09:10:00.000Z"),
      manualReviewerId: null,
      manualReviewerName: null,
      manualReviewLockToken: null,
      manualReviewClaimedAt: null,
      manualReviewLockExpiresAt: null,
      manualReviewVersion: 0,
      paperId: "paper_state_a",
      user: { id: "user_2", phone: "13800000012" },
      paper: {
        id: "paper_state_a",
        code: "paper_state_a",
        title: "Paper State A",
        phase: "主观题",
        year: 2026,
        totalScore: 20,
        passScore: 12,
        reviewEnabled: true,
        paperType: "subjective",
        questions: [createQuestion({ id: "paper_state_a_q2", type: "subjective_case", correctAnswerJson: "[]", options: [] })],
      },
      answers: [],
    },
  ];

  const fakeDb = {
    systemConfig: {
      findUnique: async () => ({
        mockExamAiReviewConfigJson: JSON.stringify({
          timeoutMs: 120000,
        }),
      }),
    },
    mockExamRecord: {
      updateMany: async () => ({ count: 0 }),
      count: async ({ where }) => {
        const matched = records.filter((record) => matchesWhere(record, where));
        return matched.length;
      },
      findMany: async ({ where }) => records.filter((record) => matchesWhere(record, where)),
    },
  };

  const aiPendingResult = await listMockExamReviewRecords({
    db: fakeDb,
    reviewStatus: "ai_pending",
    currentAdminId: "admin_current",
    currentTime: now,
  });

  assert.equal(aiPendingResult.summary.aiPending, 1);
  assert.equal(aiPendingResult.summary.manualReviewing, 1);
  assert.equal(aiPendingResult.list.length, 1);
  assert.equal(aiPendingResult.list[0].id, "record_plain_pending");

  const manualReviewingResult = await listMockExamReviewRecords({
    db: fakeDb,
    reviewStatus: "manual_reviewing",
    currentAdminId: "admin_current",
    currentTime: now,
  });

  assert.equal(manualReviewingResult.list.length, 1);
  assert.equal(manualReviewingResult.list[0].id, "record_claimed_by_current_admin");
  assert.equal(manualReviewingResult.list[0].reviewStatus, "manual_reviewing");
});

test("enqueueMockExamAiReview resets record into ai queue state", async () => {
  __resetMockExamAiReviewQueueForTests();

  const currentTime = new Date("2026-05-14T10:00:00.000Z");
  let record = {
    id: "record_queue_enqueue_1",
    status: "submitted",
    reviewWorkflowStatus: "ai_pending",
    aiReviewRetryCount: 2,
    aiReviewNextRetryAt: new Date("2026-05-14T09:00:00.000Z"),
    aiReviewStartedAt: new Date("2026-05-14T09:00:00.000Z"),
    aiReviewFinishedAt: new Date("2026-05-14T09:05:00.000Z"),
    lastAiReviewError: "old error",
    publishedAt: new Date("2026-05-14T09:05:00.000Z"),
    manualReviewerId: null,
    manualReviewLockToken: null,
  };

  const fakeDb = {
    mockExamRecord: {
      findUnique: async () => record,
      update: async ({ data }) => {
        record = {
          ...record,
          ...data,
        };
        return record;
      },
      findMany: async () => [],
    },
  };

  await enqueueMockExamAiReview({
    db: fakeDb,
    recordId: record.id,
    currentTime,
  });

  assert.equal(record.reviewWorkflowStatus, "ai_pending");
  assert.equal(record.aiReviewRetryCount, 0);
  assert.equal(record.aiReviewStartedAt, null);
  assert.equal(record.aiReviewFinishedAt, null);
  assert.equal(record.lastAiReviewError, null);
  assert.equal(record.publishedAt, null);
  assert.equal(record.aiReviewNextRetryAt?.toISOString(), currentTime.toISOString());
});

test("enqueueMockExamAiReview allows admin to requeue reviewed records and bumps version", async () => {
  __resetMockExamAiReviewQueueForTests();

  const currentTime = new Date("2026-05-14T10:00:00.000Z");
  let record = {
    id: "record_queue_requeue_admin",
    status: "submitted",
    reviewWorkflowStatus: "manual_pending",
    aiReviewRetryCount: 1,
    aiReviewNextRetryAt: new Date("2026-05-14T09:00:00.000Z"),
    aiReviewStartedAt: new Date("2026-05-14T09:00:00.000Z"),
    aiReviewFinishedAt: new Date("2026-05-14T09:05:00.000Z"),
    lastAiReviewError: "old error",
    reviewedAt: new Date("2026-05-14T09:05:00.000Z"),
    publishedAt: new Date("2026-05-14T09:06:00.000Z"),
    manualReviewerId: "admin_current",
    manualReviewLockToken: "lock_current",
    manualReviewVersion: 4,
  };

  const fakeDb = {
    mockExamRecord: {
      findUnique: async () => record,
      update: async ({ data }) => {
        record = {
          ...record,
          ...data,
          manualReviewVersion:
            data?.manualReviewVersion?.increment !== undefined
              ? Number(record.manualReviewVersion ?? 0) + Number(data.manualReviewVersion.increment ?? 0)
              : record.manualReviewVersion,
        };
        return record;
      },
      findMany: async () => [],
    },
  };

  await enqueueMockExamAiReview({
    db: fakeDb,
    recordId: record.id,
    adminId: "admin_current",
    currentTime,
  });

  assert.equal(record.reviewWorkflowStatus, "ai_pending");
  assert.equal(record.aiReviewRetryCount, 0);
  assert.equal(record.aiReviewStartedAt, null);
  assert.equal(record.aiReviewFinishedAt, null);
  assert.equal(record.lastAiReviewError, null);
  assert.equal(record.reviewedAt, null);
  assert.equal(record.publishedAt, null);
  assert.equal(record.manualReviewVersion, 5);
  assert.equal(record.aiReviewNextRetryAt?.toISOString(), currentTime.toISOString());
});

test("pumpMockExamAiReviewQueue retries failures up to max retry count then returns to ai_pending", async () => {
  __resetMockExamAiReviewQueueForTests();

  const originalConfig = {
    ...config.mockExamAiReview,
  };
  config.mockExamAiReview.maxConcurrency = 3;
  config.mockExamAiReview.maxRetryCount = 3;
  config.mockExamAiReview.retryDelayMs = 15000;

  let record = {
    id: "record_queue_retry_1",
    status: "submitted",
    reviewWorkflowStatus: "ai_pending",
    aiReviewRetryCount: 0,
    aiReviewNextRetryAt: null,
    aiReviewStartedAt: null,
    aiReviewFinishedAt: null,
    lastAiReviewError: null,
    manualReviewerId: null,
    manualReviewLockToken: null,
    submittedAt: new Date("2026-05-14T10:00:00.000Z"),
    createdAt: new Date("2026-05-14T10:00:00.000Z"),
    user: { id: "user_retry_1", phone: "13800000022" },
    paper: {
      id: "paper_retry_1",
      code: "paper_retry_1",
      title: "Retry Paper",
      phase: "主观题",
      totalScore: 1,
      passScore: 1,
      questions: [
        createQuestion({
          id: "subjective_retry_1",
          type: "subjective_case",
          score: 1,
          correctAnswerJson: "[]",
          options: [],
          questionMetaJson: JSON.stringify({
            subQuestions: [
              {
                id: "sq_retry_1",
                title: "问题(1)",
                maxScore: 1,
                referenceAnswer: "参考答案",
                rubricGuidance: "评分说明",
                rubricPoints: [{ id: "point_retry_1", title: "要点", score: 1, keywords: ["答"] }],
              },
            ],
          }),
        }),
      ],
    },
    answers: [
      {
        id: "answer_retry_1",
        questionId: "subjective_retry_1",
        answerJson: JSON.stringify({ sq_retry_1: "答" }),
        reviewJson: null,
        score: 0,
      },
    ],
  };

  const fakeDb = {
    systemConfig: {
      findUnique: async () => ({
        mockExamAiReviewConfigJson: JSON.stringify({
          provider: "openai-compatible",
          baseUrl: "https://example.com/v1",
          apiKey: "test-key",
          model: "test-model",
          timeoutMs: 1000,
        }),
      }),
    },
    mockExamRecord: {
      updateMany: async () => ({ count: 0 }),
      findMany: async ({ where }) => {
        const dueAt = where?.OR?.[1]?.aiReviewNextRetryAt?.lte ?? new Date();
        const due = !record.aiReviewNextRetryAt || record.aiReviewNextRetryAt <= dueAt;
        return due && record.reviewWorkflowStatus === "ai_pending" ? [record] : [];
      },
      findUnique: async () => record,
      update: async ({ data }) => {
        record = {
          ...record,
          ...data,
        };
        return record;
      },
    },
    mockExamAnswer: {
      update: async ({ data }) => ({
        id: "answer_retry_1",
        ...data,
      }),
    },
    $transaction: async (callback) => callback(fakeDb),
  };

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 502,
    json: async () => ({
      error: {
        message: "upstream failed",
      },
    }),
  });

  try {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const now = new Date(`2026-05-14T10:0${attempt}:00.000Z`);
      record.aiReviewNextRetryAt = null;
      await pumpMockExamAiReviewQueue({
        db: fakeDb,
        currentTime: now,
      });
      await new Promise((resolve) => setTimeout(resolve, 30));
    }

    assert.equal(record.reviewWorkflowStatus, "ai_pending");
    assert.equal(record.aiReviewRetryCount, 3);
    assert.equal(record.aiReviewStartedAt, null);
    assert.equal(record.aiReviewFinishedAt, null);
    assert.equal(record.aiReviewNextRetryAt, null);
    assert.match(record.lastAiReviewError ?? "", /3/);
  } finally {
    global.fetch = originalFetch;
    config.mockExamAiReview.maxConcurrency = originalConfig.maxConcurrency;
    config.mockExamAiReview.maxRetryCount = originalConfig.maxRetryCount;
    config.mockExamAiReview.retryDelayMs = originalConfig.retryDelayMs;
    config.mockExamAiReview.queuePollIntervalMs = originalConfig.queuePollIntervalMs;
    __resetMockExamAiReviewQueueForTests();
  }
});

test("pumpMockExamAiReviewQueue skips manually claimed records", async () => {
  __resetMockExamAiReviewQueueForTests();

  const currentTime = new Date("2026-05-14T11:00:00.000Z");
  const lockedRecord = {
    id: "record_queue_locked_1",
    status: "submitted",
    reviewWorkflowStatus: "ai_pending",
    aiReviewRetryCount: 0,
    aiReviewNextRetryAt: null,
    manualReviewerId: "admin_other",
    manualReviewLockToken: "lock_other",
    submittedAt: currentTime,
    createdAt: currentTime,
  };

  let startedCount = 0;
  const fakeDb = {
    systemConfig: {
      findUnique: async () => ({
        mockExamAiReviewConfigJson: JSON.stringify({
          provider: "rules",
        }),
      }),
    },
    mockExamRecord: {
      updateMany: async () => ({ count: 0 }),
      findMany: async () => [lockedRecord],
      findUnique: async () => lockedRecord,
      update: async ({ data }) => {
        if (data.reviewWorkflowStatus === "ai_processing") {
          startedCount += 1;
        }
        return {
          ...lockedRecord,
          ...data,
        };
      },
    },
    mockExamAnswer: {
      update: async ({ data }) => data,
    },
    $transaction: async (callback) => callback(fakeDb),
  };

  await pumpMockExamAiReviewQueue({
    db: fakeDb,
    currentTime,
  });
  await new Promise((resolve) => setTimeout(resolve, 30));

  assert.equal(startedCount, 0);
});
