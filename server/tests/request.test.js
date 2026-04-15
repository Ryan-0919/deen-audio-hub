import assert from "node:assert/strict";
import test from "node:test";
import { getClientIp, getNormalizedDeviceInfo } from "../lib/request.js";

const createRequest = (overrides = {}) => ({
  headers: {},
  ip: "",
  socket: {},
  connection: {},
  ...overrides,
});

test("getClientIp prefers x-forwarded-for first hop", () => {
  const req = createRequest({
    headers: {
      "x-forwarded-for": " 203.0.113.8, 203.0.113.9 ",
      "x-real-ip": "198.51.100.9",
    },
    ip: "::ffff:127.0.0.1",
    socket: { remoteAddress: "::ffff:192.0.2.10" },
  });

  assert.equal(getClientIp(req), "203.0.113.8");
});

test("getClientIp falls back to x-real-ip, req.ip and socket remote address", () => {
  const realIpReq = createRequest({
    headers: {
      "x-real-ip": "198.51.100.10",
    },
  });
  assert.equal(getClientIp(realIpReq), "198.51.100.10");

  const requestIpReq = createRequest({
    ip: "::ffff:10.10.10.10",
  });
  assert.equal(getClientIp(requestIpReq), "10.10.10.10");

  const socketIpReq = createRequest({
    socket: { remoteAddress: "::ffff:172.16.0.20" },
  });
  assert.equal(getClientIp(socketIpReq), "172.16.0.20");
});

test("getNormalizedDeviceInfo keeps explicit device data and normalizes whitespace", () => {
  const req = createRequest({
    headers: {
      "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    },
    ip: "::ffff:127.0.0.1",
  });

  const info = getNormalizedDeviceInfo(req, {
    type: "  iOS App  ",
    model: "  iPhone 15 Pro Max  ",
  });

  assert.deepEqual(info, {
    type: "iOS App",
    model: "iPhone 15 Pro Max",
    ip: "127.0.0.1",
  });
});

test("getNormalizedDeviceInfo falls back to user-agent when input is empty", () => {
  const req = createRequest({
    headers: {
      "user-agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8)",
    },
    socket: { remoteAddress: "::ffff:192.0.2.88" },
  });

  const info = getNormalizedDeviceInfo(req, {});

  assert.deepEqual(info, {
    type: "Android",
    model: "Android Device",
    ip: "192.0.2.88",
  });
});
