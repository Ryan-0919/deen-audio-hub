import { motion } from "motion/react";
import { ArrowRight, MessageCircleMore, Search, ShoppingCart, Sparkles, ChevronRight, ShoppingBag } from "lucide-react";
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
  { value: "price_asc", label: "价格低至高" },
  { value: "price_desc", label: "价格高至低" },
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
  if (product.courseCount > 0 && product.requiresShipping) return `${product.courseCount} 项内容 · 实物`;
  if (product.courseCount > 0) return `${product.courseCount} 项内容`;
  if (product.requiresShipping) return "支持发货";
  return "精选商品";
};

function ProductCard({ product }: { product: ShopProduct }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="group">
      <Link to={`/user/shop/products/${product.id}`} className="block">
        <div className="relative aspect-[0.92] overflow-hidden rounded-[32px] bg-white ring-1 ring-black/[0.03] shadow-sm transition-all group-hover:shadow-xl group-hover:shadow-black/5 group-hover:ring-black/5">
          <img
            src={product.coverUrl}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-x-0 top-0 flex items-start justify-between px-4 py-4">
            <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-900 backdrop-blur-sm">
              {product.categoryName || "精选"}
            </span>
            {product.salesCount > 100 && (
              <span className="rounded-full bg-slate-900/80 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                HOT
              </span>
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        </div>

        <div className="mt-4 px-2">
          <h3 className="line-clamp-1 text-[16px] font-bold tracking-tight text-slate-900">{product.name}</h3>
          <p className="mt-1 line-clamp-1 text-[13px] font-medium text-slate-500">{buildProductMeta(product)}</p>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold tracking-tight text-slate-900">{formatPriceText(product)}</span>
              {product.originalPrice ? (
                <span className="text-[12px] text-slate-400 line-through">{formatShopMoney(product.originalPrice)}</span>
              ) : null}
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">已售 {product.salesCount}</span>
          </div>
        </div>
      </Link>
    </motion.div>
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
    const syncActiveBanner = () => setActiveBannerIndex(bannerApi.selectedScrollSnap());
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
    return () => window.clearInterval(timer);
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
      toast.error(error instanceof Error ? error.message : "加载更多失败");
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
        toast.error(error instanceof Error ? error.message : "加载失败");
      } finally {
        if (active) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    };
    void load();
    return () => { active = false; };
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
      if (key === "sortBy") return (nextParams.get(key) ?? "") && (nextParams.get(key) ?? "") !== "default";
      return Boolean(nextParams.get(key));
    });
    if (hasBrowseFilter || nextParams.get("browse") === "1") nextParams.set("browse", "1");
    if (!hasBrowseFilter && updates.browse !== "1") nextParams.delete("browse");
    if ((nextParams.get("sortBy") ?? "") === "default") nextParams.delete("sortBy");
    setSearchParams(nextParams);
  };

  const clearBrowseMode = () => setSearchParams(new URLSearchParams());
  const openCustomerService = () => {
    if (!homeData?.customerServiceUrl) return;
    window.location.href = homeData.customerServiceUrl;
  };

  const openBanner = (banner: ShopBanner) => {
    if (banner.linkType === "product") { navigate(`/user/shop/products/${banner.linkTarget}`); return; }
    if (banner.linkType === "category") { updateQuery({ browse: "1", categoryId: banner.linkTarget, keyword: "" }); return; }
    if (/^https?:\/\//i.test(banner.linkTarget)) { window.location.href = banner.linkTarget; return; }
    navigate(banner.linkTarget.startsWith("/") ? banner.linkTarget : `/${banner.linkTarget}`);
  };

  const currentCategoryName = categories.find((item) => item.id === categoryId)?.name ?? "";
  const hasMoreProducts = browseMode && productList.length < productTotal;

  return (
    <div className="min-h-screen bg-[#f4f5f7] pb-20 font-sans selection:bg-slate-900 selection:text-white">
      {/* Shop Header */}
      <div className="sticky top-0 z-30 border-b border-slate-200/50 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-4 px-5 md:h-[72px] md:px-8">
          <div className="flex w-[72px] justify-start md:w-[120px]">
            <AppLogo compact />
          </div>

          <div className="min-w-0 flex-1 flex justify-center">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                updateQuery({ browse: "1", keyword: searchInput.trim() });
              }}
              className="relative w-full max-w-md"
            >
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="搜索课程、资料或商品"
                className="h-10 rounded-full border-slate-200/60 bg-slate-100/50 pl-10 pr-4 text-[14px] transition-all focus:bg-white focus:ring-slate-900/5 md:h-11"
              />
            </form>
          </div>

          <div className="flex w-[72px] justify-end gap-1 md:w-auto md:gap-3">
             <Button
               variant="ghost"
               size="icon"
               className="rounded-full text-slate-700 hover:bg-slate-100"
               onClick={() => navigate("/user/shop/orders")}
               title="我的订单"
             >
               <ShoppingBag className="size-5" />
             </Button>
            <Button
              variant="ghost"
              size="icon"
              className="relative rounded-full text-slate-700 hover:bg-slate-100"
              onClick={() => navigate("/user/shop/cart")}
              title="购物车"
            >
              <ShoppingCart className="size-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1200px] px-5 pt-8 md:px-8">
        {!browseMode && homeData ? (
          <motion.section 
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
            className="relative z-10 mx-auto w-full"
          >
            {homeData.banners.length > 0 && (
              <div className="relative">
                <Carousel
                  setApi={setBannerApi}
                  opts={{ align: "start", loop: homeData.banners.length > 1 }}
                  className="w-full"
                >
                  <CarouselContent className="ml-0">
                    {homeData.banners.map((banner) => (
                      <CarouselItem key={banner.id} className="pl-0">
                        <button
                          type="button"
                          onClick={() => openBanner(banner)}
                          className="relative block w-full overflow-hidden rounded-[24px] md:rounded-[40px] bg-white ring-1 ring-black/[0.03] shadow-sm transition-transform active:scale-[0.98] md:hover:scale-[1.01]"
                        >
                          <img src={banner.imageUrl} alt={banner.title || "banner"} className="aspect-[2/1] md:aspect-[21/9] w-full object-cover" />
                        </button>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                </Carousel>

                {homeData.banners.length > 1 && (
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
                    {homeData.banners.map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => bannerApi?.scrollTo(index)}
                        className={cn(
                          "h-1.5 rounded-full transition-all",
                          activeBannerIndex === index ? "w-8 bg-slate-900" : "w-1.5 bg-slate-300",
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.section>
        ) : null}

        {/* Categories Bar */}
        <div className="mt-10 flex items-center justify-between px-2">
           <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={clearBrowseMode}
                className={cn(
                  "rounded-full px-5 py-2 text-[13px] font-bold uppercase tracking-wider transition-all",
                  !categoryId && !type && !keyword && !browseMode ? "bg-slate-900 text-white shadow-lg shadow-black/10" : "bg-white text-slate-500 ring-1 ring-black/[0.03] hover:ring-black/10",
                )}
              >
                RECOMMENDED
              </button>
              {categoryOptions.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => updateQuery({ browse: "1", categoryId: category.id, keyword: "", type: "" })}
                  className={cn(
                    "rounded-full px-5 py-2 text-[13px] font-bold uppercase tracking-wider transition-all",
                    categoryId === category.id ? "bg-slate-900 text-white shadow-lg shadow-black/10" : "bg-white text-slate-500 ring-1 ring-black/[0.03] hover:ring-black/10",
                  )}
                >
                  {category.name}
                </button>
              ))}
           </div>
           
           {browseMode && (
              <select
                value={sortBy}
                onChange={(event) => updateQuery({ browse: "1", sortBy: event.target.value })}
                className="hidden h-10 rounded-full border-none bg-white px-4 text-[13px] font-bold text-slate-900 shadow-sm ring-1 ring-black/[0.03] outline-none md:block"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label.toUpperCase()}</option>
                ))}
              </select>
           )}
        </div>

        {loading ? (
          <div className="mt-20 text-center text-[13px] font-bold uppercase tracking-[0.2em] text-slate-400">Loading Storefront...</div>
        ) : browseMode ? (
          <div className="mt-10">
            {productList.length === 0 ? (
              <div className="rounded-[40px] bg-white p-20 text-center ring-1 ring-black/[0.03]">
                <Sparkles className="mx-auto size-10 text-slate-300 mb-6" />
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">未找到相关商品</h2>
                <p className="mt-3 text-sm font-medium text-slate-500">换个关键词试试，或者浏览我们的精选推荐。</p>
                <Button type="button" onClick={clearBrowseMode} className="mt-8 rounded-full bg-slate-900 px-8">
                  返回商城首页
                </Button>
              </div>
            ) : (
              <div className="space-y-12">
                <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
                  {productList.map((product) => <ProductCard key={product.id} product={product} />)}
                </div>
                {hasMoreProducts && (
                  <div className="flex justify-center pt-8">
                    <Button
                      variant="outline"
                      className="rounded-full border-slate-200 bg-white px-10 h-12 text-[14px] font-bold uppercase tracking-wider"
                      disabled={loadingMore}
                      onClick={() => void loadMoreProducts()}
                    >
                      {loadingMore ? "LOADING..." : "SHOW MORE"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-16">
            {/* Featured Section */}
            {(homeData?.featuredProducts?.length ?? 0) > 0 && (
              <section>
                <div className="mb-8 flex items-end justify-between px-2">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">热门推荐</h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">此时此刻大家都在关注的资料与权益。</p>
                  </div>
                  <button onClick={() => updateQuery({ browse: "1", sortBy: "sales_desc" })} className="text-[13px] font-bold tracking-widest text-slate-400 hover:text-slate-900 uppercase flex items-center">
                    SEE ALL <ChevronRight className="ml-1 size-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
                  {homeData?.featuredProducts.map((product) => <ProductCard key={product.id} product={product} />)}
                </div>
              </section>
            )}

            {/* More Products Section */}
            {moreProducts.length > 0 && (
              <section className="pb-20">
                <div className="mb-8 flex items-end justify-between px-2">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">探索更多</h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">完整的课程、配套资料与周边商品。</p>
                  </div>
                  <button onClick={() => updateQuery({ browse: "1" })} className="text-[13px] font-bold tracking-widest text-slate-400 hover:text-slate-900 uppercase flex items-center">
                    EXPLORE <ChevronRight className="ml-1 size-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
                  {moreProducts.map((product) => <ProductCard key={product.id} product={product} />)}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
