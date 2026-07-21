import { View, Text } from "react-native";

import { trpc } from "@/lib/trpc";

// Mirrors the web ProductOffers: an "as low as ₹X" line plus the applicable
// coupons. Codes are long-press selectable (RN `selectable`) so no clipboard
// native dep is needed. Coupons apply cart-wide — the preview assumes this item.

type Coupon = {
  id: string;
  code: string;
  description: string | null;
  type: "percentage" | "flat";
  value: string;
  paymentMethod: "any" | "razorpay" | "wallet";
  minCartValue: string;
  maxDiscount: string | null;
  endsAt: Date | string | null;
  usageLimitPerUser: number | null;
};

const rupee = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function discountAt(c: Coupon, price: number): number {
  if (price < Number(c.minCartValue)) return 0;
  let d = c.type === "percentage" ? (price * Number(c.value)) / 100 : Number(c.value);
  if (c.maxDiscount != null) d = Math.min(d, Number(c.maxDiscount));
  return Math.min(d, price);
}

function headline(c: Coupon): string {
  return c.type === "percentage"
    ? `${Number(c.value)}% off${c.maxDiscount != null ? ` up to ${rupee(Number(c.maxDiscount))}` : ""}`
    : `${rupee(Number(c.value))} off`;
}

function CouponRow({ coupon, price }: { coupon: Coupon; price: number }) {
  const saving = discountAt(coupon, price);
  const applicable = saving > 0;
  return (
    <View
      className="flex-row items-start gap-3 py-3.5 border-t border-[#E3DDD1]"
      style={{ opacity: applicable ? 1 : 0.6 }}
    >
      <View className="flex-1">
        <Text className="text-[14px] font-medium text-[#1B1611]">
          {headline(coupon)}
          {applicable && (
            <Text className="text-[13px] text-[#57493A]">{`  — pay ${rupee(price - saving)}`}</Text>
          )}
        </Text>
        {coupon.description ? (
          <Text className="mt-0.5 text-[12px] leading-snug text-[#57493A]">{coupon.description}</Text>
        ) : Number(coupon.minCartValue) > 0 && !applicable ? (
          <Text className="mt-0.5 text-[11px] text-[#8A7A63]">
            On orders above {rupee(Number(coupon.minCartValue))}
          </Text>
        ) : null}
      </View>
      <View className="border border-dashed border-[#B08D57] px-2.5 py-1">
        <Text selectable className="font-mono text-[12px] font-semibold tracking-wider text-[#B08D57]">
          {coupon.code}
        </Text>
      </View>
    </View>
  );
}

export function ProductOffers({ price }: { price: number }) {
  const coupons = trpc.coupon.listPublic.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const list = (coupons.data ?? []) as Coupon[];

  if (!coupons.data || list.length === 0) return null;

  const withSaving = list
    .map((c) => ({ c, saving: discountAt(c, price) }))
    .sort((a, b) => b.saving - a.saving);
  const applicable = withSaving.filter((x) => x.saving > 0).map((x) => x.c);
  const best = withSaving[0]?.saving ?? 0;
  const bestPrice = price - best;
  const shown = (applicable.length > 0 ? applicable : list).slice(0, 3);

  return (
    <View className="border-t border-[#E3DDD1] pt-6 mb-8">
      <Text className="text-[10px] font-semibold tracking-[0.24em] text-[#57493A] uppercase mb-1">
        Offers & coupons
      </Text>

      {applicable.length > 0 && bestPrice < price && (
        <Text className="mt-2 text-[15px] text-[#1B1611]">
          Get it as low as <Text className="font-semibold">{rupee(bestPrice)}</Text>
          <Text className="text-[13px] text-[#57493A]"> with coupon</Text>
        </Text>
      )}

      <View className="mt-2">
        {shown.map((c) => (
          <CouponRow key={c.id} coupon={c} price={price} />
        ))}
      </View>

      <Text className="mt-2 text-[11px] text-[#8A7A63]">
        Long-press a code to copy · apply at checkout · one coupon per order.
      </Text>
    </View>
  );
}
