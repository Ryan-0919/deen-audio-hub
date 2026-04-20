import fs from "node:fs";
import { spawn } from "node:child_process";
import { copyFile, mkdir, readFile, readdir, rename, rm } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { extension as mimeExtension, lookup as lookupMime } from "mime-types";
import { getAudioDuration } from "./audio.js";
import { config } from "./config.js";
import { prisma } from "./prisma.js";
import { deleteObject, uploadBuffer } from "./upload.js";

const DIRECT_UPLOAD_FOLDER_NAME = "课程直传";
const LIBRARY_OBJECT_FOLDER = "audios/library";
const DIRECT_OBJECT_FOLDER = "audios/course-direct";
const AUDIO_SOURCE_BASENAME = "source";
const TRANSCODE_OUTPUT_FILE = "transcoded.mp3";
const DEFAULT_ERROR_MESSAGE = "音频后台处理失败";

const queuedAudioIds = new Set();
const audioQueue = [];
let activeWorkerCount = 0;
let printedMissingFfmpegWarning = false;

const getAudioProcessingRoot = () =>
  resolve(process.cwd(), config.audioProcessingDir || join("storage", "audio-processing"));

const getAudioWorkDir = (audioId) => join(getAudioProcessingRoot(), `${audioId}`);

const normalizeErrorMessage = (error, fallback = DEFAULT_ERROR_MESSAGE) => {
  const message = error instanceof Error ? error.message : `${error ?? ""}`.trim();
  return (message || fallback).slice(0, 500);
};

const cleanupFile = async (filePath = "") => {
  if (!filePath) return;
  await rm(filePath, { force: true }).catch(() => {});
};

const cleanupDir = async (dirPath = "") => {
  if (!dirPath) return;
  await rm(dirPath, { recursive: true, force: true }).catch(() => {});
};

const moveFile = async (sourcePath, targetPath) => {
  await mkdir(dirname(targetPath), { recursive: true });

  try {
    await rename(sourcePath, targetPath);
  } catch (error) {
    if (error?.code !== "EXDEV") {
      throw error;
    }

    await copyFile(sourcePath, targetPath);
    await cleanupFile(sourcePath);
  }
};

const findAudioSourceFilePath = async (audioId) => {
  const workDir = getAudioWorkDir(audioId);
  const entries = await readdir(workDir, { withFileTypes: true }).catch(() => []);
  const sourceEntry = entries.find((entry) => entry.isFile() && entry.name.startsWith(AUDIO_SOURCE_BASENAME));
  return sourceEntry ? join(workDir, sourceEntry.name) : "";
};

const resolveAudioObjectFolder = (audio) => (audio?.folder?.name === DIRECT_UPLOAD_FOLDER_NAME ? DIRECT_OBJECT_FOLDER : LIBRARY_OBJECT_FOLDER);

const isMissingCommandError = (error) => Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");

const runFfmpeg = (inputPath, outputPath) =>
  new Promise((resolvePromise, rejectPromise) => {
    const command = config.ffmpegPath || "ffmpeg";
    const child = spawn(
      command,
      ["-y", "-i", inputPath, "-vn", "-acodec", "libmp3lame", "-ar", "44100", "-ac", "2", "-b:a", "128k", outputPath],
      {
        stdio: ["ignore", "ignore", "pipe"],
      },
    );

    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 12_000) {
        stderr = stderr.slice(-12_000);
      }
    });

    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      const lastLine = stderr
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .at(-1);

      rejectPromise(new Error(lastLine ? `FFmpeg 转码失败：${lastLine}` : "FFmpeg 转码失败"));
    });
  });

const buildProcessedUploadPayload = async (audio, sourcePath) => {
  if (config.audioTranscodeEnabled) {
    const transcodedPath = join(getAudioWorkDir(audio.id), TRANSCODE_OUTPUT_FILE);

    try {
      await runFfmpeg(sourcePath, transcodedPath);
      const buffer = await readFile(transcodedPath);

      return {
        buffer,
        mimeType: "audio/mpeg",
        fileName: `${audio.name || "audio"}.mp3`,
      };
    } catch (error) {
      if (!isMissingCommandError(error)) {
        throw error;
      }

      if (!printedMissingFfmpegWarning) {
        printedMissingFfmpegWarning = true;
        console.warn("FFmpeg not found. Audio uploads will skip transcoding and keep the original format.");
      }
    }
  }

  const buffer = await readFile(sourcePath);
  const sourceExtension = extname(sourcePath).toLowerCase() || `.${mimeExtension(audio.mimeType || "") || "bin"}`;
  const sourceMimeType = `${audio.mimeType || lookupMime(sourcePath) || lookupMime(sourceExtension) || "application/octet-stream"}`;

  return {
    buffer,
    mimeType: sourceMimeType,
    fileName: `${audio.name || "audio"}${sourceExtension}`,
  };
};

