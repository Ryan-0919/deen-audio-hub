const hasValue = (value) => Boolean(`${value ?? ""}`.trim());

const unique = (items) => [...new Set(items.filter(Boolean))];

const collectMissing = (entries) =>
  entries
    .filter(([value]) => !hasValue(value))
    .map(([, name]) => name);

const buildChannelRuntime = ({ enabled, mode, gatewayMissing, mockNote, gatewayNote, disabledNote }) => {
  if (!enabled) {
    return {
      enabled: false,
      ready: false,
      missing: [],
      note: disabledNote,
    };
  }

  if (mode !== "gateway") {
    return {
      enabled: true,
      ready: true,
      missing: [],
      note: mockNote,
    };
  }

  const missing = unique(gatewayMissing);
  return {
    enabled: true,
    ready: missing.length === 0,
    missing,
    note: missing.length === 0 ? gatewayNote : "当前渠道缺少网关配置，暂时不能用于真实支付。",
  };
};

export const buildShopPaymentRuntimeDiagnostics = ({ runtimeConfig = {}, shopConfig = {} } = {}) => {
  const mode = `${runtimeConfig.shopPaymentMode ?? ""}`.trim() || "mock";
  const siteBaseUrl = `${runtimeConfig.paySiteBaseUrl ?? ""}`.trim();
  const notifyBaseUrl = `${runtimeConfig.payNotifyBaseUrl ?? ""}`.trim();
  const gatewayMode = mode === "gateway";
  const baseMissing = gatewayMode
    ? collectMissing([
        [siteBaseUrl, "PAY_SITE_BASE_URL"],
        [notifyBaseUrl, "PAY_NOTIFY_BASE_URL"],
      ])
    : [];

  const wechatCommonMissing = gatewayMode
    ? collectMissing([
        [runtimeConfig.wechatPay?.appId, "WECHAT_PAY_APP_ID"],
        [runtimeConfig.wechatPay?.mchId, "WECHAT_PAY_MCH_ID"],
        [runtimeConfig.wechatPay?.mchSerialNo, "WECHAT_PAY_MCH_SERIAL_NO"],
        [runtimeConfig.wechatPay?.privateKeyPem, "WECHAT_PAY_PRIVATE_KEY(_PATH)"],
        [runtimeConfig.wechatPay?.apiV3Key, "WECHAT_PAY_API_V3_KEY"],
        [runtimeConfig.wechatPay?.platformCertPem, "WECHAT_PAY_PLATFORM_CERT(_PATH)"],
      ])
    : [];

  const wechatJsapiMissing = gatewayMode
    ? collectMissing([[runtimeConfig.wechatPay?.appSecret, "WECHAT_PAY_APP_SECRET"]])
    : [];

  const alipayMissing = gatewayMode
    ? collectMissing([
        [runtimeConfig.alipay?.appId, "ALIPAY_APP_ID"],
        [runtimeConfig.alipay?.privateKeyPem, "ALIPAY_PRIVATE_KEY(_PATH)"],
        [runtimeConfig.alipay?.publicKeyPem, "ALIPAY_PUBLIC_KEY(_PATH)"],
      ])
    : [];

  return {
    mode,
    siteBaseUrl,
    notifyBaseUrl,
    baseReady: !gatewayMode || baseMissing.length === 0,
    baseMissing,
    refundSupported: true,
    refundNotice:
      mode === "gateway"
        ? "已支持退款申请和后台处理流程；真实支付模式下需先在支付平台退款，再回后台点击完成，自动退款接口仍未接入。"
        : "已支持退款申请和后台处理流程，mock 模式可用于完整联调退款流程。",
    channels: {
      wechatH5: buildChannelRuntime({
        enabled: shopConfig.enableWechatH5 !== false,
        mode,
        gatewayMissing: [...baseMissing, ...wechatCommonMissing],
        mockNote: "模拟支付模式下可直接联调，不依赖微信网关参数。",
        gatewayNote: "渠道已就绪。微信 H5 仅适合手机外部浏览器拉起。",
        disabledNote: "渠道已关闭，前台不会展示微信 H5 支付入口。",
      }),
      wechatJsapi: buildChannelRuntime({
        enabled: shopConfig.enableWechatJsapi !== false,
        mode,
        gatewayMissing: [...baseMissing, ...wechatCommonMissing, ...wechatJsapiMissing],
        mockNote: "模拟支付模式下可直接联调，不依赖微信网关参数。",
        gatewayNote: "渠道已就绪。微信 JSAPI 需要在微信内打开。",
        disabledNote: "渠道已关闭，前台不会展示微信 JSAPI 支付入口。",
      }),
      alipayWap: buildChannelRuntime({
        enabled: shopConfig.enableAlipayWap !== false,
        mode,
        gatewayMissing: [...baseMissing, ...alipayMissing],
        mockNote: "模拟支付模式下可直接联调，不依赖支付宝网关参数。",
        gatewayNote: "渠道已就绪。支付宝 WAP 适合手机浏览器拉起。",
        disabledNote: "渠道已关闭，前台不会展示支付宝 WAP 支付入口。",
      }),
    },
  };
};
