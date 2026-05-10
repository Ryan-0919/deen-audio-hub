import { ImagePlus, Save, Sparkles, Store, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { Textarea } from "../../components/ui/textarea";
import { cn } from "../../components/ui/utils";
import {
  type AdminShopConfigPayload,
  type AdminShopProduct,
  type ShopBannerLinkType,
  type ShopCategory,
  type ShopConfig,
  mockApi,
} from "../../lib/mockData";

type PaymentRuntime = ShopConfig["paymentRuntime"];

type BannerForm = {
  localId: string;
  title: string;
  imageUrl: string;
  previewUrl: string;
  imageObjectKey: string;
  linkType: ShopBannerLinkType;
  linkTarget: string;
  sortOrder: string;
  status: boolean;
};

type ConfigFormState = {
  shopNotice: string;
  customerServiceUrl: string;
  featuredProductIds: string[];
  featuredCategoryIds: string[];
  paymentGuide: string;
  enableWechatH5: boolean;
  enableWechatJsapi: boolean;
  enableAlipayWap: boolean;
  runtimePaymentMode: string;
  paymentRuntime: PaymentRuntime;
  banners: BannerForm[];
};

const createLocalId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `local-${Math.random().toString(36).slice(2, 10)}`;

const createEmptyBanner = (): BannerForm => ({
  localId: createLocalId(),
  title: "",
  imageUrl: "",
  previewUrl: "",
  imageObjectKey: "",
  linkType: "product",
  linkTarget: "",
  sortOrder: "0",
  status: true,
});

const createEmptyPaymentRuntime = (): PaymentRuntime => ({
  mode: "",
  siteBaseUrl: "",
  notifyBaseUrl: "",
  baseReady: false,
  baseMissing: [],
  refundSupported: false,
  refundNotice: "",
  channels: {
    wechatH5: {
      enabled: true,
      ready: false,
      missing: [],
      note: "",
    },
    wechatJsapi: {
      enabled: true,
      ready: false,
      missing: [],
      note: "",
    },
    alipayWap: {
      enabled: true,
      ready: false,
      missing: [],
      note: "",
    },
  },
});

const createEmptyForm = (): ConfigFormState => ({
  shopNotice: "",
  customerServiceUrl: "",
  featuredProductIds: [],
  featuredCategoryIds: [],
  paymentGuide: "",
  enableWechatH5: true,
  enableWechatJsapi: true,
  enableAlipayWap: true,
  runtimePaymentMode: "",
  paymentRuntime: createEmptyPaymentRuntime(),
  banners: [],
});

const mapConfigToForm = (config: ShopConfig): ConfigFormState => ({
  shopNotice: config.shopNotice,
  customerServiceUrl: config.customerServiceUrl,
  featuredProductIds: config.featuredProductIds,
  featuredCategoryIds: config.featuredCategoryIds,
  paymentGuide: config.paymentGuide,
  enableWechatH5: config.enableWechatH5,
  enableWechatJsapi: config.enableWechatJsapi,
  enableAlipayWap: config.enableAlipayWap,
  runtimePaymentMode: config.runtimePaymentMode,
  paymentRuntime: config.paymentRuntime,
  banners: config.banners.map((banner, index) => ({
    localId: createLocalId(),
    title: banner.title,
    imageUrl: banner.imageSourceUrl ?? banner.imageUrl,
    previewUrl: banner.imageUrl,
    imageObjectKey: banner.imageObjectKey,
    linkType: banner.linkType,
    linkTarget: banner.linkTarget,
    sortOrder: `${banner.sortOrder ?? index}`,
    status: banner.status,
  })),
});

const buildPayload = (form: ConfigFormState): AdminShopConfigPayload => ({
  shopNotice: form.shopNotice.trim(),
  customerServiceUrl: form.customerServiceUrl.trim(),
  featuredProductIds: form.featuredProductIds,
  featuredCategoryIds: form.featuredCategoryIds,
  paymentGuide: form.paymentGuide.trim(),
  enableWechatH5: form.enableWechatH5,
  enableWechatJsapi: form.enableWechatJsapi,
  enableAlipayWap: form.enableAlipayWap,
  banners: form.banners.map((banner, index) => ({
    title: banner.title.trim(),
    imageUrl: banner.imageUrl,
    imageObjectKey: banner.imageObjectKey,
    linkType: banner.linkType,
    linkTarget: banner.linkTarget.trim(),
    sortOrder: Number.parseInt(banner.sortOrder, 10) || index,
    status: banner.status,
  })),
});

const paymentModeLabel = (value: string) => {
  if (value === "mock") return "模拟支付";
  if (value === "gateway") return "网关支付";
  return value || "未配置";
};

const productStatusLabel: Record<string, string> = {
  draft: "草稿",
  on_sale: "上架中",
  off_sale: "已下架",
};

const getRuntimeBadgeClassName = (enabled: boolean, ready: boolean) => {
  if (!enabled) return "bg-slate-100 text-slate-600";
  if (ready) return "bg-emerald-100 text-emerald-700";
  return "bg-rose-100 text-rose-700";
};

const getRuntimeBadgeLabel = (enabled: boolean, ready: boolean) => {
  if (!enabled) return "已关闭";
  return ready ? "已就绪" : "缺配置";
};

const loadAllAdminShopProducts = async () => {
  const pageSize = 200;
  let page = 1;
  let total = 0;
  const productMap = new Map<string, AdminShopProduct>();

  do {
    const result = await mockApi.getAdminShopProducts({ page, pageSize, status: "all" });
    total = result.pagination.total;
    result.list.forEach((product) => {
      productMap.set(product.id, product);
    });
    page += 1;
  } while (productMap.size < total);

  return Array.from(productMap.values());
};

export function ShopConfig() {
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [products, setProducts] = useState<AdminShopProduct[]>([]);
  const [form, setForm] = useState<ConfigFormState>(createEmptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingBannerId, setUploadingBannerId] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [config, categoryList, productResult] = await Promise.all([
          mockApi.getAdminShopConfig(),
          mockApi.getAdminShopCategories(),
          loadAllAdminShopProducts(),
        ]);
        setForm(mapConfigToForm(config));
        setCategories(categoryList);
        setProducts(productResult);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "加载商城配置失败");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const enabledChannelCount = useMemo(() => [form.enableWechatH5, form.enableWechatJsapi, form.enableAlipayWap].filter(Boolean).length, [form.enableAlipayWap, form.enableWechatH5, form.enableWechatJsapi]);
  const selectedProducts = useMemo(() => products.filter((product) => form.featuredProductIds.includes(product.id)), [form.featuredProductIds, products]);
  const selectedCategories = useMemo(() => categories.filter((category) => form.featuredCategoryIds.includes(category.id)), [categories, form.featuredCategoryIds]);
  const paymentRuntimeCards = useMemo(
    () => [
      { key: "wechatH5", label: "微信 H5", runtime: form.paymentRuntime.channels.wechatH5 },
      { key: "wechatJsapi", label: "微信 JSAPI", runtime: form.paymentRuntime.channels.wechatJsapi },
      { key: "alipayWap", label: "支付宝 WAP", runtime: form.paymentRuntime.channels.alipayWap },
    ],
    [form.paymentRuntime],
  );

  const updateBanner = (localId: string, updater: (banner: BannerForm) => BannerForm) => {
    setForm((current) => ({ ...current, banners: current.banners.map((banner) => (banner.localId === localId ? updater(banner) : banner)) }));
  };

  const handleBannerUpload = async (localId: string, file?: File | null) => {
    if (!file) return;
    setUploadingBannerId(localId);
    try {
      const uploaded = await mockApi.uploadShopImage(file);
      updateBanner(localId, (banner) => ({
        ...banner,
        imageUrl: uploaded.url,
        previewUrl: uploaded.readableUrl ?? uploaded.url,
        imageObjectKey: uploaded.objectKey,
      }));
      toast.success("轮播图已上传");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "轮播图上传失败");
    } finally {
      setUploadingBannerId("");
    }
  };

  const handleSave = async () => {
    const payload = buildPayload(form);
    for (const banner of payload.banners) {
      if (!banner.imageUrl) return toast.error("请先上传所有轮播图图片");
      if (!banner.linkTarget) return toast.error("请完善轮播图跳转目标");
    }
    setSaving(true);
    try {
      const updated = await mockApi.updateAdminShopConfig(payload);
      setForm(mapConfigToForm(updated));
      toast.success("商城配置已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存商城配置失败");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-slate-500">商城配置加载中...</div>;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">商城配置</h1>
          <p className="mt-2 text-sm text-slate-500">管理公告、支付通道、首页推荐位和轮播图。</p>
        </div>
        <Button onClick={() => void handleSave()} disabled={saving || uploadingBannerId !== ""}><Save className="mr-2 size-4" />{saving ? "保存中..." : "保存配置"}</Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-6"><div className="flex items-center gap-3 text-slate-500"><WalletCards className="size-5" /><span className="text-sm">当前支付模式</span></div><p className="mt-2 text-2xl font-semibold text-slate-900">{paymentModeLabel(form.runtimePaymentMode)}</p><p className="mt-2 text-sm text-slate-500">读取服务端运行时配置，仅用于查看当前环境。</p></div>
        <div className="rounded-3xl border border-blue-200 bg-blue-50 p-6"><div className="flex items-center gap-3 text-blue-700"><ImagePlus className="size-5" /><span className="text-sm">轮播图数量</span></div><p className="mt-2 text-2xl font-semibold text-blue-900">{form.banners.length}</p><p className="mt-2 text-sm text-blue-700">首页推荐位轮播图总数</p></div>
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6"><div className="flex items-center gap-3 text-emerald-700"><Sparkles className="size-5" /><span className="text-sm">启用通道</span></div><p className="mt-2 text-2xl font-semibold text-emerald-900">{enabledChannelCount}</p><p className="mt-2 text-sm text-emerald-700">最多 3 个可切换支付通道</p></div>
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6"><div className="flex items-center gap-3 text-amber-700"><Store className="size-5" /><span className="text-sm">推荐资源</span></div><p className="mt-2 text-2xl font-semibold text-amber-900">{selectedCategories.length + selectedProducts.length}</p><p className="mt-2 text-sm text-amber-700">已配置分类与商品推荐位</p></div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-8">
            <h2 className="text-lg font-semibold text-slate-900">基础信息</h2>
            <div className="mt-6 space-y-4">
              <div className="space-y-2"><Label>商城公告</Label><Textarea rows={4} value={form.shopNotice} onChange={(event) => setForm((current) => ({ ...current, shopNotice: event.target.value }))} placeholder="例如：课程权限支付后自动开通，纸质资料默认 48 小时内发货。" /></div>
              <div className="space-y-2"><Label>客服链接</Label><Input value={form.customerServiceUrl} onChange={(event) => setForm((current) => ({ ...current, customerServiceUrl: event.target.value }))} placeholder="填写企微客服、客服表单或外部帮助中心链接" /></div>
              <div className="space-y-2"><Label>支付说明</Label><Textarea rows={4} value={form.paymentGuide} onChange={(event) => setForm((current) => ({ ...current, paymentGuide: event.target.value }))} placeholder="例如：微信内优先使用微信支付，外部浏览器可跳转支付宝。" /></div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-8">
            <h2 className="text-lg font-semibold text-slate-900">支付通道</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[
                { key: "enableWechatH5", label: "微信 H5", value: form.enableWechatH5 },
                { key: "enableWechatJsapi", label: "微信 JSAPI", value: form.enableWechatJsapi },
                { key: "enableAlipayWap", label: "支付宝 WAP", value: form.enableAlipayWap },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div><p className="font-medium text-slate-900">{item.label}</p><p className="mt-1 text-sm text-slate-500">控制前台是否展示该支付入口。</p></div>
                  <Switch checked={item.value} onCheckedChange={(checked) => setForm((current) => ({ ...current, [item.key]: checked }))} />
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">运行时诊断</p>
                  <p className="mt-1 text-sm text-slate-500">直接读取服务端当前运行的支付模式和环境变量完整度。</p>
                </div>
                <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                  {paymentModeLabel(form.paymentRuntime.mode || form.runtimePaymentMode)}
                </Badge>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-medium text-slate-900">回跳 / 回调地址</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <p>
                      <span className="text-slate-500">PAY_SITE_BASE_URL:</span> {form.paymentRuntime.siteBaseUrl || "未配置"}
                    </p>
                    <p>
                      <span className="text-slate-500">PAY_NOTIFY_BASE_URL:</span> {form.paymentRuntime.notifyBaseUrl || "未配置"}
                    </p>
                  </div>
                  {form.paymentRuntime.baseMissing.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {form.paymentRuntime.baseMissing.map((item) => (
                        <Badge key={item} variant="secondary" className="bg-rose-100 text-rose-700">
                          缺少 {item}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-emerald-700">基础回跳和回调地址已就绪。</p>
                  )}
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-medium text-amber-900">退款现状</p>
                  <p className="mt-3 text-sm leading-7 text-amber-800">{form.paymentRuntime.refundNotice}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                {paymentRuntimeCards.map((item) => (
                  <div key={item.key} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-slate-900">{item.label}</p>
                      <Badge variant="secondary" className={getRuntimeBadgeClassName(item.runtime.enabled, item.runtime.ready)}>
                        {getRuntimeBadgeLabel(item.runtime.enabled, item.runtime.ready)}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{item.runtime.note}</p>
                    {item.runtime.missing.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.runtime.missing.map((missing) => (
                          <Badge key={`${item.key}-${missing}`} variant="secondary" className="bg-rose-100 text-rose-700">
                            {missing}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-8">
            <h2 className="text-lg font-semibold text-slate-900">首页推荐</h2>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div>
                <Label>推荐分类</Label>
                <div className="mt-3 flex flex-wrap gap-2">{categories.map((category) => <button key={category.id} type="button" onClick={() => setForm((current) => ({ ...current, featuredCategoryIds: current.featuredCategoryIds.includes(category.id) ? current.featuredCategoryIds.filter((id) => id !== category.id) : [...current.featuredCategoryIds, category.id] }))} className={cn("rounded-full border px-4 py-2 text-sm", form.featuredCategoryIds.includes(category.id) ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600")}>{category.name}</button>)}</div>
              </div>
              <div>
                <Label>推荐商品</Label>
                <div className="mt-3 flex flex-wrap gap-2">{products.map((product) => <button key={product.id} type="button" onClick={() => setForm((current) => ({ ...current, featuredProductIds: current.featuredProductIds.includes(product.id) ? current.featuredProductIds.filter((id) => id !== product.id) : [...current.featuredProductIds, product.id] }))} className={cn("rounded-full border px-4 py-2 text-sm", form.featuredProductIds.includes(product.id) ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600")}>{product.name}</button>)}</div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-8">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-900">首页轮播图</h2><Button variant="outline" onClick={() => setForm((current) => ({ ...current, banners: [...current.banners, createEmptyBanner()] }))}><ImagePlus className="mr-2 size-4" />新增轮播图</Button></div>
            <div className="mt-6 space-y-4">
              {form.banners.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">暂无轮播图</div> : form.banners.map((banner, index) => <div key={banner.localId} className="rounded-3xl border border-slate-200 bg-slate-50 p-5"><div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]"><div className="space-y-3"><div className="flex items-center justify-between"><Label>上传图片</Label><Badge variant="secondary" className="bg-slate-100 text-slate-700">第 {index + 1} 张</Badge></div><label className="flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-3xl border border-dashed border-slate-300 bg-white text-slate-500">{banner.previewUrl || banner.imageUrl ? <img src={banner.previewUrl || banner.imageUrl} alt={banner.title || `轮播图 ${index + 1}`} className="h-full w-full object-cover" /> : <div className="text-center"><ImagePlus className="mx-auto mb-3 size-7 text-blue-600" /><p>{uploadingBannerId === banner.localId ? "上传中..." : "点击上传图片"}</p></div>}<input type="file" accept="image/*" className="hidden" onChange={(event) => { void handleBannerUpload(banner.localId, event.target.files?.[0]); event.currentTarget.value = ""; }} /></label></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>标题</Label><Input value={banner.title} onChange={(event) => updateBanner(banner.localId, (current) => ({ ...current, title: event.target.value }))} placeholder="例如：限时课程礼包" /></div><div className="space-y-2"><Label>排序</Label><Input type="number" min={0} value={banner.sortOrder} onChange={(event) => updateBanner(banner.localId, (current) => ({ ...current, sortOrder: event.target.value }))} /></div><div className="space-y-2"><Label>跳转类型</Label><Select value={banner.linkType} onValueChange={(value: ShopBannerLinkType) => updateBanner(banner.localId, (current) => ({ ...current, linkType: value, linkTarget: "" }))}><SelectTrigger><SelectValue placeholder="请选择跳转类型" /></SelectTrigger><SelectContent><SelectItem value="product">商品</SelectItem><SelectItem value="category">分类</SelectItem><SelectItem value="custom">自定义链接</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>启用状态</Label><div className="flex h-10 items-center justify-between rounded-2xl border border-slate-200 bg-white px-4"><span className="text-sm text-slate-600">启用该轮播图</span><Switch checked={banner.status} onCheckedChange={(checked) => updateBanner(banner.localId, (current) => ({ ...current, status: checked }))} /></div></div>{banner.linkType === "product" ? <div className="space-y-2 md:col-span-2"><Label>关联商品</Label><Select value={banner.linkTarget || "__empty"} onValueChange={(value) => updateBanner(banner.localId, (current) => ({ ...current, linkTarget: value === "__empty" ? "" : value }))}><SelectTrigger><SelectValue placeholder="请选择商品" /></SelectTrigger><SelectContent><SelectItem value="__empty">请选择商品</SelectItem>{products.map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}</SelectContent></Select></div> : null}{banner.linkType === "category" ? <div className="space-y-2 md:col-span-2"><Label>关联分类</Label><Select value={banner.linkTarget || "__empty"} onValueChange={(value) => updateBanner(banner.localId, (current) => ({ ...current, linkTarget: value === "__empty" ? "" : value }))}><SelectTrigger><SelectValue placeholder="请选择分类" /></SelectTrigger><SelectContent><SelectItem value="__empty">请选择分类</SelectItem>{categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></div> : null}{banner.linkType === "custom" ? <div className="space-y-2 md:col-span-2"><Label>自定义链接</Label><Input value={banner.linkTarget} onChange={(event) => updateBanner(banner.localId, (current) => ({ ...current, linkTarget: event.target.value }))} placeholder="支持完整链接，或 /user/shop 这样的站内路径" /></div> : null}<div className="md:col-span-2 flex justify-end"><Button variant="destructive" size="sm" onClick={() => setForm((current) => ({ ...current, banners: current.banners.filter((item) => item.localId !== banner.localId) }))}>删除轮播图</Button></div></div></div></div>)}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">当前摘要</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between"><span>支付模式</span><Badge variant="secondary" className="bg-slate-100 text-slate-700">{paymentModeLabel(form.runtimePaymentMode)}</Badge></div>
              <div className="flex items-center justify-between"><span>推荐分类</span><span>{selectedCategories.length} 个</span></div>
              <div className="flex items-center justify-between"><span>推荐商品</span><span>{selectedProducts.length} 个</span></div>
              <div className="flex items-center justify-between"><span>轮播图</span><span>{form.banners.length} 张</span></div>
            </div>
          </section>
          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">推荐商品预览</h2>
            <div className="mt-4 space-y-3">{selectedProducts.length === 0 ? <p className="text-sm text-slate-500">暂无推荐商品</p> : selectedProducts.map((product) => <div key={product.id} className="rounded-2xl bg-slate-50 px-4 py-3"><p className="font-medium text-slate-900">{product.name}</p><p className="mt-1 text-sm text-slate-500">{productStatusLabel[product.status] ?? product.status}</p></div>)}</div>
          </section>
        </div>
      </div>
    </div>
  );
}
