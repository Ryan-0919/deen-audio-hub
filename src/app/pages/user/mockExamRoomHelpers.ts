import { MockExamQuestion, MockExamQuestionAnswerState, MockExamRecordDetail, MockExamSubjectiveSubQuestion } from "../../lib/mockData";

export interface QuestionGroup {
  key: string;
  label: string;
  description: string;
  questions: MockExamQuestion[];
}

export const buildDraftKey = (questionId: string, subQuestionId: string) => `${questionId}:${subQuestionId}`;

export const getInitialQuestionIndex = (questions: MockExamQuestion[]) => {
  const unfinishedIndex = questions.findIndex((question) => question.answerState !== "answered");
  return unfinishedIndex >= 0 ? unfinishedIndex : 0;
};

export const buildSubjectiveDraftMap = (questions: MockExamQuestion[]) =>
  Object.fromEntries(
    questions.flatMap((question) =>
      question.subjectiveSubQuestions.map((subQuestion) => [buildDraftKey(question.id, subQuestion.id), subQuestion.answer]),
    ),
  );

export const isSubjectiveQuestion = (question: MockExamQuestion) => question.type === "subjective_case";

export const buildNextAnswerKeys = (question: MockExamQuestion, optionKey: string) => {
  if (question.type === "single_choice") {
    return [optionKey];
  }

  const selected = new Set(question.userAnswerKeys);
  if (selected.has(optionKey)) {
    selected.delete(optionKey);
  } else {
    selected.add(optionKey);
  }

  return Array.from(selected).sort();
};

export const getDraftAnswer = (questionId: string, subQuestion: MockExamSubjectiveSubQuestion, drafts: Record<string, string>) =>
  drafts[buildDraftKey(questionId, subQuestion.id)] ?? subQuestion.answer ?? "";

export const getQuestionState = (question: MockExamQuestion, drafts: Record<string, string>): MockExamQuestionAnswerState => {
  if (!isSubjectiveQuestion(question)) {
    return question.userAnswerKeys.length > 0 ? "answered" : "unanswered";
  }

  const filledCount = question.subjectiveSubQuestions.filter((subQuestion) => getDraftAnswer(question.id, subQuestion, drafts).trim()).length;

  if (filledCount === 0) {
    return "unanswered";
  }

  if (filledCount >= question.subjectiveSubQuestions.length) {
    return "answered";
  }

  return "partial";
};

export const getAnsweredQuestionCount = (questions: MockExamQuestion[], drafts: Record<string, string>) =>
  questions.filter((question) => getQuestionState(question, drafts) === "answered").length;

export const applyObjectiveAnswerToRecord = (
  record: MockExamRecordDetail,
  questionId: string,
  answerKeys: string[],
  drafts: Record<string, string>,
): MockExamRecordDetail => {
  const nextQuestions = record.questions.map((question) =>
    question.id === questionId
      ? {
          ...question,
          userAnswerKeys: answerKeys,
          answerState: answerKeys.length > 0 ? "answered" : "unanswered",
        }
      : question,
  );

  return {
    ...record,
    answeredCount: getAnsweredQuestionCount(nextQuestions, drafts),
    questions: nextQuestions,
  };
};

export const buildQuestionGroups = (questions: MockExamQuestion[]): QuestionGroup[] => {
  const groups: QuestionGroup[] = [];

  for (const question of questions) {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.label === question.sectionLabel) {
      lastGroup.questions.push(question);
      continue;
    }

    groups.push({
      key: `${question.type}-${question.sectionLabel}-${groups.length}`,
      label: question.sectionLabel,
      description: question.sectionDescription,
      questions: [question],
    });
  }

  return groups;
};

export const getExamPhaseLabel = (record: MockExamRecordDetail) => {
  if (record.paper.phase) {
    return record.paper.phase;
  }

  return record.questions.some((question) => question.type === "subjective_case") ? "主观题" : "客观题";
};

export const buildTicketNo = (phone: string) => {
  const digits = phone.replace(/\D/g, "").slice(-8);
  return digits.padStart(8, "0");
};

export const buildIdCardNo = (phone: string) => {
  const digits = phone.replace(/\D/g, "").slice(-4).padStart(4, "0");
  return `**************${digits}`;
};

export const formatCountdown = (seconds: number) => {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainSeconds = safe % 60;
  return [hours, minutes, remainSeconds].map((item) => String(item).padStart(2, "0")).join(":");
};
