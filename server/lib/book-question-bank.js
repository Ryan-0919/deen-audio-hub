import { questionTypeLabelMap } from "./question-bank-excel.js";
import { formatDateTime } from "./time.js";
import { normalizeDisplayText } from "./text.js";
import { getReadableObjectUrl } from "./upload.js";

export const DEFAULT_BOOK_QUESTION_BANK_USER_PASSWORD = "den2024";

const SUBJECTIVE_QUESTION_TYPE = "subjective_case";

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeText = (value) => `${value ?? ""}`.replace(/\r\n/g, "\n").trim();
const normalizeFileBaseName = (value) =>
  `${value ?? ""}`
    .trim()
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(/\.[^.]+$/, "")
    .replace(/\s+/g, "")
    .toLowerCase() ?? "";

const parseJsonSafely = (value, fallback) => {
  if (!value) return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeStringArray = (value) =>
  Array.from(
    new Set(
      (Array.isArray(value) ? value : `${value ?? ""}`.split(/[\n,，、；;]/))
        .map((item) => `${item ?? ""}`.trim())
        .filter(Boolean),
    ),
  );

const normalizeAnswerKeys = (values = []) =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((item) => `${item ?? ""}`.trim().toUpperCase())
        .filter(Boolean),
    ),
  ).sort();

const hasMeaningfulAnswerValue = (value) => {
  if (Array.isArray(value)) {
    return value.some((item) => hasMeaningfulAnswerValue(item));
  }

  if (value && typeof value === "object") {
    return Object.values(value).some((item) => hasMeaningfulAnswerValue(item));
  }

  return Boolean(normalizeText(value));
};

