import { questionTypeLabelMap } from "./question-bank-excel.js";
import { formatDateTime } from "./time.js";
import { normalizeDisplayText } from "./text.js";
import { getReadableObjectUrl } from "./upload.js";

export const DEFAULT_BOOK_QUESTION_BANK_USER_PASSWORD = "den2024";

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeText = (value) => `${value ?? ""}`.replace(/\r\n/g, "\n").trim();

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

const toBookStatus = (value) => {
  const normalized = `${value ?? ""}`.trim();
  if (normalized === "published" || normalized === "closed") return normalized;
  return "draft";
};

const isBookVisibleForUser = (book) => book?.status === "published" && Boolean(book?.isVisible);

const buildQuestionMeta = (item) => {
  const raw = parseJsonSafely(item?.questionMetaJson, {});
  const subQuestions = Array.isArray(raw?.subQuestions) ? raw.subQuestions : [];

  return {
    title: normalizeText(raw?.title),
    sectionLabel: normalizeText(raw?.sectionLabel) || questionTypeLabelMap[item?.type] || "题目",
    sectionDescription: normalizeText(raw?.sectionDescription),
    subjectiveSubQuestions: subQuestions
      .map((subQuestion, index) => ({
        id: `${subQuestion?.id ?? `sub_${index + 1}`}`.trim(),
        title: normalizeText(subQuestion?.title),
        placeholder: normalizeText(subQuestion?.placeholder) || "请在此输入答案。",
        abilityLabel: normalizeText(subQuestion?.abilityLabel),
        referenceAnswer: normalizeText(subQuestion?.referenceAnswer),
        rubricGuidance: normalizeText(subQuestion?.rubricGuidance),
        rubricPoints: (Array.isArray(subQuestion?.rubricPoints) ? subQuestion.rubricPoints : [])
          .map((point, pointIndex) => ({
            id: `${point?.id ?? `point_${pointIndex + 1}`}`.trim(),
            title: normalizeText(point?.title),
            score: Math.max(0, Number.parseInt(`${point?.score ?? ""}`, 10) || 0),
            description: normalizeText(point?.description),
            keywords: normalizeStringArray(point?.keywords),
          }))
          .filter((point) => point.title),
      }))
      .filter((subQuestion) => subQuestion.title),
  };
};

const buildDisplayTitle = ({ customTitle, metaTitle, stem, material, sortOrder }) =>
  normalizeText(customTitle) ||
  normalizeText(metaTitle) ||
  normalizeText(stem).split("\n").find(Boolean) ||
  normalizeText(material).split("\n").find(Boolean) ||
  `题目 ${sortOrder}`;

