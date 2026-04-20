import {
  X509Certificate,
  createDecipheriv,
  createHmac,
  createSign,
  createVerify,
  randomBytes,
} from "node:crypto";
import { config } from "./config.js";
import { moneyToCents, parseCourseIdsSnapshot, recalculateShopOrderStatus, shopOrderDetailInclude } from "./shop.js";

const WECHAT_PAY_API_BASE_URL = "https://api.mch.weixin.qq.com";
const ALIPAY_SUCCESS_STATUSES = new Set(["TRADE_SUCCESS", "TRADE_FINISHED"]);

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const generateMockTransactionNo = (channel) => {
  const suffix = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, "0");
  return `mock_${channel}_${Date.now()}_${suffix}`;
};

const randomNonce = (size = 16) => randomBytes(size).toString("hex");

const safeJsonParse = (value) => {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
};

const mergeRawPayload = (current, patch) => {
  const currentObject = safeJsonParse(current);
  const base =
    currentObject && typeof currentObject === "object" && !Array.isArray(currentObject)
      ? currentObject
      : current
        ? { legacy: current }
        : {};

  return JSON.stringify({
    ...base,
    ...patch,
  });
};

const toDate = (value, fallback = new Date()) => {
  if (!value) return fallback;
  if (value instanceof Date) return value;

  const normalized = `${value}`.trim();
  if (!normalized) return fallback;

  const parsed = normalized.includes("T") ? new Date(normalized) : new Date(normalized.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

const buildBase64Url = (value) => Buffer.from(value).toString("base64url");
const parseBase64Url = (value) => Buffer.from(value, "base64url").toString("utf8");

const signState = (payload) => {
  const encodedPayload = buildBase64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", config.jwtSecret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
};

const verifyState = (value) => {
  const [encodedPayload = "", signature = ""] = `${value ?? ""}`.split(".");
  if (!encodedPayload || !signature) {
    throw createHttpError("微信授权状态无效", 400);
  }

  const expectedSignature = createHmac("sha256", config.jwtSecret).update(encodedPayload).digest("base64url");
  if (expectedSignature !== signature) {
    throw createHttpError("微信授权状态校验失败", 400);
  }

  const payload = safeJsonParse(parseBase64Url(encodedPayload));
  if (!payload?.orderId || !payload?.channel || !payload?.expiredAt) {
    throw createHttpError("微信授权状态缺少必要参数", 400);
  }

  if (Number(payload.expiredAt) <= Date.now()) {
    throw createHttpError("微信授权已过期，请重新发起支付", 400);
  }

  return payload;
};

const resolveOrderPayExpireAt = (order) =>
  order?.payExpireAt
    ? new Date(order.payExpireAt)
    : new Date(new Date(order.createdAt).getTime() + config.shopOrderAutoCloseMinutes * 60 * 1000);

const isOrderPaymentExpired = (order) => {
  if (!order || order.paymentStatus === "paid" || order.status !== "pending_payment") {
    return false;
  }

  return resolveOrderPayExpireAt(order).getTime() <= Date.now();
};

const isPaymentChannelEnabled = (shopConfig, channel) => {
  switch (channel) {
    case "wechat_h5":
      return Boolean(shopConfig?.enableWechatH5 ?? true);
    case "wechat_jsapi":
      return Boolean(shopConfig?.enableWechatJsapi ?? true);
    case "alipay_wap":
      return Boolean(shopConfig?.enableAlipayWap ?? true);
    default:
      return true;
  }
};

const isWechatBrowser = (userAgent = "") => /micromessenger/i.test(`${userAgent}`);
const isMobileBrowser = (userAgent = "") => /android|iphone|ipad|ipod|mobile/i.test(`${userAgent}`);

const buildOrderDescription = (order) => {
  const firstItemName = `${order?.items?.[0]?.productNameSnapshot ?? order?.orderNo ?? "商城订单"}`.trim();
  return firstItemName.slice(0, 64) || "商城订单";
};

const formatAlipayTimestamp = (date = new Date()) => {
  const pad = (value) => `${value}`.padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}:${pad(date.getSeconds())}`;
};

const readRequiredConfig = (value, name, channel) => {
  if (`${value ?? ""}`.trim()) {
    return value;
  }

  throw createHttpError(`${channel} 支付未配置：缺少 ${name}`, 503);
};

const ensureGatewayBaseConfig = () => {
  readRequiredConfig(config.paySiteBaseUrl, "PAY_SITE_BASE_URL", "商城");
  readRequiredConfig(config.payNotifyBaseUrl, "PAY_NOTIFY_BASE_URL", "商城");
};

const ensureChannelRuntimeSupported = ({ channel, userAgent = "" }) => {
  if (channel === "wechat_jsapi" && !isWechatBrowser(userAgent)) {
    throw createHttpError("微信 JSAPI 支付只能在微信内打开时使用", 400);
  }

  if (channel === "wechat_h5") {
    if (isWechatBrowser(userAgent)) {
      throw createHttpError("微信内请改用微信支付（JSAPI）", 400);
    }

    if (!isMobileBrowser(userAgent)) {
      throw createHttpError("微信 H5 支付请在手机浏览器内打开", 400);
    }
  }

  if (channel === "alipay_wap") {
    if (isWechatBrowser(userAgent)) {
      throw createHttpError("微信内无法直接拉起支付宝，请在手机浏览器中打开", 400);
    }

    if (!isMobileBrowser(userAgent)) {
      throw createHttpError("支付宝 WAP 支付请在手机浏览器内打开", 400);
    }
  }
};

const ensureGatewayChannelConfigured = (channel) => {
  ensureGatewayBaseConfig();

  if (channel === "wechat_h5" || channel === "wechat_jsapi") {
    readRequiredConfig(config.wechatPay.appId, "WECHAT_PAY_APP_ID", "微信");
    readRequiredConfig(config.wechatPay.mchId, "WECHAT_PAY_MCH_ID", "微信");
    readRequiredConfig(config.wechatPay.mchSerialNo, "WECHAT_PAY_MCH_SERIAL_NO", "微信");
    readRequiredConfig(config.wechatPay.privateKeyPem, "WECHAT_PAY_PRIVATE_KEY(_PATH)", "微信");
    readRequiredConfig(config.wechatPay.apiV3Key, "WECHAT_PAY_API_V3_KEY", "微信");
    readRequiredConfig(config.wechatPay.platformCertPem, "WECHAT_PAY_PLATFORM_CERT(_PATH)", "微信");

    if (channel === "wechat_jsapi") {
      readRequiredConfig(config.wechatPay.appSecret, "WECHAT_PAY_APP_SECRET", "微信");
    }
  }

  if (channel === "alipay_wap") {
    readRequiredConfig(config.alipay.appId, "ALIPAY_APP_ID", "支付宝");
    readRequiredConfig(config.alipay.privateKeyPem, "ALIPAY_PRIVATE_KEY(_PATH)", "支付宝");
    readRequiredConfig(config.alipay.publicKeyPem, "ALIPAY_PUBLIC_KEY(_PATH)", "支付宝");
  }
};

const buildShopPaymentReturnUrl = ({ orderId, channel, extra = {} }) => {
  const searchParams = new URLSearchParams({
    orderId,
    channel,
  });

  Object.entries(extra).forEach(([key, value]) => {
    if (value === undefined || value === null || `${value}`.trim() === "") return;
    searchParams.set(key, `${value}`);
  });

  return `${config.paySiteBaseUrl}/user/shop/payment/return?${searchParams.toString()}`;
};

const buildShopPaymentNotifyUrl = (channel) => `${config.payNotifyBaseUrl}/api/payment/callback/${channel}`;
const buildWechatOauthCallbackUrl = () => `${config.payNotifyBaseUrl}/api/payment/wechat/oauth/callback`;

const signRsaSha256 = (privateKeyPem, message) => {
  const signer = createSign("RSA-SHA256");
  signer.update(message);
  signer.end();
  return signer.sign(privateKeyPem, "base64");
};

const verifyRsaSha256 = (publicKeyPem, message, signature) => {
  const verifier = createVerify("RSA-SHA256");
  verifier.update(message);
  verifier.end();
  return verifier.verify(publicKeyPem, signature, "base64");
};

const buildWechatAuthorizationHeader = ({ method, path, body = "" }) => {
  const timestamp = `${Math.floor(Date.now() / 1000)}`;
  const nonce = randomNonce(16);
  const message = `${method.toUpperCase()}\n${path}\n${timestamp}\n${nonce}\n${body}\n`;
  const signature = signRsaSha256(config.wechatPay.privateKeyPem, message);

  return `WECHATPAY2-SHA256-RSA2048 mchid="${config.wechatPay.mchId}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${config.wechatPay.mchSerialNo}",signature="${signature}"`;
};

const requestWechatPay = async ({ method, path, body }) => {
  const bodyText = body ? JSON.stringify(body) : "";
  const response = await fetch(`${WECHAT_PAY_API_BASE_URL}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: buildWechatAuthorizationHeader({ method, path, body: bodyText }),
      "Content-Type": "application/json",
      "User-Agent": "deen-audio-hub/1.0",
    },
    body: bodyText || undefined,
  });

  const rawText = await response.text();
  const json = safeJsonParse(rawText);

  if (!response.ok) {
    const providerMessage = json?.message || json?.detail || json?.code || rawText || "微信支付请求失败";
    throw createHttpError(`微信支付请求失败：${providerMessage}`, 502);
  }

  return json ?? {};
};

