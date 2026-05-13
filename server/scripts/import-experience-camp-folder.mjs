import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { lookup as lookupMime } from "mime-types";
import { prisma } from "../lib/prisma.js";
import { uploadBuffer } from "../lib/upload.js";
import { getAudioDuration } from "../lib/audio.js";

const getArgValue = (name) => {
  const flag = `--${name}`;
  const index = process.argv.findIndex((item) => item === flag);
  if (index < 0) return "";
  return `${process.argv[index + 1] ?? ""}`.trim();
};

const sourceDirArg = getArgValue("sourceDir") || `${process.argv[2] ?? ""}`.trim();
const folderName = getArgValue("folderName") || "体验营";
const sectionLabel = getArgValue("sectionLabel") || "案例分析题";
const sectionDescription =
  getArgValue("sectionDescription") || "请结合案情按小问分别作答，系统将按各小问采分点进行批改。";
const uploadFolder = getArgValue("uploadFolder") || "mock-exam-question-lessons";
const dryRun = process.argv.includes("--dryRun");

if (!sourceDirArg) {
  throw new Error('请传入题目目录，例如：node server/scripts/import-experience-camp-folder.mjs --sourceDir "D:\\path\\to\\folder"');
}

const sourceDir = path.resolve(sourceDirArg);
const subjectKeywords = ["民法", "民诉", "刑诉", "刑法"];

const normalizeText = (value) => `${value ?? ""}`.replace(/\r\n/g, "\n").replace(/\uFEFF/g, "").trim();
const normalizeInlineText = (value) => normalizeText(value).replace(/\n+/g, " ").replace(/\s+/g, " ").trim();

