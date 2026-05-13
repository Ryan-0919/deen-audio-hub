import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/prisma.js";

const normalizeText = (value) => `${value ?? ""}`.replace(/\r\n/g, "\n").replace(/\uFEFF/g, "").trim();

const getArgValue = (name) => {
  const flag = `--${name}`;
  const index = process.argv.findIndex((item) => item === flag);
  if (index < 0) return "";
  return `${process.argv[index + 1] ?? ""}`.trim();
};

const sourceDirArg = getArgValue("sourceDir") || `${process.argv[2] ?? ""}`.trim();
if (!sourceDirArg) {
  throw new Error("请传入题目目录，例如：node server/scripts/import-subjective-markdown-folder.mjs --sourceDir \"D:\\path\\to\\folder\"");
}

const sourceDir = path.resolve(sourceDirArg);
const folderName = getArgValue("folderName") || path.basename(sourceDir);
const sectionLabel = getArgValue("sectionLabel") || "案例分析题";
const sectionDescription = getArgValue("sectionDescription") || "请结合案情按小问分别作答，系统将按各小问采分点进行批改。";

const sortFiles = (files) =>
  [...files].sort((left, right) =>
    left.localeCompare(right, "zh-CN", {
      numeric: true,
      sensitivity: "base",
    }),
  );

const parseTotalScoreFromHeader = (line) => {
  const matched = `${line ?? ""}`.match(/总分(?:数)?\s*[：:]\s*(\d+)/);
  if (!matched) return 0;
  return Number.parseInt(matched[1], 10) || 0;
};

const isQuestionStartLine = (line) => /^(?:\d+[.、]|[（(]\d+[）)])\s*.+[？?].*$/.test(`${line ?? ""}`.trim());
const isCaseHeader = (line) => /^案情[:：]?$/.test(`${line ?? ""}`.trim());
const isQuestionHeader = (line) => /^问题[:：]?$/.test(`${line ?? ""}`.trim());
const isReferenceHeader = (line) => /^参考答案[:：]?$/.test(`${line ?? ""}`.trim());
const isScoreHeader = (line) => /^得分点(?:[（(][^）)]*[）)])?[:：]?$/.test(`${line ?? ""}`.trim());
const isRubricHeader = (line) => /^阅卷标准(?:与评分细则)?[:：]?$/.test(`${line ?? ""}`.trim());

const findLineIndex = (lines, matcher) => lines.findIndex((line) => matcher(line));

const stripLeadingMarker = (value) =>
  `${value ?? ""}`
    .trim()
    .replace(/^(?:\d+[.、]|[（(]\d+[）)]|[-*•●·])\s*/, "");

