"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { createElement } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import type { CartItem } from "@/lib/cart";
import { MAX_CART_QTY, useCartStore } from "@/lib/cart";
import { trpc } from "@/lib/trpc";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CartState {
  isAuth: boolean;
  isLoading: boolean;
  items: CartItem[];
  savedItems: CartItem[];
  couponCode: string | null;
  couponId: string | null;
  couponDiscount: number | null;
  add: (item: Omit<CartItem, "quantity">) => void | Promise<unknown>;
  remove: (variantId: string) => void | Promise<unknown>;
  updateQty: (variantId: string, qty: number) => void | Promise<unknown>;
  saveForLater: (variantId: string) => void | Promise<unknown>;
  moveToCart: (variantId: string) => void | Promise<unknown>;
  removeSaved: (variantId: string) => void | Promise<unknown>;
  applyCoupon: (code: string, couponId: string, discount: number, minCartValue: number) => void;
  clearCoupon: () => void;
  clear: () => void | Promise<unknown>;
}

type ServerRow = {
  variantId: string;
  quantity: number;
  isSaved: boolean;
  productId: string | null;
  productName: string | null;
  sku: string | null;
  sizeMl: number | null;
  concentration: string | null;
  effectivePrice: number;
  mrp: string | null;
  imageUrl: string | null;
  themeColor: string | null;
  slug: string | null;
};

function toCartItem(row: ServerRow): CartItem {
  return {
    productId: row.productId ?? "",
    variantId: row.variantId,
    productName: row.productName ?? "",
    variantSku: row.sku ?? "",
    sizeMl: row.sizeMl ?? 0,
    concentration: row.concentration ?? "",
    effectivePrice: row.effectivePrice,
    mrp: Number(row.mrp ?? 0),
    imageUrl: row.imageUrl ?? undefined,
    themeColor: row.themeColor ?? undefined,
    slug: row.slug ?? "",
    quantity: row.quantity,
  };
}

// ── Context ────────────────────────────────────────────────────────────────────

export const CartContext = createContext<CartState | null>(null);

// ── Cart logic — used by CartProvider ─────────────────────────────────────────

