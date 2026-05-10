import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { comparePassword, signAdminToken, signUserToken } from "../lib/auth.js";
import { ok, fail } from "../lib/response.js";
import { serializeUser } from "../lib/serializers.js";
import { getClientIp, getNormalizedDeviceInfo } from "../lib/request.js";
import {
  consumeAdminLoginAttempt,
  consumeUserLoginAttempt,
  resetAdminLoginAttempts,
  resetUserLoginAttempts,
  validatePhoneOrThrow,
} from "../lib/security.js";
import { requireUserAuth } from "../middleware/auth.js";
import { getReadableObjectUrl } from "../lib/upload.js";
import { getDevicesToEvictForNewLogin } from "../lib/device-limit.js";
import { normalizePortalConfig } from "../../src/shared/portal-config.js";

const DEVICE_LIMIT = 5;
const USER_LOGIN_RATE_LIMIT_ERROR_CODE = 10041;
const ADMIN_LOGIN_RATE_LIMIT_ERROR_CODE = 10042;

export const authRouter = Router();

authRouter.get("/branding", async (_req, res) => {
  const config = await prisma.systemConfig.findUnique({
    where: { id: 1 },
  });

  let portalConfig;
  try {
    portalConfig = normalizePortalConfig(config?.portalConfigJson ? JSON.parse(config.portalConfigJson) : null, {
      customerServiceUrl: config?.customerServiceUrl ?? "",
    });
  } catch {
    portalConfig = normalizePortalConfig(null, {
      customerServiceUrl: config?.customerServiceUrl ?? "",
    });
  }

  portalConfig.seo.ogImageUrl = getReadableObjectUrl({
    objectKey: portalConfig.seo.ogImageObjectKey ?? "",
    fallbackUrl: portalConfig.seo.ogImageUrl ?? "",
  });
  portalConfig.memberHome.bannerImageUrl = getReadableObjectUrl({
    objectKey: portalConfig.memberHome.bannerImageObjectKey ?? "",
    fallbackUrl: portalConfig.memberHome.bannerImageUrl ?? "",
  });
  portalConfig.founder.imageUrl = getReadableObjectUrl({
    objectKey: portalConfig.founder.imageObjectKey ?? "",
    fallbackUrl: portalConfig.founder.imageUrl ?? "",
  });

  return ok(res, {
    brandLogoUrl: getReadableObjectUrl({
      objectKey: config?.brandLogoObjectKey ?? "",
      fallbackUrl: config?.brandLogoUrl ?? "",
    }),
    customerServiceUrl: config?.customerServiceUrl ?? "",
    playerDiscImageUrl: getReadableObjectUrl({
      objectKey: config?.playerDiscImageObjectKey ?? "",
      fallbackUrl: config?.playerDiscImageUrl ?? "",
    }),
    portalConfig,
  });
});

authRouter.get("/user-home-config", requireUserAuth, async (_req, res) => {
  const config = await prisma.systemConfig.findUnique({
    where: { id: 1 },
  });

  let portalConfig;
  try {
    portalConfig = normalizePortalConfig(config?.portalConfigJson ? JSON.parse(config.portalConfigJson) : null, {
      customerServiceUrl: config?.customerServiceUrl ?? "",
    });
  } catch {
    portalConfig = normalizePortalConfig(null, {
      customerServiceUrl: config?.customerServiceUrl ?? "",
    });
  }

  portalConfig.memberHome.bannerImageUrl = getReadableObjectUrl({
    objectKey: portalConfig.memberHome.bannerImageObjectKey ?? "",
    fallbackUrl: portalConfig.memberHome.bannerImageUrl ?? "",
  });

  return ok(res, {
    memberHome: portalConfig.memberHome,
    examHome: portalConfig.examHome,
    accountCenter: portalConfig.accountCenter,
  });
});