const buildAlipayUnsignedString = (params) =>
  Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && `${value}` !== "")
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

const buildSignedAlipayParams = ({ method, bizContent, extra = {} }) => {
  const baseParams = {
    app_id: config.alipay.appId,
    method,
    format: "JSON",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: formatAlipayTimestamp(new Date()),
    version: "1.0",
    ...extra,
    biz_content: JSON.stringify(bizContent),
  };
  const signature = signRsaSha256(config.alipay.privateKeyPem, buildAlipayUnsignedString(baseParams));

  return {
    ...baseParams,
    sign: signature,
  };
};

const requestAlipayApi = async ({ method, bizContent, extra = {} }) => {
  const params = buildSignedAlipayParams({ method, bizContent, extra });
  const response = await fetch(config.alipay.gateway, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: new URLSearchParams(params).toString(),
  });
  const rawText = await response.text();
  const json = safeJsonParse(rawText);
  const responseKey = `${method.replace(/\./g, "_")}_response`;
  const responseData = json?.[responseKey];

  if (!response.ok || !responseData) {
    throw createHttpError(`支付宝请求失败：${rawText || response.statusText}`, 502);
  }

  return {
    responseData,
    rawText,
  };
};

const normalizeFormPayload = (value) =>
  Object.fromEntries(
    Object.entries(value ?? {}).map(([key, item]) => [key, Array.isArray(item) ? `${item[0] ?? ""}` : `${item ?? ""}`]),
  );

