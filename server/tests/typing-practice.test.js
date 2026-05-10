import assert from "node:assert/strict";
import test from "node:test";
import { createTypingPracticeRecord, getTypingPracticeTextForUser } from "../lib/typing-practice.js";

const LONG_CONTENT =
  "第一条 为了规范法律服务市场秩序，保障当事人合法权益，促进法治建设发展，现依据相关法律法规制定本规则。".repeat(8);

const createTextEntity = () => ({
  id: "text_1",
  folderId: "folder_1",
  title: "法条速录示例",
  difficulty: "medium",
  source: "测试法条库",
  tagsJson: "[]",
  content: LONG_CONTENT,
  note: "",
  status: "published",
  sortOrder: 1,
  contentLength: LONG_CONTENT.length,
  createdAt: new Date("2026-04-29T08:00:00.000Z"),
  updatedAt: new Date("2026-04-29T08:00:00.000Z"),
  folder: {
    name: "法条速录",
  },
});

const createDb = () => {
  const text = createTextEntity();
  const createdRecords = [];

  return {
    createdRecords,
    systemConfig: {
      findUnique: async () => ({
        typingPracticeDifficultyConfigJson: null,
      }),
    },
    typingPracticeText: {
      findFirst: async ({ where }) => {
        if (where?.id !== text.id || where?.status !== "published") {
          return null;
        }

        return text;
      },
      findUnique: async ({ where }) => {
        if (where?.id !== text.id) {
          return null;
        }

        return {
          id: text.id,
          title: text.title,
          source: text.source,
          difficulty: text.difficulty,
        };
      },
    },
    typingPracticeRecord: {
      create: async ({ data }) => {
        const created = {
          id: `record_${createdRecords.length + 1}`,
          ...data,
          typedContent: data.typedContent ?? "",
          createdAt: new Date("2026-04-29T08:05:00.000Z"),
          completedAt: data.completedAt ?? new Date("2026-04-29T08:05:00.000Z"),
        };
        createdRecords.push(created);
        return created;
      },
    },
  };
};

const withMockedDateNow = async (value, callback) => {
  const originalDateNow = Date.now;
  Date.now = () => value;

  try {
    return await callback();
  } finally {
    Date.now = originalDateNow;
  }
};

test("getTypingPracticeTextForUser returns server-resolved sprint content and a play ticket", async () => {
  const db = createDb();

  const text = await withMockedDateNow(1_000, () =>
    getTypingPracticeTextForUser({
      db,
      textId: "text_1",
      mode: "sprint",
      difficulty: "hard",
      timeLimitSeconds: 180,
    }),
  );

  assert.equal(typeof text.playTicket, "string");
  assert.ok(text.playTicket.length > 20);
  assert.ok(text.content.length > 0);
  assert.ok(text.content.length <= 260);
  assert.notEqual(text.content, LONG_CONTENT);
  assert.equal(text.difficulty, "hard");
});

test("createTypingPracticeRecord rejects tampered content when play ticket does not match", async () => {
  const db = createDb();
  const text = await withMockedDateNow(2_000, () =>
    getTypingPracticeTextForUser({
      db,
      textId: "text_1",
      mode: "sprint",
      difficulty: "easy",
      timeLimitSeconds: 180,
    }),
  );

  await assert.rejects(
    () =>
      withMockedDateNow(8_000, () =>
        createTypingPracticeRecord({
          db,
          userId: "user_1",
          payload: {
            textId: text.id,
            mode: "sprint",
            difficulty: "easy",
            title: text.title,
            sourceSnapshot: text.source,
            contentSnapshot: `${text.content}篡改`,
            typedContent: text.content,
            playTicket: text.playTicket,
            errorCount: 0,
            backspaceCount: 0,
            comboMax: text.content.length,
            capturedStageCount: 99,
            livesRemaining: 3,
            durationSeconds: 5,
            timeLimitSeconds: 180,
          },
        }),
      ),
    /练习文本已被修改|ä¿®æ”¹/,
  );
});

test("createTypingPracticeRecord clamps duration using server-issued play ticket time", async () => {
  const db = createDb();
  const text = await withMockedDateNow(10_000, () =>
    getTypingPracticeTextForUser({
      db,
      textId: "text_1",
      mode: "guided",
      difficulty: "hard",
    }),
  );

  const record = await withMockedDateNow(35_000, () =>
    createTypingPracticeRecord({
      db,
      userId: "user_1",
      payload: {
        textId: text.id,
        mode: "guided",
        difficulty: "hard",
        title: text.title,
        sourceSnapshot: text.source,
        contentSnapshot: text.content,
        typedContent: text.content.slice(0, 40),
        playTicket: text.playTicket,
        errorCount: 0,
        backspaceCount: 0,
        comboMax: 40,
        capturedStageCount: 0,
        livesRemaining: 0,
        durationSeconds: 1,
      },
    }),
  );

  assert.equal(record.durationSeconds, 19);
  assert.equal(record.difficulty, "hard");
});

test("createTypingPracticeRecord ignores client supplied capturedStageCount when scoring", async () => {
  const db = createDb();
  const text = await withMockedDateNow(50_000, () =>
    getTypingPracticeTextForUser({
      db,
      textId: "text_1",
      mode: "guided",
      difficulty: "medium",
    }),
  );

  const record = await withMockedDateNow(70_000, () =>
    createTypingPracticeRecord({
      db,
      userId: "user_1",
      payload: {
        textId: text.id,
        mode: "guided",
        difficulty: "medium",
        title: text.title,
        sourceSnapshot: text.source,
        contentSnapshot: text.content,
        typedContent: text.content.slice(0, 10),
        playTicket: text.playTicket,
        errorCount: 0,
        backspaceCount: 0,
        comboMax: 10,
        capturedStageCount: 999,
        livesRemaining: 9,
        durationSeconds: 20,
      },
    }),
  );

  assert.equal(record.correctLength, 10);
  assert.equal(record.score, 200);
});
