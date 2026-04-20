import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { handleShopPaymentCallback, resolveWechatOauthCallbackRedirectUrl } from "../lib/shop-payment.js";

export const paymentRouter = Router();

const replyWechatCallback = (res, ok, message) => {
  res.status(ok ? 200 : 500).json({
    code: ok ? "SUCCESS" : "FAIL",
    message: message || (ok ? "成功" : "失败"),
  });
};

paymentRouter.get("/wechat/oauth/callback", async (req, res) => {
  const code = `${req.query?.code ?? ""}`.trim();
  const state = `${req.query?.state ?? ""}`.trim();

  if (!code || !state) {
    return res.status(400).send("微信授权缺少必要参数");
  }

  try {
    const redirectUrl = await resolveWechatOauthCallbackRedirectUrl({
      code,
      state,
    });
    return res.redirect(302, redirectUrl);
  } catch (error) {
    return res.status(error?.statusCode || 500).send(error?.message || "微信授权失败");
  }
});

paymentRouter.post("/callback/:channel", async (req, res) => {
  const channel = `${req.params.channel ?? ""}`.trim();
  const rawBody = `${req.rawBody ?? ""}`;

  try {
    await handleShopPaymentCallback({
      db: prisma,
      channel,
      headers: req.headers,
      rawBody,
      body: req.body,
    });

    if (channel === "wechat_h5" || channel === "wechat_jsapi") {
      return replyWechatCallback(res, true, "成功");
    }

    if (channel === "alipay_wap") {
      return res.type("text/plain").send("success");
    }

    return res.status(400).send("unsupported channel");
  } catch (error) {
    console.error("Payment callback failed:", {
      channel,
      message: error?.message,
      stack: error?.stack,
    });

    if (channel === "wechat_h5" || channel === "wechat_jsapi") {
      return replyWechatCallback(res, false, error?.message || "失败");
    }

    if (channel === "alipay_wap") {
      return res.status(error?.statusCode || 500).type("text/plain").send("failure");
    }

    return res.status(error?.statusCode || 500).send(error?.message || "callback failed");
  }
});
