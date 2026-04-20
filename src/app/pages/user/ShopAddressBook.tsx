import { ArrowLeft, MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { Textarea } from "../../components/ui/textarea";
import { type ShopAddress, mockApi } from "../../lib/mockData";

type AddressFormState = {
  name: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  address: string;
  isDefault: boolean;
};

const emptyForm: AddressFormState = {
  name: "",
  phone: "",
  province: "",
  city: "",
  district: "",
  address: "",
  isDefault: true,
};

const mapAddressToForm = (address: ShopAddress): AddressFormState => ({
  name: address.name,
  phone: address.phone,
  province: address.province,
  city: address.city,
  district: address.district,
  address: address.address,
  isDefault: address.isDefault,
});

export function ShopAddressBook() {
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<ShopAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionAddressId, setActionAddressId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<ShopAddress | null>(null);
  const [form, setForm] = useState<AddressFormState>(emptyForm);

  const loadAddresses = async () => {
    try {
      setLoading(true);
      const list = await mockApi.getShopAddresses();
      setAddresses(list);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载收货地址失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAddresses();
  }, []);

  const resetForm = (nextDefault = true) => {
    setEditingAddress(null);
    setForm({ ...emptyForm, isDefault: nextDefault });
  };

  const openCreateDialog = () => {
    resetForm(addresses.length === 0);
    setDialogOpen(true);
  };

  const openEditDialog = (address: ShopAddress) => {
    setEditingAddress(address);
    setForm(mapAddressToForm(address));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      province: form.province.trim(),
      city: form.city.trim(),
      district: form.district.trim(),
      address: form.address.trim(),
      isDefault: form.isDefault,
    };

    if (!payload.name || !payload.phone || !payload.province || !payload.city || !payload.district || !payload.address) {
      toast.error("请完整填写收货地址");
      return;
    }

    try {
      setSaving(true);
      if (editingAddress) {
        await mockApi.updateShopAddress(editingAddress.id, payload);
        toast.success("地址已更新");
      } else {
        await mockApi.createShopAddress(payload);
        toast.success("地址已新增");
      }
      setDialogOpen(false);
      resetForm(addresses.length === 0);
      await loadAddresses();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存收货地址失败");
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (address: ShopAddress) => {
    if (address.isDefault) return;
    try {
      setActionAddressId(address.id);
      await mockApi.updateShopAddress(address.id, { isDefault: true });
      toast.success("默认地址已更新");
      await loadAddresses();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "设置默认地址失败");
    } finally {
      setActionAddressId("");
    }
  };

  const handleDelete = async (address: ShopAddress) => {
    if (!window.confirm(`确认删除地址“${address.name} ${address.phone}”吗？`)) return;

    try {
      setActionAddressId(address.id);
      await mockApi.deleteShopAddress(address.id);

      toast.success("地址已删除");
      await loadAddresses();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除收货地址失败");
    } finally {
      setActionAddressId("");
    }
  };

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
          <h1 className="flex-1 text-center text-base font-semibold text-slate-900">收货地址</h1>
          <button
            type="button"
            onClick={openCreateDialog}
            className="flex size-10 items-center justify-center rounded-full text-blue-700 transition hover:bg-blue-50"
          >
            <Plus className="size-5" />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-sm px-4 py-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">地址簿</h2>
              <p className="mt-1 text-sm text-slate-500">默认地址会在结算页优先选中。</p>
            </div>
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="mr-2 size-4" />
              新增
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="mt-4 rounded-3xl border border-slate-200 bg-white px-6 py-14 text-center text-sm text-slate-500">收货地址加载中...</div>
        ) : addresses.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-slate-200 bg-white px-8 py-14 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <MapPin className="size-6" />
            </div>
            <h2 className="mt-4 text-lg font-medium text-slate-900">还没有收货地址</h2>
            <p className="mt-2 text-sm leading-7 text-slate-500">新增一个常用地址，结算需要收货时可以直接选择。</p>
            <Button className="mt-5 rounded-full bg-slate-900 text-white hover:bg-slate-800" onClick={openCreateDialog}>
              新增地址
            </Button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {addresses.map((address) => (
              <div key={address.id} className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {address.name} {address.phone}
                      </p>
                      {address.isDefault ? (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                          默认
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {address.province}
                      {address.city}
                      {address.district}
                      {address.address}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">更新时间 {address.updatedAt}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {!address.isDefault ? (
                    <Button variant="outline" size="sm" disabled={actionAddressId === address.id} onClick={() => void handleSetDefault(address)}>
                      <Star className="mr-2 size-4" />
                      设为默认
                    </Button>
                  ) : null}
                  <Button variant="outline" size="sm" disabled={actionAddressId === address.id} onClick={() => openEditDialog(address)}>
                    <Pencil className="mr-2 size-4" />
                    编辑
                  </Button>
                  <Button variant="destructive" size="sm" disabled={actionAddressId === address.id} onClick={() => void handleDelete(address)}>
                    <Trash2 className="mr-2 size-4" />
                    删除
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!saving) {
            setDialogOpen(open);
            if (!open) {
              resetForm(addresses.length === 0);
            }
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAddress ? "编辑收货地址" : "新增收货地址"}</DialogTitle>
            <DialogDescription>填写完整的收件人信息，默认地址会在结算页优先选择。</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>收货人</Label>
                <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>手机号</Label>
                <Input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>省</Label>
                <Input value={form.province} onChange={(event) => setForm((current) => ({ ...current, province: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>市</Label>
                <Input value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>区</Label>
                <Input value={form.district} onChange={(event) => setForm((current) => ({ ...current, district: event.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>详细地址</Label>
              <Textarea value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} rows={4} />
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">设为默认地址</p>
                <p className="mt-1 text-sm text-slate-500">下次结算时优先选中。</p>
              </div>
              <Switch checked={form.isDefault} onCheckedChange={(checked) => setForm((current) => ({ ...current, isDefault: checked }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "保存中..." : editingAddress ? "保存地址" : "新增地址"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
