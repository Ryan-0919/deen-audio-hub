import { prisma } from "../lib/prisma.js";
import { verifyToken } from "../lib/auth.js";
import { hasAdminRoleAccess } from "../lib/admin-role.js";
import { fail } from "../lib/response.js";

const INVALID_DEVICE_ERROR_CODE = 10032;

const readToken = (req) => {
  const value = req.headers.authorization;
  if (!value?.startsWith("Bearer ")) return "";
  return value.slice(7).trim();
};

export const requireAdminAuth = async (req, res, next) => {
  try {
    const token = readToken(req);
    if (!token) {
      return fail(res, "\u540e\u53f0\u767b\u5f55\u72b6\u6001\u5df2\u5931\u6548\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55", 401);
    }

    const payload = verifyToken(token);
    if (payload.role !== "admin") {
      return fail(res, "\u65e0\u6743\u9650\u8bbf\u95ee\u540e\u53f0\u63a5\u53e3", 403);
    }

    const admin = await prisma.admin.findUnique({ where: { id: payload.adminId } });
    if (!admin) {
      return fail(res, "\u7ba1\u7406\u5458\u8d26\u53f7\u4e0d\u5b58\u5728", 401);
    }

    req.auth = {
      role: "admin",
      adminId: admin.id,
      adminRole: admin.role ?? payload.adminRole ?? "super_admin",
      admin,
    };
    next();
  } catch (_error) {
    return fail(res, "\u540e\u53f0\u767b\u5f55\u72b6\u6001\u5df2\u5931\u6548\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55", 401);
  }
};

export const requireAdminRoles = (...allowedRoles) => (req, res, next) => {
  const adminRole = req.auth?.adminRole ?? req.auth?.admin?.role ?? "";
  if (hasAdminRoleAccess(adminRole, allowedRoles)) {
    next();
    return;
  }

  return fail(res, "\u5f53\u524d\u8d26\u53f7\u65e0\u6743\u9650\u8bbf\u95ee\u8be5\u540e\u53f0\u529f\u80fd", 403);
};

export const requireUserAuth = async (req, res, next) => {
  try {
    const token = readToken(req);
    if (!token) {
      return fail(res, "\u767b\u5f55\u72b6\u6001\u5df2\u5931\u6548\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55", 401);
    }

    const payload = verifyToken(token);
    if (payload.role !== "user") {
      return fail(res, "\u65e0\u6743\u9650\u8bbf\u95ee\u7528\u6237\u63a5\u53e3", 403);
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      return fail(res, "\u7528\u6237\u4e0d\u5b58\u5728", 401);
    }

    if (user.status === "disabled") {
      return fail(res, "\u5f53\u524d\u8d26\u53f7\u5df2\u505c\u7528", 403);
    }

    const device = await prisma.userDevice.findUnique({
      where: {
        userId_deviceKey: {
          userId: user.id,
          deviceKey: payload.deviceKey,
        },
      },
    });

    if (!device) {
      return fail(
        res,
        "\u5f53\u524d\u767b\u5f55\u8bbe\u5907\u5df2\u5931\u6548\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55",
        401,
        INVALID_DEVICE_ERROR_CODE,
      );
    }

    req.auth = {
      role: "user",
      userId: user.id,
      phone: user.phone,
      deviceKey: payload.deviceKey,
      user,
      device,
    };
    next();
  } catch (_error) {
    return fail(res, "\u767b\u5f55\u72b6\u6001\u5df2\u5931\u6548\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55", 401);
  }
};
