import assert from "node:assert/strict";
import test from "node:test";
import { buildShopPaymentRuntimeDiagnostics } from "../lib/shop-payment-runtime.js";

test("shop payment runtime diagnostics mark mock mode channels ready", () => {
  const diagnostics = buildShopPaymentRuntimeDiagnostics({
    runtimeConfig: {
      shopPaymentMode: "mock",
    },
    shopConfig: {
      enableWechatH5: true,
      enableWechatJsapi: true,
      enableAlipayWap: true,
    },
  });

  assert.equal(diagnostics.mode, "mock");
  assert.equal(diagnostics.baseReady, true);
  assert.equal(diagnostics.channels.wechatH5.ready, true);
  assert.equal(diagnostics.channels.wechatJsapi.ready, true);
  assert.equal(diagnostics.channels.alipayWap.ready, true);
  assert.deepEqual(diagnostics.baseMissing, []);
  assert.equal(diagnostics.refundSupported, true);
  assert.match(diagnostics.refundNotice, /退款/);
});

test("shop payment runtime diagnostics expose missing gateway variables", () => {
  const diagnostics = buildShopPaymentRuntimeDiagnostics({
    runtimeConfig: {
      shopPaymentMode: "gateway",
      paySiteBaseUrl: "https://shop.example.com",
      payNotifyBaseUrl: "",
      wechatPay: {
        appId: "wx-app",
        mchId: "",
        mchSerialNo: "",
        privateKeyPem: "",
        apiV3Key: "",
        platformCertPem: "",
        appSecret: "",
      },
      alipay: {
        appId: "",
        privateKeyPem: "",
        publicKeyPem: "",
      },
    },
    shopConfig: {
      enableWechatH5: true,
      enableWechatJsapi: true,
      enableAlipayWap: false,
    },
  });

  assert.equal(diagnostics.mode, "gateway");
  assert.equal(diagnostics.baseReady, false);
  assert.deepEqual(diagnostics.baseMissing, ["PAY_NOTIFY_BASE_URL"]);
  assert.equal(diagnostics.channels.wechatH5.ready, false);
  assert.ok(diagnostics.channels.wechatH5.missing.includes("WECHAT_PAY_MCH_ID"));
  assert.ok(diagnostics.channels.wechatJsapi.missing.includes("WECHAT_PAY_APP_SECRET"));
  assert.equal(diagnostics.channels.alipayWap.enabled, false);
  assert.equal(diagnostics.refundSupported, true);
  assert.match(diagnostics.refundNotice, /支付平台/);
});
