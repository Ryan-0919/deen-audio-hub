import { ArrowLeft, CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { type ShopOrderDetail, type ShopPaymentChannel, mockApi } from "../../lib/mockData";
import { saveWechatOpenId, startShopPaymentFlow } from "../../lib/shopPayment";
import { formatShopMoney } from "../../lib/shopOrder";

const isSupportedChannel = (value: string): value is ShopPaymentChannel =>
  value === "wechat_jsapi" || value === "wechat_h5" || value === "alipay_wap";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

export function ShopPaymentReturn() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = `${searchParams.get("orderId") ?? ""}`.trim();
  const channelParam = `${searchParams.get("channel") ?? ""}`.trim();
  const resume = `${searchParams.get("resume") ?? ""}`.trim() === "1";
  const wechatOpenId = `${searchParams.get("wechatOpenId") ?? ""}`.trim();
  const wxResult = `${searchParams.get("wxResult") ?? ""}`.trim().toLowerCase();
  const channel = isSupportedChannel(channelParam) ? channelParam : null;

  const [order, setOrder] = useState<ShopOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusText, setStatusText] = useState("正在确认支付结果...");
  const resumedRef = useRef(false);

  useEffect(() => {
    let active = true;

    const loadOrder = async () => {
      if (!orderId) {
        if (active) {
          setError("缺少订单参数");
          setLoading(false);
        }
        return;
      }

      if (wechatOpenId) {
        saveWechatOpenId(wechatOpenId);
      }

      try {
        if (resume && channel && !resumedRef.current) {
          resumedRef.current = true;
          setStatusText("正在拉起支付...");
          const launchResult = await startShopPaymentFlow({
            orderId,
            payChannel: channel,
          });

          if (!active || launchResult.redirected) {
            return;
          }

          setOrder(launchResult.result.order);
        }

        const detail = await mockApi.getShopOrderDetail(orderId);
        if (!active) return;

        setOrder(detail);

        if (detail.paymentStatus === "paid") {
          setStatusText("支付成功");
          setLoading(false);
          return;
        }

        setStatusText(wxResult.includes("cancel") ? "支付未完成，正在同步订单状态..." : "正在同步订单状态...");
        const synced = await mockApi.syncShopOrderPaymentStatus(orderId).catch(() => detail);
        if (!active) return;

        setOrder(synced);
        if (synced.paymentStatus === "paid") {
          setStatusText("支付成功");
          setLoading(false);
          return;
        }

        for (let index = 0; index < 5; index += 1) {
          await sleep(2000);
          if (!active) return;

          const polled = await mockApi.getShopOrderDetail(orderId).catch(() => null);
          if (!active || !polled) continue;

          setOrder(polled);
          if (polled.paymentStatus === "paid") {
            setStatusText("支付成功");
            setLoading(false);
            return;
          }
        }

        setStatusText(wxResult.includes("cancel") ? "支付已取消或尚未完成" : "暂未确认到支付成功，可稍后重试");
      } catch (requestError) {
        if (!active) return;
        const message = requestError instanceof Error ? requestError.message : "支付结果确认失败";
        setError(message);
        toast.error(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadOrder();

    return () => {
      active = false;
    };
  }, [channel, orderId, resume, wechatOpenId, wxResult]);

  const goToOrderDetail = () => {
    if (!orderId) {
      navigate("/user/shop/orders");
      return;
    }

    navigate(`/user/shop/orders/${orderId}`);
  };

  const success = order?.paymentStatus === "paid";
  const pending = !success && !error;

  return (
    <div className="min-h-screen bg-[#f6f8fb] px-4 py-6">
      <div className="mx-auto max-w-sm">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 flex size-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-white"
        >
          <ArrowLeft className="size-5" />
        </button>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-slate-100">
            {success ? (
              <CheckCircle2 className="size-8 text-emerald-600" />
            ) : pending ? (
              <LoaderCircle className="size-8 animate-spin text-blue-600" />
            ) : (
              <CircleAlert className="size-8 text-amber-600" />
            )}
          </div>

          <h1 className="mt-4 text-xl font-semibold text-slate-900">{success ? "支付成功" : "支付结果确认中"}</h1>
          <p className="mt-2 text-sm leading-7 text-slate-500">{error || statusText}</p>

          {order ? (
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-left">
              <p className="text-sm text-slate-500">订单号</p>
              <p className="mt-1 break-all font-medium text-slate-900">{order.orderNo}</p>
              <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                <span>支付状态</span>
                <span>{order.paymentStatus === "paid" ? "已支付" : "未支付"}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm text-slate-600">
                <span>应付金额</span>
                <span>{formatShopMoney(order.payAmount)}</span>
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3">
            <Button className="h-11 rounded-full bg-slate-900 text-white hover:bg-slate-800" onClick={goToOrderDetail}>
              查看订单详情
            </Button>
            <Button variant="outline" className="h-11 rounded-full" onClick={() => navigate("/user/shop/orders")}>
              返回订单列表
            </Button>
          </div>

          {loading ? <p className="mt-4 text-xs text-slate-400">支付平台回调可能存在几秒延迟，请稍候。</p> : null}
        </div>
      </div>
    </div>
  );
}
