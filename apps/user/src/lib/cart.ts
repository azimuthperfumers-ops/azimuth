import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  productId: string;
  variantId: string;
  productName: string;
  variantSku: string;
  sizeMl: number;
  sellingPrice: number;
  mrp: number;
  imageUrl?: string;
  themeColor?: string;
  slug: string;
  quantity: number;
};

interface CartStore {
  items: CartItem[];
  savedItems: CartItem[];
  couponCode: string | null;
  couponId: string | null;
  couponDiscount: number | null;

  add: (item: Omit<CartItem, "quantity">) => void;
  remove: (variantId: string) => void;
  updateQty: (variantId: string, qty: number) => void;
  saveForLater: (variantId: string) => void;
  moveToCart: (variantId: string) => void;
  removeSaved: (variantId: string) => void;
  applyCoupon: (code: string, couponId: string, discount: number) => void;
  clearCoupon: () => void;
  clear: () => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set) => ({
      items: [],
      savedItems: [],
      couponCode: null,
      couponId: null,
      couponDiscount: null,

      add: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.variantId === item.variantId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.variantId === item.variantId ? { ...i, quantity: i.quantity + 1 } : i,
              ),
            };
          }
          // If already saved, move it to cart instead
          const savedExisting = state.savedItems.find((i) => i.variantId === item.variantId);
          if (savedExisting) {
            return {
              savedItems: state.savedItems.filter((i) => i.variantId !== item.variantId),
              items: [...state.items, { ...savedExisting, quantity: 1 }],
            };
          }
          return { items: [...state.items, { ...item, quantity: 1 }] };
        }),

      remove: (variantId) =>
        set((state) => ({
          items: state.items.filter((i) => i.variantId !== variantId),
          couponCode: null,
          couponId: null,
          couponDiscount: null,
        })),

      updateQty: (variantId, qty) =>
        set((state) => {
          if (qty <= 0) {
            return {
              items: state.items.filter((i) => i.variantId !== variantId),
              couponCode: null,
              couponId: null,
              couponDiscount: null,
            };
          }
          return {
            items: state.items.map((i) =>
              i.variantId === variantId ? { ...i, quantity: qty } : i,
            ),
            couponCode: null,
            couponId: null,
            couponDiscount: null,
          };
        }),

      saveForLater: (variantId) =>
        set((state) => {
          const item = state.items.find((i) => i.variantId === variantId);
          if (!item) return {};
          const alreadySaved = state.savedItems.find((i) => i.variantId === variantId);
          return {
            items: state.items.filter((i) => i.variantId !== variantId),
            savedItems: alreadySaved ? state.savedItems : [...state.savedItems, { ...item, quantity: 1 }],
            couponCode: null,
            couponId: null,
            couponDiscount: null,
          };
        }),

      moveToCart: (variantId) =>
        set((state) => {
          const item = state.savedItems.find((i) => i.variantId === variantId);
          if (!item) return {};
          const existingInCart = state.items.find((i) => i.variantId === variantId);
          return {
            savedItems: state.savedItems.filter((i) => i.variantId !== variantId),
            items: existingInCart
              ? state.items.map((i) =>
                  i.variantId === variantId ? { ...i, quantity: i.quantity + 1 } : i,
                )
              : [...state.items, { ...item, quantity: 1 }],
          };
        }),

      removeSaved: (variantId) =>
        set((state) => ({
          savedItems: state.savedItems.filter((i) => i.variantId !== variantId),
        })),

      applyCoupon: (code, couponId, discount) =>
        set({ couponCode: code, couponId, couponDiscount: discount }),

      clearCoupon: () => set({ couponCode: null, couponId: null, couponDiscount: null }),

      clear: () => set({ items: [], savedItems: [], couponCode: null, couponId: null, couponDiscount: null }),
    }),
    { name: "azimuth-cart" },
  ),
);

export function cartSubtotal(items: CartItem[]) {
  return items.reduce((sum, i) => sum + i.sellingPrice * i.quantity, 0);
}