export function useCartProviderValue(): CartState {
  const { data: session } = authClient.useSession();
  const isAuth = !!session?.user;

  // Guest Zustand selectors — always called so hook order is stable
  const guestItems = useCartStore((s) => s.items);
  const guestSaved = useCartStore((s) => s.savedItems);
  const couponCode = useCartStore((s) => s.couponCode);
  const couponId = useCartStore((s) => s.couponId);
  const couponDiscount = useCartStore((s) => s.couponDiscount);
  const couponMinCartValue = useCartStore((s) => s.couponMinCartValue);
  const guestAdd = useCartStore((s) => s.add);
  const guestRemove = useCartStore((s) => s.remove);
  const guestUpdateQty = useCartStore((s) => s.updateQty);
  const guestSaveForLater = useCartStore((s) => s.saveForLater);
  const guestMoveToCart = useCartStore((s) => s.moveToCart);
  const guestRemoveSaved = useCartStore((s) => s.removeSaved);
  const applyCoupon = useCartStore((s) => s.applyCoupon);
  const clearCoupon = useCartStore((s) => s.clearCoupon);
  const guestClear = useCartStore((s) => s.clear);

  // Server cart hooks — always initialised; query only fetches when isAuth
  const utils = trpc.useUtils();
  const invalidate = () => utils.cart.list.invalidate();
  const serverQuery = trpc.cart.list.useQuery(undefined, { enabled: isAuth });
  const upsertMut = trpc.cart.upsert.useMutation({ onSuccess: invalidate });
  const updateQtyMut = trpc.cart.updateQty.useMutation({ onSuccess: invalidate });
  const removeMut = trpc.cart.remove.useMutation({ onSuccess: invalidate });
  const clearMut = trpc.cart.clear.useMutation({ onSuccess: invalidate });
  const saveForLaterMut = trpc.cart.saveForLater.useMutation({ onSuccess: invalidate });
  const moveToCartMut = trpc.cart.moveToCart.useMutation({ onSuccess: invalidate });
  const removeSavedMut = trpc.cart.removeSaved.useMutation({ onSuccess: invalidate });
  const mergeMut = trpc.cart.merge.useMutation({ onSuccess: invalidate });

  // Merge guest → server once on sign-in, then wipe Zustand
  const prevUserId = useRef<string | null>(null);
  useEffect(() => {
    const userId = session?.user?.id ?? null;
    if (userId && !prevUserId.current) {
      const guestCart = useCartStore.getState().items;
      if (guestCart.length > 0) {
        mergeMut.mutate(
          guestCart.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
          { onSuccess: () => useCartStore.getState().clear() },
        );
      } else {
        useCartStore.getState().clear();
      }
    }
    prevUserId.current = userId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  // Auto-clear coupon for auth users when server cart changes make it ineligible
  useEffect(() => {
    if (!isAuth || !couponCode || couponMinCartValue === null) return;
    const rows = (serverQuery.data ?? []) as ServerRow[];
    const activeSubtotal = rows
      .filter((r) => !r.isSaved)
      .reduce((s, r) => s + r.effectivePrice * r.quantity, 0);
    if (activeSubtotal < couponMinCartValue) {
      clearCoupon();
      toast.warning(`${couponCode} removed — cart minimum ₹${couponMinCartValue.toLocaleString("en-IN")} not met`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverQuery.data]);

  // Instant client-side guard for the total-quantity cap. Server enforces it too
  // (packages/api cart.router) — this is UX so the block is immediate.
  const capBlocked = (currentTotal: number, delta: number): boolean => {
    if (delta > 0 && currentTotal + delta > MAX_CART_QTY) {
      toast.warning(`Cart limit is ${MAX_CART_QTY} items. Remove something to add more.`);
      return true;
    }
    return false;
  };

  if (isAuth) {
    const rows = (serverQuery.data ?? []) as ServerRow[];
    const items = rows.filter((r) => !r.isSaved).map(toCartItem);
    const savedItems = rows.filter((r) => r.isSaved).map(toCartItem);
    const activeTotal = items.reduce((n, i) => n + i.quantity, 0);

    return {
      isAuth: true,
      isLoading: serverQuery.isLoading,
      items,
      savedItems,
      couponCode,
      couponId,
      couponDiscount,
      add: (item) => {
        if (capBlocked(activeTotal, 1)) return;
        return upsertMut.mutateAsync({ variantId: item.variantId, quantity: 1 });
      },
      remove: (variantId) => removeMut.mutateAsync({ variantId }),
      updateQty: (variantId, qty) => {
        const cur = items.find((i) => i.variantId === variantId)?.quantity ?? 0;
        if (capBlocked(activeTotal, qty - cur)) return;
        return updateQtyMut.mutateAsync({ variantId, quantity: qty });
      },
      saveForLater: (variantId) => saveForLaterMut.mutateAsync({ variantId }),
      moveToCart: (variantId) => {
        const savedQty = savedItems.find((i) => i.variantId === variantId)?.quantity ?? 1;
        if (capBlocked(activeTotal, savedQty)) return;
        return moveToCartMut.mutateAsync({ variantId });
      },
      removeSaved: (variantId) => removeSavedMut.mutateAsync({ variantId }),
      applyCoupon,
      clearCoupon,
      clear: () => clearMut.mutateAsync(),
    };
  }

  const guestTotal = guestItems.reduce((n, i) => n + i.quantity, 0);

  return {
    isAuth: false,
    isLoading: false,
    items: guestItems,
    savedItems: guestSaved,
    couponCode,
    couponId,
    couponDiscount,
    add: (item) => { if (!capBlocked(guestTotal, 1)) guestAdd(item); },
    remove: (variantId) => { guestRemove(variantId); },
    updateQty: (variantId, qty) => {
      const cur = guestItems.find((i) => i.variantId === variantId)?.quantity ?? 0;
      if (!capBlocked(guestTotal, qty - cur)) guestUpdateQty(variantId, qty);
    },
    saveForLater: (variantId) => { guestSaveForLater(variantId); },
    moveToCart: (variantId) => {
      const savedQty = guestSaved.find((i) => i.variantId === variantId)?.quantity ?? 1;
      if (!capBlocked(guestTotal, savedQty)) guestMoveToCart(variantId);
    },
    removeSaved: (variantId) => { guestRemoveSaved(variantId); },
    applyCoupon,
    clearCoupon,
    clear: () => { guestClear(); },
  };
}

// ── CartProvider — mount once in Providers ────────────────────────────────────

export function CartProvider({ children }: { children: ReactNode }) {
  const value = useCartProviderValue();
  return createElement(CartContext.Provider, { value }, children);
}

// ── Consumer hooks ─────────────────────────────────────────────────────────────

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}

export function useCartCount(): number {
  const ctx = useContext(CartContext);
  if (!ctx) return 0;
  return ctx.items.reduce((n, i) => n + i.quantity, 0);
}