const verifyWechatCallbackSignature = (headers, rawBody) => {
  const timestamp = `${headers["wechatpay-timestamp"] ?? ""}`.trim();
  const nonce = `${headers["wechatpay-nonce"] ?? ""}`.trim();
  const signature = `${headers["wechatpay-signature"] ?? ""}`.trim();
  const serial = `${headers["wechatpay-serial"] ?? ""}`.trim();

  if (!timestamp || !nonce || !signature || !serial) {
    throw createHttpError("微信支付回调缺少签名头", 400);
  }

  if (config.wechatPay.platformSerial && config.wechatPay.platformSerial !== serial) {
    throw createHttpError("微信支付平台证书序列号不匹配", 400);
  }

  const certificate = new X509Certificate(config.wechatPay.platformCertPem);
  const verified = verifyRsaSha256(certificate.publicKey, `${timestamp}\n${nonce}\n${rawBody}\n`, signature);
  if (!verified) {
    throw createHttpError("微信支付回调验签失败", 400);
  }
};

const decryptWechatCallbackResource = (resource) => {
  if (!resource?.ciphertext || !resource?.nonce) {
    throw createHttpError("微信支付回调缺少加密资源", 400);
  }

  const key = Buffer.from(config.wechatPay.apiV3Key, "utf8");
  if (key.length !== 32) {
    throw createHttpError("WECHAT_PAY_API_V3_KEY 长度必须为 32 位", 500);
  }

  const encrypted = Buffer.from(resource.ciphertext, "base64");
  const authTag = encrypted.subarray(encrypted.length - 16);
  const ciphertext = encrypted.subarray(0, encrypted.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(resource.nonce, "utf8"));

  if (resource.associated_data) {
    decipher.setAAD(Buffer.from(resource.associated_data, "utf8"));
  }

  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  const json = safeJsonParse(decrypted);
  if (!json) {
    throw createHttpError("微信支付回调解密结果无效", 400);
  }

  return json;
};

const getOrderForPayment = async (db, orderId) =>
  db.shopOrder.findUnique({
    where: {
      id: orderId,
    },
    include: shopOrderDetailInclude,
  });

const getOrderByOrderNo = async (db, orderNo) =>
  db.shopOrder.findUnique({
    where: {
      orderNo,
    },
    include: shopOrderDetailInclude,
  });

