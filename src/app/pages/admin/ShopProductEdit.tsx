import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ImagePlus, Plus, Trash2, Upload } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import {
  AdminShopProductDetail,
  AdminShopProductImageInput,
  AdminShopProductPayload,
  AdminShopSkuInput,
  Course,
  ShopCategory,
  ShopProductStatus,
  ShopProductType,
  mockApi,
} from "../../lib/mockData";

type FormImage = AdminShopProductImageInput & { localId: string; previewUrl: string };
type FormSku = AdminShopSkuInput & { localId: string };

type ProductFormState = {
  categoryId: string;
  name: string;
  subtitle: string;
  coverUrl: string;
  coverPreviewUrl: string;
  coverObjectKey: string;
  type: ShopProductType;
  status: ShopProductStatus;
  description: string;
  detailContent: string;
  sortOrder: string;
  courseIds: string[];
  images: FormImage[];
  skus: FormSku[];
};

const createLocalId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `local-${Math.random().toString(36).slice(2, 10)}`;

const createFormSku = (sku?: Partial<AdminShopSkuInput>): FormSku => ({
  localId: createLocalId(),
  id: sku?.id,
  name: sku?.name ?? "默认规格",
  price: sku?.price ?? "",
  originalPrice: sku?.originalPrice ?? "",
  stock: sku?.stock ?? 0,
  weight: sku?.weight ?? 0,
  isDefault: sku?.isDefault ?? true,
  status: sku?.status ?? true,
  sortOrder: sku?.sortOrder ?? 0,
});

const createFormImage = (image: {
  id?: string;
  imageUrl: string;
  imageObjectKey?: string;
  imagePreviewUrl?: string;
  sortOrder?: number;
}): FormImage => ({
  localId: createLocalId(),
  id: image.id,
  imageUrl: image.imageUrl,
  previewUrl: image.imagePreviewUrl ?? image.imageUrl,
  imageObjectKey: image.imageObjectKey ?? "",
  sortOrder: image.sortOrder ?? 0,
});

const createEmptyForm = (): ProductFormState => ({
  categoryId: "",
  name: "",
  subtitle: "",
  coverUrl: "",
  coverPreviewUrl: "",
  coverObjectKey: "",
  type: "virtual",
  status: "draft",
  description: "",
  detailContent: "",
  sortOrder: "0",
  courseIds: [],
  images: [],
  skus: [createFormSku()],
});

const mapDetailToForm = (detail: AdminShopProductDetail): ProductFormState => ({
  categoryId: detail.categoryId,
  name: detail.name,
  subtitle: detail.subtitle,
  coverUrl: detail.coverUrl,
  coverPreviewUrl: detail.coverPreviewUrl ?? detail.coverUrl,
  coverObjectKey: detail.coverObjectKey,
  type: detail.type,
  status: detail.status,
  description: detail.description,
  detailContent: detail.detailContent,
  sortOrder: `${detail.sortOrder}`,
  courseIds: detail.courseIds,
  images: detail.images.map((image, index) => createFormImage({ ...image, sortOrder: image.sortOrder ?? index })),
  skus: detail.skus.length > 0 ? detail.skus.map((sku, index) => createFormSku({ ...sku, sortOrder: index })) : [createFormSku()],
});

const buildPayload = (form: ProductFormState): AdminShopProductPayload => ({
  categoryId: form.categoryId,
  name: form.name.trim(),
  subtitle: form.subtitle.trim(),
  coverUrl: form.coverUrl,
  coverObjectKey: form.coverObjectKey,
  type: form.type,
  status: form.status,
  description: form.description.trim(),
  detailContent: form.detailContent.trim(),
  sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
  courseIds: form.type === "physical" ? [] : form.courseIds,
  images: form.images.map((image, index) => ({
    id: image.id,
    imageUrl: image.imageUrl,
    imageObjectKey: image.imageObjectKey,
    sortOrder: index,
  })),
  skus: form.skus.map((sku, index) => ({
    id: sku.id,
    name: sku.name.trim(),
    price: sku.price.trim(),
    originalPrice: sku.originalPrice.trim(),
    stock: sku.stock,
    weight: sku.weight,
    isDefault: sku.isDefault,
    status: sku.status,
    sortOrder: index,
  })),
});

