import { prisma } from "../lib/prisma.js";

const folderName = "测试";
const itemStem = "【AI批改测试题】甲公司与乙公司买卖合同纠纷一案中，乙公司迟延交货，甲公司主张违约责任。请结合民法基本原理回答下列问题。";
const paperTitle = "AI批改测试卷（主观题）";
const badItemId = "cmotgfpt900009sci61wxfstk";
const badPaperId = "cmotghu3l0001y4cit2ruatvo";

const questionMeta = {
  sectionLabel: "案例分析题",
  sectionDescription: "请分小问作答，系统将按小问进行AI批改。",
  subQuestions: [
    {
      id: "sub_1",
      title: "问题（1）乙公司是否应承担违约责任？请说明理由。",
      placeholder: "请作答第一问",
      abilityLabel: "违约责任认定",
      referenceAnswer:
        "应认定乙公司承担违约责任。因为双方买卖合同依法成立并生效，乙公司未按约定期限交付设备，已构成迟延履行，应向甲公司承担继续履行、赔偿损失等违约责任。",
      rubricGuidance: "重点看是否写明合同有效、迟延交付、构成违约、应承担违约责任四个层次。",
      rubricPoints: [
        {
          id: "p1",
          title: "说明合同关系合法有效",
          score: 2,
          description: "明确双方买卖合同成立并生效",
          keywords: ["合同成立", "合同生效", "买卖合同"],
          sortOrder: 1,
        },
        {
          id: "p2",
          title: "指出乙公司迟延履行",
          score: 2,
          description: "明确未按约定期限交货",
          keywords: ["迟延交货", "迟延履行", "未按期交付"],
          sortOrder: 2,
        },
        {
          id: "p3",
          title: "得出构成违约并承担责任的结论",
          score: 4,
          description: "写明应承担违约责任",
          keywords: ["构成违约", "承担违约责任", "赔偿损失"],
          sortOrder: 3,
        },
      ],
      sortOrder: 1,
    },
    {
      id: "sub_2",
      title: "问题（2）甲公司主张损失赔偿时，赔偿范围应如何认定？",
      placeholder: "请作答第二问",
      abilityLabel: "损失赔偿分析",
      referenceAnswer:
        "赔偿范围一般以因违约所造成的实际损失和可得利益损失为限，但不得超过违约方订立合同时预见或应当预见到的因违约可能造成的损失。本案中，甲公司可主张因迟延交货产生的合理替代采购差价、仓储支出等与违约存在因果关系的损失。",
      rubricGuidance: "重点看是否写到实际损失、可得利益、可预见规则、合理损失项目。",
      rubricPoints: [
        {
          id: "p4",
          title: "说明赔偿包括实际损失和可得利益",
          score: 3,
          description: "写出损失赔偿的基本范围",
          keywords: ["实际损失", "可得利益"],
          sortOrder: 1,
        },
        {
          id: "p5",
          title: "写明可预见规则",
          score: 3,
          description: "损失不得超过订约时可预见范围",
          keywords: ["可预见", "应当预见", "订立合同时"],
          sortOrder: 2,
        },
        {
          id: "p6",
          title: "结合案情列举合理损失项目",
          score: 6,
          description: "如替代采购差价、仓储费等",
          keywords: ["替代采购", "差价损失", "仓储费", "仓储支出"],
          sortOrder: 3,
        },
      ],
      sortOrder: 2,
    },
  ],
};