const grantCoursePermissionsForOrder = async (db, order, paidAt) => {
  const digitalItems = (order.items ?? []).filter((item) => item.productTypeSnapshot !== "physical");

  for (const item of digitalItems) {
    const courseIds = parseCourseIdsSnapshot(item.courseIdsSnapshot);

    if (courseIds.length > 0) {
      await db.userCoursePermission.createMany({
        data: courseIds.map((courseId) => ({
          userId: order.userId,
          courseId,
        })),
        skipDuplicates: true,
      });
    }

    const fulfillmentPayload = JSON.stringify({
      courseIds,
      source: "shop_payment",
    });

    const existingCount = (order.digitalFulfillments ?? []).filter((record) => record.orderItemId === item.id).length;

    if (existingCount > 0) {
      await db.shopDigitalFulfillment.updateMany({
        where: {
          orderId: order.id,
          orderItemId: item.id,
        },
        data: {
          status: "success",
          grantType: "course_permission",
          grantPayload: fulfillmentPayload,
          grantedAt: paidAt,
          errorMessage: null,
        },
      });
      continue;
    }

    await db.shopDigitalFulfillment.create({
      data: {
        orderId: order.id,
        orderItemId: item.id,
        userId: order.userId,
        status: "success",
        grantType: "course_permission",
        grantPayload: fulfillmentPayload,
        grantedAt: paidAt,
      },
    });
  }
};

const increaseProductSales = async (db, order) => {
  for (const item of order.items ?? []) {
    await db.shopProduct.update({
      where: {
        id: item.productId,
      },
      data: {
        salesCount: {
          increment: item.quantity,
        },
      },
    });
  }
};

const ensurePaymentRecord = async (db, order, channel) => {
  const latestRecord = (order.payments ?? [])[0];

  if (latestRecord) {
    if (latestRecord.channel === channel) {
      return latestRecord;
    }

    return db.shopPaymentRecord.update({
      where: {
        id: latestRecord.id,
      },
      data: {
        channel,
      },
    });
  }

  return db.shopPaymentRecord.create({
    data: {
      orderId: order.id,
      channel,
      status: "unpaid",
      payAmount: order.payAmount,
    },
  });
};

const persistPaymentAttemptPayload = async ({ db, paymentRecordId, currentRawPayload, channel, requestPayload, responsePayload }) => {
  await db.shopPaymentRecord.update({
    where: {
      id: paymentRecordId,
    },
    data: {
      channel,
      rawPayload: mergeRawPayload(currentRawPayload, {
        request: requestPayload,
        response: responsePayload,
        lastRequestedAt: new Date().toISOString(),
      }),
    },
  });
};

const markShopOrderPaid = async ({
  db,
  orderId,
  orderNo,
  channel,
  transactionNo,
  payAmountCents,
  paidAt,
  rawPayload,
}) => {
  const targetOrder =
    orderId || !orderNo
      ? await getOrderForPayment(db, orderId)
      : await getOrderByOrderNo(db, orderNo);

  if (!targetOrder) {
    throw createHttpError("支付回调对应的订单不存在", 404);
  }

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM \`ShopOrder\` WHERE id = ${targetOrder.id} FOR UPDATE`;
    const pendingOrder = await getOrderForPayment(tx, targetOrder.id);

    if (!pendingOrder) {
      throw createHttpError("支付回调对应的订单不存在", 404);
    }

    const expectedAmountCents = moneyToCents(pendingOrder.payAmount);
    if (payAmountCents !== expectedAmountCents) {
      throw createHttpError("支付金额与订单金额不一致", 400);
    }

    const paymentRecord = await ensurePaymentRecord(tx, pendingOrder, channel);
    if (pendingOrder.paymentStatus === "paid" || paymentRecord.status === "paid") {
      if (!paymentRecord.transactionNo && transactionNo) {
        await tx.shopPaymentRecord.update({
          where: {
            id: paymentRecord.id,
          },
          data: {
            transactionNo,
            paidAt,
            rawPayload: mergeRawPayload(paymentRecord.rawPayload, rawPayload),
          },
        });
      }

      return getOrderForPayment(tx, pendingOrder.id);
    }

    if (pendingOrder.status === "cancelled" || pendingOrder.status === "refunding" || pendingOrder.status === "refunded") {
      throw createHttpError("当前订单状态不允许继续入账，请人工核对", 409);
    }

    await tx.shopPaymentRecord.update({
      where: {
        id: paymentRecord.id,
      },
      data: {
        channel,
        status: "paid",
        transactionNo,
        payAmount: pendingOrder.payAmount,
        paidAt,
        rawPayload: mergeRawPayload(paymentRecord.rawPayload, rawPayload),
      },
    });

    await tx.shopOrder.update({
      where: {
        id: pendingOrder.id,
      },
      data: {
        paymentStatus: "paid",
        status: "paid",
        paidAt,
      },
    });

    await grantCoursePermissionsForOrder(tx, pendingOrder, paidAt);
    await increaseProductSales(tx, pendingOrder);
    await recalculateShopOrderStatus(tx, pendingOrder.id);

    return getOrderForPayment(tx, pendingOrder.id);
  });
};

