import { config } from "./config.js";
import { prisma } from "./prisma.js";
import { aiReviewMockExamRecord } from "./mock-exam-ai-review.js";
import { getMockExamAiReviewConfig } from "./mock-exam-ai-review-config.js";
import { recoverStaleAiProcessingMockExamReviews } from "./mock-exam.js";

const DEFAULT_MAX_CONCURRENCY = 3;
const DEFAULT_MAX_RETRY_COUNT = 3;
const DEFAULT_RETRY_DELAY_MS = 15000;
const DEFAULT_QUEUE_POLL_INTERVAL_MS = 3000;
const DEFAULT_QUEUE_SCAN_BATCH_SIZE = 20;

const runningRecordIds = new Set();
const forcedAdminQueueMap = new Map();
let queueTimer = null;
let queuePumpPromise = null;
let queueRecoveryPromise = null;

const getMaxConcurrency = () => Math.max(1, Number(config.mockExamAiReview?.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY) || DEFAULT_MAX_CONCURRENCY);
const getMaxRetryCount = () => Math.max(0, Number(config.mockExamAiReview?.maxRetryCount ?? DEFAULT_MAX_RETRY_COUNT) || DEFAULT_MAX_RETRY_COUNT);
const getRetryDelayMs = () => Math.max(0, Number(config.mockExamAiReview?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS) || DEFAULT_RETRY_DELAY_MS);
const getQueuePollIntervalMs = () =>
  Math.max(500, Number(config.mockExamAiReview?.queuePollIntervalMs ?? DEFAULT_QUEUE_POLL_INTERVAL_MS) || DEFAULT_QUEUE_POLL_INTERVAL_MS);

const hasActiveManualReviewLock = (record, currentTime = new Date()) => {
  const reviewerId = `${record?.manualReviewerId ?? ""}`.trim();
  const lockToken = `${record?.manualReviewLockToken ?? ""}`.trim();
  const expiresAt = record?.manualReviewLockExpiresAt ? new Date(record.manualReviewLockExpiresAt) : null;

  return Boolean(
    reviewerId &&
      lockToken &&
      expiresAt &&
      Number.isFinite(expiresAt.getTime()) &&
      expiresAt.getTime() > currentTime.getTime(),
  );
};

const canQueueAutoReview = ({ retryCount, lastError }) => {
  const currentRetryCount = Math.max(0, Number(retryCount ?? 0) || 0);
  const maxRetryCount = getMaxRetryCount();
  if (currentRetryCount < maxRetryCount) {
    return true;
  }
  return currentRetryCount === 0 && !`${lastError ?? ""}`.trim();
};

const normalizeErrorMessage = (error) => {
  if (error instanceof Error && error.message?.trim()) {
    return error.message.trim();
  }

  return "AI批改失败";
};

const isConflictLikeError = (error) => {
  const statusCode = Number(error?.statusCode ?? 0);
  return statusCode === 409;
};

const pruneCompletedRunningRecords = async ({ db }) => {
  if (runningRecordIds.size === 0 || typeof db?.mockExamRecord?.findMany !== "function") {
    return;
  }

  const trackedRecordIds = Array.from(runningRecordIds);
  const activeProcessingRecords = await db.mockExamRecord.findMany({
    where: {
      id: {
        in: trackedRecordIds,
      },
      reviewWorkflowStatus: "ai_processing",
    },
    select: {
      id: true,
    },
  });
  const activeProcessingIdSet = new Set(
    activeProcessingRecords.map((item) => `${item?.id ?? ""}`.trim()).filter(Boolean),
  );

  trackedRecordIds.forEach((recordId) => {
    if (!activeProcessingIdSet.has(recordId)) {
      runningRecordIds.delete(recordId);
    }
  });
};

const ensureRecoveredStaleAiProcessing = async ({ db, currentTime = new Date() }) => {
  if (queueRecoveryPromise) {
    await queueRecoveryPromise;
    return;
  }

  queueRecoveryPromise = (async () => {
    try {
      await recoverStaleAiProcessingMockExamReviews({
        db,
        currentTime,
      });
      await pruneCompletedRunningRecords({ db });
    } finally {
      queueRecoveryPromise = null;
    }
  })();

  await queueRecoveryPromise;
};

const buildRetryErrorMessage = (error, nextRetryCount) => {
  const baseMessage = normalizeErrorMessage(error);
  return `${baseMessage}（系统将在稍后自动重试，第 ${nextRetryCount} 次）`;
};

const buildExhaustedErrorMessage = (error, maxRetryCount) => {
  const baseMessage = normalizeErrorMessage(error);
  return `${baseMessage}（已自动重试 ${maxRetryCount} 次，已退回待批改）`;
};