const toNonNegativeInt = (value, fallback = 0) => {
  const parsed = Number.parseInt(`${value ?? ""}`.trim(), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const toPositiveInt = (value, fallback = 1) => {
  const parsed = Number.parseInt(`${value ?? ""}`.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toBookStatus = (value) => {
  const normalized = `${value ?? ""}`.trim();
  if (normalized === "published" || normalized === "closed") return normalized;
  return "draft";
};

const isBookVisibleForUser = (book) => book?.status === "published" && Boolean(book?.isVisible);
const isSubjectiveQuestionType = (type) => `${type ?? ""}`.trim() === SUBJECTIVE_QUESTION_TYPE;

const normalizeRubricPoints = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((item, index) => ({
      id: `${item?.id ?? `point_${index + 1}`}`.trim(),
      title: normalizeText(item?.title),
      score: Math.max(0, Number.parseInt(`${item?.score ?? ""}`, 10) || 0),
      description: normalizeText(item?.description),
      keywords: normalizeStringArray(item?.keywords),
      sortOrder: Number(item?.sortOrder ?? index + 1),
    }))
    .filter((item) => item.title)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((item, index) => ({
      ...item,
      sortOrder: index + 1,
      id: item.id || `point_${index + 1}`,
    }));

const normalizeSubjectiveSubQuestions = (items = [], stem = "") => {
  const normalized = (Array.isArray(items) ? items : [])
    .map((item, index) => ({
      id: `${item?.id ?? `sub_${index + 1}`}`.trim(),
      title: normalizeText(item?.title),
      placeholder: normalizeText(item?.placeholder) || "请在此输入答案。",
      abilityLabel: normalizeText(item?.abilityLabel),
      referenceAnswer: normalizeText(item?.referenceAnswer),
      rubricGuidance: normalizeText(item?.rubricGuidance),
      rubricPoints: normalizeRubricPoints(item?.rubricPoints),
      sortOrder: Number(item?.sortOrder ?? index + 1),
    }))
    .filter((item) => item.title)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((item, index) => ({
      ...item,
      sortOrder: index + 1,
    }));

  if (normalized.length > 0) {
    return normalized;
  }

  return [
    {
      id: "sub_1",
      title: normalizeText(stem) || "请作答",
      placeholder: "请在此输入答案。",
      abilityLabel: "",
      referenceAnswer: "",
      rubricGuidance: "",
      rubricPoints: [],
      sortOrder: 1,
    },
  ];
};

const normalizeObjectiveOptions = (options = []) =>
  (Array.isArray(options) ? options : [])
    .map((option, index) => ({
      key: `${option?.key ?? option?.optionKey ?? ""}`.trim().toUpperCase(),
      content: normalizeText(option?.content),
      sortOrder: Number(option?.sortOrder ?? index + 1),
    }))
    .filter((option) => option.key && option.content)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((option, index) => ({
      ...option,
      sortOrder: index + 1,
    }));

const parseQuestionMeta = ({ questionType, questionMetaJson, stem }) => {
  const raw = parseJsonSafely(questionMetaJson, {});
  const title = normalizeText(raw?.title);
  const sectionLabel = normalizeText(raw?.sectionLabel) || questionTypeLabelMap[questionType] || "题目";
  const sectionDescription = normalizeText(raw?.sectionDescription);
  const subjectiveSubQuestions = isSubjectiveQuestionType(questionType)
    ? normalizeSubjectiveSubQuestions(raw?.subQuestions, stem)
    : [];

  return {
    title,
    sectionLabel,
    sectionDescription,
    subjectiveSubQuestions,
  };
};

const buildQuestionMetaJson = ({ questionType, title, sectionLabel, sectionDescription, subjectiveSubQuestions, stem }) => {
  const normalizedTitle = normalizeText(title);
  const normalizedSectionLabel = normalizeText(sectionLabel);
  const normalizedSectionDescription = normalizeText(sectionDescription);

  if (isSubjectiveQuestionType(questionType)) {
    return JSON.stringify({
      title: normalizedTitle,
      sectionLabel: normalizedSectionLabel || "主观题",
      sectionDescription: normalizedSectionDescription,
      subQuestions: normalizeSubjectiveSubQuestions(subjectiveSubQuestions, stem),
    });
  }

  return JSON.stringify({
    title: normalizedTitle,
    sectionLabel: normalizedSectionLabel || questionTypeLabelMap[questionType] || "题目",
    sectionDescription: normalizedSectionDescription,
  });
};

const buildDisplayTitle = ({ customTitle, metaTitle, stem, material, sortOrder }) =>
  normalizeText(customTitle) ||
  normalizeText(metaTitle) ||
  normalizeText(stem).split("\n").find(Boolean) ||
  normalizeText(material).split("\n").find(Boolean) ||
  `题目 ${sortOrder}`;

const resolveReadableAudioUrl = ({ objectKey = "", url = "" }) =>
  getReadableObjectUrl({
    objectKey,
    fallbackUrl: url,
  });

const resolveBookItemContent = (item) => {
  const legacy = item?.questionBankItem ?? null;
  const resolvedType = item?.type ?? legacy?.type ?? "single_choice";
  const resolvedStem = normalizeText(item?.stem ?? legacy?.stem ?? "");
  const resolvedMaterial = normalizeText(item?.material ?? legacy?.material ?? "");
  const resolvedAnalysis = normalizeText(item?.analysis ?? legacy?.analysis ?? "");
  const resolvedLessonAudioUrl = normalizeText(item?.lessonAudioUrl ?? legacy?.lessonAudioUrl ?? "");
  const resolvedLessonAudioObjectKey = normalizeText(item?.lessonAudioObjectKey ?? legacy?.lessonAudioObjectKey ?? "");
  const resolvedLessonAudioDurationSeconds =
    Number(item?.lessonAudioDurationSeconds ?? legacy?.lessonAudioDurationSeconds ?? 0) || 0;
  const resolvedScore = Number(item?.score ?? legacy?.score ?? 0) || 0;
  const resolvedCorrectAnswerJson = item?.correctAnswerJson ?? legacy?.correctAnswerJson ?? "[]";
  const resolvedQuestionMetaJson = item?.questionMetaJson ?? legacy?.questionMetaJson ?? null;
  const resolvedOptions =
    Array.isArray(item?.options) && item.options.length > 0
      ? item.options
      : Array.isArray(legacy?.options)
        ? legacy.options
        : [];
  const questionMeta = parseQuestionMeta({
    questionType: resolvedType,
    questionMetaJson: resolvedQuestionMetaJson,
    stem: resolvedStem,
  });

  return {
    sourceQuestionBankItemId: `${item?.questionBankItemId ?? legacy?.id ?? ""}`.trim(),
    folderName: normalizeDisplayText(legacy?.folder?.name ?? ""),
    questionType: resolvedType,
    questionTypeLabel: questionTypeLabelMap[resolvedType] ?? resolvedType,
    stem: normalizeDisplayText(resolvedStem),
    material: normalizeDisplayText(resolvedMaterial),
    analysis: normalizeDisplayText(resolvedAnalysis),
    score: resolvedScore,
    correctAnswerKeys: normalizeAnswerKeys(parseJsonSafely(resolvedCorrectAnswerJson, [])),
    options: resolvedOptions
      .slice()
      .sort((left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0))
      .map((option) => ({
        id: option.id,
        key: `${option.optionKey ?? option.key ?? ""}`.trim().toUpperCase(),
        content: normalizeDisplayText(option.content),
      })),
    sectionLabel: normalizeDisplayText(questionMeta.sectionLabel),
    sectionDescription: normalizeDisplayText(questionMeta.sectionDescription),
    subjectiveSubQuestions: questionMeta.subjectiveSubQuestions.map((subQuestion) => ({
      id: subQuestion.id,
      title: normalizeDisplayText(subQuestion.title),
      placeholder: normalizeDisplayText(subQuestion.placeholder),
      abilityLabel: normalizeDisplayText(subQuestion.abilityLabel),
      referenceAnswer: normalizeDisplayText(subQuestion.referenceAnswer),
      rubricGuidance: normalizeDisplayText(subQuestion.rubricGuidance),
      rubricPoints: (subQuestion.rubricPoints ?? []).map((point) => ({
        id: point.id,
        title: normalizeDisplayText(point.title),
        score: Number(point.score ?? 0) || 0,
        description: normalizeDisplayText(point.description),
        keywords: normalizeStringArray(point.keywords),
      })),
    })),
    questionMetaTitle: normalizeDisplayText(questionMeta.title),
    lessonAudioUrl: resolveReadableAudioUrl({
      objectKey: resolvedLessonAudioObjectKey,
      url: resolvedLessonAudioUrl,
    }),
    lessonAudioObjectKey: resolvedLessonAudioObjectKey,
    lessonAudioDurationSeconds: resolvedLessonAudioDurationSeconds,
  };
};

const validateBookQuestionItemPayload = (payload) => {
  const questionType = `${payload?.questionType ?? payload?.type ?? ""}`.trim();
  const title = normalizeText(payload?.title);
  const stem = normalizeText(payload?.stem);
  const material = normalizeText(payload?.material);
  const analysis = normalizeText(payload?.analysis);
  const lessonAudioUrl = normalizeText(payload?.lessonAudioUrl);
  const lessonAudioObjectKey = normalizeText(payload?.lessonAudioObjectKey);
  const lessonAudioDurationSeconds = Math.max(0, Number.parseInt(`${payload?.lessonAudioDurationSeconds ?? ""}`, 10) || 0);
  const defaultScore = isSubjectiveQuestionType(questionType) ? 20 : 2;
  const score = toPositiveInt(payload?.score, defaultScore);

  if (!questionTypeLabelMap[questionType]) {
    throw createHttpError("题型不正确");
  }

  if (!stem) {
    throw createHttpError("题干不能为空");
  }

  if (!isSubjectiveQuestionType(questionType)) {
    const options = normalizeObjectiveOptions(payload?.options);
    const correctAnswerKeys = normalizeAnswerKeys(payload?.correctAnswerKeys);

    if (options.length < 2) {
      throw createHttpError("客观题至少需要两个选项");
    }

    if (correctAnswerKeys.length <= 0) {
      throw createHttpError("请至少设置一个正确答案");
    }

    const optionKeySet = new Set(options.map((option) => option.key));
    if (correctAnswerKeys.some((key) => !optionKeySet.has(key))) {
      throw createHttpError("正确答案必须来自已填写的选项");
    }

    if (questionType === "single_choice" && correctAnswerKeys.length !== 1) {
      throw createHttpError("单选题必须且只能有一个正确答案");
    }

    if (questionType === "multiple_choice" && correctAnswerKeys.length < 2) {
      throw createHttpError("多选题至少需要两个正确答案");
    }

    return {
      title,
      questionType,
      stem,
      material,
      analysis,
      lessonAudioUrl,
      lessonAudioObjectKey,
      lessonAudioDurationSeconds,
      score,
      correctAnswerJson: JSON.stringify(correctAnswerKeys),
      options,
      questionMetaJson: buildQuestionMetaJson({
        questionType,
        title,
        sectionLabel: payload?.sectionLabel,
        sectionDescription: payload?.sectionDescription,
        subjectiveSubQuestions: [],
        stem,
      }),
    };
  }

  return {
    title,
    questionType,
    stem,
    material,
    analysis,
    lessonAudioUrl,
    lessonAudioObjectKey,
    lessonAudioDurationSeconds,
    score,
    correctAnswerJson: JSON.stringify([]),
    options: [],
    questionMetaJson: buildQuestionMetaJson({
      questionType,
      title,
      sectionLabel: payload?.sectionLabel,
      sectionDescription: payload?.sectionDescription,
      subjectiveSubQuestions: payload?.subjectiveSubQuestions,
      stem,
    }),
  };
};

const createBookQuestionBankItemData = ({ bookId, subjectId, sortOrder, validated, payload }) => ({
  bookId,
  subjectId,
  title: validated.title || null,
  questionNo: normalizeText(payload?.questionNo) || null,
  yearLabel: normalizeText(payload?.yearLabel) || null,
  pageLabel: normalizeText(payload?.pageLabel) || null,
  tagsJson: JSON.stringify(normalizeStringArray(payload?.tags)),
  type: validated.questionType,
  stem: validated.stem,
  material: validated.material || null,
  analysis: validated.analysis || null,
  lessonAudioUrl: validated.lessonAudioUrl || null,
  lessonAudioObjectKey: validated.lessonAudioObjectKey || null,
  lessonAudioDurationSeconds: validated.lessonAudioDurationSeconds,
  score: validated.score,
  correctAnswerJson: validated.correctAnswerJson,
  questionMetaJson: validated.questionMetaJson,
  sortOrder,
  status: payload?.status !== false,
  options: {
    create: validated.options.map((option) => ({
      optionKey: option.key,
      content: option.content,
      sortOrder: option.sortOrder,
    })),
  },
});

export const serializeBookQuestionBank = (book) => ({
  id: book.id,
  name: normalizeDisplayText(book.name),
  code: normalizeDisplayText(book.code),
  coverUrl: getReadableObjectUrl({
    objectKey: book.coverObjectKey ?? "",
    fallbackUrl: book.coverUrl ?? "",
  }),
  coverObjectKey: book.coverObjectKey ?? "",
  description: normalizeDisplayText(book.description ?? ""),
  status: book.status,
  isVisible: Boolean(book.isVisible),
  sortOrder: Number(book.sortOrder ?? 0),
  subjectCount: Number(book._count?.subjects ?? 0),
  itemCount: Number(book._count?.items ?? 0),
  createdAt: formatDateTime(book.createdAt),
  updatedAt: formatDateTime(book.updatedAt),
});

export const serializeBookQuestionBankSubject = (subject) => ({
  id: subject.id,
  bookId: subject.bookId,
  name: normalizeDisplayText(subject.name),
  code: normalizeDisplayText(subject.code),
  description: normalizeDisplayText(subject.description ?? ""),
  sortOrder: Number(subject.sortOrder ?? 0),
  itemCount: Number(subject._count?.items ?? 0),
  createdAt: formatDateTime(subject.createdAt),
  updatedAt: formatDateTime(subject.updatedAt),
});

export const serializeBookQuestionBankPracticeState = (state) => ({
  answerJson: state?.answerJson ? parseJsonSafely(state.answerJson, null) : null,
  draftText: normalizeDisplayText(state?.draftText ?? ""),
  isAnswered: Boolean(state?.isAnswered),
  hasViewedAnswer: Boolean(state?.hasViewedAnswer),
  isMastered: Boolean(state?.isMastered),
  isRedoMarked: Boolean(state?.isRedoMarked),
  answeredAt: state?.answeredAt ? formatDateTime(state.answeredAt) : "",
  viewedAnswerAt: state?.viewedAnswerAt ? formatDateTime(state.viewedAnswerAt) : "",
  updatedAt: state?.updatedAt ? formatDateTime(state.updatedAt) : "",
});

export const serializeBookQuestionBankItemSummary = (item) => {
  const resolved = resolveBookItemContent(item);
  const displayTitle = buildDisplayTitle({
    customTitle: item.title,
    metaTitle: resolved.questionMetaTitle,
    stem: resolved.stem,
    material: resolved.material,
    sortOrder: item.sortOrder,
  });

  return {
    id: item.id,
    bookId: item.bookId,
    subjectId: item.subjectId,
    questionBankItemId: resolved.sourceQuestionBankItemId,
    title: normalizeDisplayText(displayTitle),
    customTitle: normalizeDisplayText(item.title ?? ""),
    questionNo: normalizeDisplayText(item.questionNo ?? ""),
    yearLabel: normalizeDisplayText(item.yearLabel ?? ""),
    pageLabel: normalizeDisplayText(item.pageLabel ?? ""),
    tags: normalizeStringArray(parseJsonSafely(item.tagsJson, [])),
    sortOrder: Number(item.sortOrder ?? 0),
    status: Boolean(item.status),
    subjectName: normalizeDisplayText(item.subject?.name ?? ""),
    folderName: normalizeDisplayText(resolved.folderName || "独立题库"),
    questionType: resolved.questionType,
    questionTypeLabel: resolved.questionTypeLabel,
    stem: resolved.stem,
    material: resolved.material,
    analysis: resolved.analysis,
    score: Number(resolved.score ?? 0),
    correctAnswerKeys: resolved.correctAnswerKeys,
    options: resolved.options,
    sectionLabel: resolved.sectionLabel,
    sectionDescription: resolved.sectionDescription,
    subjectiveSubQuestions: resolved.subjectiveSubQuestions,
    lessonAudioUrl: resolved.lessonAudioUrl,
    lessonAudioObjectKey: resolved.lessonAudioObjectKey,
    lessonAudioDurationSeconds: resolved.lessonAudioDurationSeconds,
    hasLessonAudio: Boolean(resolved.lessonAudioUrl || resolved.lessonAudioObjectKey),
    createdAt: formatDateTime(item.createdAt),
    updatedAt: formatDateTime(item.updatedAt),
  };
};

export const serializeBookQuestionBankPracticeItem = (bookItem, state) => {
  const resolved = resolveBookItemContent(bookItem);
  const displayTitle = buildDisplayTitle({
    customTitle: bookItem.title,
    metaTitle: resolved.questionMetaTitle,
    stem: resolved.stem,
    material: resolved.material,
    sortOrder: bookItem.sortOrder,
  });

  return {
    id: bookItem.id,
    bookId: bookItem.bookId,
    subjectId: bookItem.subjectId,
    questionBankItemId: resolved.sourceQuestionBankItemId,
    title: normalizeDisplayText(displayTitle),
    customTitle: normalizeDisplayText(bookItem.title ?? ""),
    questionNo: normalizeDisplayText(bookItem.questionNo ?? ""),
    yearLabel: normalizeDisplayText(bookItem.yearLabel ?? ""),
    pageLabel: normalizeDisplayText(bookItem.pageLabel ?? ""),
    tags: normalizeStringArray(parseJsonSafely(bookItem.tagsJson, [])),
    sortOrder: Number(bookItem.sortOrder ?? 0),
    status: Boolean(bookItem.status),
    subjectName: normalizeDisplayText(bookItem.subject?.name ?? ""),
    folderName: normalizeDisplayText(resolved.folderName || "独立题库"),
    questionType: resolved.questionType,
    questionTypeLabel: resolved.questionTypeLabel,
    stem: resolved.stem,
    material: resolved.material,
    analysis: resolved.analysis,
    score: Number(resolved.score ?? 0),
    correctAnswerKeys: resolved.correctAnswerKeys,
    options: resolved.options,
    sectionLabel: resolved.sectionLabel,
    sectionDescription: resolved.sectionDescription,
    subjectiveSubQuestions:
      resolved.subjectiveSubQuestions.length > 0
        ? resolved.subjectiveSubQuestions
        : [
            {
              id: "sub_1",
              title: resolved.stem || "请作答",
              placeholder: "请在此输入答案。",
              abilityLabel: "",
              referenceAnswer: "",
              rubricGuidance: "",
              rubricPoints: [],
            },
          ],
    lessonAudioUrl: resolved.lessonAudioUrl,
    lessonAudioObjectKey: resolved.lessonAudioObjectKey,
    lessonAudioDurationSeconds: resolved.lessonAudioDurationSeconds,
    answerState: serializeBookQuestionBankPracticeState(state),
  };
};

const ensureBookExists = async ({ db, bookId }) => {
  const book = await db.bookQuestionBank.findUnique({
    where: {
      id: bookId,
    },
  });

  if (!book) {
    throw createHttpError("题库产品不存在", 404);
  }

  return book;
};

const ensureBookSubjectExists = async ({ db, bookId, subjectId }) => {
  const subject = await db.bookQuestionBankSubject.findFirst({
    where: {
      id: subjectId,
      bookId,
    },
  });

  if (!subject) {
    throw createHttpError("题库科目不存在", 404);
  }

  return subject;
};

const ensureBookPermissionForUser = async ({ db, userId, bookId }) => {
  const permission = await db.userBookQuestionBankPermission.findUnique({
    where: {
      userId_bookId: {
        userId,
        bookId,
      },
    },
    include: {
      book: true,
    },
  });

  if (!permission || !isBookVisibleForUser(permission.book)) {
    throw createHttpError("无权访问该题库", 403);
  }

  return permission.book;
};

const getBookItemInclude = () => ({
  subject: true,
  options: {
    orderBy: {
      sortOrder: "asc",
    },
  },
  questionBankItem: {
    include: {
      folder: {
        select: {
          id: true,
          name: true,
          paperType: true,
        },
      },
      options: {
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  },
});

const ensureBookItemExists = async ({ db, bookId, bookItemId, allowHidden = false }) => {
  const item = await db.bookQuestionBankItem.findFirst({
    where: {
      id: bookItemId,
      bookId,
      ...(allowHidden ? {} : { status: true }),
    },
    include: getBookItemInclude(),
  });

  if (!item) {
    throw createHttpError("题目不存在", 404);
  }

  return item;
};

const recalculateBookProgress = async ({ db, userId, bookId, lastSubjectId, lastBookItemId }) => {
  const states = await db.userBookQuestionBankItemState.findMany({
    where: {
      userId,
      bookId,
    },
    select: {
      isAnswered: true,
      hasViewedAnswer: true,
      isMastered: true,
      isRedoMarked: true,
    },
  });

  const answeredCount = states.filter((item) => item.isAnswered).length;
  const viewedAnswerCount = states.filter((item) => item.hasViewedAnswer).length;
  const masteredCount = states.filter((item) => item.isMastered).length;
  const redoCount = states.filter((item) => item.isRedoMarked).length;

  return db.userBookQuestionBankProgress.upsert({
    where: {
      userId_bookId: {
        userId,
        bookId,
      },
    },
    update: {
      answeredCount,
      viewedAnswerCount,
      masteredCount,
      redoCount,
      ...(lastSubjectId !== undefined ? { lastSubjectId: lastSubjectId || null } : {}),
      ...(lastBookItemId !== undefined ? { lastBookItemId: lastBookItemId || null } : {}),
      lastPracticedAt: new Date(),
    },
    create: {
      userId,
      bookId,
      answeredCount,
      viewedAnswerCount,
      masteredCount,
      redoCount,
      lastSubjectId: lastSubjectId || null,
      lastBookItemId: lastBookItemId || null,
      lastPracticedAt: new Date(),
    },
  });
};

export const listAdminBookQuestionBanks = async ({ db }) => {
  const books = await db.bookQuestionBank.findMany({
    include: {
      _count: {
        select: {
          subjects: true,
          items: true,
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return books.map(serializeBookQuestionBank);
};

export const createAdminBookQuestionBank = async ({ db, payload }) => {
  const name = normalizeText(payload?.name);
  const code = normalizeText(payload?.code);

  if (!name) throw createHttpError("题库产品名称不能为空");
  if (!code) throw createHttpError("题库产品编码不能为空");

  try {
    const book = await db.bookQuestionBank.create({
      data: {
        name,
        code,
        coverUrl: normalizeText(payload?.coverUrl) || null,
        coverObjectKey: normalizeText(payload?.coverObjectKey) || null,
        description: normalizeText(payload?.description) || null,
        status: toBookStatus(payload?.status),
        isVisible: payload?.isVisible !== false,
        sortOrder: toNonNegativeInt(payload?.sortOrder, 0),
      },
      include: {
        _count: {
          select: {
            subjects: true,
            items: true,
          },
        },
      },
    });

    return serializeBookQuestionBank(book);
  } catch (error) {
    if (error?.code === "P2002") {
      throw createHttpError("题库产品编码已存在");
    }
    throw error;
  }
};

export const updateAdminBookQuestionBank = async ({ db, bookId, payload }) => {
  await ensureBookExists({ db, bookId });

  const name = normalizeText(payload?.name);
  const code = normalizeText(payload?.code);

  if (!name) throw createHttpError("题库产品名称不能为空");
  if (!code) throw createHttpError("题库产品编码不能为空");

  try {
    const book = await db.bookQuestionBank.update({
      where: {
        id: bookId,
      },
      data: {
        name,
        code,
        coverUrl: normalizeText(payload?.coverUrl) || null,
        coverObjectKey: normalizeText(payload?.coverObjectKey) || null,
        description: normalizeText(payload?.description) || null,
        status: toBookStatus(payload?.status),
        isVisible: payload?.isVisible !== false,
        sortOrder: toNonNegativeInt(payload?.sortOrder, 0),
      },
      include: {
        _count: {
          select: {
            subjects: true,
            items: true,
          },
        },
      },
    });

    return serializeBookQuestionBank(book);
  } catch (error) {
    if (error?.code === "P2002") {
      throw createHttpError("题库产品编码已存在");
    }
    throw error;
  }
};

export const deleteAdminBookQuestionBank = async ({ db, bookId }) => {
  const book = await db.bookQuestionBank.findUnique({
    where: {
      id: bookId,
    },
    include: {
      _count: {
        select: {
          items: true,
        },
      },
    },
  });

  if (!book) throw createHttpError("题库产品不存在", 404);
  if (Number(book._count?.items ?? 0) > 0) {
    throw createHttpError("请先清空题目后再删除题库产品");
  }

  await db.bookQuestionBank.delete({
    where: {
      id: bookId,
    },
  });

  return {
    success: true,
    id: book.id,
    name: normalizeDisplayText(book.name),
  };
};

export const listAdminBookQuestionBankSubjects = async ({ db, bookId }) => {
  await ensureBookExists({ db, bookId });

  const subjects = await db.bookQuestionBankSubject.findMany({
    where: {
      bookId,
    },
    include: {
      _count: {
        select: {
          items: true,
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return subjects.map(serializeBookQuestionBankSubject);
};

export const createAdminBookQuestionBankSubject = async ({ db, bookId, payload }) => {
  await ensureBookExists({ db, bookId });

  const name = normalizeText(payload?.name);
  const code = normalizeText(payload?.code);

  if (!name) throw createHttpError("科目名称不能为空");
  if (!code) throw createHttpError("科目编码不能为空");

  try {
    const subject = await db.bookQuestionBankSubject.create({
      data: {
        bookId,
        name,
        code,
        description: normalizeText(payload?.description) || null,
        sortOrder: toNonNegativeInt(payload?.sortOrder, 0),
      },
      include: {
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    return serializeBookQuestionBankSubject(subject);
  } catch (error) {
    if (error?.code === "P2002") {
      throw createHttpError("当前题库下科目名称或编码已存在");
    }
    throw error;
  }
};

export const updateAdminBookQuestionBankSubject = async ({ db, bookId, subjectId, payload }) => {
  await ensureBookSubjectExists({ db, bookId, subjectId });

  const name = normalizeText(payload?.name);
  const code = normalizeText(payload?.code);

  if (!name) throw createHttpError("科目名称不能为空");
  if (!code) throw createHttpError("科目编码不能为空");

  try {
    const subject = await db.bookQuestionBankSubject.update({
      where: {
        id: subjectId,
      },
      data: {
        name,
        code,
        description: normalizeText(payload?.description) || null,
        sortOrder: toNonNegativeInt(payload?.sortOrder, 0),
      },
      include: {
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    return serializeBookQuestionBankSubject(subject);
  } catch (error) {
    if (error?.code === "P2002") {
      throw createHttpError("当前题库下科目名称或编码已存在");
    }
    throw error;
  }
};

export const deleteAdminBookQuestionBankSubject = async ({ db, bookId, subjectId }) => {
  const subject = await db.bookQuestionBankSubject.findFirst({
    where: {
      id: subjectId,
      bookId,
    },
    include: {
      _count: {
        select: {
          items: true,
        },
      },
    },
  });

  if (!subject) throw createHttpError("题库科目不存在", 404);
  if (Number(subject._count?.items ?? 0) > 0) {
    throw createHttpError("请先清空该科目下题目后再删除");
  }

  await db.bookQuestionBankSubject.delete({
    where: {
      id: subjectId,
    },
  });

  return {
    success: true,
    id: subject.id,
    name: normalizeDisplayText(subject.name),
  };
};

export const listAdminBookQuestionBankAvailableItems = async () => ({
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 1,
});

export const listAdminBookQuestionBankItems = async ({ db, bookId, subjectId, keyword = "", questionType = "" }) => {
  await ensureBookExists({ db, bookId });

  const normalizedKeyword = normalizeText(keyword);
  const normalizedQuestionType = `${questionType ?? ""}`.trim();
  const items = await db.bookQuestionBankItem.findMany({
    where: {
      bookId,
      ...(subjectId ? { subjectId } : {}),
      ...(normalizedQuestionType ? { type: normalizedQuestionType } : {}),
      ...(normalizedKeyword
        ? {
            OR: [
              { title: { contains: normalizedKeyword } },
              { stem: { contains: normalizedKeyword } },
              { material: { contains: normalizedKeyword } },
              { analysis: { contains: normalizedKeyword } },
              { questionNo: { contains: normalizedKeyword } },
            ],
          }
        : {}),
    },
    include: getBookItemInclude(),
    orderBy: [{ subject: { sortOrder: "asc" } }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return items.map(serializeBookQuestionBankItemSummary);
};

export const createAdminBookQuestionBankItem = async ({ db, bookId, payload }) => {
  const subjectId = `${payload?.subjectId ?? ""}`.trim();
  if (!subjectId) throw createHttpError("请选择科目");

  await ensureBookSubjectExists({ db, bookId, subjectId });
  const validated = validateBookQuestionItemPayload(payload);

  const item = await db.$transaction(async (tx) => {
    const maxSort = await tx.bookQuestionBankItem.findFirst({
      where: {
        bookId,
        subjectId,
      },
      orderBy: {
        sortOrder: "desc",
      },
      select: {
        sortOrder: true,
      },
    });

    return tx.bookQuestionBankItem.create({
      data: createBookQuestionBankItemData({
        bookId,
        subjectId,
        sortOrder: toNonNegativeInt(payload?.sortOrder, Number(maxSort?.sortOrder ?? 0) + 1),
        validated,
        payload,
      }),
      include: getBookItemInclude(),
    });
  });

  return serializeBookQuestionBankItemSummary(item);
};

export const importAdminBookQuestionBankItems = async ({ db, bookId, subjectId, items }) => {
  const normalizedSubjectId = `${subjectId ?? ""}`.trim();
  if (!normalizedSubjectId) {
    throw createHttpError("请选择导入科目");
  }

  await ensureBookSubjectExists({ db, bookId, subjectId: normalizedSubjectId });

  if (!Array.isArray(items) || items.length <= 0) {
    throw createHttpError("Excel 中没有可导入的题目");
  }

  const validatedItems = items.map((item, index) => {
    try {
      return validateBookQuestionItemPayload({
        subjectId: normalizedSubjectId,
        title: item?.questionMeta?.title ?? "",
        questionType: item?.type,
        stem: item?.stem,
        material: item?.material,
        analysis: item?.analysis,
        score: item?.score,
        correctAnswerKeys: item?.correctAnswerKeys,
        options: item?.options,
        sectionLabel: item?.questionMeta?.sectionLabel,
        sectionDescription: item?.questionMeta?.sectionDescription,
        subjectiveSubQuestions: item?.questionMeta?.subQuestions,
        lessonAudioUrl: item?.lessonAudioUrl,
        lessonAudioObjectKey: item?.lessonAudioObjectKey,
        lessonAudioDurationSeconds: item?.lessonAudioDurationSeconds,
        status: true,
      });
    } catch (error) {
      throw createHttpError(`第 ${index + 1} 题：${error instanceof Error ? error.message : "题目格式不正确"}`);
    }
  });

  await db.$transaction(async (tx) => {
    const maxSort = await tx.bookQuestionBankItem.findFirst({
      where: {
        bookId,
        subjectId: normalizedSubjectId,
      },
      orderBy: {
        sortOrder: "desc",
      },
      select: {
        sortOrder: true,
      },
    });

    let nextSortOrder = Number(maxSort?.sortOrder ?? 0);

    for (let index = 0; index < validatedItems.length; index += 1) {
      nextSortOrder += 1;
      const sourceItem = items[index];
      const validated = validatedItems[index];

      await tx.bookQuestionBankItem.create({
        data: createBookQuestionBankItemData({
          bookId,
          subjectId: normalizedSubjectId,
          sortOrder: nextSortOrder,
          validated,
          payload: {
            title: sourceItem?.questionMeta?.title ?? "",
            questionNo: sourceItem?.questionNo ?? "",
            yearLabel: sourceItem?.yearLabel ?? "",
            pageLabel: sourceItem?.pageLabel ?? "",
            tags: sourceItem?.tags ?? [],
            status: true,
          },
        }),
      });
    }
  });

  return {
    parsedCount: items.length,
    createdCount: validatedItems.length,
  };
};

const buildAudioMatchCandidateSet = (item) => {
  const candidates = new Set();
  const pushCandidate = (value) => {
    const normalized = normalizeFileBaseName(value);
    if (normalized) {
      candidates.add(normalized);
    }
  };

  pushCandidate(item?.questionMeta?.title);
  pushCandidate(item?.title);
  pushCandidate(item?.questionNo);
  pushCandidate(item?.stem?.split?.("\n")?.[0] ?? "");

  return candidates;
};

export const attachImportedBookQuestionBankAudios = async ({ db, bookId, subjectId, items, audioAssets }) => {
  const normalizedSubjectId = `${subjectId ?? ""}`.trim();
  if (!normalizedSubjectId) {
    throw createHttpError("请选择导入科目");
  }

  if (!Array.isArray(items) || items.length <= 0 || !Array.isArray(audioAssets) || audioAssets.length <= 0) {
    return {
      matchedCount: 0,
      unmatchedAudioNames: [],
    };
  }

  const importedItems = await db.bookQuestionBankItem.findMany({
    where: {
      bookId,
      subjectId: normalizedSubjectId,
    },
    orderBy: [{ sortOrder: "desc" }],
    take: items.length,
    select: {
      id: true,
      sortOrder: true,
    },
  });

  const orderedImportedItems = importedItems.slice().sort((left, right) => left.sortOrder - right.sortOrder);
  const pendingAudioMap = new Map(
    audioAssets.map((asset) => [
      normalizeFileBaseName(asset.fileName),
      asset,
    ]),
  );

  let matchedCount = 0;

  await db.$transaction(async (tx) => {
    for (let index = 0; index < items.length; index += 1) {
      const sourceItem = items[index];
      const createdItem = orderedImportedItems[index];
      if (!createdItem) continue;

      const candidates = buildAudioMatchCandidateSet(sourceItem);
      const matchedKey = Array.from(candidates).find((candidate) => pendingAudioMap.has(candidate));
      const audioAsset = matchedKey ? pendingAudioMap.get(matchedKey) : pendingAudioMap.values().next().value;
      if (!audioAsset) continue;

      await tx.bookQuestionBankItem.update({
        where: {
          id: createdItem.id,
        },
        data: {
          lessonAudioUrl: audioAsset.readableUrl || audioAsset.url || null,
          lessonAudioObjectKey: audioAsset.objectKey || null,
          lessonAudioDurationSeconds: Number(audioAsset.durationSeconds ?? 0) || 0,
        },
      });

      matchedCount += 1;
      pendingAudioMap.delete(matchedKey || normalizeFileBaseName(audioAsset.fileName));
    }
  });

  return {
    matchedCount,
    unmatchedAudioNames: Array.from(pendingAudioMap.values()).map((asset) => asset.fileName),
  };
};

export const updateAdminBookQuestionBankItem = async ({ db, bookId, bookItemId, payload }) => {
  const existing = await db.bookQuestionBankItem.findFirst({
    where: {
      id: bookItemId,
      bookId,
    },
    include: {
      options: {
        orderBy: {
          sortOrder: "asc",
        },
      },
      questionBankItem: {
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

  if (!existing) {
    throw createHttpError("题目不存在", 404);
  }

  const legacySource = resolveBookItemContent(existing);
  const nextSubjectId = `${payload?.subjectId ?? existing.subjectId}`.trim();
  await ensureBookSubjectExists({ db, bookId, subjectId: nextSubjectId });

  const validated = validateBookQuestionItemPayload({
    title: payload?.title ?? existing.title ?? legacySource.questionMetaTitle,
    questionType: payload?.questionType ?? existing.type ?? legacySource.questionType,
    stem: payload?.stem ?? existing.stem ?? legacySource.stem,
    material: payload?.material ?? existing.material ?? legacySource.material,
    analysis: payload?.analysis ?? existing.analysis ?? legacySource.analysis,
    lessonAudioUrl: payload?.lessonAudioUrl ?? existing.lessonAudioUrl ?? legacySource.lessonAudioUrl,
    lessonAudioObjectKey: payload?.lessonAudioObjectKey ?? existing.lessonAudioObjectKey ?? legacySource.lessonAudioObjectKey,
    lessonAudioDurationSeconds:
      payload?.lessonAudioDurationSeconds ?? existing.lessonAudioDurationSeconds ?? legacySource.lessonAudioDurationSeconds,
    score: payload?.score ?? existing.score ?? legacySource.score,
    correctAnswerKeys:
      payload?.correctAnswerKeys ??
      parseJsonSafely(existing.correctAnswerJson, legacySource.correctAnswerKeys),
    options:
      payload?.options ??
      (existing.options?.length > 0
        ? existing.options.map((option) => ({
            key: option.optionKey,
            content: option.content,
            sortOrder: option.sortOrder,
          }))
        : legacySource.options.map((option, index) => ({
            key: option.key,
            content: option.content,
            sortOrder: index + 1,
          }))),
    sectionLabel: payload?.sectionLabel ?? legacySource.sectionLabel,
    sectionDescription: payload?.sectionDescription ?? legacySource.sectionDescription,
    subjectiveSubQuestions: payload?.subjectiveSubQuestions ?? legacySource.subjectiveSubQuestions,
  });

  const item = await db.$transaction(async (tx) => {
    await tx.bookQuestionBankItemOption.deleteMany({
      where: {
        itemId: bookItemId,
      },
    });

    return tx.bookQuestionBankItem.update({
      where: {
        id: bookItemId,
      },
      data: {
        subjectId: nextSubjectId,
        title: validated.title || null,
        questionNo: normalizeText(payload?.questionNo ?? existing.questionNo) || null,
        yearLabel: normalizeText(payload?.yearLabel ?? existing.yearLabel) || null,
        pageLabel: normalizeText(payload?.pageLabel ?? existing.pageLabel) || null,
        tagsJson: JSON.stringify(normalizeStringArray(payload?.tags ?? parseJsonSafely(existing.tagsJson, []))),
        type: validated.questionType,
        stem: validated.stem,
        material: validated.material || null,
        analysis: validated.analysis || null,
        lessonAudioUrl: validated.lessonAudioUrl || null,
        lessonAudioObjectKey: validated.lessonAudioObjectKey || null,
        lessonAudioDurationSeconds: validated.lessonAudioDurationSeconds,
        score: validated.score,
        correctAnswerJson: validated.correctAnswerJson,
        questionMetaJson: validated.questionMetaJson,
        sortOrder: toNonNegativeInt(payload?.sortOrder, Number(existing.sortOrder ?? 0)),
        status: payload?.status === undefined ? existing.status : payload.status !== false,
        options: {
          create: validated.options.map((option) => ({
            optionKey: option.key,
            content: option.content,
            sortOrder: option.sortOrder,
          })),
        },
      },
      include: getBookItemInclude(),
    });
  });

  return serializeBookQuestionBankItemSummary(item);
};

export const deleteAdminBookQuestionBankItem = async ({ db, bookId, bookItemId }) => {
  const existing = await db.bookQuestionBankItem.findFirst({
    where: {
      id: bookItemId,
      bookId,
    },
    select: {
      id: true,
      title: true,
    },
  });

  if (!existing) {
    throw createHttpError("题目不存在", 404);
  }

  await db.bookQuestionBankItem.delete({
    where: {
      id: bookItemId,
    },
  });

  return {
    success: true,
    id: existing.id,
    title: normalizeDisplayText(existing.title ?? ""),
  };
};

export const listAdminBookQuestionBankPermissions = async ({ db, bookId }) => {
  await ensureBookExists({ db, bookId });

  const permissions = await db.userBookQuestionBankPermission.findMany({
    where: {
      bookId,
    },
    include: {
      user: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return permissions.map((permission) => ({
    id: permission.id,
    userId: permission.userId,
    bookId: permission.bookId,
    phone: permission.user.phone,
    nickname: normalizeDisplayText(permission.user.nickname ?? ""),
    displayName: normalizeDisplayText(permission.user.nickname ?? "") || permission.user.phone,
    sourceType: normalizeDisplayText(permission.sourceType ?? ""),
    sourceId: normalizeDisplayText(permission.sourceId ?? ""),
    createdAt: formatDateTime(permission.createdAt),
  }));
};

export const grantAdminBookQuestionBankPermission = async ({ db, bookId, phones, defaultPasswordHash }) => {
  await ensureBookExists({ db, bookId });

  const uniquePhones = Array.from(
    new Set((Array.isArray(phones) ? phones : []).map((item) => `${item ?? ""}`.replace(/\D/g, "")).filter(Boolean)),
  );

  if (uniquePhones.length <= 0) {
    throw createHttpError("请至少提供一个手机号");
  }

  const existingUsers = await db.user.findMany({
    where: {
      phone: {
        in: uniquePhones,
      },
    },
    select: {
      id: true,
      phone: true,
    },
  });

  const existingMap = new Map(existingUsers.map((item) => [item.phone, item]));
  const createdUsers = [];

  for (const phone of uniquePhones) {
    if (existingMap.has(phone)) continue;

    const user = await db.user.create({
      data: {
        phone,
        passwordHash: defaultPasswordHash ?? DEFAULT_BOOK_QUESTION_BANK_USER_PASSWORD,
      },
      select: {
        id: true,
        phone: true,
      },
    });

    existingMap.set(phone, user);
    createdUsers.push(user.phone);
  }

  const users = Array.from(existingMap.values());

  await db.userBookQuestionBankPermission.createMany({
    data: users.map((user) => ({
      userId: user.id,
      bookId,
      sourceType: "manual",
    })),
    skipDuplicates: true,
  });

  const grantedCount = await db.userBookQuestionBankPermission.count({
    where: {
      bookId,
      userId: {
        in: users.map((item) => item.id),
      },
    },
  });

  return {
    totalPhones: uniquePhones.length,
    createdUsers,
    grantedCount,
  };
};

export const revokeAdminBookQuestionBankPermission = async ({ db, bookId, userId }) => {
  const permission = await db.userBookQuestionBankPermission.findUnique({
    where: {
      userId_bookId: {
        userId,
        bookId,
      },
    },
  });

  if (!permission) {
    throw createHttpError("权限不存在", 404);
  }

  await db.userBookQuestionBankPermission.delete({
    where: {
      userId_bookId: {
        userId,
        bookId,
      },
    },
  });

  return { success: true };
};

export const listUserBookQuestionBanks = async ({ db, userId }) => {
  const permissions = await db.userBookQuestionBankPermission.findMany({
    where: {
      userId,
    },
    include: {
      book: {
        include: {
          _count: {
            select: {
              subjects: true,
              items: true,
            },
          },
        },
      },
    },
    orderBy: [{ book: { sortOrder: "asc" } }, { createdAt: "desc" }],
  });

  const visibleBooks = permissions.map((item) => item.book).filter(isBookVisibleForUser);
  const progressList =
    visibleBooks.length > 0
      ? await db.userBookQuestionBankProgress.findMany({
          where: {
            userId,
            bookId: {
              in: visibleBooks.map((item) => item.id),
            },
          },
        })
      : [];

  const progressMap = new Map(progressList.map((item) => [item.bookId, item]));

  return permissions
    .filter((permission) => isBookVisibleForUser(permission.book))
    .map((permission) => {
      const progress = progressMap.get(permission.bookId);

      return {
        ...serializeBookQuestionBank(permission.book),
        progress: {
          answeredCount: Number(progress?.answeredCount ?? 0),
          viewedAnswerCount: Number(progress?.viewedAnswerCount ?? 0),
          masteredCount: Number(progress?.masteredCount ?? 0),
          redoCount: Number(progress?.redoCount ?? 0),
          lastSubjectId: progress?.lastSubjectId ?? "",
          lastBookItemId: progress?.lastBookItemId ?? "",
          lastPracticedAt: progress?.lastPracticedAt ? formatDateTime(progress.lastPracticedAt) : "",
        },
      };
    });
};

export const getUserBookQuestionBankDetail = async ({ db, userId, bookId, subjectId, statusFilter = "all" }) => {
  const book = await ensureBookPermissionForUser({ db, userId, bookId });

  const [subjects, items, progress, states] = await Promise.all([
    db.bookQuestionBankSubject.findMany({
      where: {
        bookId,
      },
      include: {
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    db.bookQuestionBankItem.findMany({
      where: {
        bookId,
        status: true,
        ...(subjectId ? { subjectId } : {}),
      },
      include: getBookItemInclude(),
      orderBy: [{ subject: { sortOrder: "asc" } }, { sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    db.userBookQuestionBankProgress.findUnique({
      where: {
        userId_bookId: {
          userId,
          bookId,
        },
      },
    }),
    db.userBookQuestionBankItemState.findMany({
      where: {
        userId,
        bookId,
      },
    }),
  ]);

  const stateMap = new Map(states.map((item) => [item.bookItemId, item]));
  const filteredItems = items
    .map((item) => ({
      ...serializeBookQuestionBankItemSummary(item),
      answerState: serializeBookQuestionBankPracticeState(stateMap.get(item.id)),
    }))
    .filter((item) => {
      if (statusFilter === "answered") return item.answerState.isAnswered;
      if (statusFilter === "unanswered") return !item.answerState.isAnswered;
      if (statusFilter === "viewed") return item.answerState.hasViewedAnswer;
      if (statusFilter === "mastered") return item.answerState.isMastered;
      if (statusFilter === "redo") return item.answerState.isRedoMarked;
      return true;
    });

  return {
    book: serializeBookQuestionBank({
      ...book,
      _count: {
        subjects: subjects.length,
        items: items.length,
      },
    }),
    subjects: subjects.map(serializeBookQuestionBankSubject),
    progress: {
      answeredCount: Number(progress?.answeredCount ?? 0),
      viewedAnswerCount: Number(progress?.viewedAnswerCount ?? 0),
      masteredCount: Number(progress?.masteredCount ?? 0),
      redoCount: Number(progress?.redoCount ?? 0),
      lastSubjectId: progress?.lastSubjectId ?? "",
      lastBookItemId: progress?.lastBookItemId ?? "",
      lastPracticedAt: progress?.lastPracticedAt ? formatDateTime(progress.lastPracticedAt) : "",
    },
    items: filteredItems,
  };
};

export const getUserBookQuestionBankPractice = async ({ db, userId, bookId, bookItemId }) => {
  const book = await ensureBookPermissionForUser({ db, userId, bookId });
  const [bookItem, state, orderedItems] = await Promise.all([
    ensureBookItemExists({ db, bookId, bookItemId }),
    db.userBookQuestionBankItemState.findUnique({
      where: {
        userId_bookItemId: {
          userId,
          bookItemId,
        },
      },
    }),
    db.bookQuestionBankItem.findMany({
      where: {
        bookId,
        status: true,
      },
      orderBy: [{ subject: { sortOrder: "asc" } }, { sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
      },
    }),
  ]);

  const currentIndex = orderedItems.findIndex((item) => item.id === bookItemId);
  const prevBookItemId = currentIndex > 0 ? orderedItems[currentIndex - 1]?.id ?? "" : "";
  const nextBookItemId = currentIndex >= 0 ? orderedItems[currentIndex + 1]?.id ?? "" : "";

  return {
    book: serializeBookQuestionBank({
      ...book,
      _count: {
        subjects: 0,
        items: 0,
      },
    }),
    item: serializeBookQuestionBankPracticeItem(bookItem, state),
    prevBookItemId,
    nextBookItemId,
  };
};

export const saveUserBookQuestionBankPracticeAnswer = async ({ db, userId, bookId, bookItemId, answerJson, draftText }) => {
  await ensureBookPermissionForUser({ db, userId, bookId });
  const bookItem = await ensureBookItemExists({ db, bookId, bookItemId });

  const normalizedDraftText = normalizeText(draftText);
  const normalizedAnswerJson = answerJson === undefined ? null : JSON.stringify(answerJson);
  const isAnswered = Boolean(normalizedDraftText) || hasMeaningfulAnswerValue(answerJson);

  const state = await db.userBookQuestionBankItemState.upsert({
    where: {
      userId_bookItemId: {
        userId,
        bookItemId,
      },
    },
    update: {
      answerJson: normalizedAnswerJson,
      draftText: normalizedDraftText || null,
      isAnswered,
      answeredAt: isAnswered ? new Date() : null,
      questionBankItemId: bookItem.questionBankItemId || null,
    },
    create: {
      userId,
      bookId,
      bookItemId,
      questionBankItemId: bookItem.questionBankItemId || null,
      answerJson: normalizedAnswerJson,
      draftText: normalizedDraftText || null,
      isAnswered,
      answeredAt: isAnswered ? new Date() : null,
    },
  });

  await recalculateBookProgress({
    db,
    userId,
    bookId,
    lastSubjectId: bookItem.subjectId,
    lastBookItemId: bookItem.id,
  });

  return serializeBookQuestionBankPracticeState(state);
};

export const markUserBookQuestionBankViewedAnswer = async ({ db, userId, bookId, bookItemId }) => {
  await ensureBookPermissionForUser({ db, userId, bookId });
  const bookItem = await ensureBookItemExists({ db, bookId, bookItemId });

  const state = await db.userBookQuestionBankItemState.upsert({
    where: {
      userId_bookItemId: {
        userId,
        bookItemId,
      },
    },
    update: {
      hasViewedAnswer: true,
      viewedAnswerAt: new Date(),
      questionBankItemId: bookItem.questionBankItemId || null,
    },
    create: {
      userId,
      bookId,
      bookItemId,
      questionBankItemId: bookItem.questionBankItemId || null,
      hasViewedAnswer: true,
      viewedAnswerAt: new Date(),
    },
  });

  await recalculateBookProgress({
    db,
    userId,
    bookId,
    lastSubjectId: bookItem.subjectId,
    lastBookItemId: bookItem.id,
  });

  return serializeBookQuestionBankPracticeState(state);
};

export const updateUserBookQuestionBankPracticeState = async ({ db, userId, bookId, bookItemId, isMastered, isRedoMarked }) => {
  await ensureBookPermissionForUser({ db, userId, bookId });
  const bookItem = await ensureBookItemExists({ db, bookId, bookItemId });
  const updateData = {
    ...(isMastered !== undefined ? { isMastered: Boolean(isMastered) } : {}),
    ...(isRedoMarked !== undefined ? { isRedoMarked: Boolean(isRedoMarked) } : {}),
    questionBankItemId: bookItem.questionBankItemId || null,
  };
  const createData = {
    ...(isMastered !== undefined ? { isMastered: Boolean(isMastered) } : {}),
    ...(isRedoMarked !== undefined ? { isRedoMarked: Boolean(isRedoMarked) } : {}),
    questionBankItemId: bookItem.questionBankItemId || null,
  };

  const state = await db.userBookQuestionBankItemState.upsert({
    where: {
      userId_bookItemId: {
        userId,
        bookItemId,
      },
    },
    update: updateData,
    create: {
      userId,
      bookId,
      bookItemId,
      ...createData,
    },
  });

  await recalculateBookProgress({
    db,
    userId,
    bookId,
    lastSubjectId: bookItem.subjectId,
    lastBookItemId: bookItem.id,
  });

  return serializeBookQuestionBankPracticeState(state);
};

export const getUserBookQuestionBankResumeTarget = async ({ db, userId, bookId }) => {
  await ensureBookPermissionForUser({ db, userId, bookId });

  const progress = await db.userBookQuestionBankProgress.findUnique({
    where: {
      userId_bookId: {
        userId,
        bookId,
      },
    },
  });

  if (progress?.lastBookItemId) {
    const lastItem = await db.bookQuestionBankItem.findFirst({
      where: {
        id: progress.lastBookItemId,
        bookId,
        status: true,
      },
      select: {
        id: true,
      },
    });

    if (lastItem) {
      return {
        bookItemId: lastItem.id,
      };
    }
  }

  const firstItem = await db.bookQuestionBankItem.findFirst({
    where: {
      bookId,
      status: true,
    },
    orderBy: [{ subject: { sortOrder: "asc" } }, { sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
    },
  });

  return {
    bookItemId: firstItem?.id ?? "",
  };
};