const createMockPayment = async ({ db, orderId, userId, channel }) => {
  const paidAt = new Date();

  const paidOrder = await db.$transaction(async (tx) => {
    const pendingOrder = await getOrderForPayment(tx, orderId);

    if (!pendingOrder || pendingOrder.userId !== userId) {
      throw createHttpError("订单不存在", 404);
    }

    if (pendingOrder.paymentStatus === "paid") {
      return pendingOrder;
    }

    if (isOrderPaymentExpired(pendingOrder)) {
      throw createHttpError("订单支付已超时，请重新下单", 400);
    }

    const paymentRecord = await ensurePaymentRecord(tx, pendingOrder, channel);
    const transactionNo = generateMockTransactionNo(channel);
    const rawPayload = {
      mode: "mock",
      channel,
      transactionNo,
      paidAt: paidAt.toISOString(),
    };

    await tx.shopPaymentRecord.update({
      where: {
        id: paymentRecord.id,
      },
      data: {
        channel,
        status: "paid",
        transactionNo,
        payAmount: pendingOrder.payAmount,
        paidAt,
        rawPayload: mergeRawPayload(paymentRecord.rawPayload, rawPayload),
      },
    });

    await tx.shopOrder.update({
      where: {
        id: pendingOrder.id,
      },
      data: {
        paymentStatus: "paid",
        status: "paid",
        paidAt,
      },
    });

    await grantCoursePermissionsForOrder(tx, pendingOrder, paidAt);
    await increaseProductSales(tx, pendingOrder);
    await recalculateShopOrderStatus(tx, pendingOrder.id);

    return getOrderForPayment(tx, pendingOrder.id);
  });

  return {
    mode: "mock",
    channel,
    launchUrl: "",
    paymentPayload: null,
    order: paidOrder,
  };
};

const createWechatH5Payment = async ({ order, clientIp }) => {
  const requestPayload = {
    appid: config.wechatPay.appId,
    mchid: config.wechatPay.mchId,
    description: buildOrderDescription(order),
    out_trade_no: order.orderNo,
    notify_url: buildShopPaymentNotifyUrl("wechat_h5"),
    time_expire: resolveOrderPayExpireAt(order).toISOString(),
    amount: {
      total: moneyToCents(order.payAmount),
      currency: "CNY",
    },
    scene_info: {
      payer_client_ip: clientIp || "127.0.0.1",
      h5_info: {
        type: "Wap",
        app_name: config.wechatPay.h5AppName,
        app_url: config.wechatPay.h5AppUrl || config.paySiteBaseUrl,
      },
    },
  };

  const responsePayload = await requestWechatPay({
    method: "POST",
    path: "/v3/pay/transactions/h5",
    body: requestPayload,
  });
  const rawLaunchUrl = `${responsePayload?.h5_url ?? ""}`.trim();

  if (!rawLaunchUrl) {
    throw createHttpError("微信支付未返回 H5 拉起地址", 502);
  }

  const returnUrl = buildShopPaymentReturnUrl({
    orderId: order.id,
    channel: "wechat_h5",
  });

  return {
    launchUrl: `${rawLaunchUrl}${rawLaunchUrl.includes("?") ? "&" : "?"}redirect_url=${encodeURIComponent(returnUrl)}`,
    paymentPayload: null,
    requestPayload,
    responsePayload,
  };
};