const parseKeywordsFromTitle = (title) =>
  Array.from(
    new Set(
      `${title ?? ""}`
        .split(/[、，,；;：:\s/]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ).slice(0, 8);

const stripLeadingMarker = (value) =>
  `${value ?? ""}`
    .trim()
    .replace(/^\d+\.\s*/, "")
    .replace(/^[（(]\d+[）)]\s*/, "")
    .replace(/^[-*•●·]\s*/, "");

const simplifyRubricTitle = (value) => {
  const cleaned = normalizeInlineText(value)
    .replace(/[（(]\d+分[）)]/g, "")
    .replace(/[；;。]+$/g, "")
    .trim();

  const colonMatched = cleaned.match(/^(?:结论分?|理由分?|观点分?|主体分?|行为分?|罪名分?|理由)\s*[：:]\s*(.+)$/);
  if (colonMatched) {
    return normalizeInlineText(colonMatched[1]);
  }

  return cleaned;
};

const extractSubject = (fileName) => {
  const matched = subjectKeywords.find((keyword) => fileName.includes(keyword));
  if (!matched) {
    throw new Error(`无法从文件名识别科目：${fileName}`);
  }
  return matched;
};

const findAudioFileBySubject = (audioFiles, subject) => {
  const matched = audioFiles.filter((fileName) => fileName.includes(subject));
  if (matched.length !== 1) {
    throw new Error(`${subject} 音频匹配失败，期望 1 个，实际 ${matched.length} 个`);
  }
  return matched[0];
};

const buildPseudoUploadFile = ({ buffer, fileName, mimeType }) => ({
  buffer,
  originalname: fileName,
  mimetype: mimeType,
  size: buffer.length,
});

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

const splitTopLevelScoreSegments = (scoreText) => {
  const normalized = normalizeText(scoreText);
  const markers = Array.from(normalized.matchAll(/\d+\.\s*/g));

  if (markers.length === 0) {
    return normalized ? [normalized] : [];
  }

  return markers.map((match, index) => {
    const start = match.index;
    const end = index + 1 < markers.length ? markers[index + 1].index : normalized.length;
    return normalized.slice(start, end).trim();
  });
};

const parseNestedRubricPoints = (segment) => {
  const points = [];
  const nestedRegex = /[（(](\d+)[）)]\s*([\s\S]*?)(?=[（(]\d+[）)]\s*|$)/g;

  for (const match of segment.matchAll(nestedRegex)) {
    const rawItem = normalizeInlineText(match[2]);
    const scoreMatches = Array.from(rawItem.matchAll(/[（(](\d+)分[）)]/g));
    const lastScoreMatch = scoreMatches.at(-1);

    if (!lastScoreMatch) {
      continue;
    }

    const score = Number.parseInt(lastScoreMatch[1], 10) || 0;
    const title = simplifyRubricTitle(rawItem);

    if (!title || score <= 0) {
      continue;
    }

    points.push({
      title,
      score,
      description: title,
      keywords: parseKeywordsFromTitle(title),
    });
  }

  return points;
};

const parseTopLevelRubricPoint = (segment) => {
  const scoreMatches = Array.from(segment.matchAll(/[（(](\d+)分[）)]/g));
  const lastScoreMatch = scoreMatches.at(-1);
  if (!lastScoreMatch) {
    return null;
  }

  const score = Number.parseInt(lastScoreMatch[1], 10) || 0;
  const title = simplifyRubricTitle(stripLeadingMarker(segment));
  if (!title || score <= 0) {
    return null;
  }

  return {
    title,
    score,
    description: title,
    keywords: parseKeywordsFromTitle(title),
  };
};

const parseRubricPoints = (scoreText) => {
  const points = [];

  for (const segment of splitTopLevelScoreSegments(scoreText)) {
    const nestedPoints = parseNestedRubricPoints(segment);
    if (nestedPoints.length > 0) {
      points.push(...nestedPoints);
      continue;
    }

    const point = parseTopLevelRubricPoint(segment);
    if (point) {
      points.push(point);
    }
  }

  return points.map((point, index) => ({
    ...point,
    id: `point_${index + 1}`,
    sortOrder: index + 1,
  }));
};

const findTopLevelQuestionStarts = (questionsText) => {
  const normalized = normalizeText(questionsText);
  const markerRegex = /(\d+)\./g;
  const markers = Array.from(normalized.matchAll(markerRegex));
  const candidates = [];

  for (const marker of markers) {
    const start = marker.index;
    const tail = normalized.slice(start, start + 240);
    const questionMarkOffset = tail.search(/[？?]/);
    if (questionMarkOffset < 0) {
      continue;
    }

    const between = tail.slice(marker[0].length, questionMarkOffset);
    if (/\d+\./.test(between)) {
      continue;
    }

    if (!tail.includes("参考答案")) {
      const nextReferenceOffset = normalized.indexOf("参考答案", start);
      if (nextReferenceOffset < 0 || nextReferenceOffset - start > 1500) {
        continue;
      }
    }

    candidates.push({
      number: Number.parseInt(marker[1], 10) || 0,
      index: start,
    });
  }

  return candidates;
};

const parseQuestionBlocks = (questionsText, fileName) => {
  const normalized = normalizeText(questionsText);
  const matches = findTopLevelQuestionStarts(normalized);

  if (matches.length === 0) {
    throw new Error(`${fileName} 未识别到题目小问`);
  }

  return matches.map((match, index) => {
    const start = match.index;
    const end = index + 1 < matches.length ? matches[index + 1].index : normalized.length;
    return normalized.slice(start, end).trim();
  });
};

const parseQuestionBlock = (block, fileName, blockIndex) => {
  const referenceLabel = "参考答案";
  const rubricLabel = "阅卷标准与评分细则";
  const scoreHeaderMatch = block.match(/得分点（总分数：(\d+)分）/);
  const referenceIndex = block.indexOf(referenceLabel);
  const rubricIndex = block.indexOf(rubricLabel);
  const scoreIndex = scoreHeaderMatch ? block.indexOf(scoreHeaderMatch[0]) : -1;

  if (referenceIndex < 0 || scoreIndex < 0 || rubricIndex < 0 || !(referenceIndex < scoreIndex && scoreIndex < rubricIndex)) {
    throw new Error(`${fileName} 第 ${blockIndex + 1} 问结构不完整`);
  }

  const title = normalizeInlineText(stripLeadingMarker(block.slice(0, referenceIndex)));
  const referenceAnswer = normalizeText(block.slice(referenceIndex + referenceLabel.length, scoreIndex));
  const scoreHeader = scoreHeaderMatch[0];
  const scoreText = normalizeText(block.slice(scoreIndex + scoreHeader.length, rubricIndex));
  const rubricText = normalizeText(block.slice(rubricIndex + rubricLabel.length));
  const rubricPoints = parseRubricPoints(scoreText);
  const totalScoreFromHeader = Number.parseInt(scoreHeaderMatch[1], 10) || 0;
  const totalScoreFromPoints = rubricPoints.reduce((sum, point) => sum + Number(point.score ?? 0), 0);

  if (!title) {
    throw new Error(`${fileName} 第 ${blockIndex + 1} 问题干为空`);
  }

  if (!referenceAnswer) {
    throw new Error(`${fileName} 第 ${blockIndex + 1} 问参考答案为空`);
  }

  if (rubricPoints.length === 0) {
    throw new Error(`${fileName} 第 ${blockIndex + 1} 问未识别到采分点`);
  }

  return {
    title,
    referenceAnswer,
    rubricGuidance: normalizeText(`得分点：\n${scoreText}\n\n阅卷标准：\n${rubricText}`),
    rubricPoints,
    totalScore: Math.max(totalScoreFromHeader, totalScoreFromPoints),
  };
};

const parseTextQuestionFile = async (filePath) => {
  const fileName = path.basename(filePath);
  const raw = normalizeText(await readFile(filePath, "utf8"));
  const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);

  if (lines.length === 0) {
    throw new Error(`${fileName} 内容为空`);
  }

  const titleLine = /^案情[:：]?$/.test(lines[0]) ? "" : lines[0];
  const title = normalizeText(titleLine || fileName.replace(/\.[^.]+$/i, ""));
  const caseMarkerMatch = raw.match(/案情[:：]?/);
  const questionMarkerMatch = raw.match(/问题[:：]?/);

  if (!caseMarkerMatch || !questionMarkerMatch) {
    throw new Error(`${fileName} 缺少“案情/问题”结构`);
  }

  const caseStart = caseMarkerMatch.index + caseMarkerMatch[0].length;
  const questionStart = questionMarkerMatch.index + questionMarkerMatch[0].length;
  const caseText = normalizeText(raw.slice(caseStart, questionMarkerMatch.index));
  const questionBlocks = parseQuestionBlocks(raw.slice(questionStart), fileName).map((block, index) =>
    parseQuestionBlock(block, fileName, index),
  );
  const subject = extractSubject(fileName);

  if (!caseText) {
    throw new Error(`${fileName} 缺少案情内容`);
  }

  return {
    fileName,
    title,
    subject,
    stem: normalizeText(`案情：\n\n${caseText}`),
    material: "案情",
    analysis: `${subject}体验营主观题，共 ${questionBlocks.length} 问。请结合案情按小问分别作答，系统将按采分点进行批改。`,
    totalScore: questionBlocks.reduce((sum, item) => sum + Number(item.totalScore ?? 0), 0),
    subQuestions: questionBlocks,
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

const uploadLessonAudio = async (sourceFilePath, fileName) => {
  const buffer = await readFile(sourceFilePath);
  const mimeType = `${lookupMime(fileName) || "audio/mpeg"}`;
  const pseudoFile = buildPseudoUploadFile({ buffer, fileName, mimeType });

  const [uploaded, durationSeconds] = await Promise.all([
    uploadBuffer({
      fileName,
      buffer,
      mimeType,
      folder: uploadFolder,
    }),
    getAudioDuration(pseudoFile),
  ]);

  return {
    lessonAudioUrl: uploaded.readableUrl ?? uploaded.url,
    lessonAudioObjectKey: uploaded.objectKey,
    lessonAudioDurationSeconds: Math.max(0, Number(durationSeconds ?? 0)),
    originalFileName: fileName,
  };
};

const upsertQuestionBankItem = async (folderId, seed, audio) => {
  const questionMetaJson = buildQuestionMetaJson(seed);
  const existing = await prisma.questionBankItem.findFirst({
    where: {
      folderId,
      type: "subjective_case",
      stem: seed.stem,
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
    material: seed.material,
    analysis: seed.analysis,
    score: seed.totalScore,
    correctAnswerJson: JSON.stringify([]),
    questionMetaJson,
    lessonAudioUrl: audio.lessonAudioUrl,
    lessonAudioObjectKey: audio.lessonAudioObjectKey,
    lessonAudioDurationSeconds: audio.lessonAudioDurationSeconds,
  };

  if (existing) {
    const updated = await prisma.questionBankItem.update({
      where: { id: existing.id },
      data,
      select: { id: true, sortOrder: true },
    });

    return {
      itemId: updated.id,
      sortOrder: updated.sortOrder,
      mode: "updated",
    };
  }

  const created = await prisma.questionBankItem.create({
    data: {
      ...data,
      sortOrder: await getNextFolderSortOrder(folderId),
    },
    select: { id: true, sortOrder: true },
  });

  return {
    itemId: created.id,
    sortOrder: created.sortOrder,
    mode: "created",
  };
};

const main = async () => {
  const dirEntries = await readdir(sourceDir, { withFileTypes: true });
  const textFiles = dirEntries.filter((entry) => entry.isFile() && /\.txt$/i.test(entry.name)).map((entry) => entry.name);
  const audioFiles = dirEntries.filter((entry) => entry.isFile() && /\.mp3$/i.test(entry.name)).map((entry) => entry.name);

  if (textFiles.length === 0) {
    throw new Error(`目录下未找到 txt 文件：${sourceDir}`);
  }

  if (audioFiles.length === 0) {
    throw new Error(`目录下未找到 mp3 文件：${sourceDir}`);
  }

  const parsedItems = [];

  for (const fileName of textFiles) {
    const seed = await parseTextQuestionFile(path.join(sourceDir, fileName));
    const audioFileName = findAudioFileBySubject(audioFiles, seed.subject);
    parsedItems.push({
      ...seed,
      audioFileName,
    });
  }

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          sourceDir,
          folderName,
          count: parsedItems.length,
          items: parsedItems.map((item) => ({
            fileName: item.fileName,
            title: item.title,
            subject: item.subject,
            audioFileName: item.audioFileName,
            totalScore: item.totalScore,
            subQuestionCount: item.subQuestions.length,
            subQuestions: item.subQuestions.map((subQuestion) => ({
              title: subQuestion.title,
              totalScore: subQuestion.totalScore,
              rubricPointCount: subQuestion.rubricPoints.length,
            })),
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  const { folder, mode: folderMode } = await ensureFolder();
  const imported = [];

  for (const item of parsedItems) {
    const audio = await uploadLessonAudio(path.join(sourceDir, item.audioFileName), item.audioFileName);
    const result = await upsertQuestionBankItem(folder.id, item, audio);

    imported.push({
      fileName: item.fileName,
      subject: item.subject,
      title: item.title,
      itemId: result.itemId,
      sortOrder: result.sortOrder,
      mode: result.mode,
      totalScore: item.totalScore,
      subQuestionCount: item.subQuestions.length,
      audioFileName: item.audioFileName,
      lessonAudioObjectKey: audio.lessonAudioObjectKey,
      lessonAudioDurationSeconds: audio.lessonAudioDurationSeconds,
    });
  }

  console.log(
    JSON.stringify(
      {
        sourceDir,
        folderName,
        folderId: folder.id,
        folderMode,
        importedCount: imported.length,
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
