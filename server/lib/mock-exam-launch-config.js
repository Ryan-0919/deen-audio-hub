import { normalizeMockExamLaunchConfig } from "../../src/shared/mock-exam-launch-config.js";
import { getReadableObjectUrl } from "./upload.js";

export const parseMockExamLaunchConfigJson = (value) => {
  if (!value) {
    return normalizeMockExamLaunchConfig(null);
  }

  try {
    return normalizeMockExamLaunchConfig(JSON.parse(value));
  } catch (_error) {
    return normalizeMockExamLaunchConfig(null);
  }
};

const resolveLaunchConfigAssets = (configValue) => {
  const normalized = normalizeMockExamLaunchConfig(configValue);
  normalized.notice.avatarUrl = getReadableObjectUrl({
    objectKey: normalized.notice.avatarObjectKey ?? "",
    fallbackUrl: normalized.notice.avatarUrl ?? "",
  });
  return normalized;
};

export const getMockExamLaunchConfig = async (db) => {
  const systemConfig = await db.systemConfig.findUnique({
    where: { id: 1 },
    select: {
      mockExamLaunchConfigJson: true,
    },
  });

  return resolveLaunchConfigAssets(parseMockExamLaunchConfigJson(systemConfig?.mockExamLaunchConfigJson ?? null));
};

export const updateMockExamLaunchConfig = async ({ db, config: configInput }) => {
  const normalized = normalizeMockExamLaunchConfig(configInput);

  await db.systemConfig.upsert({
    where: {
      id: 1,
    },
    update: {
      mockExamLaunchConfigJson: JSON.stringify(normalized),
    },
    create: {
      id: 1,
      webhookUrl: "",
      mockExamLaunchConfigJson: JSON.stringify(normalized),
    },
  });

  return resolveLaunchConfigAssets(normalized);
};
