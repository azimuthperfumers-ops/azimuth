import { trpc } from "@/lib/trpc";

export function useCartCount() {
  const { data: cartItems = [] } = trpc.cart.list.useQuery(undefined, {
    staleTime: 60_000,
  });
  return cartItems.filter((i) => !i.isSaved).reduce((n, i) => n + i.quantity, 0);
}