const processQueuedAudio = async (audioId) => {
  const audio = await prisma.audio.findUnique({
    where: { id: audioId },
    select: {
      id: true,
      name: true,
      mimeType: true,
      objectKey: true,
      folder: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!audio) {
    await cleanupAudioProcessingSource(audioId);
    return;
  }

  const sourcePath = await findAudioSourceFilePath(audioId);
  if (!sourcePath) {
    await prisma.audio.updateMany({
      where: { id: audioId },
      data: {
        processStatus: "failed",
        processMessage: "源文件丢失，请重新上传",
      },
    });
    return;
  }

  await prisma.audio.updateMany({
    where: { id: audioId },
    data: {
      processStatus: "processing",
      processMessage: "正在后台处理",
    },
  });

  let uploaded = null;

  try {
    const uploadPayload = await buildProcessedUploadPayload(audio, sourcePath);
    const duration = await getAudioDuration({
      buffer: uploadPayload.buffer,
      mimetype: uploadPayload.mimeType,
      size: uploadPayload.buffer.length,
    });

    uploaded = await uploadBuffer({
      fileName: uploadPayload.fileName,
      buffer: uploadPayload.buffer,
      mimeType: uploadPayload.mimeType,
      folder: resolveAudioObjectFolder(audio),
    });

    await prisma.audio.update({
      where: { id: audioId },
      data: {
        duration,
        mimeType: uploadPayload.mimeType,
        objectKey: uploaded.objectKey,
        objectUrl: uploaded.url,
        processStatus: "ready",
        processMessage: "",
      },
    });

    if (audio.objectKey && audio.objectKey !== uploaded.objectKey) {
      await deleteObject(audio.objectKey).catch((error) => {
        console.error("Cleanup old audio object failed:", error);
      });
    }

    await cleanupAudioProcessingSource(audioId);
  } catch (error) {
    if (uploaded?.objectKey) {
      await deleteObject(uploaded.objectKey).catch((cleanupError) => {
        console.error("Cleanup uploaded audio object failed:", cleanupError);
      });
    }

    await prisma.audio.updateMany({
      where: { id: audioId },
      data: {
        processStatus: "failed",
        processMessage: normalizeErrorMessage(error),
      },
    });

    await cleanupAudioProcessingSource(audioId);

    console.error("Audio processing failed:", {
      audioId,
      message: error instanceof Error ? error.message : `${error ?? ""}`,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
};

const drainAudioQueue = () => {
  while (activeWorkerCount < config.audioProcessConcurrency && audioQueue.length > 0) {
    const audioId = audioQueue.shift();
    if (!audioId) {
      continue;
    }

    activeWorkerCount += 1;

    void processQueuedAudio(audioId).finally(() => {
      queuedAudioIds.delete(audioId);
      activeWorkerCount = Math.max(activeWorkerCount - 1, 0);
      drainAudioQueue();
    });
  }
};

export const getAudioUploadTempRoot = () => {
  const targetPath = join(getAudioProcessingRoot(), "_incoming");
  fs.mkdirSync(targetPath, { recursive: true });
  return targetPath;
};

export const cleanupStagedAudioUploadFile = async (filePath = "") => {
  await cleanupFile(filePath);
};

export const promoteAudioUploadSource = async ({ audioId, tempPath, originalName = "" }) => {
  const extension = extname(originalName).toLowerCase() || extname(tempPath).toLowerCase() || ".bin";
  const workDir = getAudioWorkDir(audioId);
  const targetPath = join(workDir, `${AUDIO_SOURCE_BASENAME}${extension}`);

  await cleanupDir(workDir);
  await moveFile(tempPath, targetPath);

  return targetPath;
};

export const cleanupAudioProcessingSource = async (audioId) => {
  await cleanupDir(getAudioWorkDir(audioId));
};

export const enqueueAudioProcessing = (audioId) => {
  const normalizedAudioId = `${audioId ?? ""}`.trim();
  if (!normalizedAudioId || queuedAudioIds.has(normalizedAudioId)) {
    return;
  }

  queuedAudioIds.add(normalizedAudioId);
  audioQueue.push(normalizedAudioId);
  drainAudioQueue();
};

export const resumePendingAudioProcessingJobs = async () => {
  const pendingAudios = await prisma.audio.findMany({
    where: {
      processStatus: {
        in: ["pending", "processing"],
      },
    },
    select: {
      id: true,
    },
  });

  pendingAudios.forEach((audio) => {
    enqueueAudioProcessing(audio.id);
  });
};
