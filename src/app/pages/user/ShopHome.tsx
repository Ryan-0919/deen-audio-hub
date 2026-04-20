import { ArrowRight, MessageCircleMore, Search, ShoppingCart, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { AppLogo } from "../../components/branding/AppLogo";
import { Button } from "../../components/ui/button";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "../../components/ui/carousel";
import { Input } from "../../components/ui/input";
import { cn } from "../../components/ui/utils";
import {
  type ShopBanner,
  type ShopCategory,
  type ShopHomePayload,
  type ShopProduct,
  type ShopProductType,
  mockApi,
} from "../../lib/mockData";
import { formatShopMoney } from "../../lib/shopOrder";

const PAGE_SIZE = 40;

const sortOptions = [
  { value: "default", label: "综合排序" },
  { value: "sales_desc", label: "销量优先" },
  { value: "price_asc", label: "价格从低到高" },
  { value: "price_desc", label: "价格从高到低" },
  { value: "latest", label: "最新上架" },
] as const;

const formatPriceText = (product: ShopProduct) => {
  if (product.minPrice === product.maxPrice) return formatShopMoney(product.minPrice);
  return `${formatShopMoney(product.minPrice)} 起`;
};

const mergeProducts = (...groups: ShopProduct[][]) => {
  const seen = new Set<string>();
  const result: ShopProduct[] = [];

  groups.flat().forEach((product) => {
    if (!product?.id || seen.has(product.id)) return;
    seen.add(product.id);
    result.push(product);
  });

  return result;
};

const buildProductMeta = (product: ShopProduct) => {
  if (product.courseCount > 0 && product.requiresShipping) return `${product.courseCount} 项内容 · 支持发货`;
  if (product.courseCount > 0) return `${product.courseCount} 项内容`;
  if (product.requiresShipping) return "支持发货";
  return "精选商品";
};

function ProductCard({ product }: { product: ShopProduct }) {
  return (
    <Link to={`/user/shop/products/${product.id}`} className="group block">
      <div className="relative overflow-hidden rounded-[22px] bg-white">
        <img
          src={product.coverUrl}
          alt={product.name}
          className="aspect-[0.92] w-full object-cover transition duration-300 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between px-3 py-3">
          <span className="rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-medium text-slate-700">
            {product.categoryName || "精选"}
          </span>
          <span className="rounded-full bg-[#ff6a3d] px-2.5 py-1 text-[11px] font-medium text-white">热销</span>
        </div>
      </div>

      <div className="mt-3">
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-6 text-slate-900">{product.name}</h3>
        {product.subtitle ? <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{product.subtitle}</p> : null}

        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[20px] font-semibold tracking-[-0.03em] text-[#ff6a3d]">{formatPriceText(product)}</p>
            {product.originalPrice ? <p className="mt-1 text-xs text-slate-400 line-through">{formatShopMoney(product.originalPrice)}</p> : null}
          </div>

          <div className="text-right text-[11px] leading-5 text-slate-500">
            <p>已售 {product.salesCount}</p>
            <p>{buildProductMeta(product)}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}

function ProductSection({
  title,
  description,
  products,
  onMore,
}: {
  title: string;
  description?: string;
  products: ShopProduct[];
  onMore?: () => void;
}) {
  if (products.length === 0) return null;

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-semibold tracking-[-0.03em] text-slate-900">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>

        {onMore ? (
          <button type="button" onClick={onMore} className="inline-flex items-center gap-1 text-sm font-medium text-[#ff6a3d]">
            查看更多
            <ArrowRight className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}

export function ShopHome() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [homeData, setHomeData] = useState<ShopHomePayload | null>(null);
  const [productList, setProductList] = useState<ShopProduct[]>([]);
  const [productPage, setProductPage] = useState(1);
  const [productTotal, setProductTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchInput, setSearchInput] = useState(searchParams.get("keyword") ?? "");
  const [bannerApi, setBannerApi] = useState<CarouselApi | null>(null);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);

  const keyword = (searchParams.get("keyword") ?? "").trim();
  const categoryId = (searchParams.get("categoryId") ?? "").trim();
  const type = (searchParams.get("type") ?? "").trim();
  const sortBy = (searchParams.get("sortBy") ?? "default").trim();
  const browseMode = searchParams.get("browse") === "1" || Boolean(keyword || categoryId || type);

  useEffect(() => {
    setSearchInput(keyword);
  }, [keyword]);

  useEffect(() => {
    if (!bannerApi) return;

    const syncActiveBanner = () => {
      setActiveBannerIndex(bannerApi.selectedScrollSnap());
    };

    syncActiveBanner();
    bannerApi.on("select", syncActiveBanner);
    bannerApi.on("reInit", syncActiveBanner);

    return () => {
      bannerApi.off("select", syncActiveBanner);
      bannerApi.off("reInit", syncActiveBanner);
    };
  }, [bannerApi]);

  useEffect(() => {
    if (!bannerApi || browseMode || !homeData?.banners?.length || homeData.banners.length <= 1) return;

    const timer = window.setInterval(() => {
      const snapCount = bannerApi.scrollSnapList().length;
      const nextIndex = (bannerApi.selectedScrollSnap() + 1) % snapCount;
      bannerApi.scrollTo(nextIndex);
    }, 4000);

    return () => {
      window.clearInterval(timer);
    };
  }, [bannerApi, browseMode, homeData?.banners]);

  const loadMoreProducts = async () => {
    if (!browseMode || loading || loadingMore || productList.length >= productTotal) return;

    try {
      setLoadingMore(true);
      const nextPage = productPage + 1;
      const result = await mockApi.getShopProducts({
        categoryId: categoryId || undefined,
        type: type ? (type as ShopProductType) : undefined,
        keyword: keyword || undefined,
        sortBy: (sortBy || "default") as (typeof sortOptions)[number]["value"],
        page: nextPage,
        pageSize: PAGE_SIZE,
      });

      setProductList((current) => mergeProducts(current, result.list));
      setProductPage(result.pagination.page);
      setProductTotal(result.pagination.total);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载更多商品失败");
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        const categoryPromise = mockApi.getShopCategories();

        if (browseMode) {
          const [nextCategories, result] = await Promise.all([
            categoryPromise,
            mockApi.getShopProducts({
              categoryId: categoryId || undefined,
              type: type ? (type as ShopProductType) : undefined,
              keyword: keyword || undefined,
              sortBy: (sortBy || "default") as (typeof sortOptions)[number]["value"],
              page: 1,
              pageSize: PAGE_SIZE,
            }),
          ]);

          if (!active) return;
          setCategories(nextCategories);
          setProductList(result.list);
          setProductPage(result.pagination.page);
          setProductTotal(result.pagination.total);
          setHomeData(null);
          return;
        }

        const [nextCategories, nextHome] = await Promise.all([categoryPromise, mockApi.getShopHome()]);
        if (!active) return;
        setCategories(nextCategories);
        setHomeData(nextHome);
        setProductList([]);
        setProductPage(1);
        setProductTotal(0);
      } catch (error) {
        if (!active) return;
        toast.error(error instanceof Error ? error.message : "加载商城内容失败");
      } finally {
        if (active) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [browseMode, categoryId, keyword, sortBy, type]);

  const categoryOptions = useMemo(() => {
    if (homeData?.featuredCategories?.length) return homeData.featuredCategories;
    return categories;
  }, [categories, homeData]);

  const moreProducts = useMemo(
    () => mergeProducts(homeData?.courseProducts ?? [], homeData?.hybridProducts ?? [], homeData?.physicalProducts ?? []),
    [homeData],
  );

  const updateQuery = (updates: Record<string, string>) => {
    const nextParams = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (value) nextParams.set(key, value);
      else nextParams.delete(key);
    });

    const hasBrowseFilter = ["keyword", "categoryId", "type", "sortBy"].some((key) => {
      if (key === "sortBy") {
        return (nextParams.get(key) ?? "") && (nextParams.get(key) ?? "") !== "default";
      }
      return Boolean(nextParams.get(key));
    });

    if (hasBrowseFilter || nextParams.get("browse") === "1") nextParams.set("browse", "1");
    if (!hasBrowseFilter && updates.browse !== "1") nextParams.delete("browse");
    if ((nextParams.get("sortBy") ?? "") === "default") nextParams.delete("sortBy");

    setSearchParams(nextParams);
  };

  const clearBrowseMode = () => {
    setSearchParams(new URLSearchParams());
  };

  const openCustomerService = () => {
    if (!homeData?.customerServiceUrl) return;
    window.location.href = homeData.customerServiceUrl;
  };

  const openBanner = (banner: ShopBanner) => {
    if (banner.linkType === "product") {
      navigate(`/user/shop/products/${banner.linkTarget}`);
      return;
    }

    if (banner.linkType === "category") {
      updateQuery({
        browse: "1",
        categoryId: banner.linkTarget,
        keyword: "",
      });
      return;
    }

    if (/^https?:\/\//i.test(banner.linkTarget)) {
      window.location.href = banner.linkTarget;
      return;
    }

    navigate(banner.linkTarget.startsWith("/") ? banner.linkTarget : `/${banner.linkTarget}`);
  };

  const currentCategoryName = categories.find((item) => item.id === categoryId)?.name ?? "";
  const hasMoreProducts = browseMode && productList.length < productTotal;

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <div className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/96 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-sm items-center gap-3 px-4">
          <div className="flex w-[72px] justify-start">
            <AppLogo compact />
          </div>

          <div className="min-w-0 flex-1">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                updateQuery({
                  browse: "1",
                  keyword: searchInput.trim(),
                });
              }}
              className="relative"
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="搜索课程、图书或更多商品"
                className="h-10 rounded-full border-slate-200 bg-slate-50 pl-9 pr-4"
              />
            </form>
          </div>

          <div className="flex w-[72px] justify-end">
            <Button variant="ghost" size="icon" className="rounded-full text-slate-700 hover:bg-slate-100" onClick={() => navigate("/user/shop/cart")}>
              <ShoppingCart className="size-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-sm px-4 pb-8 pt-4">
        {!browseMode && homeData ? (
          <section className="overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#ff8757_0%,#ff6a3d_48%,#ff5a2b_100%)] px-4 pb-4 pt-5 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-white/70">Shop</p>
                <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.04em]">今天先看这些</h1>
                <p className="mt-2 text-sm leading-6 text-white/82">课程、资料和配套商品都在这里，价格和推荐位优先给你看清楚。</p>
              </div>

              {homeData.customerServiceUrl ? (
                <button
                  type="button"
                  onClick={openCustomerService}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white/18 px-3 py-2 text-sm text-white"
                >
                  <MessageCircleMore className="size-4" />
                  客服
                </button>
              ) : null}
            </div>

            {homeData.banners.length > 0 ? (
              <div className="mt-4">
                <Carousel
                  setApi={setBannerApi}
                  opts={{
                    align: "start",
                    loop: homeData.banners.length > 1,
                  }}
                >
                  <CarouselContent className="ml-0">
                    {homeData.banners.map((banner) => (
                      <CarouselItem key={banner.id} className="pl-0">
                        <button
                          type="button"
                          onClick={() => openBanner(banner)}
                          className="relative block w-full overflow-hidden rounded-[22px] bg-white/12 text-left"
                        >
                          <img src={banner.imageUrl} alt={banner.title || "banner"} className="aspect-[16/9] w-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                          <div className="absolute inset-x-0 bottom-0 px-4 py-4">
                            <p className="text-base font-semibold text-white">{banner.title || "查看详情"}</p>
                          </div>
                        </button>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                </Carousel>

                {homeData.banners.length > 1 ? (
                  <div className="mt-3 flex justify-center gap-2">
                    {homeData.banners.map((banner, index) => (
                      <button
                        key={banner.id}
                        type="button"
                        onClick={() => bannerApi?.scrollTo(index)}
                        aria-label={`切换到第 ${index + 1} 张轮播图`}
                        className={cn(
                          "h-1.5 rounded-full transition-all",
                          activeBannerIndex === index ? "w-6 bg-white" : "w-2 bg-white/45",
                        )}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

          </section>
        ) : null}

        <div className="mt-5 overflow-x-auto">
          <div className="flex min-w-max gap-2">
            <button
              type="button"
              onClick={clearBrowseMode}
              className={cn(
                "rounded-full px-4 py-2.5 text-sm font-medium transition-colors",
                !categoryId && !type && !keyword && !browseMode ? "bg-[#ff6a3d] text-white" : "bg-white text-slate-600",
              )}
            >
              推荐
            </button>
            {categoryOptions.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() =>
                  updateQuery({
                    browse: "1",
                    categoryId: category.id,
                    keyword: "",
                    type: "",
                  })
                }
                className={cn(
                  "rounded-full px-4 py-2.5 text-sm font-medium transition-colors",
                  categoryId === category.id ? "bg-[#ff6a3d] text-white" : "bg-white text-slate-600",
                )}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {browseMode ? (
          <section className="mt-5 rounded-[24px] bg-white px-4 py-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-[20px] font-semibold tracking-[-0.03em] text-slate-900">商品列表</h2>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500">
                  {currentCategoryName ? <span>分类：{currentCategoryName}</span> : null}
                  {keyword ? <span>关键词：{keyword}</span> : null}
                  {!keyword && !currentCategoryName && !type ? <span>当前展示全部商品</span> : null}
                  {productTotal > 0 ? <span>共 {productTotal} 件商品</span> : null}
                </div>
              </div>

              <select
                value={sortBy}
                onChange={(event) => updateQuery({ browse: "1", sortBy: event.target.value })}
                className="h-10 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </section>
        ) : null}

        {loading ? (
          <div className="mt-10 py-12 text-center text-sm text-slate-500">商城内容加载中...</div>
        ) : browseMode ? (
          productList.length === 0 ? (
            <div className="mt-12 rounded-[24px] bg-white px-8 py-14 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <Sparkles className="size-6" />
              </div>
              <h2 className="mt-4 text-lg font-medium text-slate-900">没有找到符合条件的商品</h2>
              <p className="mt-2 text-sm leading-7 text-slate-500">换一个关键词，或者返回推荐页重新挑选。</p>
              <Button type="button" variant="outline" className="mt-5 rounded-full" onClick={clearBrowseMode}>
                返回推荐页
              </Button>
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              <div className="grid grid-cols-2 gap-x-3 gap-y-6">
                {productList.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {hasMoreProducts ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-full border-slate-200 bg-white"
                  disabled={loadingMore}
                  onClick={() => void loadMoreProducts()}
                >
                  {loadingMore ? "加载中..." : `加载更多商品 (${productList.length}/${productTotal})`}
                </Button>
              ) : null}

              {productTotal > 0 ? <p className="text-center text-xs text-slate-400">已显示 {productList.length} / {productTotal} 件商品</p> : null}
            </div>
          )
        ) : (
          <>
            <ProductSection
              title="热门推荐"
              description="先看现在买得最多的。"
              products={homeData?.featuredProducts ?? []}
              onMore={() => updateQuery({ browse: "1", sortBy: "sales_desc" })}
            />
            <ProductSection
              title="更多商品"
              description="课程、资料和配套商品都放在这里。"
              products={moreProducts}
              onMore={() => updateQuery({ browse: "1", type: "", categoryId: "", keyword: "" })}
            />
          </>
        )}
      </div>
    </div>
  );
}
