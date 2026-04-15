import { prisma } from "./prisma.js";
import { deleteObject } from "./upload.js";

const hasSystemImageReference = (systemConfig, objectKey) =>
  Boolean(
    objectKey &&
      systemConfig &&
      [systemConfig.brandLogoObjectKey, systemConfig.playerDiscImageObjectKey].some((value) => value && value === objectKey),
  );

export const cleanupObjectIfUnused = async (objectKey = "") => {
  const normalized = `${objectKey ?? ""}`.trim();
  if (!normalized) return false;

  const [audioCount, courseCount, systemConfig] = await Promise.all([
    prisma.audio.count({
      where: { objectKey: normalized },
    }),
    prisma.course.count({
      where: { coverObjectKey: normalized },
    }),
    prisma.systemConfig.findUnique({
      where: { id: 1 },
      select: {
        brandLogoObjectKey: true,
        playerDiscImageObjectKey: true,
      },
    }),
  ]);

  if (audioCount > 0 || courseCount > 0 || hasSystemImageReference(systemConfig, normalized)) {
    return false;
  }

  try {
    await deleteObject(normalized);
    return true;
  } catch (error) {
    console.error(`OSS cleanup failed for ${normalized}:`, error);
    return false;
  }
};

export const cleanupObjectIfReplaced = async ({ previousObjectKey = "", nextObjectKey = "" }) => {
  const previous = `${previousObjectKey ?? ""}`.trim();
  const next = `${nextObjectKey ?? ""}`.trim();

  if (!previous || previous === next) {
    return false;
  }

  return cleanupObjectIfUnused(previous);
};
