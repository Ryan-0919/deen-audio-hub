import { motion } from "motion/react";
import { ArrowLeft, MapPin, Pencil, Plus, Star, Trash2, CheckCircle2 } from "lucide-react";
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
import { cn } from "../../components/ui/utils";
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
    <div className="min-h-screen bg-[#f5f7fb] pb-20 font-sans selection:bg-slate-900 selection:text-white">
      {/* Premium Header */}
      <div className="sticky top-0 z-30 border-b border-slate-200/50 bg-white/80 backdrop-blur-xl transition-all">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4 md:h-[72px] md:px-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="group flex size-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-black/[0.04] transition-all hover:bg-slate-50 hover:shadow-md"
          >
            <ArrowLeft className="size-5 transition-transform group-hover:-translate-x-0.5" />
          </button>
          <h1 className="flex-1 text-center text-[17px] font-bold tracking-tight text-slate-900 md:text-lg">收货地址</h1>
          <button
            type="button"
            onClick={openCreateDialog}
            className="flex size-10 items-center justify-center rounded-full bg-blue-50 text-blue-600 shadow-sm transition-all hover:bg-blue-100"
          >
            <Plus className="size-5" />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-[32px] bg-white p-5 shadow-sm ring-1 ring-black/[0.03] md:flex md:items-center md:justify-between md:gap-6 md:p-6">
          <div>
            <h2 className="text-[17px] font-bold tracking-tight text-slate-900">地址簿</h2>
            <p className="mt-1 text-[13px] font-medium leading-relaxed text-slate-500">默认地址会在结算页优先选中，电脑端可同时查看更多地址卡片。</p>
          </div>
          <Button className="mt-4 h-12 w-full rounded-full bg-slate-900 px-6 font-bold tracking-wider text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 md:mt-0 md:w-auto" onClick={openCreateDialog}>
            <Plus className="mr-2 size-4" />
            NEW ADDRESS
          </Button>
        </motion.div>

        {loading ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-10 text-center text-[13px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Loading Addresses...
          </motion.div>
        ) : addresses.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-8 max-w-md rounded-[40px] bg-white p-12 text-center shadow-xl shadow-slate-200/40 ring-1 ring-black/[0.03]">
            <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-blue-50 mb-6 text-blue-400">
              <MapPin className="size-10" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">还没有收货地址</h2>
            <p className="mt-3 text-sm font-medium leading-relaxed text-slate-500">新增一个常用地址，结算需要收货时可以直接选择。</p>
            <Button className="mt-8 h-12 rounded-full bg-slate-900 px-8 text-[14px] font-bold tracking-wider text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition-all hover:-translate-y-0.5" onClick={openCreateDialog}>
              ADD ADDRESS
            </Button>
          </motion.div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {addresses.map((address, i) => (
              <motion.div 
                key={address.id} 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.05 }}
                className={cn(
                  "relative rounded-[32px] p-6 shadow-sm ring-1 transition-all hover:shadow-lg",
                  address.isDefault 
                    ? "bg-white ring-blue-600/20 hover:shadow-blue-500/10" 
                    : "bg-white ring-black/[0.03] hover:shadow-slate-200/50"
                )}
              >
                {address.isDefault && (
                  <div className="absolute top-0 right-0 rounded-bl-[32px] rounded-tr-[32px] bg-blue-50 px-5 py-2">
                    <span className="text-[11px] font-bold tracking-wider text-blue-600 uppercase">Default</span>
                  </div>
                )}
                
                <div className="flex items-start justify-between gap-3 pr-20">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <p className="text-[17px] font-bold text-slate-900">{address.name}</p>
                      <span className="text-[14px] font-medium text-slate-500">{address.phone}</span>
                    </div>
                    <p className="mt-4 text-[14px] font-medium leading-relaxed text-slate-600">
                      {address.province} {address.city} {address.district} <br/>
                      <span className="font-bold text-slate-900">{address.address}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
                  {!address.isDefault && (
                    <Button variant="ghost" size="sm" className="h-10 rounded-full font-bold text-blue-600 hover:bg-blue-50" disabled={actionAddressId === address.id} onClick={() => void handleSetDefault(address)}>
                      <CheckCircle2 className="mr-2 size-4" />
                      设为默认
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="h-10 rounded-full border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-50" disabled={actionAddressId === address.id} onClick={() => openEditDialog(address)}>
                    <Pencil className="mr-2 size-4" />
                    编辑
                  </Button>
                  <Button variant="ghost" size="sm" className="h-10 rounded-full font-bold text-rose-600 hover:bg-rose-50" disabled={actionAddressId === address.id} onClick={() => void handleDelete(address)}>
                    <Trash2 className="mr-2 size-4" />
                    删除
                  </Button>
                </div>
              </motion.div>
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
        <DialogContent className="sm:max-w-2xl rounded-[32px] p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{editingAddress ? "编辑收货地址" : "新增收货地址"}</DialogTitle>
            <DialogDescription className="text-sm font-medium text-slate-500">填写完整的收件人信息，默认地址会在结算页优先选择。</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[13px] font-bold text-slate-700 ml-1">收货人</Label>
                <Input className="h-12 rounded-[16px] border-none bg-slate-50 px-4 shadow-inner" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] font-bold text-slate-700 ml-1">手机号</Label>
                <Input className="h-12 rounded-[16px] border-none bg-slate-50 px-4 shadow-inner" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-[13px] font-bold text-slate-700 ml-1">省</Label>
                <Input className="h-12 rounded-[16px] border-none bg-slate-50 px-4 shadow-inner" value={form.province} onChange={(event) => setForm((current) => ({ ...current, province: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] font-bold text-slate-700 ml-1">市</Label>
                <Input className="h-12 rounded-[16px] border-none bg-slate-50 px-4 shadow-inner" value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] font-bold text-slate-700 ml-1">区</Label>
                <Input className="h-12 rounded-[16px] border-none bg-slate-50 px-4 shadow-inner" value={form.district} onChange={(event) => setForm((current) => ({ ...current, district: event.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] font-bold text-slate-700 ml-1">详细地址</Label>
              <Textarea className="resize-none min-h-[100px] rounded-[20px] border-none bg-slate-50 p-4 shadow-inner text-[14px]" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} rows={4} />
            </div>

            <div className="flex items-center justify-between rounded-[24px] bg-slate-50 px-5 py-4">
              <div>
                <p className="text-[14px] font-bold text-slate-900">设为默认地址</p>
                <p className="mt-1 text-[12px] font-medium text-slate-500">下次结算时优先选中。</p>
              </div>
              <Switch className="data-[state=checked]:bg-blue-600" checked={form.isDefault} onCheckedChange={(checked) => setForm((current) => ({ ...current, isDefault: checked }))} />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button variant="ghost" className="rounded-full font-bold text-slate-500 hover:bg-slate-100" onClick={() => setDialogOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button className="rounded-full bg-slate-900 px-6 font-bold text-white hover:bg-slate-800" onClick={() => void handleSave()} disabled={saving}>
              {saving ? "SAVING..." : editingAddress ? "SAVE ADDRESS" : "ADD ADDRESS"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