const ensureFolder = async () => {
  const existing = await prisma.questionBankFolder.findFirst({
    where: {
      paperType: "subjective",
      name: folderName,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.questionBankFolder.create({
    data: {
      name: folderName,
      paperType: "subjective",
    },
  });
};

const deleteBadPaperIfSafe = async () => {
  const paper = await prisma.mockExamPaper.findUnique({
    where: { id: badPaperId },
    include: {
      _count: {
        select: {
          records: true,
        },
      },
    },
  });

  if (!paper) {
    return;
  }

  if (Number(paper._count?.records ?? 0) === 0) {
    await prisma.mockExamPaper.delete({
      where: { id: paper.id },
    });
  }
};

const deleteBadItemIfSafe = async () => {
  const item = await prisma.questionBankItem.findUnique({
    where: { id: badItemId },
    include: {
      _count: {
        select: {
          sourceQuestions: true,
        },
      },
    },
  });

  if (!item) {
    return;
  }

  if (Number(item._count?.sourceQuestions ?? 0) === 0) {
    await prisma.questionBankItem.delete({
      where: { id: item.id },
    });
  }
};

const ensureItem = async (folderId) => {
  const existing = await prisma.questionBankItem.findFirst({
    where: {
      folderId,
      stem: itemStem,
    },
  });

  const maxSort = await prisma.questionBankItem.findFirst({
    where: { folderId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const data = {
    folderId,
    type: "subjective_case",
    stem: itemStem,
    material:
      "案情：2024年3月，甲公司与乙公司签订设备买卖合同，约定乙公司于2024年4月1日前交付设备。乙公司迟延至2024年4月20日才交货，导致甲公司生产计划受阻并产生额外仓储与替代采购支出。甲公司起诉要求乙公司承担违约责任并赔偿损失。",
    analysis: "答题时注意区分违约责任的成立、损失赔偿范围以及守约方的举证重点。",
    score: 20,
    correctAnswerJson: JSON.stringify([]),
    questionMetaJson: JSON.stringify(questionMeta),
  };

  if (existing) {
    return prisma.questionBankItem.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.questionBankItem.create({
    data: {
      ...data,
      sortOrder: Number(maxSort?.sortOrder ?? 0) + 1,
    },
  });
};

const ensurePaper = async (item) => {
  const existing = await prisma.mockExamPaper.findFirst({
    where: {
      title: paperTitle,
    },
  });

  const maxSort = await prisma.mockExamPaper.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const paperData = {
    code: `ai_review_test_${Date.now().toString(36)}`,
    title: paperTitle,
    subtitle: "用于测试一题一个AI批改链路",
    paperType: "subjective",
    year: 2026,
    phase: "主观题",
    durationMinutes: 90,
    maxAttempts: 0,
    reviewEnabled: true,
    totalScore: 20,
    questionCount: 1,
    passScore: 12,
    description: "测试AI逐小问批改、点评、采分点命中与遗漏点展示。",
    status: "published",
  };

  if (existing) {
    return prisma.mockExamPaper.update({
      where: { id: existing.id },
      data: {
        ...paperData,
        code: existing.code,
        questions: {
          deleteMany: {},
          create: [
            {
              sourceBankItemId: item.id,
              type: "subjective_case",
              stem: item.stem,
              material: item.material,
              analysis: item.analysis,
              score: item.score,
              sortOrder: 1,
              correctAnswerJson: item.correctAnswerJson,
              questionMetaJson: item.questionMetaJson,
            },
          ],
        },
      },
    });
  }

  return prisma.mockExamPaper.create({
    data: {
      ...paperData,
      sortOrder: Number(maxSort?.sortOrder ?? 0) + 1,
      questions: {
        create: [
          {
            sourceBankItemId: item.id,
            type: "subjective_case",
            stem: item.stem,
            material: item.material,
            analysis: item.analysis,
            score: item.score,
            sortOrder: 1,
            correctAnswerJson: item.correctAnswerJson,
            questionMetaJson: item.questionMetaJson,
          },
        ],
      },
    },
  });
};

try {
  await deleteBadPaperIfSafe();
  await deleteBadItemIfSafe();
  const folder = await ensureFolder();
  const item = await ensureItem(folder.id);
  const paper = await ensurePaper(item);

  console.log(
    JSON.stringify(
      {
        folderId: folder.id,
        folderName: folder.name,
        itemId: item.id,
        stem: item.stem,
        paperId: paper.id,
        paperTitle: paper.title,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
