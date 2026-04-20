import { ArrowLeft, CreditCard, MapPin, PackageCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import {
  type ShopAddress,
  type ShopCheckoutPreview,
  type ShopHomePayload,
  type ShopPaymentChannel,
  mockApi,
} from "../../lib/mockData";
import { startShopPaymentFlow } from "../../lib/shopPayment";
import { formatShopMoney } from "../../lib/shopOrder";

type CheckoutSource = "cart" | "buy_now";

const paymentChannels: { value: ShopPaymentChannel; label: string; description: string }[] = [
  { value: "wechat_h5", label: "微信 H5", description: "适合手机浏览器内直接拉起微信支付。" },
  { value: "wechat_jsapi", label: "微信 JSAPI", description: "适合在微信内直接发起支付。" },
  { value: "alipay_wap", label: "支付宝 WAP", description: "适合手机浏览器内直接跳转支付宝。" },
];

const emptyAddressForm = {
  name: "",
  phone: "",
  province: "",
  city: "",
  district: "",
  address: "",
};

const resolveAvailablePaymentChannels = (shopHome: ShopHomePayload | null) =>
  paymentChannels.filter((channel) => {
    if (!shopHome) return true;
    if (channel.value === "wechat_h5") return shopHome.enableWechatH5;
    if (channel.value === "wechat_jsapi") return shopHome.enableWechatJsapi;
    if (channel.value === "alipay_wap") return shopHome.enableAlipayWap;
    return true;
  });

export function ShopCheckout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const source: CheckoutSource = (searchParams.get("source") ?? "buy_now") === "cart" ? "cart" : "buy_now";
  const cartItemIdsParam = searchParams.get("cartItemIds") ?? "";
  const cartItemIds = useMemo(
    () =>
      cartItemIdsParam
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    [cartItemIdsParam],
  );
  const buyNowSkuId = `${searchParams.get("buyNowSkuId") ?? ""}`.trim();
  const buyNowQuantity = Math.max(Number.parseInt(searchParams.get("buyNowQuantity") ?? "1", 10) || 1, 1);

  const [shopHome, setShopHome] = useState<ShopHomePayload | null>(null);
  const [preview, setPreview] = useState<ShopCheckoutPreview | null>(null);
  const [addresses, setAddresses] = useState<ShopAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [useNewAddress, setUseNewAddress] = useState(false);
  const [addressForm, setAddressForm] = useState(emptyAddressForm);
  const [payChannel, setPayChannel] = useState<ShopPaymentChannel>("wechat_h5");
  const [remark, setRemark] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [creatingAddress, setCreatingAddress] = useState(false);

  const availablePaymentChannels = useMemo(() => resolveAvailablePaymentChannels(shopHome), [shopHome]);

  useEffect(() => {
    if (availablePaymentChannels.length === 0) return;
    if (availablePaymentChannels.some((channel) => channel.value === payChannel)) return;
    setPayChannel(availablePaymentChannels[0].value);
  }, [availablePaymentChannels, payChannel]);

  useEffect(() => {
    let active = true;

    const loadAddresses = async () => {
      try {
        const list = await mockApi.getShopAddresses();
        if (!active) return;
        setAddresses(list);
        const defaultAddress = list.find((item) => item.isDefault) ?? list[0];
        setSelectedAddressId(defaultAddress?.id ?? "");
        setUseNewAddress(list.length === 0);
      } catch (error) {
        if (!active) return;
        setAddresses([]);
        setSelectedAddressId("");
        setUseNewAddress(true);
        toast.error(error instanceof Error ? error.message : "加载收货地址失败");
      }
    };

    const load = async () => {
      if (source === "cart" && cartItemIds.length === 0) {
        setLoading(false);
        setPreview(null);
        return;
      }

      if (source === "buy_now" && !buyNowSkuId) {
        setLoading(false);
        setPreview(null);
        return;
      }

      try {
        setLoading(true);

        const [nextPreview, nextHome] = await Promise.all([
          mockApi.previewShopCheckout({
            source,
            cartItemIds: source === "cart" ? cartItemIds : undefined,
            buyNowSkuId: source === "buy_now" ? buyNowSkuId : undefined,
            buyNowQuantity: source === "buy_now" ? buyNowQuantity : undefined,
          }),
          mockApi.getShopHome().catch(() => null),
        ]);

        if (!active) return;

        setPreview(nextPreview);
        setShopHome(nextHome);

        if (nextPreview.requiresShipping) {
          await loadAddresses();
        } else {
          setAddresses([]);
          setSelectedAddressId("");
          setUseNewAddress(false);
        }
      } catch (error) {
        if (!active) return;
        toast.error(error instanceof Error ? error.message : "加载结算信息失败");
        setPreview(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [buyNowQuantity, buyNowSkuId, cartItemIds, source]);

  const ensureAddressId = async () => {
    if (!preview?.requiresShipping) return "";
    if (!useNewAddress && selectedAddressId) return selectedAddressId;

    const payload = {
      name: addressForm.name.trim(),
      phone: addressForm.phone.trim(),
      province: addressForm.province.trim(),
      city: addressForm.city.trim(),
      district: addressForm.district.trim(),
      address: addressForm.address.trim(),
      isDefault: addresses.length === 0,
    };

    if (!payload.name || !payload.phone || !payload.province || !payload.city || !payload.district || !payload.address) {
      throw new Error("请完整填写收货地址");
    }

    setCreatingAddress(true);
    try {
      const created = await mockApi.createShopAddress(payload);
      setAddresses((current) => {
        const nextList = [created, ...current.filter((item) => item.id !== created.id)].sort(
          (left, right) => Number(right.isDefault) - Number(left.isDefault),
        );
        return nextList;
      });
      setSelectedAddressId(created.id);
      setUseNewAddress(false);
      setAddressForm(emptyAddressForm);
      return created.id;
    } finally {
      setCreatingAddress(false);
    }
  };

  const handleSubmit = async () => {
    if (!preview) return;

    if (availablePaymentChannels.length === 0) {
      toast.error("当前没有可用支付方式");
      return;
    }

    try {
      setSubmitting(true);
      const addressId = await ensureAddressId();

      const order = await mockApi.createShopOrder({
        source,
        cartItemIds: source === "cart" ? cartItemIds : undefined,
        buyNowSkuId: source === "buy_now" ? buyNowSkuId : undefined,
        buyNowQuantity: source === "buy_now" ? buyNowQuantity : undefined,
        addressId: addressId || undefined,
        remark: remark.trim() || undefined,
        payChannel,
      });

      toast.success(`订单 ${order.orderNo} 已创建`);
      if (order.payExpireAt) {
        toast.info(`请在 ${order.payExpireAt} 前完成支付`);
      }

      try {
        const paymentResult = await startShopPaymentFlow({
          orderId: order.orderId,
          payChannel,
        });

        if (paymentResult.redirected) {
          return;
        }

        toast.success(paymentResult.result.mode === "mock" ? "订单已完成模拟支付" : "已发起支付");
      } catch (paymentError) {
        toast.error(paymentError instanceof Error ? paymentError.message : "拉起支付失败，请到订单页继续支付");
      }

      navigate(`/user/shop/orders/${order.orderId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建订单失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f8fb] px-4 py-6">
        <div className="mx-auto max-w-sm rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500">结算信息加载中...</div>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="min-h-screen bg-[#f6f8fb] px-4 py-6">
        <div className="mx-auto max-w-sm rounded-3xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-base font-medium text-slate-900">当前没有可结算的商品</p>
          <p className="mt-2 text-sm leading-7 text-slate-500">商品可能已失效、库存不足，或者本次购买参数不完整。</p>
          <Button className="mt-4" variant="outline" onClick={() => navigate("/user/shop")}>
            返回商城
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <div className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-sm items-center px-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex size-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="flex-1 text-center text-base font-semibold text-slate-900">确认订单</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="mx-auto max-w-sm space-y-4 px-4 py-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <PackageCheck className="size-5 text-slate-700" />
            <h2 className="text-base font-semibold text-slate-900">商品清单</h2>
          </div>

          <div className="mt-4 space-y-3">
            {preview.items.map((item) => (
              <div key={`${item.productId}-${item.skuId}`} className="flex gap-3 rounded-2xl bg-slate-50 p-3">
                <img src={item.coverUrl} alt={item.productName} className="h-16 w-16 rounded-2xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium text-slate-900">{item.productName}</p>
                  <p className="mt-1 text-xs text-slate-500">数量 {item.quantity}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-900">{formatShopMoney(item.price)}</p>
                    <p className="text-sm text-slate-500">小计 {formatShopMoney(item.subtotal)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>商品金额</span>
              <span>{formatShopMoney(preview.productAmount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>运费</span>
              <span>{formatShopMoney(preview.freightAmount)}</span>
            </div>
            <div className="flex items-center justify-between text-base font-semibold text-slate-900">
              <span>应付金额</span>
              <span>{formatShopMoney(preview.payAmount)}</span>
            </div>
          </div>

          {preview.warnings.length > 0 ? (
            <div className="mt-4 space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              {preview.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}
        </div>

        {preview.requiresShipping ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MapPin className="size-5 text-slate-700" />
                <h2 className="text-base font-semibold text-slate-900">收货地址</h2>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" className="text-sm text-slate-500" onClick={() => navigate("/user/shop/addresses")}>
                  地址管理
                </button>
                <button type="button" className="text-sm text-blue-700" onClick={() => setUseNewAddress((current) => !current)}>
                  {useNewAddress ? "使用已有地址" : "新增地址"}
                </button>
              </div>
            </div>

            {useNewAddress ? (
              <div className="mt-4 grid gap-3">
                <Input placeholder="收货人" value={addressForm.name} onChange={(event) => setAddressForm((current) => ({ ...current, name: event.target.value }))} />
                <Input placeholder="手机号" value={addressForm.phone} onChange={(event) => setAddressForm((current) => ({ ...current, phone: event.target.value }))} />
                <div className="grid grid-cols-3 gap-3">
                  <Input placeholder="省" value={addressForm.province} onChange={(event) => setAddressForm((current) => ({ ...current, province: event.target.value }))} />
                  <Input placeholder="市" value={addressForm.city} onChange={(event) => setAddressForm((current) => ({ ...current, city: event.target.value }))} />
                  <Input placeholder="区" value={addressForm.district} onChange={(event) => setAddressForm((current) => ({ ...current, district: event.target.value }))} />
                </div>
                <Textarea placeholder="详细地址" value={addressForm.address} onChange={(event) => setAddressForm((current) => ({ ...current, address: event.target.value }))} />
              </div>
            ) : addresses.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">还没有可用收货地址，请先新增一个地址。</p>
            ) : (
              <div className="mt-4 space-y-2">
                {addresses.map((address) => (
                  <button
                    key={address.id}
                    type="button"
                    onClick={() => setSelectedAddressId(address.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      selectedAddressId === address.id ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {address.name} {address.phone}
                      </p>
                      {address.isDefault ? (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                          默认
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {address.province}
                      {address.city}
                      {address.district}
                      {address.address}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <CreditCard className="size-5 text-slate-700" />
            <h2 className="text-base font-semibold text-slate-900">支付方式</h2>
          </div>

          <div className="mt-4 space-y-2">
            {availablePaymentChannels.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-500">当前没有可用支付方式，请联系管理员开启支付通道。</div>
            ) : (
              availablePaymentChannels.map((channel) => (
                <button
                  key={channel.value}
                  type="button"
                  onClick={() => setPayChannel(channel.value)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    payChannel === channel.value ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-900">{channel.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{channel.description}</p>
                </button>
              ))
            )}
          </div>

          {shopHome?.paymentGuide ? <p className="mt-3 text-xs leading-6 text-slate-500">{shopHome.paymentGuide}</p> : null}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">买家备注</h2>
          <Textarea className="mt-4" value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="选填，可填写发货要求或订单备注" />
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>订单来源</span>
            <span>{source === "buy_now" ? "立即购买" : "购物车结算"}</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-base font-semibold text-slate-900">
            <span>应付金额</span>
            <span>{formatShopMoney(preview.payAmount)}</span>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-sm items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500">共 {preview.items.length} 件商品</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{formatShopMoney(preview.payAmount)}</p>
          </div>
          <Button
            type="button"
            className="h-12 rounded-full bg-slate-900 px-6 text-white hover:bg-slate-800"
            disabled={submitting || creatingAddress || availablePaymentChannels.length === 0}
            onClick={() => void handleSubmit()}
          >
            {submitting ? "提交中..." : "提交订单并支付"}
          </Button>
        </div>
      </div>
    </div>
  );
}
