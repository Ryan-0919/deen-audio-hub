import { mockApi, type ShopPaymentChannel, type ShopPaymentStartResult, type ShopWechatJsapiPaymentPayload } from "./mockData";

const WECHAT_OPEN_ID_KEY = "shopWechatOpenId";

const isBrowser = () => typeof window !== "undefined";

const readLocalStorage = (key: string) => {
  if (!isBrowser()) return "";

  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
};

const writeLocalStorage = (key: string, value: string) => {
  if (!isBrowser()) return;

  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
};

export const isWechatBrowser = () =>
  typeof navigator !== "undefined" && /MicroMessenger/i.test(navigator.userAgent || "");

export const getStoredWechatOpenId = () => readLocalStorage(WECHAT_OPEN_ID_KEY);

export const saveWechatOpenId = (openId: string) => {
  writeLocalStorage(WECHAT_OPEN_ID_KEY, openId.trim());
};

const waitForWeixinBridge = async () => {
  if (!isBrowser()) {
    throw new Error("当前环境不支持微信支付");
  }

  if ((window as typeof window & { WeixinJSBridge?: unknown }).WeixinJSBridge) {
    return;
  }

  await new Promise<void>((resolve) => {
    const handler = () => {
      document.removeEventListener("WeixinJSBridgeReady", handler);
      resolve();
    };

    document.addEventListener("WeixinJSBridgeReady", handler, { once: true });
  });
};

const invokeWechatJsapi = async (payload: ShopWechatJsapiPaymentPayload) => {
  await waitForWeixinBridge();

  const bridge = (window as typeof window & {
    WeixinJSBridge: {
      invoke: (
        name: string,
        payload: Record<string, string>,
        callback: (result: { err_msg?: string; errMsg?: string }) => void,
      ) => void;
    };
  }).WeixinJSBridge;

  return new Promise<string>((resolve) => {
    bridge.invoke(
      "getBrandWCPayRequest",
      {
        appId: payload.appId,
        timeStamp: payload.timeStamp,
        nonceStr: payload.nonceStr,
        package: payload.package,
        signType: payload.signType,
        paySign: payload.paySign,
      },
      (result) => {
        resolve(`${result.err_msg || result.errMsg || ""}`.trim());
      },
    );
  });
};

const buildReturnUrlWithWechatResult = (payload: ShopWechatJsapiPaymentPayload, wxResult: string) => {
  const url = new URL(payload.returnUrl, window.location.origin);
  if (wxResult) {
    url.searchParams.set("wxResult", wxResult);
  }
  return url.toString();
};

export const startShopPaymentFlow = async ({
  orderId,
  payChannel,
}: {
  orderId: string;
  payChannel: ShopPaymentChannel;
}): Promise<{ result: ShopPaymentStartResult; redirected: boolean }> => {
  const result = await mockApi.payShopOrder(orderId, payChannel, {
    wechatOpenId: payChannel === "wechat_jsapi" ? getStoredWechatOpenId() : "",
  });

  if (result.paymentPayload?.type === "wechat_jsapi") {
    const wxResult = await invokeWechatJsapi(result.paymentPayload);
    window.location.href = buildReturnUrlWithWechatResult(result.paymentPayload, wxResult);
    return { result, redirected: true };
  }

  if (result.launchUrl) {
    window.location.href = result.launchUrl;
    return { result, redirected: true };
  }

  return { result, redirected: false };
};
