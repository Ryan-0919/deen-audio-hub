import { ArrowLeft, Minus, Plus, ShoppingCart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { cn } from "../../components/ui/utils";
import { type ShopProductDetail as ShopProductDetailPayload, type ShopSku, mockApi } from "../../lib/mockData";
import { formatShopMoney } from "../../lib/shopOrder";

const formatSkuPriceText = (sku: ShopSku) => formatShopMoney(sku.price);

const buildPurchaseHints = (product: ShopProductDetailPayload) => {
  const hints = ["支付成功后可在订单页查看处理进度。"];

  if (product.boundCourses.length > 0) {
    hints.unshift("支付成功后会自动开通对应课程内容。");
  }

  if (product.requiresShipping) {
    hints.push("如包含实物内容，会按订单填写的收货地址安排发货。");
    hints.push("发货后可在订单页查看物流状态。");
  } else {
    hints.push("无需等待发货，完成支付后可直接查看内容。");
  }

  return hints;
};

export function ShopProductDetail() {
  const navigate = useNavigate();
  const { productId } = useParams<{ productId: string }>();

  const [product, setProduct] = useState<ShopProductDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSkuId, setSelectedSkuId] = useState("");
  const [selectedImageUrl, setSelectedImageUrl] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!productId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const detail = await mockApi.getShopProductDetail(productId);
        if (!active) return;

        const defaultSkuId = detail.defaultSkuId || detail.skus.find((item) => item.status)?.id || detail.skus[0]?.id || "";
        const gallery = detail.images.length > 0 ? detail.images : [{ id: "cover", imageUrl: detail.coverUrl, sortOrder: 0 }];

        setProduct(detail);
        setSelectedSkuId(defaultSkuId);
        setSelectedImageUrl(gallery[0]?.imageUrl ?? detail.coverUrl);
      } catch (error) {
        if (!active) return;
        toast.error(error instanceof Error ? error.message : "加载商品详情失败");
        setProduct(null);
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
  }, [productId]);

  const selectedSku = useMemo(
    () => product?.skus.find((item) => item.id === selectedSkuId) ?? product?.skus[0] ?? null,
    [product, selectedSkuId],
  );

  const purchaseHints = useMemo(() => (product ? buildPurchaseHints(product) : []), [product]);

  useEffect(() => {
    if (!selectedSku) return;

    if (selectedSku.stock <= 0) {
      setQuantity(1);
      return;
    }

    setQuantity((current) => Math.min(Math.max(current, 1), selectedSku.stock));
  }, [selectedSku]);

  const ensurePurchasableSku = () => {
    if (!product || !selectedSku) {
      toast.error("请先选择商品规格");
      return null;
    }

    if (!selectedSku.status || selectedSku.stock <= 0) {
      toast.error("当前规格暂不可购买");
      return null;
    }

    return selectedSku;
  };

  const handleAddToCart = async () => {
    const sku = ensurePurchasableSku();
    if (!product || !sku) return;

    try {
      setSubmitting(true);
      await mockApi.addShopCartItem({
        productId: product.id,
        skuId: sku.id,
        quantity,
      });
      toast.success("已加入购物车");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加入购物车失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBuyNow = () => {
    const sku = ensurePurchasableSku();
    if (!sku) return;

    const search = new URLSearchParams({
      source: "buy_now",
      buyNowSkuId: sku.id,
      buyNowQuantity: `${quantity}`,
    });

    navigate(`/user/shop/checkout?${search.toString()}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f7fb] px-4 py-6">
        <div className="mx-auto max-w-sm py-12 text-center text-slate-500">商品详情加载中...</div>
      </div>
    );
  }

  if (!product || !selectedSku) {
    return (
      <div className="min-h-screen bg-[#f5f7fb] px-4 py-6">
        <div className="mx-auto max-w-sm py-12 text-center text-slate-500">商品不存在或已下架</div>
      </div>
    );
  }

  const gallery = product.images.length > 0 ? product.images : [{ id: "cover", imageUrl: product.coverUrl, sortOrder: 0 }];
  const heroImageUrl = selectedImageUrl || gallery[0]?.imageUrl || product.coverUrl;

  return (
    <div className="min-h-screen bg-[#f5f7fb] pb-28">
      <div className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/96 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-sm items-center px-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex size-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="min-w-0 flex-1 truncate px-3 text-center text-base font-semibold text-slate-900">商品详情</h1>
          <Button variant="ghost" size="icon" className="rounded-full text-slate-700 hover:bg-slate-100" onClick={() => navigate("/user/shop/cart")}>
            <ShoppingCart className="size-5" />
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-sm px-4 py-4">
        <section className="overflow-hidden rounded-[26px] bg-white">
          <div className="aspect-square bg-[#fff3ee]">
            <img src={heroImageUrl} alt={product.name} className="h-full w-full object-cover" />
          </div>

          {gallery.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto px-4 py-4">
              {gallery.map((image) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setSelectedImageUrl(image.imageUrl)}
                  className={cn(
                    "overflow-hidden rounded-[16px] border transition",
                    heroImageUrl === image.imageUrl ? "border-[#ff6a3d]" : "border-slate-200",
                  )}
                >
                  <img src={image.imageUrl} alt={product.name} className="h-16 w-16 object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="mt-4 rounded-[26px] bg-white px-4 py-5">
          <div className="flex flex-wrap items-center gap-2">
            {product.categoryName ? (
              <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-700">
                {product.categoryName}
              </Badge>
            ) : null}
            {product.boundCourses.length > 0 ? (
              <Badge variant="secondary" className="rounded-full bg-orange-50 text-[#ff6a3d]">
                含课程内容
              </Badge>
            ) : null}
            {product.requiresShipping ? (
              <Badge variant="secondary" className="rounded-full bg-amber-50 text-amber-700">
                支持发货
              </Badge>
            ) : null}
          </div>

          <h1 className="mt-4 text-[28px] font-semibold leading-9 tracking-[-0.04em] text-slate-900">{product.name}</h1>
          {product.subtitle ? <p className="mt-2 text-sm leading-7 text-slate-500">{product.subtitle}</p> : null}

          <div className="mt-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-[32px] font-semibold tracking-[-0.05em] text-[#ff6a3d]">{formatSkuPriceText(selectedSku)}</p>
              {selectedSku.originalPrice ? <p className="mt-1 text-sm text-slate-400 line-through">{formatShopMoney(selectedSku.originalPrice)}</p> : null}
            </div>
            <div className="text-right text-xs leading-6 text-slate-500">
              <p>已售 {product.salesCount}</p>
              <p>库存 {selectedSku.stock}</p>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-[26px] bg-white px-4 py-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">规格选择</h2>
            <p className="text-xs text-slate-500">请选择适合你的版本</p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2.5">
            {product.skus.map((sku) => {
              const disabled = !sku.status || sku.stock <= 0;

              return (
                <button
                  key={sku.id}
                  type="button"
                  onClick={() => {
                    if (!disabled) setSelectedSkuId(sku.id);
                  }}
                  disabled={disabled}
                  className={cn(
                    "min-w-[132px] rounded-[18px] border px-4 py-3 text-left text-sm transition-colors",
                    sku.id === selectedSku.id ? "border-[#ff6a3d] bg-orange-50 text-[#ff6a3d]" : "border-slate-200 bg-white text-slate-700",
                    disabled && "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400",
                  )}
                >
                  <p className="font-medium">{sku.name}</p>
                  <p className="mt-1 text-xs">{sku.stock > 0 ? `${formatSkuPriceText(sku)} · 库存 ${sku.stock}` : "暂时售罄"}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex items-center justify-between rounded-[20px] bg-slate-50 px-4 py-4">
            <div>
              <p className="text-sm font-medium text-slate-900">购买数量</p>
              <p className="mt-1 text-xs text-slate-500">当前规格库存 {selectedSku.stock}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantity((current) => Math.max(current - 1, 1))}
                className="flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-800"
              >
                <Minus className="size-4" />
              </button>
              <div className="min-w-10 text-center text-base font-semibold text-slate-900">{quantity}</div>
              <button
                type="button"
                onClick={() => setQuantity((current) => Math.min(current + 1, Math.max(selectedSku.stock, 1)))}
                className="flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-800"
              >
                <Plus className="size-4" />
              </button>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-[26px] bg-white px-4 py-5">
          <h2 className="text-base font-semibold text-slate-900">购买说明</h2>
          <div className="mt-3 space-y-2 text-sm leading-7 text-slate-500">
            {purchaseHints.map((text) => (
              <p key={text}>{text}</p>
            ))}
          </div>
        </section>

        {product.boundCourses.length > 0 ? (
          <section className="mt-4 rounded-[26px] bg-white px-4 py-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">包含内容</h2>
              <p className="text-xs text-slate-500">{product.boundCourses.length} 项</p>
            </div>

            <div className="mt-4 space-y-3">
              {product.boundCourses.map((course) => (
                <div key={course.id} className="rounded-[18px] bg-slate-50 px-4 py-4">
                  <p className="text-sm font-semibold text-slate-900">{course.name}</p>
                  {course.description ? <p className="mt-1 text-sm leading-6 text-slate-500">{course.description}</p> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {product.description || product.detailContent ? (
          <section className="mt-4 rounded-[26px] bg-white px-4 py-5">
            <h2 className="text-base font-semibold text-slate-900">图文详情</h2>
            <div className="mt-3 space-y-3 text-sm leading-7 text-slate-500">
              {product.description ? <p className="whitespace-pre-wrap">{product.description}</p> : null}
              {product.detailContent ? <p className="whitespace-pre-wrap">{product.detailContent}</p> : null}
            </div>
          </section>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-slate-200/80 bg-white/96 backdrop-blur">
        <div className="mx-auto flex max-w-sm items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[22px] font-semibold tracking-[-0.04em] text-[#ff6a3d]">{formatSkuPriceText(selectedSku)}</p>
            <p className="truncate text-xs text-slate-500">
              已选 {selectedSku.name} · {quantity} 件
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full border-[#ff6a3d] px-4 text-[#ff6a3d] hover:bg-orange-50 hover:text-[#ff6a3d]"
            disabled={submitting}
            onClick={() => void handleAddToCart()}
          >
            加购物车
          </Button>
          <Button
            type="button"
            className="h-11 rounded-full bg-[#ff6a3d] px-5 text-white hover:bg-[#f65a28]"
            disabled={submitting}
            onClick={handleBuyNow}
          >
            立即购买
          </Button>
        </div>
      </div>
    </div>
  );
}
