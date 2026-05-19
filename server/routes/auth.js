import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { comparePassword, hashPassword, signAdminToken, signUserToken } from "../lib/auth.js";
import { ok, fail } from "../lib/response.js";
import { serializeUser } from "../lib/serializers.js";
import { getClientIp, getNormalizedDeviceInfo } from "../lib/request.js";
import {
  consumeAdminLoginAttempt,
  consumeUserLoginAttempt,
  consumeUserRegisterAttempt,
  resetAdminLoginAttempts,
  resetUserLoginAttempts,
  resetUserRegisterAttempts,
  validatePhoneOrThrow,
  validatePasswordOrThrow,
} from "../lib/security.js";
import { requireUserAuth } from "../middleware/auth.js";
import { getReadableObjectUrl } from "../lib/upload.js";
import { getDevicesToEvictForNewLogin } from "../lib/device-limit.js";
import { normalizePortalConfig } from "../../src/shared/portal-config.js";
import { normalizeDisplayText } from "../lib/text.js";

const DEVICE_LIMIT = 5;
const USER_LOGIN_RATE_LIMIT_ERROR_CODE = 10041;
const ADMIN_LOGIN_RATE_LIMIT_ERROR_CODE = 10042;
const USER_REGISTER_RATE_LIMIT_ERROR_CODE = 10043;
const USER_PROFILE_NICKNAME_MAX_LENGTH = 20;

const isUniqueConstraintError = (error) => Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");

const normalizeNickname = (value = "") => {
  const text = normalizeDisplayText(value).replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.slice(0, USER_PROFILE_NICKNAME_MAX_LENGTH);
};

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
        nickname: true,
        avatarUrl: true,
        avatarObjectKey: true,
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
          mockExamSeriesPermissions: true,
          mockExamPermissions: true,
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

authRouter.post("/user/register", async (req, res, next) => {
  const rawPhone = `${req.body?.phone ?? ""}`;
  const rawPassword = `${req.body?.password ?? ""}`;
  const rawConfirmPassword = `${req.body?.confirmPassword ?? ""}`;
  const agreeTerms =
    req.body?.agreeTerms === true ||
    req.body?.agreeTerms === "true" ||
    req.body?.agreeTerms === 1 ||
    req.body?.agreeTerms === "1";
  const { deviceKey, type, model } = req.body ?? {};

  if (!rawPhone || !rawPassword || !deviceKey) {
    return fail(res, "请输入完整的注册信息", 400);
  }

  try {
    const phone = validatePhoneOrThrow(rawPhone);
    const password = validatePasswordOrThrow(rawPassword);
    const confirmPassword = validatePasswordOrThrow(rawConfirmPassword, "确认密码");

    if (password !== confirmPassword) {
      return fail(res, "两次输入的密码不一致", 400);
    }

    if (!agreeTerms) {
      return fail(res, "请先阅读并同意用户协议与隐私政策", 400);
    }

    const ip = getClientIp(req);
    const rateLimitResult = consumeUserRegisterAttempt({ ip, phone });

    if (!rateLimitResult.ok) {
      return fail(
        res,
        `注册尝试过于频繁，请 ${rateLimitResult.retryAfterSeconds} 秒后再试`,
        429,
        USER_REGISTER_RATE_LIMIT_ERROR_CODE,
      );
    }

    const passwordHash = await hashPassword(password);
    const deviceInfo = getNormalizedDeviceInfo(req, { type, model });
    const now = new Date();

    const createdUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone,
          nickname: "",
          avatarUrl: null,
          avatarObjectKey: null,
          passwordHash,
          status: "active",
          lastLoginAt: now,
        },
      });

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

      return tx.user.findUnique({
        where: { id: user.id },
        include: {
          permissions: true,
          devices: true,
          mockExamSeriesPermissions: true,
          mockExamPermissions: true,
        },
      });
    });

    if (!createdUser) {
      return fail(res, "注册失败，请稍后重试", 500);
    }

    const token = signUserToken({
      userId: createdUser.id,
      phone: createdUser.phone,
      deviceKey,
    });
    resetUserRegisterAttempts({ ip, phone });

    return ok(
      res,
      {
        success: true,
        token,
        user: serializeUser(createdUser),
      },
      "注册成功",
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return fail(res, "该手机号已注册，请直接登录", 400);
    }

    if (error?.statusCode) {
      return fail(res, error.message, error.statusCode, error.code ?? error.statusCode);
    }

    if (error instanceof Error && error.message) {
      return fail(res, error.message, 400);
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
      mockExamSeriesPermissions: true,
      mockExamPermissions: true,
    },
  });

  return ok(res, user ? serializeUser(user) : null);
});

authRouter.patch("/user/profile", requireUserAuth, async (req, res) => {
  const nickname = normalizeNickname(`${req.body?.nickname ?? ""}`);

  if (!nickname) {
    return fail(res, "昵称不能为空", 400);
  }

  const updatedUser = await prisma.user.update({
    where: { id: req.auth.userId },
    data: {
      nickname,
    },
    include: {
      permissions: true,
      devices: true,
      mockExamSeriesPermissions: true,
      mockExamPermissions: true,
    },
  });

  return ok(res, serializeUser(updatedUser), "资料已更新");
});

authRouter.patch("/user/password", requireUserAuth, async (req, res) => {
  const currentPassword = `${req.body?.currentPassword ?? ""}`;
  const nextPassword = `${req.body?.newPassword ?? ""}`;
  const confirmPassword = `${req.body?.confirmPassword ?? ""}`;

  if (!currentPassword || !nextPassword || !confirmPassword) {
    return fail(res, "请填写完整的密码信息", 400);
  }

  let validatedPassword;
  let validatedConfirmPassword;

  try {
    validatedPassword = validatePasswordOrThrow(nextPassword, "新密码");
    validatedConfirmPassword = validatePasswordOrThrow(confirmPassword, "确认密码");
  } catch (error) {
    if (error instanceof Error && error.message) {
      return fail(res, error.message, 400);
    }
    throw error;
  }

  if (validatedPassword !== validatedConfirmPassword) {
    return fail(res, "两次输入的新密码不一致", 400);
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    select: {
      id: true,
      passwordHash: true,
    },
  });

  if (!currentUser) {
    return fail(res, "用户不存在", 404);
  }

  const isMatched = await comparePassword(currentPassword, currentUser.passwordHash);
  if (!isMatched) {
    return fail(res, "原密码不正确", 400);
  }

  if (currentPassword === validatedPassword) {
    return fail(res, "新密码不能与原密码一致", 400);
  }

  await prisma.user.update({
    where: { id: req.auth.userId },
    data: {
      passwordHash: await hashPassword(validatedPassword),
    },
  });

  return ok(res, { success: true }, "密码已修改");
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
