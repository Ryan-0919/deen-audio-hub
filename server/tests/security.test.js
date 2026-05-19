import assert from "node:assert/strict";
import test from "node:test";
import {
  consumeAdminLoginAttempt,
  consumeUserLoginAttempt,
  consumeUserRegisterAttempt,
  isValidPhone,
  normalizePhone,
  validatePasswordOrThrow,
  validatePhoneOrThrow,
} from "../lib/security.js";

test("normalizePhone strips non-digits and keeps mainland mobile number", () => {
  assert.equal(normalizePhone(" 138-0013-8000 "), "13800138000");
  assert.equal(normalizePhone("+86 138 0013 8000"), "8613800138000");
});

test("phone validation accepts valid mobile numbers and rejects invalid input", () => {
  assert.equal(isValidPhone("13800138000"), true);
  assert.equal(validatePhoneOrThrow("138 0013 8000"), "13800138000");
  assert.equal(isValidPhone("123456"), false);
  assert.throws(() => validatePhoneOrThrow("10086"), /手机号/);
});

test("password validation enforces length boundaries", () => {
  assert.equal(validatePasswordOrThrow("den2024"), "den2024");
  assert.throws(() => validatePasswordOrThrow("12345"), /密码长度/);
  assert.throws(() => validatePasswordOrThrow("a".repeat(33)), /密码长度/);
});

test("user login limiter blocks after 10 failed attempts within the window", () => {
  const uniqueKey = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const ip = `198.51.100.${Math.floor(Math.random() * 100)}`;
  const phone = `13800${uniqueKey.replace(/\D/g, "").slice(-6).padStart(6, "0")}`;

  for (let index = 0; index < 10; index += 1) {
    const result = consumeUserLoginAttempt({ ip, phone });
    assert.equal(result.ok, true);
    assert.equal(result.retryAfterSeconds, 0);
  }

  const blocked = consumeUserLoginAttempt({ ip, phone });
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterSeconds >= 1);
});

test("user register limiter blocks after 6 failed attempts within the window", () => {
  const uniqueKey = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const ip = `198.51.100.${Math.floor(Math.random() * 100)}`;
  const phone = `13900${uniqueKey.replace(/\D/g, "").slice(-6).padStart(6, "0")}`;

  for (let index = 0; index < 6; index += 1) {
    const result = consumeUserRegisterAttempt({ ip, phone });
    assert.equal(result.ok, true);
    assert.equal(result.retryAfterSeconds, 0);
  }

  const blocked = consumeUserRegisterAttempt({ ip, phone });
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterSeconds >= 1);
});

test("admin login limiter blocks after 8 failed attempts within the window", () => {
  const ip = `203.0.113.${Math.floor(Math.random() * 100)}`;
  const account = `admin-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  for (let index = 0; index < 8; index += 1) {
    const result = consumeAdminLoginAttempt({ ip, account });
    assert.equal(result.ok, true);
    assert.equal(result.retryAfterSeconds, 0);
  }

  const blocked = consumeAdminLoginAttempt({ ip, account });
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterSeconds >= 1);
});
