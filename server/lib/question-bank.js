import { formatDateTime } from "./time.js";
import { questionTypeLabelMap } from "./question-bank-excel.js";

const subjectiveQuestionType = "subjective_case";

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const parseJsonSafely = (value, fallback) => {
  if (!value) return fallback;

  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
};

const normalizeText = (value) => `${value ?? ""}`.replace(/\r\n/g, "\n").trim();
const normalizeKeywords = (value) =>
  Array.from(
    new Set(
      (Array.isArray(value) ? value : `${value ?? ""}`.split(/[\n,，、；;]/))
        .map((item) => `${item ?? ""}`.trim())
        .filter(Boolean),
    ),
  );

const normalizeRubricPoints = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((item, index) => ({
      id: `${item?.id ?? `point_${index + 1}`}`.trim(),
      title: normalizeText(item?.title),
      score: Math.max(0, Number.parseInt(`${item?.score ?? ""}`, 10) || 0),
      description: normalizeText(item?.description),
      keywords: normalizeKeywords(item?.keywords),
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
      id: item.id || `point_${index + 1}`,
      sortOrder: index + 1,
    }));

const normalizeAnswerKeys = (values = []) =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((item) => `${item ?? ""}`.trim().toUpperCase())
        .filter(Boolean),
    ),
  ).sort();

const isSubjectiveQuestionType = (type) => type === subjectiveQuestionType;
const getPaperTypeByQuestionType = (type) => (isSubjectiveQuestionType(type) ? "subjective" : "objective");

const normalizeObjectiveOptions = (options = []) =>
  options
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
      title: stem || "请作答",
      placeholder: "请在此输入答案。",
      abilityLabel: "",
      referenceAnswer: "",
      rubricGuidance: "",
      rubricPoints: [],
      sortOrder: 1,
    },
  ];
};

const parseQuestionMeta = (item) => {
  const raw = parseJsonSafely(item?.questionMetaJson, {});
  const title = normalizeText(raw?.title);
  const sectionLabel = normalizeText(raw?.sectionLabel) || questionTypeLabelMap[item?.type] || "题目";
  const sectionDescription = normalizeText(raw?.sectionDescription);
  const subjectiveSubQuestions = isSubjectiveQuestionType(item?.type)
    ? normalizeSubjectiveSubQuestions(raw?.subQuestions, item?.stem)
    : [];

  return {
    title,
    sectionLabel,
    sectionDescription,
    subjectiveSubQuestions,
  };
};

const serializeQuestionBankFolder = (folder) => ({
  id: folder.id,
  name: normalizeText(folder.name),
  paperType: folder.paperType,
  questionCount: Number(folder._count?.items ?? 0),
  createdAt: formatDateTime(folder.createdAt),
  updatedAt: formatDateTime(folder.updatedAt),
});

const serializeQuestionBankItem = (item) => {
  const questionMeta = parseQuestionMeta(item);

  return {
    id: item.id,
    folderId: item.folderId,
    folderName: normalizeText(item.folder?.name),
    paperType: item.folder?.paperType ?? getPaperTypeByQuestionType(item.type),
    questionType: item.type,
    questionTypeLabel: questionTypeLabelMap[item.type] ?? item.type,
    title: questionMeta.title,
    stem: normalizeText(item.stem),
    material: normalizeText(item.material),
    analysis: normalizeText(item.analysis),
    score: Number(item.score ?? 0),
    sortOrder: Number(item.sortOrder ?? 0),
    correctAnswerKeys: normalizeAnswerKeys(parseJsonSafely(item.correctAnswerJson, [])),
    options: (item.options ?? [])
      .slice()
      .sort((left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0))
      .map((option) => ({
        id: option.id,
        key: `${option.optionKey ?? ""}`.trim().toUpperCase(),
        content: normalizeText(option.content),
      })),
    sectionLabel: questionMeta.sectionLabel,
    sectionDescription: questionMeta.sectionDescription,
    subjectiveSubQuestions: questionMeta.subjectiveSubQuestions.map((subQuestion) => ({
      id: subQuestion.id,
      title: subQuestion.title,
      placeholder: subQuestion.placeholder,
      abilityLabel: subQuestion.abilityLabel,
      referenceAnswer: subQuestion.referenceAnswer,
      rubricGuidance: subQuestion.rubricGuidance,
      rubricPoints: subQuestion.rubricPoints.map((point) => ({
        id: point.id,
        title: point.title,
        score: point.score,
        description: point.description,
        keywords: point.keywords,
      })),
    })),
    lessonAudioUrl: normalizeText(item.lessonAudioUrl),
    lessonAudioObjectKey: normalizeText(item.lessonAudioObjectKey),
    lessonAudioDurationSeconds: Number(item.lessonAudioDurationSeconds ?? 0) || 0,
    createdAt: formatDateTime(item.createdAt),
    updatedAt: formatDateTime(item.updatedAt),
  };
};

