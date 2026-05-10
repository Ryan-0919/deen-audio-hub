import { prisma } from "./prisma.js";
import { deleteObject } from "./upload.js";

const getPortalShareImageObjectKey = (systemConfig) => {
  if (!systemConfig?.portalConfigJson) return "";

  try {
    const parsed = JSON.parse(systemConfig.portalConfigJson);
    return `${parsed?.seo?.ogImageObjectKey ?? ""}`.trim();
  } catch {
    return "";
  }
};

const getPortalFounderImageObjectKey = (systemConfig) => {
  if (!systemConfig?.portalConfigJson) return "";

  try {
    const parsed = JSON.parse(systemConfig.portalConfigJson);
    return `${parsed?.founder?.imageObjectKey ?? ""}`.trim();
  } catch {
    return "";
  }
};

const hasSystemImageReference = (systemConfig, objectKey) =>
  Boolean(
    objectKey &&
      systemConfig &&
      [
        systemConfig.brandLogoObjectKey,
        systemConfig.playerDiscImageObjectKey,
        getPortalShareImageObjectKey(systemConfig),
        getPortalFounderImageObjectKey(systemConfig),
      ].some(
        (value) => value && value === objectKey,
      ),
  );

export const cleanupObjectIfUnused = async (objectKey = "") => {
  const normalized = `${objectKey ?? ""}`.trim();
  if (!normalized) return false;

  const [audioCount, audioHandoutCount, courseCoverCount, courseHandoutCount, productCoverCount, productImageCount, bannerImageCount, systemConfig] =
    await Promise.all([
    prisma.audio.count({
      where: { objectKey: normalized },
    }),
    prisma.audio.count({
      where: { handoutObjectKey: normalized },
    }),
    prisma.course.count({
      where: { coverObjectKey: normalized },
    }),
    prisma.course.count({
      where: { handoutObjectKey: normalized },
    }),
    prisma.shopProduct.count({
      where: { coverObjectKey: normalized },
    }),
    prisma.shopProductImage.count({
      where: { imageObjectKey: normalized },
    }),
    prisma.shopBanner.count({
      where: { imageObjectKey: normalized },
    }),
    prisma.systemConfig.findUnique({
      where: { id: 1 },
      select: {
        brandLogoObjectKey: true,
        playerDiscImageObjectKey: true,
        portalConfigJson: true,
      },
    }),
    ]);

  if (
    audioCount > 0 ||
    audioHandoutCount > 0 ||
    courseCoverCount > 0 ||
    courseHandoutCount > 0 ||
    productCoverCount > 0 ||
    productImageCount > 0 ||
    bannerImageCount > 0 ||
    hasSystemImageReference(systemConfig, normalized)
  ) {
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
