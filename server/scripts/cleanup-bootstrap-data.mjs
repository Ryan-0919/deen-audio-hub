import "dotenv/config";
import { prisma } from "../lib/prisma.js";

const DEFAULT_AUDIO_FOLDER_NAMES = ["默认文件夹", "课程直传"];
const DEFAULT_TYPING_FOLDER_NAMES = ["法条速录", "案例跟打", "高频金句"];
const DEFAULT_MOCK_EXAM_PAPER_CODES = ["objective_mock_paper_1", "objective_mock_paper_2", "subjective_mock_paper_1"];

const main = async () => {
  const summary = {
    deletedMockExamPapers: 0,
    deletedAudioFolders: 0,
    skippedAudioFolders: [],
    deletedTypingFolders: 0,
    skippedTypingFolders: [],
  };

  const mockExamPapers = await prisma.mockExamPaper.findMany({
    where: {
      code: {
        in: DEFAULT_MOCK_EXAM_PAPER_CODES,
      },
    },
    select: {
      id: true,
      code: true,
      title: true,
      _count: {
        select: {
          records: true,
          permissions: true,
        },
      },
    },
  });

  for (const paper of mockExamPapers) {
    await prisma.mockExamPaper.delete({
      where: {
        id: paper.id,
      },
    });
    summary.deletedMockExamPapers += 1;
  }

  const audioFolders = await prisma.audioFolder.findMany({
    where: {
      name: {
        in: DEFAULT_AUDIO_FOLDER_NAMES,
      },
    },
    include: {
      _count: {
        select: {
          audios: true,
        },
      },
    },
  });

  for (const folder of audioFolders) {
    if (Number(folder._count?.audios ?? 0) > 0) {
      summary.skippedAudioFolders.push({
        id: folder.id,
        name: folder.name,
        reason: "folder_has_audios",
      });
      continue;
    }

    await prisma.audioFolder.delete({
      where: {
        id: folder.id,
      },
    });
    summary.deletedAudioFolders += 1;
  }

  const typingFolders = await prisma.typingPracticeFolder.findMany({
    where: {
      name: {
        in: DEFAULT_TYPING_FOLDER_NAMES,
      },
    },
    include: {
      _count: {
        select: {
          texts: true,
        },
      },
    },
  });

  for (const folder of typingFolders) {
    if (Number(folder._count?.texts ?? 0) > 0) {
      summary.skippedTypingFolders.push({
        id: folder.id,
        name: folder.name,
        reason: "folder_has_texts",
      });
      continue;
    }

    await prisma.typingPracticeFolder.delete({
      where: {
        id: folder.id,
      },
    });
    summary.deletedTypingFolders += 1;
  }

  console.log(JSON.stringify(summary, null, 2));
};

try {
  await main();
} finally {
  await prisma.$disconnect();
}