const parseKeywordsFromTitle = (title) =>
  Array.from(
    new Set(
      `${title ?? ""}`
        .split(/[、，,；;：:\s/]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ).slice(0, 8);

const isContainerRubricTitle = (title, rawLine) => {
  const normalizedTitle = `${title ?? ""}`.replace(/\s+/g, "");
  const normalizedLine = `${rawLine ?? ""}`.trim();

  if (/[：:]$/.test(normalizedLine)) {
    return true;
  }

  return /^(?:结论|理由|结论分|理由分|理由评分标准|评分标准|总体规则|总体评分规则|评分规则|评分说明)$/.test(normalizedTitle);
};

const parseRubricPoint = (rawLine, index) => {
  const line = `${rawLine ?? ""}`.trim();
  if (!line) return null;
  if (!/^(?:\d+[.、]|[（(]\d+[）)])/.test(line)) return null;

  const scoreMatches = Array.from(line.matchAll(/[（(]\s*(\d+)\s*分\s*[）)]/g));
  const lastScoreMatch = scoreMatches.at(-1);
  if (!lastScoreMatch) return null;

  const score = Number.parseInt(lastScoreMatch[1], 10);
  if (!Number.isFinite(score) || score <= 0) return null;

  const title = stripLeadingMarker(line)
    .replace(/[（(]\s*\d+\s*分\s*[）)]/g, "")
    .replace(/^(?:结论分|理由分|结论|理由)\s*[:：]\s*/, "")
    .replace(/[；;。]+$/g, "")
    .trim();

  if (!title || isContainerRubricTitle(title, line)) {
    return null;
  }

  return {
    id: `point_${index + 1}`,
    title,
    score,
    description: title,
    keywords: parseKeywordsFromTitle(title),
    sortOrder: index + 1,
  };
};

const parseRubricPoints = (scoreLines) =>
  scoreLines
    .map((line, index) => parseRubricPoint(line, index))
    .filter(Boolean)
    .map((item, index) => ({
      ...item,
      id: `point_${index + 1}`,
      sortOrder: index + 1,
    }));

const buildQuestionMetaJson = (seed) =>
  JSON.stringify({
    title: seed.title,
    sectionLabel,
    sectionDescription,
    subQuestions: seed.subQuestions.map((subQuestion, subQuestionIndex) => ({
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

const parseMarkdownQuestionFile = async (filePath) => {
  const rawContent = await readFile(filePath, "utf8");
  const content = normalizeText(rawContent);
  const lines = content.split("\n").map((line) => line.trimRight());
  const fileName = path.basename(filePath);
  const title = normalizeText(lines.find((line) => line.trim()) ?? fileName.replace(/\.md$/i, ""));

  const caseHeaderIndex = findLineIndex(lines, isCaseHeader);
  const questionHeaderIndex = findLineIndex(lines, isQuestionHeader);

  if (caseHeaderIndex < 0 || questionHeaderIndex < 0 || questionHeaderIndex <= caseHeaderIndex) {
    throw new Error(`${fileName} 的“案情 / 问题”结构无法识别`);
  }

  const caseText = normalizeText(lines.slice(caseHeaderIndex + 1, questionHeaderIndex).join("\n"));
  if (!caseText) {
    throw new Error(`${fileName} 缺少案情内容`);
  }

  const trailingLines = lines.slice(questionHeaderIndex + 1);
  const questionBlocks = [];
  let currentBlock = null;

  for (const rawLine of trailingLines) {
    const line = `${rawLine ?? ""}`.trim();
    if (isQuestionStartLine(line)) {
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
    throw new Error(`${fileName} 未识别到分问`);
  }

  const subQuestions = questionBlocks.map((block, blockIndex) => {
    const referenceIndex = findLineIndex(block.lines, isReferenceHeader);
    const scoreIndex = findLineIndex(block.lines, isScoreHeader);
    const rubricIndex = findLineIndex(block.lines, isRubricHeader);

    if (referenceIndex < 0 || scoreIndex < 0 || rubricIndex < 0 || !(referenceIndex < scoreIndex && scoreIndex < rubricIndex)) {
      throw new Error(`${fileName} 第 ${blockIndex + 1} 问结构不完整，缺少“参考答案 / 得分点 / 阅卷标准”`);
    }

    const referenceAnswer = normalizeText(block.lines.slice(referenceIndex + 1, scoreIndex).join("\n"));
    const scoreHeader = block.lines[scoreIndex] ?? "";
    const scoreLines = block.lines.slice(scoreIndex + 1, rubricIndex).map((line) => `${line ?? ""}`.trim()).filter(Boolean);
    const rubricText = normalizeText(block.lines.slice(rubricIndex + 1).join("\n"));
    const rubricPoints = parseRubricPoints(scoreLines);
    const totalScoreFromHeader = parseTotalScoreFromHeader(scoreHeader);
    const totalScoreFromPoints = rubricPoints.reduce((sum, point) => sum + Number(point.score ?? 0), 0);

    if (!referenceAnswer) {
      throw new Error(`${fileName} 第 ${blockIndex + 1} 问缺少参考答案`);
    }

    if (rubricPoints.length === 0) {
      throw new Error(`${fileName} 第 ${blockIndex + 1} 问未识别到有效得分点`);
    }

    return {
      title: block.title,
      referenceAnswer,
      rubricGuidance: normalizeText(`得分点：\n${scoreLines.join("\n")}\n\n阅卷标准：\n${rubricText}`),
      rubricPoints,
      totalScore: Math.max(totalScoreFromHeader, totalScoreFromPoints),
    };
  });

  return {
    fileName,
    title,
    stem: normalizeText(`案情：\n\n${caseText}`),
    analysis: `${title}，共 ${subQuestions.length} 问。请结合案情按小问分别作答，系统将按采分点进行批改。`,
    totalScore: subQuestions.reduce((sum, item) => sum + Number(item.totalScore ?? 0), 0),
    subQuestions,
  };
};

const ensureFolder = async () => {
  const existing = await prisma.questionBankFolder.findFirst({
    where: {
      paperType: "subjective",
      name: folderName,
    },
  });

  if (existing) {
    return { folder: existing, mode: "existing" };
  }

  const created = await prisma.questionBankFolder.create({
    data: {
      paperType: "subjective",
      name: folderName,
    },
  });

  return { folder: created, mode: "created" };
};

const getNextFolderSortOrder = async (folderId) => {
  const lastItem = await prisma.questionBankItem.findFirst({
    where: { folderId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  return Number(lastItem?.sortOrder ?? 0) + 1;
};

const upsertQuestionBankItem = async (folderId, seed) => {
  const questionMetaJson = buildQuestionMetaJson(seed);
  const existing = await prisma.questionBankItem.findFirst({
    where: {
      folderId,
      type: "subjective_case",
      stem: seed.stem,
    },
    select: {
      id: true,
    },
  });

  const data = {
    folderId,
    type: "subjective_case",
    stem: seed.stem,
    material: "",
    analysis: seed.analysis,
    score: seed.totalScore,
    correctAnswerJson: JSON.stringify([]),
    questionMetaJson,
  };

  if (existing) {
    const updated = await prisma.questionBankItem.update({
      where: { id: existing.id },
      data,
      select: { id: true },
    });

    return {
      itemId: updated.id,
      mode: "updated",
    };
  }

  const created = await prisma.questionBankItem.create({
    data: {
      ...data,
      sortOrder: await getNextFolderSortOrder(folderId),
    },
    select: { id: true },
  });

  return {
    itemId: created.id,
    mode: "created",
  };
};

const main = async () => {
  const dirEntries = await readdir(sourceDir, { withFileTypes: true });
  const mdFiles = sortFiles(
    dirEntries
      .filter((entry) => entry.isFile() && /\.md$/i.test(entry.name))
      .map((entry) => entry.name),
  );

  if (mdFiles.length === 0) {
    throw new Error(`目录下未找到 md 文件：${sourceDir}`);
  }

  const { folder, mode: folderMode } = await ensureFolder();
  const imported = [];

  for (const fileName of mdFiles) {
    const seed = await parseMarkdownQuestionFile(path.join(sourceDir, fileName));
    const result = await upsertQuestionBankItem(folder.id, seed);

    imported.push({
      fileName,
      title: seed.title,
      itemId: result.itemId,
      mode: result.mode,
      questionCount: seed.subQuestions.length,
      totalScore: seed.totalScore,
    });
  }

  const folderItemCount = await prisma.questionBankItem.count({
    where: {
      folderId: folder.id,
    },
  });

  console.log(
    JSON.stringify(
      {
        sourceDir,
        folderName,
        folderId: folder.id,
        folderMode,
        importedCount: imported.length,
        folderItemCount,
        items: imported,
      },
      null,
      2,
    ),
  );
};

try {
  await main();
} finally {
  await prisma.$disconnect();
}
