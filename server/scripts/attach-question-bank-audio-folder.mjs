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

const folderId = getArgValue("folderId");
const sourceDirArg = getArgValue("sourceDir") || `${process.argv[2] ?? ""}`.trim();
const audioPrefix = getArgValue("audioPrefix") || "";
const uploadFolder = getArgValue("uploadFolder") || "mock-exam-question-lessons";

if (!folderId) {
  throw new Error("请传入 --folderId");
}

if (!sourceDirArg) {
  throw new Error("请传入 --sourceDir");
}

const sourceDir = path.resolve(sourceDirArg);

const extractNumber = (value) => {
  const matched = `${value ?? ""}`.match(/(\d+)/);
  return matched ? Number.parseInt(matched[1], 10) || 0 : 0;
};

const sortByNumber = (items) =>
  [...items].sort((left, right) => {
    const leftNo = extractNumber(left);
    const rightNo = extractNumber(right);
    if (leftNo !== rightNo) return leftNo - rightNo;
    return left.localeCompare(right, "zh-CN", { numeric: true, sensitivity: "base" });
  });

const buildPseudoUploadFile = ({ buffer, fileName, mimeType }) => ({
  buffer,
  originalname: fileName,
  mimetype: mimeType,
  size: buffer.length,
});

const main = async () => {
  const folder = await prisma.questionBankFolder.findUnique({
    where: { id: folderId },
    select: { id: true, name: true, paperType: true },
  });

  if (!folder) {
    throw new Error("题库文件夹不存在");
  }

  const items = await prisma.questionBankItem.findMany({
    where: {
      folderId,
      type: "subjective_case",
    },
    orderBy: {
      sortOrder: "asc",
    },
    select: {
      id: true,
      sortOrder: true,
      stem: true,
      lessonAudioObjectKey: true,
    },
  });

  if (items.length === 0) {
    throw new Error("该文件夹下没有可绑定的主观题");
  }

  const dirEntries = await readdir(sourceDir, { withFileTypes: true });
  const audioFiles = sortByNumber(
    dirEntries
      .filter((entry) => entry.isFile() && /\.mp3$/i.test(entry.name))
      .map((entry) => entry.name)
      .filter((name) => (audioPrefix ? name.startsWith(audioPrefix) : true)),
  );

  if (audioFiles.length === 0) {
    throw new Error("目录下没有匹配到 mp3 文件");
  }

  if (audioFiles.length !== items.length) {
    throw new Error(`音频数量(${audioFiles.length})与题目数量(${items.length})不一致`);
  }

  const results = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const fileName = audioFiles[index];
    const fullPath = path.join(sourceDir, fileName);
    const buffer = await readFile(fullPath);
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

    await prisma.questionBankItem.update({
      where: { id: item.id },
      data: {
        lessonAudioUrl: uploaded.url,
        lessonAudioObjectKey: uploaded.objectKey,
        lessonAudioDurationSeconds: Math.max(0, Number(durationSeconds ?? 0)),
      },
    });

    results.push({
      sortOrder: item.sortOrder,
      itemId: item.id,
      fileName,
      objectKey: uploaded.objectKey,
      durationSeconds: Math.max(0, Number(durationSeconds ?? 0)),
    });
  }

  console.log(
    JSON.stringify(
      {
        folderId: folder.id,
        folderName: folder.name,
        questionCount: items.length,
        boundCount: results.length,
        results,
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
