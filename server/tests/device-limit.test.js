import assert from "node:assert/strict";
import test from "node:test";
import { getDevicesToEvictForNewLogin } from "../lib/device-limit.js";

const createDevice = (id, loginAt, updatedAt = loginAt) => ({
  id,
  loginAt: new Date(loginAt),
  updatedAt: new Date(updatedAt),
});

test("getDevicesToEvictForNewLogin keeps devices when limit is not reached", () => {
  const devices = [
    createDevice("a", "2026-04-15T10:00:00.000Z"),
    createDevice("b", "2026-04-15T11:00:00.000Z"),
    createDevice("c", "2026-04-15T12:00:00.000Z"),
  ];

  assert.deepEqual(getDevicesToEvictForNewLogin(devices, 5), []);
});

test("getDevicesToEvictForNewLogin evicts the oldest device when a sixth device logs in", () => {
  const devices = [
    createDevice("a", "2026-04-15T08:00:00.000Z"),
    createDevice("b", "2026-04-15T09:00:00.000Z"),
    createDevice("c", "2026-04-15T10:00:00.000Z"),
    createDevice("d", "2026-04-15T11:00:00.000Z"),
    createDevice("e", "2026-04-15T12:00:00.000Z"),
  ];

  assert.deepEqual(getDevicesToEvictForNewLogin(devices, 5), ["a"]);
});

test("getDevicesToEvictForNewLogin evicts multiple oldest devices when data already exceeds the limit", () => {
  const devices = [
    createDevice("a", "2026-04-15T08:00:00.000Z"),
    createDevice("b", "2026-04-15T09:00:00.000Z"),
    createDevice("c", "2026-04-15T10:00:00.000Z"),
    createDevice("d", "2026-04-15T11:00:00.000Z"),
    createDevice("e", "2026-04-15T12:00:00.000Z"),
    createDevice("f", "2026-04-15T13:00:00.000Z"),
  ];

  assert.deepEqual(getDevicesToEvictForNewLogin(devices, 5), ["a", "b"]);
});
