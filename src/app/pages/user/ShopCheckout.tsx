import { motion } from "motion/react";
import { ArrowLeft, CreditCard, MapPin, PackageCheck, Plus, CheckCircle2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { cn } from "../../components/ui/utils";
import {
  type ShopAddress,
  type ShopCheckoutPreview,
  type ShopHomePayload,
  type ShopPaymentChannel,
  mockApi,
} from "../../lib/mockData";
import { formatShopMoney } from "../../lib/shopOrder";
import { startShopPaymentFlow } from "../../lib/shopPayment";

type CheckoutSource = "cart" | "buy_now";

const paymentChannels: { value: ShopPaymentChannel; label: string; description: string }[] = [
  { value: "wechat_h5", label: "微信支付", description: "推荐使用微信直接支付" },
  { value: "alipay_wap", label: "支付宝", description: "支持支付宝余额及绑定的银行卡" },
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
    if (channel.value === "wechat_h5") return shopHome.enableWechatH5 || shopHome.enableWechatJsapi;
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
      <div className="min-h-screen bg-[#f5f7fb] px-4 py-6 md:px-6 xl:px-8">
        <div className="mx-auto max-w-3xl rounded-[40px] bg-white p-12 text-center text-[13px] font-bold uppercase tracking-[0.2em] text-slate-400 shadow-xl shadow-slate-200/40">
          Loading Checkout...
        </div>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="min-h-screen bg-[#f5f7fb] px-4 py-6 md:px-6 xl:px-8 font-sans">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-3xl rounded-[40px] bg-white p-16 text-center shadow-xl shadow-slate-200/40 ring-1 ring-black/[0.03]">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">无法加载结算信息</h2>
          <p className="mt-3 text-sm font-medium leading-7 text-slate-500">商品可能已失效、库存不足，或者本次购买参数不完整。</p>
          <Button className="mt-8 h-12 rounded-full px-8 font-bold tracking-wider" variant="outline" onClick={() => navigate("/user/shop")}>
            返回商城
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] pb-28 lg:pb-10 font-sans selection:bg-slate-900 selection:text-white">
      {/* Premium Header */}
      <div className="sticky top-0 z-30 border-b border-slate-200/50 bg-white/80 backdrop-blur-xl transition-all">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 md:h-[72px] md:px-6 xl:px-8">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="group flex size-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-black/[0.04] transition-all hover:bg-slate-50 hover:shadow-md"
          >
            <ArrowLeft className="size-5 transition-transform group-hover:-translate-x-0.5" />
          </button>
          <h1 className="flex-1 text-center text-[17px] font-bold tracking-tight text-slate-900 md:text-lg">确认订单</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8 xl:px-8">
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start lg:gap-8">
          
          <div className="order-2 space-y-6 lg:order-1">
            {preview.requiresShipping && (
              <motion.section initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="rounded-[32px] bg-white p-5 shadow-sm ring-1 ring-black/[0.03] md:p-7">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <MapPin className="size-5" />
                    </div>
                    <h2 className="text-[17px] font-bold tracking-tight text-slate-900">收货地址</h2>
                  </div>
                  <div className="flex items-center gap-4 text-[13px] font-bold tracking-wider">
                    <button type="button" className="text-slate-400 hover:text-slate-900 transition-colors uppercase" onClick={() => navigate("/user/shop/addresses")}>
                      管理
                    </button>
                    <button type="button" className="text-blue-600 hover:text-blue-700 transition-colors uppercase" onClick={() => setUseNewAddress((current) => !current)}>
                      {useNewAddress ? "使用已有" : "新增地址"}
                    </button>
                  </div>
                </div>

                {useNewAddress ? (
                  <div className="grid gap-4 rounded-[24px] bg-slate-50 p-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Input
                        placeholder="收货人姓名"
                        className="h-12 rounded-[16px] border-none bg-white px-4 shadow-sm"
                        value={addressForm.name}
                        onChange={(event) => setAddressForm((current) => ({ ...current, name: event.target.value }))}
                      />
                      <Input
                        placeholder="手机号码"
                        className="h-12 rounded-[16px] border-none bg-white px-4 shadow-sm"
                        value={addressForm.phone}
                        onChange={(event) => setAddressForm((current) => ({ ...current, phone: event.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <Input
                        placeholder="省份"
                        className="h-12 rounded-[16px] border-none bg-white px-4 shadow-sm"
                        value={addressForm.province}
                        onChange={(event) => setAddressForm((current) => ({ ...current, province: event.target.value }))}
                      />
                      <Input
                        placeholder="城市"
                        className="h-12 rounded-[16px] border-none bg-white px-4 shadow-sm"
                        value={addressForm.city}
                        onChange={(event) => setAddressForm((current) => ({ ...current, city: event.target.value }))}
                      />
                      <Input
                        placeholder="区/县"
                        className="h-12 rounded-[16px] border-none bg-white px-4 shadow-sm"
                        value={addressForm.district}
                        onChange={(event) => setAddressForm((current) => ({ ...current, district: event.target.value }))}
                      />
                    </div>
                    <Textarea
                      placeholder="详细地址 (如街道、小区、楼栋号)"
                      className="min-h-[100px] rounded-[16px] border-none bg-white p-4 shadow-sm resize-none"
                      value={addressForm.address}
                      onChange={(event) => setAddressForm((current) => ({ ...current, address: event.target.value }))}
                    />
                  </div>
                ) : addresses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-[24px] border-2 border-dashed border-slate-200 py-10 text-center">
                    <p className="text-[14px] font-medium text-slate-500">还没有可用收货地址</p>
                    <Button variant="outline" className="mt-4 rounded-full" onClick={() => setUseNewAddress(true)}>添加新地址</Button>
                  </div>
                ) : (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {addresses.map((address) => (
                      <button
                        key={address.id}
                        type="button"
                        onClick={() => setSelectedAddressId(address.id)}
                        className={cn(
                          "relative w-full rounded-[24px] border-2 p-5 text-left transition-all",
                          selectedAddressId === address.id 
                            ? "border-blue-600 bg-blue-50/50 shadow-md shadow-blue-500/10" 
                            : "border-transparent bg-slate-50 hover:bg-slate-100"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <p className="text-[15px] font-bold text-slate-900">{address.name}</p>
                            <span className="text-[14px] font-medium text-slate-500">{address.phone}</span>
                            {address.isDefault && (
                              <Badge variant="secondary" className="rounded-md bg-slate-200/60 px-2 py-0.5 text-[11px] font-bold text-slate-600">默认</Badge>
                            )}
                          </div>
                          {selectedAddressId === address.id && <CheckCircle2 className="size-5 text-blue-600" />}
                        </div>
                        <p className="mt-3 text-[13px] font-medium leading-relaxed text-slate-600">
                          {address.province} {address.city} {address.district} {address.address}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </motion.section>
            )}

            <motion.section initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-[32px] bg-white p-5 shadow-sm ring-1 ring-black/[0.03] md:p-7">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex size-10 items-center justify-center rounded-full bg-green-50 text-green-600">
                  <CreditCard className="size-5" />
                </div>
                <h2 className="text-[17px] font-bold tracking-tight text-slate-900">支付方式</h2>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {availablePaymentChannels.length === 0 ? (
                  <div className="col-span-full rounded-[24px] bg-slate-50 p-5 text-center text-[14px] font-medium text-slate-500">当前没有可用支付方式，请联系客服。</div>
                ) : (
                  availablePaymentChannels.map((channel) => (
                    <button
                      key={channel.value}
                      type="button"
                      onClick={() => setPayChannel(channel.value)}
                      className={cn(
                        "relative flex w-full flex-col justify-center rounded-[24px] border-2 p-5 text-left transition-all",
                        payChannel === channel.value 
                          ? "border-green-600 bg-green-50/50 shadow-md shadow-green-500/10" 
                          : "border-transparent bg-slate-50 hover:bg-slate-100"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-[15px] font-bold text-slate-900">{channel.label}</p>
                        {payChannel === channel.value && <CheckCircle2 className="size-5 text-green-600" />}
                      </div>
                      <p className="mt-2 text-[12px] font-medium text-slate-500">{channel.description}</p>
                    </button>
                  ))
                )}
              </div>

              {shopHome?.paymentGuide && <p className="mt-6 rounded-[16px] bg-slate-50 p-4 text-[13px] font-medium leading-relaxed text-slate-500">{shopHome.paymentGuide}</p>}
            </motion.section>

            <motion.section initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-[32px] bg-white p-5 shadow-sm ring-1 ring-black/[0.03] md:p-7">
              <h2 className="text-[17px] font-bold tracking-tight text-slate-900 mb-4">买家备注</h2>
              <Textarea 
                className="min-h-[100px] rounded-[24px] border-none bg-slate-50 p-5 text-[14px] shadow-inner resize-none focus-visible:ring-2 focus-visible:ring-slate-200" 
                value={remark} 
                onChange={(event) => setRemark(event.target.value)} 
                placeholder="选填：可填写关于商品或发货的特殊要求" 
              />
            </motion.section>
          </div>

          <aside className="order-1 lg:sticky lg:top-[96px] lg:order-2">
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="rounded-[32px] bg-white p-6 shadow-xl shadow-slate-200/40 ring-1 ring-black/[0.03]">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex size-10 items-center justify-center rounded-full bg-[#fff4f0] text-[#ff6a3d]">
                  <PackageCheck className="size-5" />
                </div>
                <h2 className="text-[17px] font-bold tracking-tight text-slate-900">订单清单</h2>
              </div>

              <div className="space-y-4">
                {preview.items.map((item) => (
                  <div key={`${item.productId}-${item.skuId}`} className="group flex gap-4 rounded-[24px] bg-slate-50 p-3 transition-colors hover:bg-slate-100">
                    <img src={item.coverUrl} alt={item.productName} className="h-20 w-20 rounded-[20px] object-cover ring-1 ring-black/[0.04] transition-transform group-hover:scale-105" />
                    <div className="min-w-0 flex-1 flex flex-col justify-between py-1">
                      <div>
                        <p className="line-clamp-2 text-[14px] font-bold leading-snug text-slate-900">{item.productName}</p>
                        <p className="mt-1 text-[12px] font-medium text-slate-500">数量 × {item.quantity}</p>
                      </div>
                      <div className="flex items-end justify-between">
                        <p className="text-[14px] font-bold text-slate-900">{formatShopMoney(item.price)}</p>
                        <p className="text-[12px] font-bold text-[#ff6a3d] bg-orange-50/50 px-2 py-0.5 rounded-md">小计 {formatShopMoney(item.subtotal)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-3 border-t border-slate-100 pt-6">
                <div className="flex items-center justify-between text-[14px] font-medium text-slate-500">
                  <span>商品金额</span>
                  <span className="text-slate-900">{formatShopMoney(preview.productAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-[14px] font-medium text-slate-500">
                  <span>运费</span>
                  <span className="text-slate-900">{formatShopMoney(preview.freightAmount)}</span>
                </div>
                <div className="flex items-end justify-between pt-4">
                  <span className="text-[15px] font-bold text-slate-900 pb-1">应付总计</span>
                  <span className="text-[34px] font-bold tracking-tight text-[#ff6a3d] leading-none">{formatShopMoney(preview.payAmount)}</span>
                </div>
              </div>

              {preview.warnings.length > 0 && (
                <div className="mt-6 space-y-2 rounded-[20px] bg-amber-50 p-4 text-[13px] font-medium leading-relaxed text-amber-700 ring-1 ring-amber-100">
                  {preview.warnings.map((warning) => (
                    <p key={warning} className="flex items-start before:content-['•'] before:mr-2 before:text-amber-500">{warning}</p>
                  ))}
                </div>
              )}

              <Button
                type="button"
                className="mt-8 hidden h-14 w-full rounded-full bg-[#ff6a3d] text-[15px] font-bold tracking-widest text-white shadow-lg shadow-orange-500/25 transition-all hover:-translate-y-0.5 hover:bg-[#f65a28] hover:shadow-orange-500/40 disabled:opacity-50 disabled:shadow-none lg:flex"
                disabled={submitting || creatingAddress || availablePaymentChannels.length === 0}
                onClick={() => void handleSubmit()}
              >
                {submitting ? "PROCESSING..." : "PLACE ORDER"}
              </Button>
            </motion.div>
          </aside>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-4 z-40 px-4 lg:hidden">
        <div className="mx-auto flex max-w-md items-center gap-4 rounded-[32px] bg-white/95 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl ring-1 ring-black/[0.04] supports-[backdrop-filter]:bg-white/80">
          <div className="min-w-0 flex-1 pl-2">
            <p className="text-[11px] font-bold text-slate-400">共 {preview.items.length} 件</p>
            <p className="mt-0.5 text-[22px] font-bold leading-none tracking-tight text-[#ff6a3d]">{formatShopMoney(preview.payAmount)}</p>
          </div>
          <Button
            type="button"
            className="h-12 min-w-[140px] rounded-full bg-[#ff6a3d] px-6 text-[14px] font-bold tracking-wider text-white shadow-md shadow-orange-500/20 hover:bg-[#f65a28] disabled:opacity-50"
            disabled={submitting || creatingAddress || availablePaymentChannels.length === 0}
            onClick={() => void handleSubmit()}
          >
            {submitting ? "PROCESSING" : "PLACE ORDER"}
          </Button>
        </div>
      </div>
    </div>
  );
}
