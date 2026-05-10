import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../lib/prisma.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.resolve(__dirname, "..", "..", "..", "测试题");
const folderName = "测试题";
const sectionLabel = "案例分析题";
const sectionDescription = "请结合案情按小问分别作答，系统将按小问进行批改。";

const normalizeText = (value) => `${value ?? ""}`.replace(/\r\n/g, "\n").replace(/\uFEFF/g, "").trim();

const splitNonEmptyKeywords = (value) =>
  Array.from(
    new Set(
      `${value ?? ""}`
        .split(/[、，,；;：:\s]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ).slice(0, 6);

const buildQuestionMetaJson = (subQuestions) =>
  JSON.stringify({
    sectionLabel,
    sectionDescription,
    subQuestions: subQuestions.map((subQuestion, subQuestionIndex) => ({
      id: `sub_${subQuestionIndex + 1}`,
      title: subQuestion.title,
      placeholder: "请在此输入本问答案。",
      abilityLabel: `第${subQuestionIndex + 1}问`,
      referenceAnswer: subQuestion.referenceAnswer,
      rubricGuidance: subQuestion.rubricGuidance,
      rubricPoints: subQuestion.rubricPoints.map((point, pointIndex) => ({
        id: `p_${subQuestionIndex + 1}_${pointIndex + 1}`,
        title: point.title,
        score: point.score,
        description: point.description,
        keywords: point.keywords,
        sortOrder: pointIndex + 1,
      })),
      sortOrder: subQuestionIndex + 1,
    })),
  });

const findLineIndex = (lines, matcher) => lines.findIndex((line) => matcher(line.trim()));

const parseRubricPoints = (scoreLines) => {
  const parsed = [];

  for (const rawLine of scoreLines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/[：:]$/.test(line)) continue;
    if (!/^(?:\d+\.|[（(]\d+[）)])/.test(line)) continue;

    const matches = Array.from(line.matchAll(/[（(](\d+)分[）)]/g));
    const lastMatch = matches.at(-1);
    if (!lastMatch) continue;

    const score = Number.parseInt(lastMatch[1], 10);
    if (!Number.isFinite(score) || score <= 0) continue;

    const title = line
      .replace(/^\d+\.\s*/, "")
      .replace(/^[（(]\d+[）)]\s*/, "")
      .replace(/[（(]\d+分[）)]/g, "")
      .replace(/^(?:结论|理由)[:：]\s*/, "")
      .replace(/[；;。]+$/g, "")
      .trim();

    if (!title) continue;

    parsed.push({
      title,
      score,
      description: title,
      keywords: splitNonEmptyKeywords(title),
    });
  }

  return parsed;
};

const parseMarkdownPaper = (fileName, rawContent) => {
  const content = normalizeText(rawContent);
  const lines = content.split("\n").map((line) => line.trimRight());
  const title = lines.find((line) => line.trim())?.trim();

  if (!title) {
    throw new Error(`文件 ${fileName} 缺少标题`);
  }

  const caseStartIndex = findLineIndex(lines, (line) => /^案情[:：]?$/.test(line));
  const questionHeaderIndex = findLineIndex(lines, (line) => line === "问题");

  if (caseStartIndex < 0 || questionHeaderIndex < 0 || questionHeaderIndex <= caseStartIndex) {
    throw new Error(`文件 ${fileName} 的案情/问题结构无法识别`);
  }

  const stem = normalizeText(lines.slice(caseStartIndex + 1, questionHeaderIndex).join("\n"));
  if (!stem) {
    throw new Error(`文件 ${fileName} 缺少案情内容`);
  }

  const questionLines = lines.slice(questionHeaderIndex + 1);
  const questionBlocks = [];
  let currentBlock = null;

  for (const rawLine of questionLines) {
    const line = rawLine.trim();
    if (/^\d+\..+[？?]$/.test(line)) {
      currentBlock = {
        title: line,
        lines: [],
      };
      questionBlocks.push(currentBlock);
      continue;
    }

    if (currentBlock) {
      currentBlock.lines.push(rawLine);
    }
  }

  if (questionBlocks.length === 0) {
    throw new Error(`文件 ${fileName} 未解析到题目`);
  }

  const subQuestions = questionBlocks.map((block, index) => {
    const referenceIndex = findLineIndex(block.lines, (line) => line === "参考答案");
    const scoreIndex = findLineIndex(block.lines, (line) => line.startsWith("得分点（总分数"));
    const rubricIndex = findLineIndex(block.lines, (line) => line === "阅卷标准与评分细则");

    if (referenceIndex < 0 || scoreIndex < 0 || rubricIndex < 0 || !(referenceIndex < scoreIndex && scoreIndex < rubricIndex)) {
      throw new Error(`文件 ${fileName} 的第 ${index + 1} 问结构不完整`);
    }

    const referenceAnswer = normalizeText(block.lines.slice(referenceIndex + 1, scoreIndex).join("\n"));
    const scoreLines = block.lines.slice(scoreIndex + 1, rubricIndex).map((line) => line.trim()).filter(Boolean);
    const rubricText = normalizeText(block.lines.slice(rubricIndex + 1).join("\n"));
    const rubricPoints = parseRubricPoints(scoreLines);

    if (!referenceAnswer) {
      throw new Error(`文件 ${fileName} 的第 ${index + 1} 问缺少参考答案`);
    }

    if (rubricPoints.length === 0) {
      throw new Error(`文件 ${fileName} 的第 ${index + 1} 问缺少可识别的得分点`);
    }

    return {
      title: block.title,
      referenceAnswer,
      rubricGuidance: normalizeText(`得分点：\n${scoreLines.join("\n")}\n\n阅卷标准与评分细则：\n${rubricText}`),
      rubricPoints,
    };
  });

  const totalScore = subQuestions.reduce(
    (sum, subQuestion) => sum + subQuestion.rubricPoints.reduce((subSum, point) => subSum + point.score, 0),
    0,
  );

  return {
    fileName,
    title,
    stem,
    analysis: `请围绕本题中的民法争议点分别作答，系统会按小问进行批改。`,
    totalScore,
    passScore: Math.max(1, Math.round(totalScore * 0.6)),
    subQuestions,
    phase: title.replace(/第.*$/, "").trim() || "主观题",
  };
};

const getNextSortOrder = async (model, where = {}) => {
  const record = await prisma[model].findFirst({
    where,
    orderBy: {
      sortOrder: "desc",
    },
    select: {
      sortOrder: true,
    },
  });

  return Number(record?.sortOrder ?? 0) + 1;
};

const ensureFolder = async () => {
  const existing = await prisma.questionBankFolder.findFirst({
    where: {
      paperType: "subjective",
      name: folderName,
    },
  });

  if (existing) {
    return {
      folder: existing,
      mode: "existing",
    };
  }

  const created = await prisma.questionBankFolder.create({
    data: {
      name: folderName,
      paperType: "subjective",
    },
  });

  return {
    folder: created,
    mode: "created",
  };
};

const ensureQuestionBankItem = async (folderId, seed) => {
  const questionMetaJson = buildQuestionMetaJson(seed.subQuestions);
  const existing = await prisma.questionBankItem.findFirst({
    where: {
      folderId,
      stem: seed.stem,
      type: "subjective_case",
    },
    select: {
      id: true,
      sortOrder: true,
    },
  });

  const data = {
    folderId,
    type: "subjective_case",
    stem: seed.stem,
    material: "案情",
    analysis: seed.analysis,
    score: seed.totalScore,
    correctAnswerJson: JSON.stringify([]),
    questionMetaJson,
  };

  if (existing) {
    const updated = await prisma.questionBankItem.update({
      where: {
        id: existing.id,
      },
      data,
      select: {
        id: true,
      },
    });

    return {
      itemId: updated.id,
      mode: "updated",
    };
  }

  const created = await prisma.questionBankItem.create({
    data: {
      ...data,
      sortOrder: await getNextSortOrder("questionBankItem", { folderId }),
    },
    select: {
      id: true,
    },
  });

  return {
    itemId: created.id,
    mode: "created",
  };
};

const ensurePaper = async (seed, itemId) => {
  const existing = await prisma.mockExamPaper.findFirst({
    where: {
      title: seed.title,
      paperType: "subjective",
    },
    orderBy: [
      {
        updatedAt: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
    select: {
      id: true,
      code: true,
      coverUrl: true,
      coverObjectKey: true,
      _count: {
        select: {
          records: true,
        },
      },
      questions: {
        select: {
          sourceBankItemId: true,
        },
      },
    },
  });

  if (existing && existing.questions.length === 1 && existing.questions[0]?.sourceBankItemId === itemId) {
    return {
      paperId: existing.id,
      mode: "existing",
    };
  }

  const questionItem = await prisma.questionBankItem.findUniqueOrThrow({
    where: {
      id: itemId,
    },
    select: {
      id: true,
      stem: true,
      material: true,
      analysis: true,
      score: true,
      correctAnswerJson: true,
      questionMetaJson: true,
    },
  });

  const paperData = {
    title: seed.title,
    subtitle: "主观题模拟卷",
    paperType: "subjective",
    year: 2026,
    phase: seed.phase,
    durationMinutes: 180,
    maxAttempts: 0,
    reviewEnabled: true,
    totalScore: seed.totalScore,
    questionCount: 1,
    passScore: seed.passScore,
    description: `由 ${folderName} 目录导入生成的单题主观卷。`,
    status: "published",
  };

  if (existing && Number(existing._count?.records ?? 0) === 0) {
    const updated = await prisma.mockExamPaper.update({
      where: {
        id: existing.id,
      },
      data: {
        ...paperData,
        code: existing.code,
        coverUrl: existing.coverUrl,
        coverObjectKey: existing.coverObjectKey,
        questions: {
          deleteMany: {},
          create: [
            {
              sourceBankItemId: questionItem.id,
              type: "subjective_case",
              stem: questionItem.stem,
              material: questionItem.material,
              analysis: questionItem.analysis,
              score: questionItem.score,
              sortOrder: 1,
              correctAnswerJson: questionItem.correctAnswerJson,
              questionMetaJson: questionItem.questionMetaJson,
            },
          ],
        },
      },
      select: {
        id: true,
      },
    });

    return {
      paperId: updated.id,
      mode: "updated",
    };
  }

  if (existing && Number(existing._count?.records ?? 0) > 0) {
    throw new Error(`试卷《${seed.title}》已存在且已有作答记录，脚本未覆盖该试卷，请改名后重试。`);
  }

  const created = await prisma.mockExamPaper.create({
    data: {
      ...paperData,
      code: `import_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      sortOrder: await getNextSortOrder("mockExamPaper"),
      questions: {
        create: [
          {
            sourceBankItemId: questionItem.id,
            type: "subjective_case",
            stem: questionItem.stem,
            material: questionItem.material,
            analysis: questionItem.analysis,
            score: questionItem.score,
            sortOrder: 1,
            correctAnswerJson: questionItem.correctAnswerJson,
            questionMetaJson: questionItem.questionMetaJson,
          },
        ],
      },
    },
    select: {
      id: true,
    },
  });

  return {
    paperId: created.id,
    mode: "created",
  };
};

try {
  const fileNames = (await readdir(sourceDir))
    .filter((fileName) => fileName.toLowerCase().endsWith(".md"))
    .sort((left, right) => left.localeCompare(right, "zh-Hans-CN"));

  if (fileNames.length === 0) {
    throw new Error(`目录 ${sourceDir} 下没有可导入的 markdown 文件`);
  }

  const seeds = [];
  for (const fileName of fileNames) {
    const fullPath = path.join(sourceDir, fileName);
    const rawContent = await readFile(fullPath, "utf8");
    seeds.push(parseMarkdownPaper(fileName, rawContent));
  }

  const { folder, mode: folderMode } = await ensureFolder();
  const results = [];

  for (const seed of seeds) {
    const itemResult = await ensureQuestionBankItem(folder.id, seed);
    const paperResult = await ensurePaper(seed, itemResult.itemId);

    results.push({
      sourceFile: seed.fileName,
      title: seed.title,
      totalScore: seed.totalScore,
      subQuestionCount: seed.subQuestions.length,
      itemId: itemResult.itemId,
      itemMode: itemResult.mode,
      paperId: paperResult.paperId,
      paperMode: paperResult.mode,
    });
  }

  console.log(
    JSON.stringify(
      {
        folderId: folder.id,
        folderName: folder.name,
        folderMode,
        importedCount: results.length,
        results,
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