export const enqueueMockExamAiReview = async ({ db = prisma, recordId, adminId = "", currentTime = new Date() }) => {
  const normalizedRecordId = `${recordId ?? ""}`.trim();
  const normalizedAdminId = `${adminId ?? ""}`.trim();
  if (!normalizedRecordId) {
    throw Object.assign(new Error("缺少批改记录参数"), { statusCode: 400 });
  }

  const record = await db.mockExamRecord.findUnique({
    where: { id: normalizedRecordId },
    select: {
      id: true,
      status: true,
      reviewWorkflowStatus: true,
      aiReviewRetryCount: true,
      lastAiReviewError: true,
      manualReviewerId: true,
      manualReviewLockToken: true,
      manualReviewLockExpiresAt: true,
    },
  });

  if (!record) {
    throw Object.assign(new Error("考试记录不存在"), { statusCode: 404 });
  }

  if (`${record.status ?? ""}`.trim() !== "submitted") {
    throw Object.assign(new Error("该考试记录尚未交卷"), { statusCode: 409 });
  }

  const workflowStatus = `${record.reviewWorkflowStatus ?? ""}`.trim();
  if (!normalizedAdminId && (workflowStatus === "published" || workflowStatus === "manual_pending")) {
    throw Object.assign(new Error("当前试卷已完成批改，无需进入自动批改队列"), { statusCode: 409 });
  }

  if (!normalizedAdminId && !canQueueAutoReview({ retryCount: record.aiReviewRetryCount, lastError: record.lastAiReviewError })) {
    throw Object.assign(new Error("当前试卷已达到自动批改次数上限，请转人工处理"), { statusCode: 409 });
  }

  const reviewerId = `${record.manualReviewerId ?? ""}`.trim();
  const hasActiveLock = hasActiveManualReviewLock(record, currentTime);
  if (hasActiveLock && reviewerId !== normalizedAdminId) {
    throw Object.assign(new Error("该试卷已被人工领取，不能进入自动批改队列"), { statusCode: 409 });
  }

  if (normalizedAdminId) {
    forcedAdminQueueMap.set(normalizedRecordId, normalizedAdminId);
  } else {
    forcedAdminQueueMap.delete(normalizedRecordId);
  }

  await db.mockExamRecord.update({
    where: { id: normalizedRecordId },
    data: {
      reviewWorkflowStatus: "ai_pending",
      aiReviewStartedAt: null,
      aiReviewFinishedAt: null,
      aiReviewRetryCount: 0,
      aiReviewNextRetryAt: currentTime,
      lastAiReviewError: null,
      reviewedAt: null,
      publishedAt: null,
      manualReviewerId: null,
      manualReviewerName: null,
      manualReviewLockToken: null,
      manualReviewClaimedAt: null,
      manualReviewLockExpiresAt: null,
      manualReviewVersion: {
        increment: 1,
      },
    },
  });

  void pumpMockExamAiReviewQueue({ db });
  return { success: true, recordId: normalizedRecordId };
};

const retryFailedMockExamAiReview = async ({ db, recordId, error, currentTime = new Date() }) => {
  const latestRecord = await db.mockExamRecord.findUnique({
    where: { id: recordId },
    select: {
      id: true,
      aiReviewRetryCount: true,
      manualReviewerId: true,
      manualReviewLockToken: true,
      manualReviewLockExpiresAt: true,
      reviewWorkflowStatus: true,
    },
  });

  if (!latestRecord) {
    forcedAdminQueueMap.delete(recordId);
    return "missing";
  }

  const forcedAdminId = `${forcedAdminQueueMap.get(recordId) ?? ""}`.trim();
  const reviewerId = `${latestRecord.manualReviewerId ?? ""}`.trim();
  const hasActiveLock = hasActiveManualReviewLock(latestRecord, currentTime);
  if (hasActiveLock && reviewerId !== forcedAdminId) {
    await db.mockExamRecord.update({
      where: { id: recordId },
      data: {
        reviewWorkflowStatus: "ai_pending",
        aiReviewStartedAt: null,
        aiReviewFinishedAt: null,
        aiReviewNextRetryAt: null,
        lastAiReviewError: normalizeErrorMessage(error),
      },
    });
    forcedAdminQueueMap.delete(recordId);
    return "blocked";
  }

  const currentRetryCount = Math.max(0, Number(latestRecord.aiReviewRetryCount ?? 0) || 0);
  const maxRetryCount = getMaxRetryCount();
  if (currentRetryCount >= maxRetryCount) {
    await db.mockExamRecord.update({
      where: { id: recordId },
      data: {
        reviewWorkflowStatus: "ai_pending",
        aiReviewStartedAt: null,
        aiReviewFinishedAt: null,
        aiReviewNextRetryAt: null,
        aiReviewRetryCount: currentRetryCount,
        lastAiReviewError: buildExhaustedErrorMessage(error, maxRetryCount),
      },
    });
    forcedAdminQueueMap.delete(recordId);
    return "exhausted";
  }

  const nextRetryCount = currentRetryCount + 1;

  await db.mockExamRecord.update({
    where: { id: recordId },
    data: {
      reviewWorkflowStatus: "ai_pending",
      aiReviewStartedAt: null,
      aiReviewFinishedAt: null,
      aiReviewRetryCount: nextRetryCount,
      aiReviewNextRetryAt: new Date(currentTime.getTime() + getRetryDelayMs()),
      lastAiReviewError: buildRetryErrorMessage(error, nextRetryCount),
    },
  });
  return "scheduled";
};

