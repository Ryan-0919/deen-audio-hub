import { prisma } from "./prisma.js";
import { normalizeDisplayText } from "./text.js";

const toDetailText = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const normalized = normalizeDisplayText(value);
    return normalized || null;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch (_error) {
    return `${value}`;
  }
};

export const writeAuditLog = async ({
  adminId = null,
  operatorAccount = "",
  operatorName = "",
  action,
  entityType,
  entityId = null,
  entityName = "",
  detail = null,
}) => {
  if (!action || !entityType) return null;

  return prisma.auditLog.create({
    data: {
      adminId,
      operatorAccount: operatorAccount || null,
      operatorName: operatorName || null,
      action,
      entityType,
      entityId,
      entityName: entityName || null,
      detail: toDetailText(detail),
    },
  });
};

export const writeAdminAuditLog = async (req, payload) =>
  writeAuditLog({
    adminId: req.auth?.adminId ?? null,
    operatorAccount: req.auth?.admin?.account ?? "",
    operatorName: req.auth?.admin?.name ?? "",
    ...payload,
  });

export const writeSystemAuditLog = async (payload) =>
  writeAuditLog({
    operatorAccount: "system",
    operatorName: "\u7cfb\u7edf\u4efb\u52a1",
    ...payload,
  });