const buildQuestionMetaJson = ({ questionType, title, sectionLabel, sectionDescription, subjectiveSubQuestions, stem }) => {
  const normalizedTitle = normalizeText(title);
  const normalizedSectionLabel = normalizeText(sectionLabel);
  const normalizedSectionDescription = normalizeText(sectionDescription);

  if (!isSubjectiveQuestionType(questionType) && !normalizedTitle && !normalizedSectionLabel && !normalizedSectionDescription) {
    return null;
  }

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

const validateQuestionInput = ({ folder, payload }) => {
  if (!folder) {
    throw createHttpError("目标文件夹不存在", 404);
  }

  const questionType = `${payload?.questionType ?? payload?.type ?? ""}`.trim();
  const stem = normalizeText(payload?.stem);
  const material = normalizeText(payload?.material);
  const analysis = normalizeText(payload?.analysis);
  const lessonAudioUrl = normalizeText(payload?.lessonAudioUrl);
  const lessonAudioObjectKey = normalizeText(payload?.lessonAudioObjectKey);
  const lessonAudioDurationSeconds = Math.max(0, Number.parseInt(`${payload?.lessonAudioDurationSeconds ?? ""}`, 10) || 0);
  const score = Number.parseInt(`${payload?.score ?? ""}`, 10);
  const normalizedScore = Number.isFinite(score) && score > 0 ? score : isSubjectiveQuestionType(questionType) ? 20 : 2;
  const paperType = getPaperTypeByQuestionType(questionType);

  if (!questionTypeLabelMap[questionType]) {
    throw createHttpError("题型不正确");
  }

  if (folder.paperType !== paperType) {
    throw createHttpError(folder.paperType === "objective" ? "客观题文件夹不能保存主观题" : "主观题文件夹只能保存主观题");
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

    if (correctAnswerKeys.length === 0) {
      throw createHttpError("请至少设置一个正确答案");
    }

    const optionKeySet = new Set(options.map((option) => option.key));
    if (correctAnswerKeys.some((key) => !optionKeySet.has(key))) {
      throw createHttpError("正确答案必须来自已填写的选项");
    }

    if (questionType === "single_choice" && correctAnswerKeys.length !== 1) {
      throw createHttpError("单选题必须只有一个正确答案");
    }

    if (questionType === "multiple_choice" && correctAnswerKeys.length < 2) {
      throw createHttpError("多选题至少需要两个正确答案");
    }

    return {
      questionType,
      stem,
      material,
      analysis,
      lessonAudioUrl,
      lessonAudioObjectKey,
      lessonAudioDurationSeconds,
      score: normalizedScore,
      correctAnswerJson: JSON.stringify(correctAnswerKeys),
      options,
      questionMetaJson: buildQuestionMetaJson({
      title: payload?.title,
      questionType,
      sectionLabel: payload?.sectionLabel,
      sectionDescription: payload?.sectionDescription,
      subjectiveSubQuestions: [],
      stem,
    }),
  };
  }

  return {
    questionType,
    stem,
    material,
    analysis,
    lessonAudioUrl,
    lessonAudioObjectKey,
    lessonAudioDurationSeconds,
    score: normalizedScore,
    correctAnswerJson: JSON.stringify([]),
    options: [],
    questionMetaJson: buildQuestionMetaJson({
      title: payload?.title,
      questionType,
      sectionLabel: payload?.sectionLabel,
      sectionDescription: payload?.sectionDescription,
      subjectiveSubQuestions: payload?.subjectiveSubQuestions,
      stem,
    }),
  };
};

const createQuestionItemData = ({ folderId, nextSortOrder, validated }) => ({
  folderId,
  type: validated.questionType,
  stem: validated.stem,
  material: validated.material || null,
  analysis: validated.analysis || null,
  lessonAudioUrl: validated.lessonAudioUrl || null,
  lessonAudioObjectKey: validated.lessonAudioObjectKey || null,
  lessonAudioDurationSeconds: Number(validated.lessonAudioDurationSeconds ?? 0) || 0,
  score: validated.score,
  sortOrder: nextSortOrder,
  correctAnswerJson: validated.correctAnswerJson,
  questionMetaJson: validated.questionMetaJson,
  options: {
    create: validated.options.map((option) => ({
      optionKey: option.key,
      content: option.content,
      sortOrder: option.sortOrder,
    })),
  },
});

export const getQuestionBankSummary = async ({ db }) => {
  const [totalFolders, totalQuestions, subjectiveQuestions] = await Promise.all([
    db.questionBankFolder.count(),
    db.questionBankItem.count(),
    db.questionBankItem.count({
      where: {
        type: subjectiveQuestionType,
      },
    }),
  ]);

  return {
    totalFolders,
    totalQuestions,
    objectiveQuestions: Math.max(0, totalQuestions - subjectiveQuestions),
    subjectiveQuestions,
  };
};

export const listQuestionBankFolders = async ({ db, paperType }) => {
  const folders = await db.questionBankFolder.findMany({
    where: {
      paperType,
    },
    include: {
      _count: {
        select: {
          items: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
  });

  return folders.map(serializeQuestionBankFolder);
};

export const createQuestionBankFolder = async ({ db, name, paperType }) => {
  const normalizedName = normalizeText(name);
  if (!normalizedName) {
    throw createHttpError("文件夹名称不能为空");
  }

  try {
    const folder = await db.questionBankFolder.create({
      data: {
        name: normalizedName,
        paperType,
      },
      include: {
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    return serializeQuestionBankFolder(folder);
  } catch (error) {
    if (error?.code === "P2002") {
      throw createHttpError("同类型下已存在同名文件夹");
    }

    throw error;
  }
};

export const updateQuestionBankFolder = async ({ db, folderId, name }) => {
  const normalizedName = normalizeText(name);
  if (!normalizedName) {
    throw createHttpError("文件夹名称不能为空");
  }

  const existing = await db.questionBankFolder.findUnique({
    where: {
      id: folderId,
    },
  });

  if (!existing) {
    throw createHttpError("文件夹不存在", 404);
  }

  try {
    const folder = await db.questionBankFolder.update({
      where: {
        id: folderId,
      },
      data: {
        name: normalizedName,
      },
      include: {
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    return serializeQuestionBankFolder(folder);
  } catch (error) {
    if (error?.code === "P2002") {
      throw createHttpError("同类型下已存在同名文件夹");
    }

    throw error;
  }
};

export const deleteQuestionBankFolder = async ({ db, folderId }) => {
  const folder = await db.questionBankFolder.findUnique({
    where: {
      id: folderId,
    },
    include: {
      _count: {
        select: {
          items: true,
        },
      },
    },
  });

  if (!folder) {
    throw createHttpError("文件夹不存在", 404);
  }

  if (Number(folder._count?.items ?? 0) > 0) {
    throw createHttpError("请先清空文件夹中的题目后再删除");
  }

  await db.questionBankFolder.delete({
    where: {
      id: folderId,
    },
  });

  return {
    success: true,
  };
};

export const listQuestionBankItems = async ({ db, paperType, folderId, keyword, questionType, page, pageSize }) => {
  const where = {
    folder: {
      is: {
        paperType,
      },
    },
    ...(folderId ? { folderId } : {}),
    ...(questionType ? { type: questionType } : {}),
    ...(keyword
      ? {
          OR: [
            {
              stem: {
                contains: keyword,
              },
            },
            {
              material: {
                contains: keyword,
              },
            },
            {
              analysis: {
                contains: keyword,
              },
            },
            {
              folder: {
                is: {
                  name: {
                    contains: keyword,
                  },
                },
              },
            },
          ],
        }
      : {}),
  };

  const total = await db.questionBankItem.count({ where });
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const currentPage = Math.min(page, totalPages);
  const items =
    total === 0
      ? []
      : await db.questionBankItem.findMany({
          where,
          include: {
            folder: {
              select: {
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
          orderBy: folderId ? [{ sortOrder: "asc" }, { updatedAt: "desc" }] : [{ updatedAt: "desc" }, { id: "desc" }],
          skip: (currentPage - 1) * pageSize,
          take: pageSize,
        });

  return {
    items: items.map(serializeQuestionBankItem),
    total,
    page: currentPage,
    pageSize,
    totalPages,
  };
};

export const createQuestionBankItem = async ({ db, payload }) => {
  const folderId = `${payload?.folderId ?? ""}`.trim();
  if (!folderId) {
    throw createHttpError("请选择文件夹");
  }

  const folder = await db.questionBankFolder.findUnique({
    where: {
      id: folderId,
    },
  });

  const validated = validateQuestionInput({
    folder,
    payload,
  });

  const item = await db.$transaction(async (tx) => {
    const maxSortItem = await tx.questionBankItem.findFirst({
      where: {
        folderId,
      },
      orderBy: {
        sortOrder: "desc",
      },
      select: {
        sortOrder: true,
      },
    });

    return tx.questionBankItem.create({
      data: createQuestionItemData({
        folderId,
        nextSortOrder: Number(maxSortItem?.sortOrder ?? 0) + 1,
        validated,
      }),
      include: {
        folder: {
          select: {
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
    });
  });

  return serializeQuestionBankItem(item);
};

export const updateQuestionBankItem = async ({ db, itemId, payload }) => {
  const existing = await db.questionBankItem.findUnique({
    where: {
      id: itemId,
    },
    select: {
      id: true,
      folderId: true,
    },
  });

  if (!existing) {
    throw createHttpError("题目不存在", 404);
  }

  const nextFolderId = `${payload?.folderId ?? existing.folderId}`.trim();
  const folder = await db.questionBankFolder.findUnique({
    where: {
      id: nextFolderId,
    },
  });

  const validated = validateQuestionInput({
    folder,
    payload: {
      ...payload,
      folderId: nextFolderId,
    },
  });

  const item = await db.$transaction(async (tx) => {
    const sortOrder =
      nextFolderId === existing.folderId
        ? undefined
        : Number(
            (
              await tx.questionBankItem.findFirst({
                where: {
                  folderId: nextFolderId,
                },
                orderBy: {
                  sortOrder: "desc",
                },
                select: {
                  sortOrder: true,
                },
              })
            )?.sortOrder ?? 0,
          ) + 1;

    await tx.questionBankItemOption.deleteMany({
      where: {
        itemId,
      },
    });

    return tx.questionBankItem.update({
      where: {
        id: itemId,
      },
      data: {
        folderId: nextFolderId,
        type: validated.questionType,
        stem: validated.stem,
        material: validated.material || null,
        analysis: validated.analysis || null,
        lessonAudioUrl: validated.lessonAudioUrl || null,
        lessonAudioObjectKey: validated.lessonAudioObjectKey || null,
        lessonAudioDurationSeconds: Number(validated.lessonAudioDurationSeconds ?? 0) || 0,
        score: validated.score,
        ...(sortOrder ? { sortOrder } : {}),
        correctAnswerJson: validated.correctAnswerJson,
        questionMetaJson: validated.questionMetaJson,
        options: {
          create: validated.options.map((option) => ({
            optionKey: option.key,
            content: option.content,
            sortOrder: option.sortOrder,
          })),
        },
      },
      include: {
        folder: {
          select: {
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
    });
  });

  return serializeQuestionBankItem(item);
};

export const deleteQuestionBankItem = async ({ db, itemId }) => {
  const existing = await db.questionBankItem.findUnique({
    where: {
      id: itemId,
    },
    select: {
      id: true,
    },
  });

  if (!existing) {
    throw createHttpError("题目不存在", 404);
  }

  await db.questionBankItem.delete({
    where: {
      id: itemId,
    },
  });

  return {
    success: true,
  };
};

export const importQuestionBankItems = async ({ db, folderId, items }) => {
  if (!folderId) {
    throw createHttpError("请选择导入文件夹");
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw createHttpError("模板中没有可导入的题目");
  }

  const folder = await db.questionBankFolder.findUnique({
    where: {
      id: folderId,
    },
  });

  if (!folder) {
    throw createHttpError("文件夹不存在", 404);
  }

  return db.$transaction(async (tx) => {
    const maxSortItem = await tx.questionBankItem.findFirst({
      where: {
        folderId,
      },
      orderBy: {
        sortOrder: "desc",
      },
      select: {
        sortOrder: true,
      },
    });

    let sortOrderCursor = Number(maxSortItem?.sortOrder ?? 0);
    let createdCount = 0;

    for (const source of items) {
      const validated = validateQuestionInput({
        folder,
        payload: {
          folderId,
          questionType: source.type,
          title: source.questionMeta?.title,
          stem: source.stem,
          material: source.material,
          analysis: source.analysis,
          score: source.score,
          correctAnswerKeys: source.correctAnswerKeys,
          options: source.options,
          sectionLabel: source.questionMeta?.sectionLabel,
          sectionDescription: source.questionMeta?.sectionDescription,
          subjectiveSubQuestions: source.questionMeta?.subQuestions,
        },
      });

      sortOrderCursor += 1;

      await tx.questionBankItem.create({
        data: createQuestionItemData({
          folderId,
          nextSortOrder: sortOrderCursor,
          validated,
        }),
      });

      createdCount += 1;
    }

    return {
      parsedCount: items.length,
      createdCount,
    };
  });
};

const toNullableString = (value) => {
  const normalized = normalizeText(value);
  return normalized || null;
};

const syncSeriesPaperPermissions = async ({ db, paperId, seriesId }) => {
  const normalizedPaperId = `${paperId ?? ""}`.trim();
  const normalizedSeriesId = `${seriesId ?? ""}`.trim();
  if (!normalizedPaperId || !normalizedSeriesId) {
    return;
  }

  const seriesPermissionRows = await db.userMockExamSeriesPermission.findMany({
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

  await db.userMockExamPermission.createMany({
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

const generatePaperCode = () => `qb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const toPaperStatus = (value) => (`${value ?? ""}`.trim() === "published" ? "published" : "draft");
const toReviewEnabled = (value, fallback = true) => (value === undefined ? fallback : `${value}` !== "false");

export const createMockExamPaperFromQuestionBank = async ({ db, itemIds, paper }) => {
  const normalizedItemIds = Array.from(new Set((Array.isArray(itemIds) ? itemIds : []).map((item) => `${item ?? ""}`.trim()).filter(Boolean)));
  if (normalizedItemIds.length === 0) {
    throw createHttpError("请至少选择一道题目");
  }

  const selectedItems = await db.questionBankItem.findMany({
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

  const paperTypes = new Set(orderedItems.map((item) => getPaperTypeByQuestionType(item.type)));
  if (paperTypes.size > 1) {
    throw createHttpError("客观题和主观题不能混合组卷");
  }

  const title = normalizeText(paper?.title);
  if (!title) {
    throw createHttpError("试卷标题不能为空");
  }

  const year = Number.parseInt(`${paper?.year ?? ""}`.trim(), 10);
  const durationMinutes = Number.parseInt(`${paper?.durationMinutes ?? ""}`.trim(), 10);
  const passScore = Number.parseInt(`${paper?.passScore ?? ""}`.trim(), 10);
  const sortOrder = Number.parseInt(`${paper?.sortOrder ?? ""}`.trim(), 10);
  const seriesId = `${paper?.seriesId ?? ""}`.trim();
  const totalScore = orderedItems.reduce((sum, item) => sum + Number(item.score ?? 0), 0);

  const maxSortPaper = await db.mockExamPaper.findFirst({
    orderBy: {
      sortOrder: "desc",
    },
    select: {
      sortOrder: true,
    },
  });

  try {
    const created = await db.mockExamPaper.create({
      data: {
        seriesId: seriesId || null,
        code: normalizeText(paper?.code) || generatePaperCode(),
        title,
        subtitle: toNullableString(paper?.subtitle),
        coverUrl: null,
        coverObjectKey: null,
        paperType: paperTypes.has("subjective") ? "subjective" : "objective",
        year: Number.isFinite(year) && year > 0 ? year : null,
        phase: toNullableString(paper?.phase),
        durationMinutes: Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : paperTypes.has("subjective") ? 240 : 90,
        maxAttempts: Number.parseInt(`${paper?.maxAttempts ?? ""}`.trim(), 10) >= 0 ? Number.parseInt(`${paper?.maxAttempts ?? ""}`.trim(), 10) : 0,
        reviewEnabled: toReviewEnabled(paper?.reviewEnabled, paperTypes.has("subjective")),
        totalScore,
        questionCount: orderedItems.length,
        passScore: Number.isFinite(passScore) && passScore >= 0 ? passScore : Math.max(1, Math.round(totalScore * 0.6)),
        description: toNullableString(paper?.description),
        status: toPaperStatus(paper?.status),
        sortOrder: Number.isFinite(sortOrder) && sortOrder > 0 ? sortOrder : Number(maxSortPaper?.sortOrder ?? 0) + 1,
        questions: {
          create: orderedItems.map((item, index) => ({
            sourceBankItemId: item.id,
            type: item.type,
            stem: item.stem,
            material: item.material ?? null,
            analysis: item.analysis ?? null,
            score: Number(item.score ?? 0),
            sortOrder: index + 1,
            correctAnswerJson: item.correctAnswerJson,
            questionMetaJson: item.questionMetaJson,
            options: {
              create: (item.options ?? []).map((option) => ({
                optionKey: option.optionKey,
                content: option.content,
                sortOrder: Number(option.sortOrder ?? 0),
              })),
            },
          })),
        },
      },
      select: {
        id: true,
        title: true,
        totalScore: true,
        questionCount: true,
      },
    });

    await syncSeriesPaperPermissions({
      db,
      paperId: created.id,
      seriesId,
    });

    return {
      paperId: created.id,
      title: created.title,
      totalScore: Number(created.totalScore ?? 0),
      questionCount: Number(created.questionCount ?? 0),
    };
  } catch (error) {
    if (error?.code === "P2002") {
      throw createHttpError("试卷编号已存在，请修改后重试");
    }

    throw error;
  }
};
