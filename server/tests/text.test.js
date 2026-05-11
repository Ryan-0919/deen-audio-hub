import assert from "node:assert/strict";
import test from "node:test";
import { getDisplayNameFromUpload, normalizeDisplayText } from "../lib/text.js";

test("normalizeDisplayText fixes full latin1 mojibake text", () => {
  const expected = "请求失败";
  const mojibake = Buffer.from(expected, "utf8").toString("latin1");

  assert.equal(normalizeDisplayText(mojibake), expected);
});

test("normalizeDisplayText keeps mixed chinese text stable when only a fragment is mojibake", () => {
  const teacherName = "张三";
  const mixed = `该试卷已由${Buffer.from(teacherName, "utf8").toString("latin1")}领取，请稍后再试`;

  assert.equal(normalizeDisplayText(mixed), mixed);
});

test("getDisplayNameFromUpload keeps readable chinese fallback names", () => {
  assert.equal(getDisplayNameFromUpload("", "未命名文件"), "未命名文件");
});
