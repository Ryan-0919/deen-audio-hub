import { hashPassword } from "./auth.js";
import { config, isConfiguredValue } from "./config.js";
import { prisma } from "./prisma.js";

const defaultFolders = ["默认文件夹", "课程直传"];

export const bootstrap = async () => {
  const adminCount = await prisma.admin.count();
  const hasBootstrapAdminConfig = isConfiguredValue(config.adminAccount) && isConfiguredValue(config.adminPassword);

  if (adminCount === 0 && !hasBootstrapAdminConfig) {
    throw new Error("首次启动请在 .env 中配置 ADMIN_ACCOUNT 和 ADMIN_PASSWORD");
  }

  if (hasBootstrapAdminConfig) {
    const admin = await prisma.admin.findFirst({
      where: { account: config.adminAccount },
    });

    if (!admin) {
      await prisma.admin.create({
        data: {
          account: config.adminAccount,
          passwordHash: await hashPassword(config.adminPassword),
          name: "课程运营管理员",
        },
      });
    }
  }

  for (const name of defaultFolders) {
    const exists = await prisma.audioFolder.findUnique({ where: { name } });
    if (!exists) {
      await prisma.audioFolder.create({ data: { name } });
    }
  }

  const systemConfig = await prisma.systemConfig.findUnique({ where: { id: 1 } });
  if (!systemConfig) {
    await prisma.systemConfig.create({
      data: {
        id: 1,
      },
    });
  }
};
