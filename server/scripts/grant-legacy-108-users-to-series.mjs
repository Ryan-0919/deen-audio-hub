import "dotenv/config";
import { prisma } from "../lib/prisma.js";

const DEFAULT_TARGET_SERIES = "主观题108题批改";
const DEFAULT_SOURCE_TITLES = ["主观题108题1", "主观题108题2", "主观题108题3", "主观题108题4"];

const printHelp = () => {
  console.log(`
用法：
  node server/scripts/grant-legacy-108-users-to-series.mjs [选项]

默认行为：
  - 目标机考课程：${DEFAULT_TARGET_SERIES}
  - 来源旧试卷：${DEFAULT_SOURCE_TITLES.join("、")}

可选参数：
  --preview
    只预览，不写入数据库

  --target-series <机考课程名称或ID>
    指定目标机考课程，默认是“${DEFAULT_TARGET_SERIES}”

  --source-title <试卷标题>
    指定来源旧试卷标题，可重复传多次

  --source-titles <标题1,标题2,标题3>
    以逗号分隔一次传多个来源旧试卷标题

示例：
  node server/scripts/grant-legacy-108-users-to-series.mjs --preview
  node server/scripts/grant-legacy-108-users-to-series.mjs
  node server/scripts/grant-legacy-108-users-to-series.mjs --target-series "主观题108题批改"
  node server/scripts/grant-legacy-108-users-to-series.mjs --source-titles "主观题108题1,主观题108题2,主观题108题3,主观题108题4"
`.trim());
};

const parseArgs = (argv) => {
  const args = {
    preview: false,
    targetSeries: DEFAULT_TARGET_SERIES,
    sourceTitles: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current === "--help" || current === "-h") {
      args.help = true;
      continue;
    }

    if (current === "--preview" || current === "--dry-run") {
      args.preview = true;
      continue;
    }

    if (current === "--target-series") {
      args.targetSeries = `${argv[index + 1] ?? ""}`.trim();
      index += 1;
      continue;
    }

    if (current === "--source-title") {
      const value = `${argv[index + 1] ?? ""}`.trim();
      if (value) {
        args.sourceTitles.push(value);
      }
      index += 1;
      continue;
    }

    if (current === "--source-titles") {
      const value = `${argv[index + 1] ?? ""}`
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      args.sourceTitles.push(...value);
      index += 1;
    }
  }

  if (args.sourceTitles.length === 0) {
    args.sourceTitles = [...DEFAULT_SOURCE_TITLES];
  }

  return args;
};

const unique = (list) => Array.from(new Set(list.filter(Boolean)));

const resolveTargetSeries = async (keyword) => {
  const normalized = `${keyword ?? ""}`.trim();
  if (!normalized) {
    throw new Error("目标机考课程不能为空");
  }

  const exact = await prisma.mockExamSeries.findFirst({
    where: {
      OR: [{ id: normalized }, { name: normalized }],
    },
    select: {
      id: true,
      name: true,
      description: true,
    },
  });

  if (exact) {
    return exact;
  }

  const fuzzy = await prisma.mockExamSeries.findMany({
    where: {
      name: {
        contains: normalized,
      },
    },
    select: {
      id: true,
      name: true,
      description: true,
    },
    take: 10,
  });

  if (fuzzy.length === 1) {
    return fuzzy[0];
  }

  const candidates = fuzzy.map((item) => `${item.name} (${item.id})`).join("\n");
  throw new Error(candidates ? `未唯一匹配到目标机考课程，请改成更精确的名称或 ID：\n${candidates}` : `未找到目标机考课程：${normalized}`);
};

const resolveSourcePaperByTitle = async (title) => {
  const normalized = `${title ?? ""}`.trim();
  if (!normalized) {
    return null;
  }

  const exact = await prisma.mockExamPaper.findFirst({
    where: {
      title: normalized,
    },
    select: {
      id: true,
      title: true,
      seriesId: true,
      code: true,
    },
  });

  if (exact) {
    return exact;
  }

  const fuzzy = await prisma.mockExamPaper.findMany({
    where: {
      title: {
        contains: normalized,
      },
    },
    select: {
      id: true,
      title: true,
      seriesId: true,
      code: true,
    },
    take: 10,
  });

  if (fuzzy.length === 1) {
    return fuzzy[0];
  }

  const candidates = fuzzy.map((item) => `${item.title} (${item.id})`).join("\n");
  throw new Error(candidates ? `来源试卷“${normalized}”匹配到多条，请改成更精确的标题：\n${candidates}` : `未找到来源试卷：${normalized}`);
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const targetSeries = await resolveTargetSeries(args.targetSeries);
  const sourcePapers = unique(args.sourceTitles);
  const resolvedSourcePapers = [];

  for (const title of sourcePapers) {
    const paper = await resolveSourcePaperByTitle(title);
    if (paper) {
      resolvedSourcePapers.push(paper);
    }
  }

  const sourcePaperIds = resolvedSourcePapers.map((item) => item.id);
  const targetPapers = await prisma.mockExamPaper.findMany({
    where: {
      seriesId: targetSeries.id,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      status: true,
    },
  });

  const permissionRows = await prisma.userMockExamPermission.findMany({
    where: {
      paperId: {
        in: sourcePaperIds,
      },
    },
    select: {
      userId: true,
      paperId: true,
    },
  });

  const userIds = unique(permissionRows.map((item) => item.userId));
  const users = userIds.length
    ? await prisma.user.findMany({
        where: {
          id: {
            in: userIds,
          },
        },
        select: {
          id: true,
          phone: true,
        },
        orderBy: {
          registeredAt: "desc",
        },
      })
    : [];

  const previewPayload = {
    targetSeries: {
      id: targetSeries.id,
      name: targetSeries.name,
    },
    sourcePapers: resolvedSourcePapers.map((item) => ({
      id: item.id,
      title: item.title,
      code: item.code,
    })),
    targetPapers: targetPapers.map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
    })),
    userCount: users.length,
    samplePhones: users.slice(0, 20).map((item) => item.phone),
    preview: args.preview,
  };

  console.log(JSON.stringify(previewPayload, null, 2));

  if (users.length === 0) {
    console.log("没有找到任何拥有旧试卷权限的用户，无需迁移。");
    return;
  }

  if (args.preview) {
    console.log("预览模式结束，未写入数据库。");
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const createdSeriesPermissions = await tx.userMockExamSeriesPermission.createMany({
      data: userIds.map((userId) => ({
        userId,
        seriesId: targetSeries.id,
      })),
      skipDuplicates: true,
    });

    const createdPaperPermissions =
      targetPapers.length > 0
        ? await tx.userMockExamPermission.createMany({
            data: userIds.flatMap((userId) =>
              targetPapers.map((paper) => ({
                userId,
                paperId: paper.id,
                manualAttemptLimit: null,
                manualAttemptUsed: 0,
                currentRecordStartedAt: null,
              })),
            ),
            skipDuplicates: true,
          })
        : { count: 0 };

    return {
      createdSeriesPermissionCount: createdSeriesPermissions.count,
      createdPaperPermissionCount: createdPaperPermissions.count,
    };
  });

  console.log(
    JSON.stringify(
      {
        success: true,
        targetSeriesId: targetSeries.id,
        targetSeriesName: targetSeries.name,
        migratedUserCount: users.length,
        targetPaperCount: targetPapers.length,
        ...result,
      },
      null,
      2,
    ),
  );
};

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