const consumeQueuedRecord = async ({ db, recordId }) => {
  runningRecordIds.add(recordId);
  try {
    const forcedAdminId = `${forcedAdminQueueMap.get(recordId) ?? ""}`.trim();
    const runtimeConfig = await getMockExamAiReviewConfig(db);
    await aiReviewMockExamRecord({
      db,
      recordId,
      adminId: forcedAdminId,
      runtimeConfig,
      allowRuleFallback: false,
    });
    forcedAdminQueueMap.delete(recordId);
  } catch (error) {
    if (!isConflictLikeError(error)) {
      const retryOutcome = await retryFailedMockExamAiReview({
        db,
        recordId,
        error,
      });
      if (retryOutcome !== "scheduled") {
        forcedAdminQueueMap.delete(recordId);
      }
    } else {
      forcedAdminQueueMap.delete(recordId);
    }
  } finally {
    runningRecordIds.delete(recordId);
    void pumpMockExamAiReviewQueue({ db });
  }
};

export const pumpMockExamAiReviewQueue = async ({ db = prisma, currentTime = new Date() } = {}) => {
  if (queuePumpPromise) {
    return queuePumpPromise;
  }

  queuePumpPromise = (async () => {
    try {
      await ensureRecoveredStaleAiProcessing({ db, currentTime });

      const availableSlots = Math.max(0, getMaxConcurrency() - runningRecordIds.size);
      if (availableSlots <= 0) {
        return;
      }

      const runnableRecordIds = [];
      const seenRecordIds = new Set();
      const scanBatchSize = Math.max(DEFAULT_QUEUE_SCAN_BATCH_SIZE, availableSlots * 4);
      let skip = 0;

      while (runnableRecordIds.length < availableSlots) {
        const queuedRecords = await db.mockExamRecord.findMany({
          where: {
            status: "submitted",
            reviewWorkflowStatus: "ai_pending",
            OR: [
              {
                aiReviewNextRetryAt: null,
              },
              {
                aiReviewNextRetryAt: {
                  lte: currentTime,
                },
              },
            ],
          },
          orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
          skip,
          take: scanBatchSize,
          select: {
            id: true,
            manualReviewerId: true,
            manualReviewLockToken: true,
            manualReviewLockExpiresAt: true,
            aiReviewRetryCount: true,
            lastAiReviewError: true,
          },
        });

        if (queuedRecords.length === 0) {
          break;
        }

        for (const item of queuedRecords) {
          const recordId = `${item.id ?? ""}`.trim();
          if (!recordId || seenRecordIds.has(recordId) || runningRecordIds.has(recordId)) {
            continue;
          }
          seenRecordIds.add(recordId);

          const manualReviewerId = `${item.manualReviewerId ?? ""}`.trim();
          const manualReviewLockToken = `${item.manualReviewLockToken ?? ""}`.trim();
          const lastAiReviewError = `${item.lastAiReviewError ?? ""}`.trim();
          const manualReviewLockExpiresAt = item.manualReviewLockExpiresAt;
          const aiReviewRetryCount = item.aiReviewRetryCount;

          if (!canQueueAutoReview({ retryCount: aiReviewRetryCount, lastError: lastAiReviewError })) {
            continue;
          }

          if (
            hasActiveManualReviewLock(
              {
                manualReviewerId,
                manualReviewLockToken,
                manualReviewLockExpiresAt,
              },
              currentTime,
            ) &&
            `${forcedAdminQueueMap.get(recordId) ?? ""}`.trim() !== manualReviewerId
          ) {
            continue;
          }

          runnableRecordIds.push(recordId);
          if (runnableRecordIds.length >= availableSlots) {
            break;
          }
        }

        if (queuedRecords.length < scanBatchSize) {
          break;
        }
        skip += queuedRecords.length;
      }

      for (const recordId of runnableRecordIds) {
        void consumeQueuedRecord({ db, recordId });
      }
    } finally {
      queuePumpPromise = null;
    }
  })();

  return queuePumpPromise;
};

export const startMockExamAiReviewQueue = ({ db = prisma } = {}) => {
  if (queueTimer !== null) {
    return;
  }

  const triggerPump = () => {
    void pumpMockExamAiReviewQueue({ db });
  };

  triggerPump();
  queueTimer = setInterval(triggerPump, getQueuePollIntervalMs());
};

export const stopMockExamAiReviewQueue = () => {
  if (queueTimer !== null) {
    clearInterval(queueTimer);
    queueTimer = null;
  }
};

export const __resetMockExamAiReviewQueueForTests = () => {
  stopMockExamAiReviewQueue();
  runningRecordIds.clear();
  forcedAdminQueueMap.clear();
  queuePumpPromise = null;
  queueRecoveryPromise = null;
};

export const __setRunningMockExamAiReviewQueueRecordIdsForTests = (recordIds = []) => {
  runningRecordIds.clear();
  for (const recordId of Array.isArray(recordIds) ? recordIds : []) {
    const normalizedRecordId = `${recordId ?? ""}`.trim();
    if (normalizedRecordId) {
      runningRecordIds.add(normalizedRecordId);
    }
  }
};