const createWechatJsapiPayment = async ({ order, wechatOpenId }) => {
  const requestPayload = {
    appid: config.wechatPay.appId,
    mchid: config.wechatPay.mchId,
    description: buildOrderDescription(order),
    out_trade_no: order.orderNo,
    notify_url: buildShopPaymentNotifyUrl("wechat_jsapi"),
    time_expire: resolveOrderPayExpireAt(order).toISOString(),
    amount: {
      total: moneyToCents(order.payAmount),
      currency: "CNY",
    },
    payer: {
      openid: wechatOpenId,
    },
  };

  const responsePayload = await requestWechatPay({
    method: "POST",
    path: "/v3/pay/transactions/jsapi",
    body: requestPayload,
  });
  const prepayId = `${responsePayload?.prepay_id ?? ""}`.trim();

  if (!prepayId) {
    throw createHttpError("微信支付未返回预支付单号", 502);
  }

  const timeStamp = `${Math.floor(Date.now() / 1000)}`;
  const nonceStr = randomNonce(16);
  const packageValue = `prepay_id=${prepayId}`;
  const paySign = signRsaSha256(
    config.wechatPay.privateKeyPem,
    `${config.wechatPay.appId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`,
  );

  return {
    launchUrl: "",
    requestPayload,
    responsePayload,
    paymentPayload: {
      type: "wechat_jsapi",
      appId: config.wechatPay.appId,
      timeStamp,
      nonceStr,
      package: packageValue,
      signType: "RSA",
      paySign,
      returnUrl: buildShopPaymentReturnUrl({
        orderId: order.id,
        channel: "wechat_jsapi",
      }),
    },
  };
};

const createAlipayWapPayment = async ({ order }) => {
  const returnUrl = buildShopPaymentReturnUrl({
    orderId: order.id,
    channel: "alipay_wap",
  });
  const requestPayload = buildSignedAlipayParams({
    method: "alipay.trade.wap.pay",
    extra: {
      notify_url: buildShopPaymentNotifyUrl("alipay_wap"),
      return_url: returnUrl,
    },
    bizContent: {
      out_trade_no: order.orderNo,
      total_amount: `${order.payAmount}`,
      subject: buildOrderDescription(order),
      product_code: "QUICK_WAP_WAY",
      quit_url: returnUrl,
      time_expire: formatAlipayTimestamp(resolveOrderPayExpireAt(order)),
    },
  });

  return {
    launchUrl: `${config.alipay.gateway}?${new URLSearchParams(requestPayload).toString()}`,
    paymentPayload: null,
    requestPayload,
    responsePayload: null,
  };
};

const createGatewayPayment = async ({ order, channel, clientIp, wechatOpenId }) => {
  switch (channel) {
    case "wechat_h5":
      return createWechatH5Payment({ order, clientIp });
    case "wechat_jsapi":
      return createWechatJsapiPayment({ order, wechatOpenId });
    case "alipay_wap":
      return createAlipayWapPayment({ order });
    default:
      throw createHttpError("暂不支持该支付渠道", 400);
  }
};

const queryWechatPaymentStatus = async ({ order }) =>
  requestWechatPay({
    method: "GET",
    path: `/v3/pay/transactions/out-trade-no/${encodeURIComponent(order.orderNo)}?mchid=${encodeURIComponent(config.wechatPay.mchId)}`,
  });

const queryAlipayPaymentStatus = async ({ order }) => {
  const { responseData, rawText } = await requestAlipayApi({
    method: "alipay.trade.query",
    bizContent: {
      out_trade_no: order.orderNo,
    },
  });

  if (responseData?.code !== "10000") {
    if (responseData?.sub_code === "ACQ.TRADE_NOT_EXIST") {
      return {
        tradeStatus: "WAIT_BUYER_PAY",
        rawText,
        responseData,
      };
    }

    throw createHttpError(`支付宝查单失败：${responseData?.sub_msg || responseData?.msg || responseData?.code}`, 502);
  }

  return {
    tradeStatus: `${responseData.trade_status ?? ""}`.trim(),
    rawText,
    responseData,
  };
};

const buildWechatOauthState = ({ orderId, channel }) =>
  signState({
    orderId,
    channel,
    expiredAt: Date.now() + 10 * 60 * 1000,
  });

export const buildWechatOauthLaunchUrl = ({ orderId, channel }) => {
  ensureGatewayChannelConfigured("wechat_jsapi");
  const authorizeUrl = new URL("https://open.weixin.qq.com/connect/oauth2/authorize");
  authorizeUrl.searchParams.set("appid", config.wechatPay.appId);
  authorizeUrl.searchParams.set("redirect_uri", buildWechatOauthCallbackUrl());
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "snsapi_base");
  authorizeUrl.searchParams.set("state", buildWechatOauthState({ orderId, channel }));
  authorizeUrl.hash = "wechat_redirect";
  return authorizeUrl.toString();
};

