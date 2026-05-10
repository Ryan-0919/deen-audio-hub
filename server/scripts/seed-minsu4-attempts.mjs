import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import { finalizeMockExamRecord, saveMockExamAnswer, startMockExamRecord } from "../lib/mock-exam.js";

const phone = "15836288846";
const bankItemId = "cmou6vury0000vocig95rjowz";
const paperTitle = "通关宝-民诉4";

const attemptAnswers = [
  {
    sub_1:
      "(1)\n不得追加，侵权责任中第三人有权申请作为第三人参加诉讼，或者法院依职权追加，被告不得申请作为第三人参加诉讼",
    sub_2:
      "(2)\n可以另行提起诉讼，对于共同侵权责任中，原告不追加共同被告的，被告有权基于多承担的部分提起诉讼，并不违反重复起诉的条件",
    sub_3:
      "(3)\n不违反一事不再理，对此原则条件有三，诉讼的当事人相同，诉讼的标的相同，诉讼的请求相同，本案中前诉与后诉的均不相同",
  },
  {
    sub_1:
      "(1)\n法院不应追加，法院不告不理原则，本案不属于郑某与刘某共同侵权责任，原告可以选择告诉，但法院应向当事人释明追加刘某为共同被告",
    sub_2: "(2)\n不能，一事不再理原则",
    sub_3: "(3)\n违反，案件为同一案件，当事人没有变化，没有新事实，没有新证据",
  },
  {
    sub_1:
      "(1)\n不能。理由如下：对原被告争议的诉讼标的没有独立请求权但与案件的处理结果有法律上的利害关系而参加诉讼的人是无独立请求权的第三人。无独立请求权第三人可以申请参加诉讼或者法院依职权追加其参加诉讼。本案中，不能根据申请追加。",
    sub_2: "(2)\n能。孙某家属有诉讼权利能力，是诉讼的适格当事人。",
    sub_3:
      "(3)\n不违反。一事不再理原则，即重复起诉。重复起诉的情形是：后诉与前诉的当事人相同；后诉与前诉的诉讼标的相同；后诉与前诉的诉讼请求相同，或后诉的诉讼请求实质上否定前诉的裁判结果。 本案中，后诉的当事人是孙某家属和刘某，前诉的当事人是孙某家属和郑某，后诉和前诉的当事人不相同。",
  },
];

const buildPaperPayload = () => ({
  title: paperTitle,
  subtitle: "主观题模拟试卷",
  year: 2026,
  phase: "民诉",
  durationMinutes: 180,
  maxAttempts: 0,
  reviewEnabled: true,
  passScore: 9,
  description: "由题库题目自动组卷生成，用于 AI 批改测试。",
  status: "published",
});

const buildPaperCode = () => `minsu4_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

try {
  const user = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, phone: true },
  });

  if (!user) {
    throw new Error(`未找到手机号 ${phone} 对应的用户`);
  }

  let paper = await prisma.mockExamPaper.findFirst({
    where: {
      title: paperTitle,
      questions: {
        some: {
          sourceBankItemId: bankItemId,
        },
      },
    },
    include: {
      questions: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!paper) {
    const sourceItem = await prisma.questionBankItem.findUnique({
      where: { id: bankItemId },
      include: {
        options: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!sourceItem) {
      throw new Error("题库题目不存在");
    }

    const maxSortPaper = await prisma.mockExamPaper.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const paperConfig = buildPaperPayload();
    const createdPaper = await prisma.mockExamPaper.create({
      data: {
        code: buildPaperCode(),
        title: paperConfig.title,
        subtitle: paperConfig.subtitle,
        paperType: "subjective",
        year: paperConfig.year,
        phase: paperConfig.phase,
        durationMinutes: paperConfig.durationMinutes,
        maxAttempts: paperConfig.maxAttempts,
        reviewEnabled: paperConfig.reviewEnabled,
        totalScore: Number(sourceItem.score ?? 0),
        questionCount: 1,
        passScore: paperConfig.passScore,
        description: paperConfig.description,
        status: paperConfig.status,
        sortOrder: Number(maxSortPaper?.sortOrder ?? 0) + 1,
        questions: {
          create: [
            {
              sourceBankItemId: sourceItem.id,
              type: sourceItem.type,
              stem: sourceItem.stem,
              material: sourceItem.material ?? null,
              analysis: sourceItem.analysis ?? null,
              score: Number(sourceItem.score ?? 0),
              sortOrder: 1,
              correctAnswerJson: sourceItem.correctAnswerJson,
              questionMetaJson: sourceItem.questionMetaJson,
              options: {
                create: (sourceItem.options ?? []).map((option) => ({
                  optionKey: option.optionKey,
                  content: option.content,
                  sortOrder: Number(option.sortOrder ?? 0),
                })),
              },
            },
          ],
        },
      },
    });

    paper = await prisma.mockExamPaper.findUnique({
      where: { id: createdPaper.id },
      include: {
        questions: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
  }

  if (!paper) {
    throw new Error("试卷创建失败");
  }

  const targetQuestion = paper.questions[0];
  if (!targetQuestion) {
    throw new Error("试卷中没有题目");
  }

  const questionMeta = JSON.parse(targetQuestion.questionMetaJson ?? "{}");
  const subQuestions = Array.isArray(questionMeta.subQuestions) ? questionMeta.subQuestions : [];

  if (subQuestions.length !== 3) {
    throw new Error(`小问数量不符，当前为 ${subQuestions.length}`);
  }

  await prisma.mockExamRecord.deleteMany({
    where: {
      userId: user.id,
      paperId: paper.id,
      status: "in_progress",
    },
  });

  const results = [];

  for (let index = 0; index < attemptAnswers.length; index += 1) {
    const answerSet = attemptAnswers[index];
    const now = new Date(Date.now() + index * 60_000);

    const record = await startMockExamRecord({
      db: prisma,
      paperId: paper.id,
      userId: user.id,
      currentTime: now,
    });

    for (const subQuestion of subQuestions) {
      const answerText = answerSet[subQuestion.id] ?? "";
      await saveMockExamAnswer({
        db: prisma,
        recordId: record.id,
        userId: user.id,
        questionId: targetQuestion.id,
        subQuestionId: subQuestion.id,
        answerText,
        currentTime: new Date(now.getTime() + 10_000),
      });
    }

    const submitted = await finalizeMockExamRecord({
      db: prisma,
      recordId: record.id,
      userId: user.id,
      currentTime: new Date(now.getTime() + 20_000),
    });

    results.push({
      attemptIndex: index + 1,
      recordId: submitted.id,
      attemptNo: submitted.attemptNo,
      status: submitted.status,
      submittedAt: submitted.submittedAt,
    });
  }

  console.log(
    JSON.stringify(
      {
        phone,
        userId: user.id,
        paperId: paper.id,
        paperTitle: paper.title,
        questionId: targetQuestion.id,
        createdAttempts: results,
      },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}
