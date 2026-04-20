import { useDeferredValue, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Eye, EyeOff, PackagePlus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import {
  AdminShopProduct,
  AdminShopProductListSummary,
  ShopCategory,
  ShopProductStatus,
  ShopProductType,
  mockApi,
} from "../../lib/mockData";

type ProductTypeFilter = "all" | ShopProductType;
type ProductStatusFilter = "all" | ShopProductStatus;

const typeMeta: Record<ShopProductType, { label: string; className: string }> = {
  virtual: { label: "虚拟", className: "bg-indigo-100 text-indigo-700" },
  physical: { label: "实物", className: "bg-amber-100 text-amber-700" },
  hybrid: { label: "组合", className: "bg-emerald-100 text-emerald-700" },
};

const statusMeta: Record<ShopProductStatus, { label: string; className: string }> = {
  draft: { label: "草稿", className: "bg-slate-100 text-slate-700" },
  on_sale: { label: "上架中", className: "bg-emerald-100 text-emerald-700" },
  off_sale: { label: "已下架", className: "bg-amber-100 text-amber-700" },
};

export function ShopProductList() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [products, setProducts] = useState<AdminShopProduct[]>([]);
  const [summary, setSummary] = useState<AdminShopProductListSummary>({
    total: 0,
    onSale: 0,
    draft: 0,
    offSale: 0,
  });
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [typeFilter, setTypeFilter] = useState<ProductTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<ProductStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const deferredKeyword = useDeferredValue(keyword.trim());

  const loadCategories = async () => {
    try {
      const list = await mockApi.getAdminShopCategories();
      setCategories(list);
    } catch (_error) {
      toast.error("加载商品分类失败");
    }
  };

  const loadProducts = async (options?: { keepLoading?: boolean }) => {
    if (options?.keepLoading !== false) {
      setLoading(true);
    }

    try {
      const result = await mockApi.getAdminShopProducts({
        keyword: deferredKeyword,
        categoryId,
        type: typeFilter,
        status: statusFilter,
        page,
        pageSize,
      });
      setProducts(result.list);
      setTotal(result.pagination.total);
      setSummary(
        result.summary ?? {
          total: result.pagination.total,
          onSale: result.list.filter((item) => item.status === "on_sale").length,
          draft: result.list.filter((item) => item.status === "draft").length,
          offSale: result.list.filter((item) => item.status === "off_sale").length,
        },
      );
    } catch (_error) {
      toast.error("加载商品列表失败");
    } finally {
      if (options?.keepLoading !== false) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadCategories();
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [deferredKeyword, categoryId, typeFilter, statusFilter, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [deferredKeyword, categoryId, typeFilter, statusFilter]);

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  const handlePublishToggle = async (product: AdminShopProduct) => {
    const nextStatus: ShopProductStatus = product.status === "on_sale" ? "off_sale" : "on_sale";

    try {
      await mockApi.publishAdminShopProduct(product.id, nextStatus);
      toast.success(nextStatus === "on_sale" ? "商品已上架" : "商品已下架");
      await loadProducts({ keepLoading: false });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新商品状态失败");
    }
  };

  const handleDelete = async (product: AdminShopProduct) => {
    if (!window.confirm(`确认删除商品“${product.name}”吗？`)) {
      return;
    }

    try {
      await mockApi.deleteAdminShopProduct(product.id);
      toast.success("商品已删除");
      await loadProducts({ keepLoading: false });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除商品失败");
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-500">商品列表加载中...</div>;
  }

  return (
    <div className="p-8">
      <div className="rounded-3xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-8 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">商城商品</h1>
              <p className="mt-2 text-sm text-slate-500">管理商品分类、类型、SKU 与课程绑定关系，商品上架前会做完整性校验。</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate("/admin/shop/categories")}>
                管理分类
              </Button>
              <Button onClick={() => navigate("/admin/shop/products/new")}>
                <PackagePlus className="mr-2 size-4" />
                新建商品
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-6 px-8 py-6">
          <div className="grid gap-4 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">当前结果</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.total}</p>
              <p className="mt-2 text-sm text-slate-500">当前筛选结果中的商品数量</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-sm text-emerald-700">上架中</p>
              <p className="mt-2 text-3xl font-semibold text-emerald-800">{summary.onSale}</p>
              <p className="mt-2 text-sm text-emerald-700">前台可直接购买</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-600">草稿</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.draft}</p>
              <p className="mt-2 text-sm text-slate-500">尚未完成上架准备</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="text-sm text-amber-700">已下架</p>
              <p className="mt-2 text-3xl font-semibold text-amber-900">{summary.offSale}</p>
              <p className="mt-2 text-sm text-amber-700">后台保留，前台不可见</p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_220px_180px_180px_auto]">
            <Input placeholder="按商品名称或副标题搜索" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="商品分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分类</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(value: ProductTypeFilter) => setTypeFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="商品类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="virtual">虚拟商品</SelectItem>
                <SelectItem value="physical">实物商品</SelectItem>
                <SelectItem value="hybrid">组合商品</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value: ProductStatusFilter) => setStatusFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="商品状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="on_sale">上架中</SelectItem>
                <SelectItem value="off_sale">已下架</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => {
                setKeyword("");
                setCategoryId("all");
                setTypeFilter("all");
                setStatusFilter("all");
              }}
            >
              重置
            </Button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>商品</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>价格区间</TableHead>
                  <TableHead>SKU / 课程</TableHead>
                  <TableHead>销量</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-3">
                        <img src={product.coverPreviewUrl || product.coverUrl} alt={product.name} className="h-16 w-16 rounded-2xl object-cover" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{product.name}</p>
                          <p className="mt-1 truncate text-sm text-slate-500">{product.subtitle || "无副标题"}</p>
                          <p className="mt-1 text-xs text-slate-400">排序 #{product.sortOrder}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{product.categoryName || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={typeMeta[product.type].className}>
                        {typeMeta[product.type].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusMeta[product.status].className}>
                        {statusMeta[product.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <p className="font-medium text-slate-900">
                          ￥{product.minPrice}
                          {product.minPrice !== product.maxPrice ? ` - ￥${product.maxPrice}` : ""}
                        </p>
                        <p className="text-slate-500">{product.originalPrice ? `划线价 ￥${product.originalPrice}` : "无划线价"}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm text-slate-600">
                        <p>{product.skuCount} 个 SKU</p>
                        <p>{product.courseCount} 门课程</p>
                      </div>
                    </TableCell>
                    <TableCell>{product.salesCount}</TableCell>
                    <TableCell>{product.updatedAt}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/admin/shop/products/${product.id}/edit`)}>
                          <Pencil className="mr-2 size-4" />
                          编辑
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => void handlePublishToggle(product)}>
                          {product.status === "on_sale" ? (
                            <>
                              <EyeOff className="mr-2 size-4" />
                              下架
                            </>
                          ) : (
                            <>
                              <Eye className="mr-2 size-4" />
                              上架
                            </>
                          )}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => void handleDelete(product)}>
                          <Trash2 className="mr-2 size-4" />
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {products.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-14 text-center text-slate-500">
                      暂无商品
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <p>
              共 {total} 条，当前第 {page} / {totalPages} 页
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))}>
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
              >
                下一页
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
