import { syncLawEntries } from "../lib/law-sync.js";
import { prisma } from "../lib/prisma.js";

const readArg = (name) => {
  const target = `--${name}`;
  const index = process.argv.findIndex((item) => item === target);
  if (index < 0) {
    return "";
  }

  return process.argv[index + 1] ?? "";
};

const main = async () => {
  const filePath = readArg("file");

  await prisma.$connect();

  const result = await syncLawEntries({
    source: filePath ? "file" : "remote",
    filePath,
  });

  console.log(`source=${result.source}`);
  console.log(`sourceLabel=${result.sourceLabel}`);
  console.log(`totalRecords=${result.totalRecords}`);
  console.log(`topCategoryCount=${result.topCategoryCount}`);
  console.log(`syncedAt=${result.syncedAt}`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
