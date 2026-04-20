import { ArrowLeft, Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { type ShopCartItem, mockApi } from "../../lib/mockData";
import { formatShopMoney } from "../../lib/shopOrder";

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
    <div className="min-h-screen bg-[#f6f8fb]">
      <div className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-sm items-center px-4">
          <button
            type="button"
            onClick={() => navigate("/user/shop")}
            className="flex size-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="flex-1 text-center text-base font-semibold text-slate-900">购物车</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="mx-auto max-w-sm px-4 py-4">
        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-14 text-center text-sm text-slate-500">购物车加载中...</div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white px-8 py-14 text-center">
            <h2 className="text-lg font-medium text-slate-900">购物车还是空的</h2>
            <p className="mt-2 text-sm leading-7 text-slate-500">先去商城挑选想买的内容，再回来统一结算。</p>
            <Button type="button" className="mt-5 rounded-full bg-slate-900 text-white hover:bg-slate-800" onClick={() => navigate("/user/shop")}>
              去商城选购
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex gap-3">
                  <div className="flex pt-1">
                    <Checkbox checked={selectedItemIds.includes(item.id)} disabled={!item.available} onCheckedChange={() => toggleItem(item.id)} />
                  </div>

                  <img src={item.coverUrl} alt={item.productName} className="h-20 w-20 rounded-2xl object-cover" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="line-clamp-2 text-base font-semibold text-slate-900">{item.productName}</h2>
                        <p className="mt-1 text-sm text-slate-500">{item.skuName}</p>
                      </div>
                      <button type="button" onClick={() => void removeCartItem(item.id)} className="text-slate-400 transition hover:text-red-500">
                        <Trash2 className="size-4" />
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div>
                        <p className="text-lg font-semibold text-slate-900">{formatShopMoney(item.price)}</p>
                        {item.originalPrice ? <p className="mt-1 text-xs text-slate-400 line-through">{formatShopMoney(item.originalPrice)}</p> : null}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="rounded-full"
                          disabled={updatingItemId === item.id || item.quantity <= 1 || !item.available}
                          onClick={() => void updateCartItem(item.id, Math.max(item.quantity - 1, 1))}
                        >
                          <Minus className="size-4" />
                        </Button>
                        <div className="min-w-10 text-center text-sm font-semibold text-slate-900">{item.quantity}</div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="rounded-full"
                          disabled={updatingItemId === item.id || item.quantity >= item.stock || !item.available}
                          onClick={() => void updateCartItem(item.id, Math.min(item.quantity + 1, item.stock))}
                        >
                          <Plus className="size-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                          小计 {formatShopMoney(item.subtotal)}
                        </Badge>
                        {item.requiresShipping ? (
                          <Badge variant="secondary" className="bg-amber-50 text-amber-700">
                            需发货
                          </Badge>
                        ) : null}
                      </div>
                      <span>{item.available ? `库存 ${item.stock}` : "当前不可下单"}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!loading && items.length > 0 ? (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-slate-200/80 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-sm items-center gap-3 px-4 py-3">
            <button type="button" onClick={toggleAll} className="flex items-center gap-2 text-sm text-slate-600">
              <Checkbox checked={availableItems.length > 0 && selectedItemIds.length === availableItems.length} />
              <span>全选</span>
            </button>

            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500">已选 {selectedItems.length} 件商品</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{formatShopMoney(selectedAmount.toFixed(2))}</p>
            </div>

            <Button type="button" className="h-12 rounded-full bg-slate-900 px-6 text-white hover:bg-slate-800" disabled={selectedItems.length === 0} onClick={goToCheckout}>
              去结算
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