export function ShopProductEdit() {
  const navigate = useNavigate();
  const { productId } = useParams<{ productId: string }>();
  const isEdit = Boolean(productId);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [form, setForm] = useState<ProductFormState>(createEmptyForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [categoryList, courseList, detail] = await Promise.all([
          mockApi.getAdminShopCategories(),
          mockApi.getAllCourses(),
          isEdit && productId ? mockApi.getAdminShopProductDetail(productId) : Promise.resolve(null),
        ]);
        setCategories(categoryList);
        setCourses(courseList);
        setForm(detail ? mapDetailToForm(detail) : createEmptyForm());
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "加载商品信息失败");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [isEdit, productId]);

  const selectedCourses = useMemo(() => courses.filter((course) => form.courseIds.includes(course.id)), [courses, form.courseIds]);

  const updateSku = (localId: string, updater: (sku: FormSku) => FormSku) => {
    setForm((current) => ({ ...current, skus: current.skus.map((sku) => (sku.localId === localId ? updater(sku) : sku)) }));
  };

  const handleCoverUpload = async (file?: File | null) => {
    if (!file) return;
    setCoverUploading(true);
    try {
      const uploaded = await mockApi.uploadShopImage(file);
      setForm((current) => ({
        ...current,
        coverUrl: uploaded.url,
        coverPreviewUrl: uploaded.readableUrl ?? uploaded.url,
        coverObjectKey: uploaded.objectKey,
      }));
      toast.success("封面已上传");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "封面上传失败");
    } finally {
      setCoverUploading(false);
    }
  };

  const handleGalleryUpload = async (files: File[]) => {
    if (files.length === 0) return;
    setGalleryUploading(true);
    try {
      const uploadedList = await Promise.all(files.map((file) => mockApi.uploadShopImage(file)));
      setForm((current) => ({
        ...current,
        images: [
          ...current.images,
          ...uploadedList.map((uploaded, index) =>
            createFormImage({
              imageUrl: uploaded.url,
              imagePreviewUrl: uploaded.readableUrl ?? uploaded.url,
              imageObjectKey: uploaded.objectKey,
              sortOrder: current.images.length + index,
            }),
          ),
        ],
      }));
      toast.success(`已上传 ${uploadedList.length} 张商品图`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "商品图上传失败");
    } finally {
      setGalleryUploading(false);
    }
  };

  const removeSku = (localId: string) => {
    setForm((current) => {
      if (current.skus.length === 1) {
        toast.error("至少保留一个 SKU");
        return current;
      }
      const nextSkus = current.skus.filter((sku) => sku.localId !== localId);
      if (!nextSkus.some((sku) => sku.isDefault)) nextSkus[0] = { ...nextSkus[0], isDefault: true };
      return { ...current, skus: nextSkus };
    });
  };

  const handleSubmit = async () => {
    const payload = buildPayload(form);
    if (!payload.categoryId) return toast.error("请选择商品分类");
    if (!payload.name) return toast.error("请输入商品名称");
    if (!payload.coverUrl) return toast.error("请上传商品封面");
    if (payload.skus.some((sku) => !sku.name || !sku.price)) return toast.error("请填写完整的 SKU 名称和价格");
    setSaving(true);
    try {
      if (isEdit && productId) {
        await mockApi.updateAdminShopProduct(productId, payload);
        toast.success("商品已更新");
      } else {
        await mockApi.createAdminShopProduct(payload);
        toast.success("商品已创建");
      }
      navigate("/admin/shop/products");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存商品失败");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-slate-500">商品信息加载中...</div>;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate("/admin/shop/products")} className="flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700">
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <p className="text-sm font-medium text-blue-600">{isEdit ? "编辑商品" : "新建商品"}</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">{isEdit ? "商品设置" : "创建商品"}</h1>
            <p className="mt-2 text-sm text-slate-500">支持虚拟、实物、组合三类商品。</p>
          </div>
        </div>
        <Button onClick={() => void handleSubmit()} disabled={saving || coverUploading || galleryUploading}>{saving ? "保存中..." : isEdit ? "保存商品" : "创建商品"}</Button>
      </div>

      <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { void handleCoverUpload(event.target.files?.[0]); event.currentTarget.value = ""; }} />
      <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { void handleGalleryUpload(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-8">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2"><Label>商品分类</Label><Select value={form.categoryId} onValueChange={(value) => setForm((current) => ({ ...current, categoryId: value }))}><SelectTrigger><SelectValue placeholder="请选择商品分类" /></SelectTrigger><SelectContent>{categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>商品类型</Label><Select value={form.type} onValueChange={(value: ShopProductType) => setForm((current) => ({ ...current, type: value, courseIds: value === "physical" ? [] : current.courseIds }))}><SelectTrigger><SelectValue placeholder="请选择商品类型" /></SelectTrigger><SelectContent><SelectItem value="virtual">虚拟商品</SelectItem><SelectItem value="physical">实物商品</SelectItem><SelectItem value="hybrid">组合商品</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>商品名称</Label><Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="请输入商品名称" /></div>
              <div className="space-y-2"><Label>副标题</Label><Input value={form.subtitle} onChange={(event) => setForm((current) => ({ ...current, subtitle: event.target.value }))} placeholder="用于列表页补充说明" /></div>
              <div className="space-y-2"><Label>商品状态</Label><Select value={form.status} onValueChange={(value: ShopProductStatus) => setForm((current) => ({ ...current, status: value }))}><SelectTrigger><SelectValue placeholder="请选择商品状态" /></SelectTrigger><SelectContent><SelectItem value="draft">草稿</SelectItem><SelectItem value="on_sale">上架中</SelectItem><SelectItem value="off_sale">已下架</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>排序值</Label><Input type="number" min={0} value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} /></div>
            </div>
            <div className="mt-6 grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
              <div className="space-y-3">
                <div className="flex items-center justify-between"><Label>商品封面</Label><Badge variant="secondary" className="bg-red-50 text-red-700">必传</Badge></div>
                <button type="button" onClick={() => coverInputRef.current?.click()} className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-3xl border border-dashed border-slate-300 bg-slate-50 text-slate-500">
                  {form.coverPreviewUrl || form.coverUrl ? <img src={form.coverPreviewUrl || form.coverUrl} alt="商品封面" className="h-full w-full object-cover" /> : <div className="text-center"><ImagePlus className="mx-auto mb-3 size-7 text-blue-600" /><p>{coverUploading ? "上传中..." : "点击上传商品封面"}</p></div>}
                </button>
              </div>
              <div className="space-y-4">
                <div className="space-y-2"><Label>商品简介</Label><Textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={4} placeholder="用于详情页顶部简要描述" /></div>
                <div className="space-y-2"><Label>详情说明</Label><Textarea value={form.detailContent} onChange={(event) => setForm((current) => ({ ...current, detailContent: event.target.value }))} rows={8} placeholder="用于图文详情、购买须知、发货说明等" /></div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-8">
            <div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-semibold text-slate-900">商品图库</h2><p className="mt-2 text-sm text-slate-500">支持上传多张商品图，按当前顺序展示。</p></div><Button variant="outline" onClick={() => galleryInputRef.current?.click()} disabled={galleryUploading}><Upload className="mr-2 size-4" />{galleryUploading ? "上传中..." : "上传商品图"}</Button></div>
            {form.images.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">暂无商品图</div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{form.images.map((image, index) => <div key={image.localId} className="overflow-hidden rounded-3xl border border-slate-200 bg-white"><img src={image.previewUrl || image.imageUrl} alt={`商品图 ${index + 1}`} className="aspect-square w-full object-cover" /><div className="flex items-center justify-between px-4 py-3"><div><p className="text-sm font-medium text-slate-900">第 {index + 1} 张</p><p className="text-xs text-slate-400">{image.imageObjectKey || "本地记录"}</p></div><Button variant="destructive" size="sm" onClick={() => setForm((current) => ({ ...current, images: current.images.filter((item) => item.localId !== image.localId) }))}><Trash2 className="mr-2 size-4" />删除</Button></div></div>)}</div>}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-8">
            <div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-semibold text-slate-900">绑定课程</h2><p className="mt-2 text-sm text-slate-500">虚拟商品与组合商品支付成功后可直接开通课程权限。</p></div><Badge variant="secondary" className="bg-blue-50 text-blue-700">已选 {selectedCourses.length} 门</Badge></div>
            {form.type === "physical" ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">当前为实物商品，不能绑定课程。</div> : <ScrollArea className="h-72 rounded-2xl border border-slate-200"><div className="space-y-3 p-4">{courses.map((course) => <label key={course.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"><Checkbox checked={form.courseIds.includes(course.id)} onCheckedChange={(checked) => setForm((current) => ({ ...current, courseIds: checked === true ? Array.from(new Set([...current.courseIds, course.id])) : current.courseIds.filter((id) => id !== course.id) }))} /><div className="min-w-0"><p className="font-medium text-slate-900">{course.name}</p><p className="mt-1 line-clamp-2 text-sm text-slate-500">{course.description}</p></div></label>)}</div></ScrollArea>}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-8">
            <div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-semibold text-slate-900">SKU 配置</h2><p className="mt-2 text-sm text-slate-500">至少保留一个 SKU，并确保价格完整。</p></div><Button variant="outline" onClick={() => setForm((current) => ({ ...current, skus: [...current.skus, createFormSku({ name: `规格 ${current.skus.length + 1}`, isDefault: false, status: true, sortOrder: current.skus.length })] }))}><Plus className="mr-2 size-4" />新增 SKU</Button></div>
            <div className="space-y-4">{form.skus.map((sku, index) => <div key={sku.localId} className="rounded-3xl border border-slate-200 bg-slate-50 p-5"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-3"><Badge variant="secondary" className="bg-white text-slate-700">SKU {index + 1}</Badge>{sku.isDefault ? <Badge variant="secondary" className="bg-blue-50 text-blue-700">默认规格</Badge> : null}</div><Button variant="destructive" size="sm" onClick={() => removeSku(sku.localId)}><Trash2 className="mr-2 size-4" />删除</Button></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><div className="space-y-2"><Label>SKU 名称</Label><Input value={sku.name} onChange={(event) => updateSku(sku.localId, (current) => ({ ...current, name: event.target.value }))} /></div><div className="space-y-2"><Label>售价</Label><Input value={sku.price} onChange={(event) => updateSku(sku.localId, (current) => ({ ...current, price: event.target.value }))} /></div><div className="space-y-2"><Label>划线价</Label><Input value={sku.originalPrice} onChange={(event) => updateSku(sku.localId, (current) => ({ ...current, originalPrice: event.target.value }))} /></div><div className="space-y-2"><Label>库存</Label><Input type="number" min={0} value={sku.stock} onChange={(event) => updateSku(sku.localId, (current) => ({ ...current, stock: Math.max(Number.parseInt(event.target.value, 10) || 0, 0) }))} /></div><div className="space-y-2"><Label>重量(g)</Label><Input type="number" min={0} value={sku.weight} onChange={(event) => updateSku(sku.localId, (current) => ({ ...current, weight: Math.max(Number.parseInt(event.target.value, 10) || 0, 0) }))} /></div><label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><span>启用</span><Checkbox checked={sku.status} onCheckedChange={(checked) => updateSku(sku.localId, (current) => ({ ...current, status: checked === true }))} /></label><label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><span>默认规格</span><Checkbox checked={sku.isDefault} onCheckedChange={(checked) => checked === true && setForm((current) => ({ ...current, skus: current.skus.map((item) => ({ ...item, isDefault: item.localId === sku.localId })) }))} /></label></div></div>)}</div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">当前摘要</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between"><span>商品类型</span><Badge variant="secondary" className="bg-slate-100 text-slate-700">{form.type === "virtual" ? "虚拟商品" : form.type === "physical" ? "实物商品" : "组合商品"}</Badge></div>
              <div className="flex items-center justify-between"><span>商品状态</span><Badge variant="secondary" className="bg-slate-100 text-slate-700">{form.status === "draft" ? "草稿" : form.status === "on_sale" ? "上架中" : "已下架"}</Badge></div>
              <div className="flex items-center justify-between"><span>绑定课程</span><span>{form.type === "physical" ? "不支持" : `${selectedCourses.length} 门`}</span></div>
              <div className="flex items-center justify-between"><span>SKU 数量</span><span>{form.skus.length} 个</span></div>
              <div className="flex items-center justify-between"><span>商品图数量</span><span>{form.images.length} 张</span></div>
            </div>
          </section>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate("/admin/shop/products")}>返回</Button>
            <Button type="button" onClick={() => void handleSubmit()} disabled={saving || coverUploading || galleryUploading}>{saving ? "保存中..." : isEdit ? "保存商品" : "创建商品"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