authRouter.post("/user/login", async (req, res, next) => {
  const { password, deviceKey, type, model } = req.body ?? {};
  const rawPhone = `${req.body?.phone ?? ""}`;

  if (!rawPhone || !password || !deviceKey) {
    return fail(res, "\u8bf7\u8f93\u5165\u5b8c\u6574\u7684\u767b\u5f55\u4fe1\u606f", 400);
  }

  try {
    const phone = validatePhoneOrThrow(rawPhone);
    const ip = getClientIp(req);
    const rateLimitResult = consumeUserLoginAttempt({ ip, phone });

    if (!rateLimitResult.ok) {
      return fail(
        res,
        `\u767b\u5f55\u5c1d\u8bd5\u8fc7\u4e8e\u9891\u7e41\uff0c\u8bf7 ${rateLimitResult.retryAfterSeconds} \u79d2\u540e\u518d\u8bd5`,
        429,
        USER_LOGIN_RATE_LIMIT_ERROR_CODE,
      );
    }

    const user = await prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        phone: true,
        passwordHash: true,
        status: true,
      },
    });

    if (!user) {
      return fail(res, "\u624b\u673a\u53f7\u6216\u5bc6\u7801\u9519\u8bef", 400);
    }

    if (user.status === "disabled") {
      return fail(res, "\u5f53\u524d\u8d26\u53f7\u5df2\u505c\u7528", 403);
    }

    const isMatched = await comparePassword(password, user.passwordHash);
    if (!isMatched) {
      return fail(res, "\u624b\u673a\u53f7\u6216\u5bc6\u7801\u9519\u8bef", 400);
    }

    const deviceInfo = getNormalizedDeviceInfo(req, { type, model });
    const now = new Date();

    const updatedUser = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM \`User\` WHERE id = ${user.id} FOR UPDATE`;

      const existingDevice = await tx.userDevice.findUnique({
        where: {
          userId_deviceKey: {
            userId: user.id,
            deviceKey,
          },
        },
      });

      if (existingDevice) {
        await tx.userDevice.update({
          where: { id: existingDevice.id },
          data: {
            type: deviceInfo.type,
            model: deviceInfo.model,
            ip: deviceInfo.ip,
            loginAt: now,
          },
        });
      } else {
        const existingDevices = await tx.userDevice.findMany({
          where: { userId: user.id },
          select: {
            id: true,
            loginAt: true,
            updatedAt: true,
          },
        });

        const deviceIdsToEvict = getDevicesToEvictForNewLogin(existingDevices, DEVICE_LIMIT);
        if (deviceIdsToEvict.length > 0) {
          await tx.userDevice.deleteMany({
            where: {
              userId: user.id,
              id: {
                in: deviceIdsToEvict,
              },
            },
          });
        }

        await tx.userDevice.create({
          data: {
            userId: user.id,
            deviceKey,
            type: deviceInfo.type,
            model: deviceInfo.model,
            ip: deviceInfo.ip,
            loginAt: now,
          },
        });
      }

      return tx.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: now,
        },
        include: {
          permissions: true,
          devices: true,
        },
      });
    });

    const token = signUserToken({
      userId: updatedUser.id,
      phone: updatedUser.phone,
      deviceKey,
    });
    resetUserLoginAttempts({ ip, phone });

    return ok(res, {
      success: true,
      token,
      user: serializeUser(updatedUser),
    });
  } catch (error) {
    if (error?.statusCode) {
      return fail(res, error.message, error.statusCode, error.code ?? error.statusCode);
    }

    return next(error);
  }
});

authRouter.post("/user/logout", requireUserAuth, async (req, res) => {
  const deviceKey = req.body?.deviceKey || req.auth.deviceKey;

  await prisma.userDevice.deleteMany({
    where: {
      userId: req.auth.userId,
      deviceKey,
    },
  });

  return ok(res, { success: true }, "\u9000\u51fa\u6210\u529f");
});

authRouter.get("/user/me", requireUserAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    include: {
      permissions: true,
      devices: true,
    },
  });

  return ok(res, user ? serializeUser(user) : null);
});

authRouter.post("/admin/login", async (req, res) => {
  const account = `${req.body?.account ?? ""}`.trim();
  const password = `${req.body?.password ?? ""}`;
  if (!account || !password) {
    return fail(res, "\u8bf7\u8f93\u5165\u540e\u53f0\u8d26\u53f7\u548c\u5bc6\u7801", 400);
  }

  const ip = getClientIp(req);
  const rateLimitResult = consumeAdminLoginAttempt({ ip, account });
  if (!rateLimitResult.ok) {
    return fail(
      res,
      `\u540e\u53f0\u767b\u5f55\u5c1d\u8bd5\u8fc7\u4e8e\u9891\u7e41\uff0c\u8bf7 ${rateLimitResult.retryAfterSeconds} \u79d2\u540e\u518d\u8bd5`,
      429,
      ADMIN_LOGIN_RATE_LIMIT_ERROR_CODE,
    );
  }

  const admin = await prisma.admin.findUnique({
    where: { account },
  });

  if (!admin) {
    return fail(res, "\u8d26\u53f7\u6216\u5bc6\u7801\u9519\u8bef", 400);
  }

  const isMatched = await comparePassword(password, admin.passwordHash);
  if (!isMatched) {
    return fail(res, "\u8d26\u53f7\u6216\u5bc6\u7801\u9519\u8bef", 400);
  }

  const token = signAdminToken({
    adminId: admin.id,
    account: admin.account,
    name: admin.name,
    adminRole: admin.role ?? "super_admin",
  });
  resetAdminLoginAttempts({ ip, account });

  return ok(res, {
    success: true,
    token,
    admin: {
      id: admin.id,
      account: admin.account,
      name: admin.name,
      role: admin.role ?? "super_admin",
    },
  });
});
