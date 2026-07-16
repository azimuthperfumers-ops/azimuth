"use client";

import { useMemo, useState } from "react";
import { BadgePercent, ChevronRight, Tag, X } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

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

// Discount this coupon gives on a cart worth `price` (0 if min cart not met).
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

function terms(c: Coupon): string[] {
  const t: string[] = [];
  if (Number(c.minCartValue) > 0) t.push(`On orders above ${rupee(Number(c.minCartValue))}`);
  if (c.paymentMethod === "wallet") t.push("Wallet payments only");
  if (c.paymentMethod === "razorpay") t.push("Card / UPI / bank payments only");
  if (c.usageLimitPerUser != null) t.push(`Up to ${c.usageLimitPerUser} use${c.usageLimitPerUser > 1 ? "s" : ""} per customer`);
  if (c.endsAt) {
    t.push(
      `Valid till ${new Date(c.endsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
    );
  }
  t.push("Applied at checkout. One coupon per order.");
  return t;
}

function copyCode(code: string) {
  navigator.clipboard
    ?.writeText(code)
    .then(() => toast.success(`Code ${code} copied — apply it at checkout`))
    .catch(() => {});
}

function CouponRow({ coupon, price, detailed }: { coupon: Coupon; price: number; detailed?: boolean }) {
  const saving = discountAt(coupon, price);
  const applicable = saving > 0;

  return (
    <div className={cn("flex items-start gap-3 py-3.5", !applicable && "opacity-70")}>
      <Tag className="mt-0.5 size-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-foreground">
          {headline(coupon)}
          {applicable && (
            <span className="ml-2 text-[13px] font-normal text-muted-foreground">
              — pay {rupee(price - saving)}
            </span>
          )}
        </p>
        {coupon.description && (
          <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{coupon.description}</p>
        )}
        {detailed ? (
          <ul className="mt-1.5 space-y-0.5">
            {terms(coupon).map((t) => (
              <li key={t} className="text-[12px] leading-snug text-muted-foreground/70">
                · {t}
              </li>
            ))}
          </ul>
        ) : (
          !applicable && (
            <p className="mt-0.5 text-[12px] text-muted-foreground/70">
              On orders above {rupee(Number(coupon.minCartValue))}
            </p>
          )
        )}
      </div>
      <button
        onClick={() => copyCode(coupon.code)}
        className="shrink-0 border border-dashed border-primary/50 px-2.5 py-1 font-mono text-[12px] font-semibold tracking-wider text-primary hover:bg-primary/5 transition-colors"
        title="Copy code"
      >
        {coupon.code}
      </button>
    </div>
  );
}

// Amazon-style offers block for the product page: best applicable coupon as an
// "as low as ₹X" line, a couple of offers inline, and a See-all dialog with
// full terms. Coupons apply cart-wide — the preview assumes this item alone.
export function ProductOffers({ price }: { price: number }) {
  const [open, setOpen] = useState(false);
  const coupons = trpc.coupon.listPublic.useQuery(undefined, { staleTime: 5 * 60 * 1000 });

  const { applicable, all, bestPrice } = useMemo(() => {
    const list = (coupons.data ?? []) as Coupon[];
    const withSaving = list
      .map((c) => ({ c, saving: discountAt(c, price) }))
      .sort((a, b) => b.saving - a.saving);
    const applicable = withSaving.filter((x) => x.saving > 0).map((x) => x.c);
    const best = withSaving[0]?.saving ?? 0;
    return { applicable, all: withSaving.map((x) => x.c), bestPrice: price - best };
  }, [coupons.data, price]);

  if (!coupons.data || all.length === 0) return null;

  return (
    <div className="border-t border-border pt-6">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-[12px] font-semibold tracking-[0.18em] uppercase text-foreground/60">
          <BadgePercent className="size-4 text-primary" />
          Offers &amp; coupons
        </p>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-0.5 text-[12px] font-semibold tracking-[0.08em] text-primary uppercase hover:opacity-70 transition-opacity"
        >
          See all ({all.length})
          <ChevronRight className="size-3.5" />
        </button>
      </div>

      {applicable.length > 0 && bestPrice < price && (
        <p className="mt-3 text-[15px] text-foreground">
          Get it as low as <span className="font-semibold tabular-nums">{rupee(bestPrice)}</span>{" "}
          <span className="text-[13px] text-muted-foreground">with coupon</span>
        </p>
      )}

      <div className="mt-1 divide-y divide-border/60">
        {(applicable.length > 0 ? applicable : all).slice(0, 2).map((c) => (
          <CouponRow key={c.id} coupon={c} price={price} />
        ))}
      </div>

      {/* See-all dialog */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto bg-background p-6 sm:border sm:border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-start justify-between">
              <h2 className="font-heading text-2xl font-medium text-foreground">Offers &amp; coupons</h2>
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>
            <p className="mb-4 text-[13px] text-muted-foreground">
              Copy a code and apply it at checkout. Discounts are calculated on your cart total.
            </p>
            <div className="divide-y divide-border/60">
              {all.map((c) => (
                <CouponRow key={c.id} coupon={c} price={price} detailed />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