const buildReadableAudioUrl = (item) =>
  getReadableObjectUrl({
    objectKey: item?.lessonAudioObjectKey ?? "",
    fallbackUrl: item?.lessonAudioUrl ?? "",
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
  const questionMeta = buildQuestionMeta(item.questionBankItem);
  const displayTitle = buildDisplayTitle({
    customTitle: item.title,
    metaTitle: questionMeta.title,
    stem: item.questionBankItem?.stem,
    material: item.questionBankItem?.material,
    sortOrder: item.sortOrder,
  });

  return {
    id: item.id,
    bookId: item.bookId,
    subjectId: item.subjectId,
    questionBankItemId: item.questionBankItemId,
    title: normalizeDisplayText(displayTitle),
    customTitle: normalizeDisplayText(item.title ?? ""),
    questionNo: normalizeDisplayText(item.questionNo ?? ""),
    yearLabel: normalizeDisplayText(item.yearLabel ?? ""),
    pageLabel: normalizeDisplayText(item.pageLabel ?? ""),
    tags: normalizeStringArray(parseJsonSafely(item.tagsJson, [])),
    sortOrder: Number(item.sortOrder ?? 0),
    status: Boolean(item.status),
    subjectName: normalizeDisplayText(item.subject?.name ?? ""),
    folderName: normalizeDisplayText(item.questionBankItem?.folder?.name ?? ""),
    questionType: item.questionBankItem?.type ?? "single_choice",
    questionTypeLabel: questionTypeLabelMap[item.questionBankItem?.type] ?? item.questionBankItem?.type ?? "题目",
    score: Number(item.questionBankItem?.score ?? 0),
    hasLessonAudio: Boolean(item.questionBankItem?.lessonAudioUrl || item.questionBankItem?.lessonAudioObjectKey),
    createdAt: formatDateTime(item.createdAt),
    updatedAt: formatDateTime(item.updatedAt),
  };
};

export const serializeBookQuestionBankPracticeItem = (bookItem, state) => {
  const questionItem = bookItem.questionBankItem;
  const questionMeta = buildQuestionMeta(questionItem);
  const displayTitle = buildDisplayTitle({
    customTitle: bookItem.title,
    metaTitle: questionMeta.title,
    stem: questionItem.stem,
    material: questionItem.material,
    sortOrder: bookItem.sortOrder,
  });

  return {
    id: bookItem.id,
    bookId: bookItem.bookId,
    subjectId: bookItem.subjectId,
    questionBankItemId: bookItem.questionBankItemId,
    title: normalizeDisplayText(displayTitle),
    customTitle: normalizeDisplayText(bookItem.title ?? ""),
    questionNo: normalizeDisplayText(bookItem.questionNo ?? ""),
    yearLabel: normalizeDisplayText(bookItem.yearLabel ?? ""),
    pageLabel: normalizeDisplayText(bookItem.pageLabel ?? ""),
    tags: normalizeStringArray(parseJsonSafely(bookItem.tagsJson, [])),
    sortOrder: Number(bookItem.sortOrder ?? 0),
    status: Boolean(bookItem.status),
    subjectName: normalizeDisplayText(bookItem.subject?.name ?? ""),
    questionType: questionItem.type,
    questionTypeLabel: questionTypeLabelMap[questionItem.type] ?? questionItem.type,
    stem: normalizeDisplayText(questionItem.stem),
    material: normalizeDisplayText(questionItem.material ?? ""),
    analysis: normalizeDisplayText(questionItem.analysis ?? ""),
    score: Number(questionItem.score ?? 0),
    correctAnswerKeys: normalizeAnswerKeys(parseJsonSafely(questionItem.correctAnswerJson, [])),
    options: (questionItem.options ?? [])
      .slice()
      .sort((left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0))
      .map((option) => ({
        id: option.id,
        key: `${option.optionKey ?? ""}`.trim().toUpperCase(),
        content: normalizeDisplayText(option.content),
      })),
    sectionLabel: normalizeDisplayText(questionMeta.sectionLabel),
    sectionDescription: normalizeDisplayText(questionMeta.sectionDescription),
    subjectiveSubQuestions:
      questionMeta.subjectiveSubQuestions.length > 0
        ? questionMeta.subjectiveSubQuestions.map((subQuestion) => ({
            ...subQuestion,
            title: normalizeDisplayText(subQuestion.title),
            placeholder: normalizeDisplayText(subQuestion.placeholder),
            abilityLabel: normalizeDisplayText(subQuestion.abilityLabel),
            referenceAnswer: normalizeDisplayText(subQuestion.referenceAnswer),
            rubricGuidance: normalizeDisplayText(subQuestion.rubricGuidance),
            rubricPoints: subQuestion.rubricPoints.map((point) => ({
              ...point,
              title: normalizeDisplayText(point.title),
              description: normalizeDisplayText(point.description),
            })),
          }))
        : [
            {
              id: "sub_1",
              title: normalizeDisplayText(questionItem.stem),
              placeholder: "请在此输入答案。",
              abilityLabel: "",
              referenceAnswer: "",
              rubricGuidance: "",
              rubricPoints: [],
            },
          ],
    lessonAudioUrl: buildReadableAudioUrl(questionItem),
    lessonAudioObjectKey: questionItem.lessonAudioObjectKey ?? "",
    lessonAudioDurationSeconds: Number(questionItem.lessonAudioDurationSeconds ?? 0) || 0,
    answerState: serializeBookQuestionBankPracticeState(state),
  };
};

const serializeQuestionBankItemForSelection = (item) => {
  const questionMeta = buildQuestionMeta(item);

  return {
    id: item.id,
    folderId: item.folderId,
    folderName: normalizeDisplayText(item.folder?.name ?? ""),
    paperType: item.folder?.paperType ?? "objective",
    questionType: item.type,
    questionTypeLabel: questionTypeLabelMap[item.type] ?? item.type,
    title: normalizeDisplayText(
      buildDisplayTitle({
        customTitle: "",
        metaTitle: questionMeta.title,
        stem: item.stem,
        material: item.material,
        sortOrder: item.sortOrder,
      }),
    ),
    stem: normalizeDisplayText(item.stem),
    material: normalizeDisplayText(item.material ?? ""),
    analysis: normalizeDisplayText(item.analysis ?? ""),
    score: Number(item.score ?? 0),
    sortOrder: Number(item.sortOrder ?? 0),
    correctAnswerKeys: normalizeAnswerKeys(parseJsonSafely(item.correctAnswerJson, [])),
    options: (item.options ?? [])
      .slice()
      .sort((left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0))
      .map((option) => ({
        id: option.id,
        key: `${option.optionKey ?? ""}`.trim().toUpperCase(),
        content: normalizeDisplayText(option.content),
      })),
    sectionLabel: normalizeDisplayText(questionMeta.sectionLabel),
    sectionDescription: normalizeDisplayText(questionMeta.sectionDescription),
    subjectiveSubQuestions: questionMeta.subjectiveSubQuestions,
    lessonAudioUrl: buildReadableAudioUrl(item),
    lessonAudioObjectKey: item.lessonAudioObjectKey ?? "",
    lessonAudioDurationSeconds: Number(item.lessonAudioDurationSeconds ?? 0) || 0,
    createdAt: formatDateTime(item.createdAt),
    updatedAt: formatDateTime(item.updatedAt),
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

const ensureBookItemExists = async ({ db, bookId, bookItemId }) => {
  const item = await db.bookQuestionBankItem.findFirst({
    where: {
      id: bookItemId,
      bookId,
    },
    include: {
      subject: true,
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
    },
  });

  if (!item || !item.status) {
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
      throw createHttpError("同一题库下科目名称或编码已存在");
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
      throw createHttpError("同一题库下科目名称或编码已存在");
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

  if (!subject) throw createHttpError("科目不存在", 404);
  if (Number(subject._count?.items ?? 0) > 0) {
    throw createHttpError("请先移除该科目下的题目后再删除");
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

export const listAdminBookQuestionBankAvailableItems = async ({ db, paperType, folderId, keyword, page = 1, pageSize = 20 }) => {
  const where = {
    folder: {
      is: {
        paperType: `${paperType ?? ""}`.trim() === "subjective" ? "subjective" : "objective",
      },
    },
    ...(folderId ? { folderId } : {}),
    ...(keyword
      ? {
          OR: [{ stem: { contains: keyword } }, { material: { contains: keyword } }, { analysis: { contains: keyword } }],
        }
      : {}),
  };

  const total = await db.questionBankItem.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const items =
    total <= 0
      ? []
      : await db.questionBankItem.findMany({
          where,
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
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          skip: (currentPage - 1) * pageSize,
          take: pageSize,
        });

  return {
    items: items.map(serializeQuestionBankItemForSelection),
    total,
    page: currentPage,
    pageSize,
    totalPages,
  };
};

export const listAdminBookQuestionBankItems = async ({ db, bookId, subjectId }) => {
  await ensureBookExists({ db, bookId });

  const items = await db.bookQuestionBankItem.findMany({
    where: {
      bookId,
      ...(subjectId ? { subjectId } : {}),
    },
    include: {
      subject: {
        select: {
          id: true,
          name: true,
          sortOrder: true,
        },
      },
      questionBankItem: {
        include: {
          folder: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: [{ subject: { sortOrder: "asc" } }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return items.map(serializeBookQuestionBankItemSummary);
};

export const createAdminBookQuestionBankItem = async ({ db, bookId, payload }) => {
  const subjectId = `${payload?.subjectId ?? ""}`.trim();
  const questionBankItemId = `${payload?.questionBankItemId ?? ""}`.trim();

  if (!subjectId) throw createHttpError("请选择科目");
  if (!questionBankItemId) throw createHttpError("请选择题目");

  await ensureBookSubjectExists({ db, bookId, subjectId });

  const questionBankItem = await db.questionBankItem.findUnique({
    where: {
      id: questionBankItemId,
    },
  });

  if (!questionBankItem) {
    throw createHttpError("题库题目不存在", 404);
  }

  const duplicatedItem = await db.bookQuestionBankItem.findFirst({
    where: {
      bookId,
      questionBankItemId,
    },
    select: {
      id: true,
    },
  });

  if (duplicatedItem) {
    throw createHttpError("该题目已加入当前题库产品", 409);
  }

  const maxSort = await db.bookQuestionBankItem.findFirst({
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

  const item = await db.bookQuestionBankItem.create({
    data: {
      bookId,
      subjectId,
      questionBankItemId,
      title: normalizeText(payload?.title) || null,
      questionNo: normalizeText(payload?.questionNo) || null,
      yearLabel: normalizeText(payload?.yearLabel) || null,
      pageLabel: normalizeText(payload?.pageLabel) || null,
      tagsJson: JSON.stringify(normalizeStringArray(payload?.tags)),
      sortOrder: toNonNegativeInt(payload?.sortOrder, Number(maxSort?.sortOrder ?? 0) + 1),
      status: payload?.status !== false,
    },
    include: {
      subject: {
        select: {
          id: true,
          name: true,
        },
      },
      questionBankItem: {
        include: {
          folder: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  return serializeBookQuestionBankItemSummary(item);
};

export const updateAdminBookQuestionBankItem = async ({ db, bookId, bookItemId, payload }) => {
  const existing = await db.bookQuestionBankItem.findFirst({
    where: {
      id: bookItemId,
      bookId,
    },
  });

  if (!existing) {
    throw createHttpError("题目映射不存在", 404);
  }

  const nextSubjectId = `${payload?.subjectId ?? existing.subjectId}`.trim();
  await ensureBookSubjectExists({ db, bookId, subjectId: nextSubjectId });

  const item = await db.bookQuestionBankItem.update({
    where: {
      id: bookItemId,
    },
    data: {
      subjectId: nextSubjectId,
      title: normalizeText(payload?.title) || null,
      questionNo: normalizeText(payload?.questionNo) || null,
      yearLabel: normalizeText(payload?.yearLabel) || null,
      pageLabel: normalizeText(payload?.pageLabel) || null,
      tagsJson: JSON.stringify(normalizeStringArray(payload?.tags)),
      sortOrder: toNonNegativeInt(payload?.sortOrder, Number(existing.sortOrder ?? 0)),
      status: payload?.status !== false,
    },
    include: {
      subject: {
        select: {
          id: true,
          name: true,
        },
      },
      questionBankItem: {
        include: {
          folder: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
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
    throw createHttpError("题目映射不存在", 404);
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
      include: {
        subject: true,
        questionBankItem: {
          include: {
            folder: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
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
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
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
    },
    create: {
      userId,
      bookId,
      bookItemId,
      questionBankItemId: bookItem.questionBankItemId,
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
    },
    create: {
      userId,
      bookId,
      bookItemId,
      questionBankItemId: bookItem.questionBankItemId,
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
  };
  const createData = {
    ...(isMastered !== undefined ? { isMastered: Boolean(isMastered) } : {}),
    ...(isRedoMarked !== undefined ? { isRedoMarked: Boolean(isRedoMarked) } : {}),
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
      questionBankItemId: bookItem.questionBankItemId,
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
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
    },
  });

  return {
    bookItemId: firstItem?.id ?? "",
  };
};