export const resolveWechatOauthCallbackRedirectUrl = async ({ code, state }) => {
  ensureGatewayChannelConfigured("wechat_jsapi");
  const parsedState = verifyState(state);
  const response = await fetch(
    `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${encodeURIComponent(config.wechatPay.appId)}&secret=${encodeURIComponent(
      config.wechatPay.appSecret,
    )}&code=${encodeURIComponent(code)}&grant_type=authorization_code`,
  );
  const rawText = await response.text();
  const json = safeJsonParse(rawText);

  if (!response.ok || !json?.openid) {
    const providerMessage = json?.errmsg || rawText || "微信授权失败";
    throw createHttpError(`微信授权失败：${providerMessage}`, 502);
  }

  return buildShopPaymentReturnUrl({
    orderId: parsedState.orderId,
    channel: parsedState.channel,
    extra: {
      resume: "1",
      wechatOpenId: json.openid,
    },
  });
};

export const ensureShopPaymentChannelEnabled = async ({ db, channel }) => {
  const shopConfig = await db.shopConfig.findUnique({
    where: {
      id: 1,
    },
    select: {
      enableWechatH5: true,
      enableWechatJsapi: true,
      enableAlipayWap: true,
    },
  });

  if (!isPaymentChannelEnabled(shopConfig, channel)) {
    throw createHttpError("当前支付方式暂未开启，请更换其他支付方式", 400);
  }
};

export const startShopOrderPayment = async ({
  db,
  orderId,
  userId,
  channel,
  clientIp = "",
  userAgent = "",
  wechatOpenId = "",
}) => {
  const order = await getOrderForPayment(db, orderId);

  if (!order || order.userId !== userId) {
    throw createHttpError("订单不存在", 404);
  }

  if (order.status === "cancelled" || order.status === "refunded" || order.status === "refunding") {
    throw createHttpError("当前订单不允许继续支付", 400);
  }

  if (order.paymentStatus === "paid") {
    const latestChannel = order.payments?.[0]?.channel ?? channel;
    return {
      mode: config.shopPaymentMode === "gateway" ? "gateway" : "mock",
      channel: latestChannel,
      launchUrl: "",
      paymentPayload: null,
      order,
    };
  }

  if (isOrderPaymentExpired(order)) {
    throw createHttpError("订单支付已超时，请重新下单", 400);
  }

  await ensureShopPaymentChannelEnabled({
    db,
    channel,
  });

  ensureChannelRuntimeSupported({
    channel,
    userAgent,
  });

  if (config.shopPaymentMode !== "gateway") {
    return createMockPayment({
      db,
      orderId,
      userId,
      channel,
    });
  }

  ensureGatewayChannelConfigured(channel);

  if (channel === "wechat_jsapi" && !wechatOpenId) {
    return {
      mode: "gateway",
      channel,
      launchUrl: buildWechatOauthLaunchUrl({
        orderId: order.id,
        channel,
      }),
      paymentPayload: null,
      order,
    };
  }

  const { paymentRecordId, currentRawPayload } = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM \`ShopOrder\` WHERE id = ${order.id} FOR UPDATE`;
    const lockedOrder = await getOrderForPayment(tx, order.id);

    if (!lockedOrder || lockedOrder.userId !== userId) {
      throw createHttpError("订单不存在", 404);
    }

    if (lockedOrder.paymentStatus === "paid") {
      throw createHttpError("订单已支付，无需重复发起", 400);
    }

    if (isOrderPaymentExpired(lockedOrder)) {
      throw createHttpError("订单支付已超时，请重新下单", 400);
    }

    const paymentRecord = await ensurePaymentRecord(tx, lockedOrder, channel);

    return {
      paymentRecordId: paymentRecord.id,
      currentRawPayload: paymentRecord.rawPayload,
    };
  });

  const paymentResult = await createGatewayPayment({
    order,
    channel,
    clientIp,
    wechatOpenId,
  });

  await persistPaymentAttemptPayload({
    db,
    paymentRecordId,
    currentRawPayload,
    channel,
    requestPayload: paymentResult.requestPayload,
    responsePayload: paymentResult.responsePayload,
  });

  const refreshedOrder = await getOrderForPayment(db, order.id);

  return {
    mode: "gateway",
    channel,
    launchUrl: paymentResult.launchUrl,
    paymentPayload: paymentResult.paymentPayload ?? null,
    order: refreshedOrder ?? order,
  };
};

