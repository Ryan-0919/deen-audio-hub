import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { type ShopCartItem, mockApi } from "../../lib/mockData";
import { formatShopMoney } from "../../lib/shopOrder";
import { cn } from "../../components/ui/utils";

const parseMoney = (value: string) => Number.parseFloat(value || "0") || 0;

export function ShopCart() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ShopCartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingItemId, setUpdatingItemId] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  const loadCart = async () => {
    try {
      setLoading(true);
      const cart = await mockApi.getShopCart();
      setItems(cart.items);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载购物车失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCart();
  }, []);

  useEffect(() => {
    setSelectedItemIds((current) => {
      const availableIds = items.filter((item) => item.available).map((item) => item.id);
      const retainedIds = current.filter((id) => availableIds.includes(id));
      return retainedIds.length > 0 ? retainedIds : availableIds;
    });
  }, [items]);

  const availableItems = useMemo(() => items.filter((item) => item.available), [items]);
  const selectedItems = useMemo(() => items.filter((item) => selectedItemIds.includes(item.id)), [items, selectedItemIds]);
  const selectedAmount = useMemo(
    () => selectedItems.reduce((sum, item) => sum + parseMoney(item.price) * item.quantity, 0),
    [selectedItems],
  );
  const selectedQuantity = useMemo(() => selectedItems.reduce((sum, item) => sum + item.quantity, 0), [selectedItems]);
  const unavailableCount = useMemo(() => items.filter((item) => !item.available).length, [items]);
  const allAvailableSelected = availableItems.length > 0 && selectedItemIds.length === availableItems.length;

  const toggleItem = (itemId: string) => {
    setSelectedItemIds((current) => (current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]));
  };

  const toggleAll = () => {
    const availableIds = availableItems.map((item) => item.id);
    if (availableIds.length === 0) return;
    setSelectedItemIds((current) => (current.length === availableIds.length ? [] : availableIds));
  };

  const updateCartItem = async (itemId: string, quantity: number) => {
    try {
      setUpdatingItemId(itemId);
      const cart = await mockApi.updateShopCartItem(itemId, { quantity });
      setItems(cart.items);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新购物车失败");
    } finally {
      setUpdatingItemId("");
    }
  };

  const removeCartItem = async (itemId: string) => {
    try {
      setUpdatingItemId(itemId);
      const cart = await mockApi.deleteShopCartItem(itemId);
      setItems(cart.items);
      toast.success("商品已移除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "移除商品失败");
    } finally {
      setUpdatingItemId("");
    }
  };

  const goToCheckout = () => {
    if (selectedItems.length === 0) {
      toast.error("请先勾选要结算的商品");
      return;
    }

    const search = new URLSearchParams({
      source: "cart",
      cartItemIds: selectedItems.map((item) => item.id).join(","),
    });

    navigate(`/user/shop/checkout?${search.toString()}`);
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] pb-28 lg:pb-10 font-sans selection:bg-slate-900 selection:text-white">
      {/* Premium Header */}
      <div className="sticky top-0 z-30 border-b border-slate-200/50 bg-white/80 backdrop-blur-xl transition-all">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 md:h-[72px] md:px-6 xl:px-8">
          <button
            type="button"
            onClick={() => navigate("/user/shop")}
            className="group flex size-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-black/[0.04] transition-all hover:bg-slate-50 hover:shadow-md"
          >
            <ArrowLeft className="size-5 transition-transform group-hover:-translate-x-0.5" />
          </button>
          <h1 className="flex-1 text-center text-[17px] font-bold tracking-tight text-slate-900 md:text-lg">购物车</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8 xl:px-8">
        {loading ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-10 text-center text-[13px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Loading Cart...
          </motion.div>
        ) : items.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} 
            className="mx-auto mt-8 max-w-md rounded-[40px] bg-white p-12 text-center shadow-xl shadow-slate-200/40 ring-1 ring-black/[0.03]"
          >
            <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-slate-50 mb-6">
              <ShoppingBag className="size-10 text-slate-300" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">购物车还是空的</h2>
            <p className="mt-3 text-sm font-medium leading-relaxed text-slate-500">挑选心仪的内容与商品，装满你的学习与生活。</p>
            <Button type="button" className="mt-8 h-12 rounded-full bg-slate-900 px-8 text-sm font-bold tracking-wider text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 hover:-translate-y-0.5 transition-all" onClick={() => navigate("/user/shop")}>
              去商城逛逛
            </Button>
          </motion.div>
        ) : (
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-8">
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {items.map((item, i) => (
                  <motion.div 
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                    transition={{ duration: 0.4, delay: i * 0.05 }}
                    className={cn(
                      "group relative rounded-[32px] bg-white p-4 shadow-sm ring-1 ring-black/[0.03] transition-all hover:shadow-lg hover:shadow-slate-200/50 lg:p-5",
                      !item.available && "opacity-60 grayscale-[0.5]"
                    )}
                  >
                    <div className="flex gap-4">
                      <div className="flex pt-6">
                        <Checkbox 
                          checked={selectedItemIds.includes(item.id)} 
                          disabled={!item.available} 
                          onCheckedChange={() => toggleItem(item.id)} 
                          className="data-[state=checked]:bg-[#ff6a3d] data-[state=checked]:border-[#ff6a3d]"
                        />
                      </div>

                      <div className="relative aspect-square h-24 w-24 shrink-0 overflow-hidden rounded-[24px] ring-1 ring-black/[0.04]">
                         <img src={item.coverUrl} alt={item.productName} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      </div>

                      <div className="min-w-0 flex-1 flex flex-col justify-between py-1">
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <h2 className="line-clamp-2 text-[15px] font-bold leading-tight text-slate-900">{item.productName}</h2>
                            <button 
                              type="button" 
                              onClick={() => void removeCartItem(item.id)} 
                              className="text-slate-300 transition-colors hover:text-red-500"
                              title="移除"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                          <p className="mt-1.5 text-[13px] font-medium text-slate-500">{item.skuName}</p>
                        </div>

                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-lg font-bold tracking-tight text-[#ff6a3d]">{formatShopMoney(item.price)}</span>
                            {item.originalPrice ? <span className="text-[12px] font-medium text-slate-400 line-through">{formatShopMoney(item.originalPrice)}</span> : null}
                          </div>

                          <div className="flex items-center gap-1 rounded-full bg-slate-50 p-1 ring-1 ring-slate-200/50">
                            <button
                              type="button"
                              className="flex size-8 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:opacity-50 disabled:shadow-none"
                              disabled={updatingItemId === item.id || item.quantity <= 1 || !item.available}
                              onClick={() => void updateCartItem(item.id, Math.max(item.quantity - 1, 1))}
                            >
                              <Minus className="size-3.5" />
                            </button>
                            <div className="min-w-[2.5rem] text-center text-[13px] font-bold text-slate-900">{item.quantity}</div>
                            <button
                              type="button"
                              className="flex size-8 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:opacity-50 disabled:shadow-none"
                              disabled={updatingItemId === item.id || item.quantity >= item.stock || !item.available}
                              onClick={() => void updateCartItem(item.id, Math.min(item.quantity + 1, item.stock))}
                            >
                              <Plus className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="ml-14 mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 pl-2 sm:ml-[112px] sm:pl-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="rounded-md bg-orange-50/50 px-2 py-0.5 text-[11px] font-semibold text-[#ff6a3d]">
                          小计 {formatShopMoney(item.subtotal)}
                        </Badge>
                        {item.requiresShipping ? (
                          <Badge variant="secondary" className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            需发货
                          </Badge>
                        ) : null}
                      </div>
                      <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">{item.available ? `STOCK ${item.stock}` : "UNAVAILABLE"}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <aside className="mt-6 hidden lg:sticky lg:top-[96px] lg:mt-0 lg:block">
              <motion.section 
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
                className="rounded-[32px] bg-white p-6 shadow-xl shadow-slate-200/40 ring-1 ring-black/[0.03]"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                  <button type="button" onClick={toggleAll} className="flex items-center gap-2.5">
                    <Checkbox checked={allAvailableSelected} className="data-[state=checked]:bg-[#ff6a3d] data-[state=checked]:border-[#ff6a3d]" />
                    <span className="text-[14px] font-bold text-slate-700">全选可下单商品</span>
                  </button>
                  <span className="text-[12px] font-bold text-slate-400">{availableItems.length} ITEMS</span>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="flex justify-between items-center text-[14px] text-slate-500 font-medium">
                    <span>已选商品数量</span>
                    <span className="text-slate-900 font-bold">{selectedQuantity} 件</span>
                  </div>
                  <div className="flex justify-between items-end border-t border-slate-100 pt-4">
                    <span className="text-[14px] text-slate-500 font-medium pb-1">合计金额</span>
                    <div className="text-right">
                       <span className="text-[32px] font-bold tracking-tight text-[#ff6a3d] leading-none">{formatShopMoney(selectedAmount.toFixed(2))}</span>
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  className="mt-8 h-14 w-full rounded-full bg-[#ff6a3d] text-[15px] font-bold tracking-widest text-white shadow-lg shadow-orange-500/25 transition-all hover:-translate-y-0.5 hover:bg-[#f65a28] hover:shadow-orange-500/40 disabled:opacity-50 disabled:shadow-none"
                  disabled={selectedItems.length === 0}
                  onClick={goToCheckout}
                >
                  CHECKOUT
                </Button>
              </motion.section>

              {unavailableCount > 0 && (
                <motion.section 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                  className="mt-4 rounded-[24px] bg-slate-100 px-5 py-4 text-[13px] font-medium leading-relaxed text-slate-600 ring-1 ring-black/[0.03]"
                >
                  当前有 <strong className="text-slate-900">{unavailableCount}</strong> 件商品暂不可下单，不会参与本次结算。
                </motion.section>
              )}
            </aside>
          </div>
        )}
      </div>

      {!loading && items.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 px-4 lg:hidden">
          <div className="mx-auto flex max-w-md items-center gap-3 rounded-[32px] bg-white/95 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl ring-1 ring-black/[0.04] supports-[backdrop-filter]:bg-white/80">
            <button type="button" onClick={toggleAll} className="flex flex-col items-center justify-center pl-2 pr-1">
              <Checkbox checked={allAvailableSelected} className="data-[state=checked]:bg-[#ff6a3d] data-[state=checked]:border-[#ff6a3d]" />
              <span className="mt-1 text-[10px] font-bold text-slate-500">全选</span>
            </button>

            <div className="min-w-0 flex-1 pl-2 border-l border-slate-100">
              <p className="text-[11px] font-bold text-slate-400">已选 {selectedItems.length} 件</p>
              <p className="mt-0.5 text-[20px] font-bold leading-none tracking-tight text-[#ff6a3d]">{formatShopMoney(selectedAmount.toFixed(2))}</p>
            </div>

            <Button
              type="button"
              className="h-12 min-w-[120px] rounded-full bg-[#ff6a3d] px-6 text-[14px] font-bold tracking-wider text-white shadow-md shadow-orange-500/20 hover:bg-[#f65a28] disabled:opacity-50"
              disabled={selectedItems.length === 0}
              onClick={goToCheckout}
            >
              去结算
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