export const syncShopOrderPaymentStatus = async ({ db, orderId, userId }) => {
  const order = await getOrderForPayment(db, orderId);

  if (!order || order.userId !== userId) {
    throw createHttpError("订单不存在", 404);
  }

  if (order.paymentStatus === "paid" || config.shopPaymentMode !== "gateway") {
    return order;
  }

  const channel = `${order.payments?.[0]?.channel ?? ""}`.trim();
  if (!channel) {
    return order;
  }

  if (channel === "wechat_h5" || channel === "wechat_jsapi") {
    ensureGatewayChannelConfigured(channel);
    const responseData = await queryWechatPaymentStatus({ order });

    if (`${responseData?.trade_state ?? ""}`.trim() === "SUCCESS") {
      return markShopOrderPaid({
        db,
        orderId: order.id,
        channel,
        transactionNo: `${responseData.transaction_id ?? ""}`.trim(),
        payAmountCents: Number(responseData?.amount?.payer_total ?? responseData?.amount?.total ?? 0),
        paidAt: toDate(responseData?.success_time),
        rawPayload: {
          query: responseData,
          finalizedBy: "query",
        },
      });
    }

    return getOrderForPayment(db, order.id);
  }

  if (channel === "alipay_wap") {
    ensureGatewayChannelConfigured(channel);
    const responseData = await queryAlipayPaymentStatus({ order });

    if (ALIPAY_SUCCESS_STATUSES.has(responseData.tradeStatus)) {
      return markShopOrderPaid({
        db,
        orderId: order.id,
        channel,
        transactionNo: `${responseData.responseData?.trade_no ?? ""}`.trim(),
        payAmountCents: moneyToCents(responseData.responseData?.total_amount ?? order.payAmount),
        paidAt: toDate(responseData.responseData?.send_pay_date),
        rawPayload: {
          query: responseData.responseData,
          rawQueryResponse: responseData.rawText,
          finalizedBy: "query",
        },
      });
    }

    return getOrderForPayment(db, order.id);
  }

  return order;
};

export const handleShopPaymentCallback = async ({ db, channel, headers, rawBody, body }) => {
  if (channel === "wechat_h5" || channel === "wechat_jsapi") {
    ensureGatewayChannelConfigured(channel);
    verifyWechatCallbackSignature(headers, rawBody);
    const callbackPayload = safeJsonParse(rawBody);
    if (!callbackPayload) {
      throw createHttpError("微信支付回调体无效", 400);
    }

    if (`${callbackPayload.event_type ?? ""}`.trim() !== "TRANSACTION.SUCCESS") {
      return {
        channel,
        paid: false,
        order: null,
      };
    }

    const decryptedResource = decryptWechatCallbackResource(callbackPayload.resource);
    if (`${decryptedResource.trade_state ?? ""}`.trim() !== "SUCCESS") {
      return {
        channel,
        paid: false,
        order: null,
      };
    }

    const order = await markShopOrderPaid({
      db,
      orderNo: `${decryptedResource.out_trade_no ?? ""}`.trim(),
      channel,
      transactionNo: `${decryptedResource.transaction_id ?? ""}`.trim(),
      payAmountCents: Number(decryptedResource?.amount?.payer_total ?? decryptedResource?.amount?.total ?? 0),
      paidAt: toDate(decryptedResource?.success_time),
      rawPayload: {
        callback: callbackPayload,
        decryptedResource,
        finalizedBy: "callback",
      },
    });

    return {
      channel,
      paid: true,
      order,
    };
  }

  if (channel === "alipay_wap") {
    ensureGatewayChannelConfigured(channel);
    const normalizedPayload = normalizeFormPayload(body);
    const signature = normalizedPayload.sign;

    if (!signature) {
      throw createHttpError("支付宝回调缺少签名", 400);
    }

    const verified = verifyRsaSha256(
      config.alipay.publicKeyPem,
      buildAlipayUnsignedString(
        Object.fromEntries(
          Object.entries(normalizedPayload).filter(([key]) => key !== "sign" && key !== "sign_type"),
        ),
      ),
      signature,
    );

    if (!verified) {
      throw createHttpError("支付宝回调验签失败", 400);
    }

    if (!ALIPAY_SUCCESS_STATUSES.has(`${normalizedPayload.trade_status ?? ""}`.trim())) {
      return {
        channel,
        paid: false,
        order: null,
      };
    }

    const order = await markShopOrderPaid({
      db,
      orderNo: `${normalizedPayload.out_trade_no ?? ""}`.trim(),
      channel,
      transactionNo: `${normalizedPayload.trade_no ?? ""}`.trim(),
      payAmountCents: moneyToCents(normalizedPayload.total_amount ?? 0),
      paidAt: toDate(normalizedPayload.gmt_payment || normalizedPayload.notify_time),
      rawPayload: {
        callback: normalizedPayload,
        rawBody,
        finalizedBy: "callback",
      },
    });

    return {
      channel,
      paid: true,
      order,
    };
  }

  throw createHttpError("暂不支持该支付回调渠道", 400);
};
