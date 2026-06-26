"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck, Minus, Plus, Tag, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { authClient } from "@/lib/auth-client";
import { cartSubtotal } from "@/lib/cart";
import type { CartItem } from "@/lib/cart";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useCart } from "@/hooks/use-cart";

function formatInr(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

// ─── Active cart row ──────────────────────────────────────────────────────────

function CartRow({
  item,
  onRemove,
  onUpdateQty,
  onSaveForLater,
}: {
  item: CartItem;
  onRemove: (variantId: string) => void;
  onUpdateQty: (variantId: string, qty: number) => void;
  onSaveForLater: (variantId: string) => void;
}) {
  const lineTotal = item.sellingPrice * item.quantity;
  const lineMrp = item.mrp * item.quantity;
  const hasSaving = item.mrp > item.sellingPrice;

  return (
    <div className="grid grid-cols-[120px_1fr] gap-6 py-8 border-b border-border">
      {/* Image */}
      <Link href={`/shop/${item.slug}`} className="block shrink-0">
        <div
          className="w-[120px] h-[150px] overflow-hidden"
          style={{ backgroundColor: item.themeColor ?? "#e8e0d5" }}
        >
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt={item.productName} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-end p-3">
              <span
                className="font-heading text-sm font-medium text-white/60 leading-tight"
                style={{ mixBlendMode: "overlay" }}
              >
                {item.productName}
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="flex flex-col justify-between py-1">
        {/* Top: name + remove */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link
              href={`/shop/${item.slug}`}
              className="font-heading text-[1.15rem] font-medium leading-tight text-foreground hover:opacity-70 transition-opacity"
            >
              {item.productName}
            </Link>
            <p className="mt-1 text-[11px] text-muted-foreground/60 tracking-[0.06em]">
              {item.sizeMl}ml · {item.variantSku}
            </p>
          </div>
          <button
            onClick={() => onRemove(item.variantId)}
            className="mt-0.5 shrink-0 text-muted-foreground/30 hover:text-foreground/70 transition-colors"
            title="Remove"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Bottom: qty + save + price */}
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-2.5">
            {/* Qty stepper */}
            <div className="flex items-center border border-border/60 w-fit">
              <button
                onClick={() => onUpdateQty(item.variantId, item.quantity - 1)}
                className="flex h-8 w-9 items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
              >
                {item.quantity === 1 ? <Trash2 className="size-3" /> : <Minus className="size-3" />}
              </button>
              <span className="flex h-8 w-10 items-center justify-center border-x border-border/60 text-sm font-semibold tabular-nums">
                {item.quantity}
              </span>
              <button
                onClick={() => onUpdateQty(item.variantId, item.quantity + 1)}
                className="flex h-8 w-9 items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
              >
                <Plus className="size-3" />
              </button>
            </div>

            {/* Save for later */}
            <button
              onClick={() => onSaveForLater(item.variantId)}
              className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/50 uppercase hover:text-foreground transition-colors w-fit"
            >
              <Bookmark className="size-3" />
              Save for later
            </button>
          </div>

          {/* Price block */}
          <div className="text-right">
            <p className="text-xl font-semibold tabular-nums text-foreground">
              {formatInr(lineTotal)}
            </p>
            {hasSaving && (
              <>
                <p className="text-[11px] text-muted-foreground/50 tabular-nums line-through">
                  {formatInr(lineMrp)}
                </p>
                <p className="text-[11px] font-semibold text-primary tabular-nums">
                  Save {formatInr(lineMrp - lineTotal)}
                </p>
              </>
            )}
            {item.quantity > 1 && (
              <p className="mt-0.5 text-[11px] text-muted-foreground/40 tabular-nums">
                {formatInr(item.sellingPrice)} each
              </p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Saved item row ───────────────────────────────────────────────────────────

function SavedRow({
  item,
  onMoveToCart,
  onRemoveSaved,
}: {
  item: CartItem;
  onMoveToCart: (variantId: string) => void;
  onRemoveSaved: (variantId: string) => void;
}) {
  return (
    <div className="flex gap-4 py-5 border-b border-border/40">
      <div
        className="w-14 h-[70px] shrink-0 overflow-hidden opacity-60"
        style={{ backgroundColor: item.themeColor ?? "#e8e0d5" }}
      >
        {item.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.productName} className="h-full w-full object-cover" />
        )}
      </div>
      <div className="flex flex-1 items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground/60">{item.productName}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground/40">{item.sizeMl}ml · {formatInr(item.sellingPrice)}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onMoveToCart(item.variantId)}
            className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] uppercase border border-border px-3 py-2 text-foreground/60 hover:border-foreground hover:text-foreground transition-colors"
          >
            <BookmarkCheck className="size-3" />
            Move to cart
          </button>
          <button
            onClick={() => onRemoveSaved(item.variantId)}
            className="text-muted-foreground/30 hover:text-foreground/50 transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Coupon browser ───────────────────────────────────────────────────────────

function CouponBrowser({ subtotal, onSelect }: { subtotal: number; onSelect: (code: string) => void }) {
  const { data: coupons } = trpc.coupon.listActive.useQuery();

  if (!coupons?.length) return null;

  const eligible = coupons.filter((c) => subtotal >= Number(c.minCartValue));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-bold tracking-[0.2em] text-foreground/40 uppercase">
          Available offers
        </span>
        {eligible.length > 0 && (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-bold tracking-[0.1em] text-primary uppercase">
            {eligible.length} applicable
          </span>
        )}
      </div>
      {coupons.map((coupon) => {
        const minCart = Number(coupon.minCartValue);
        const isEligible = subtotal >= minCart;
        const val = Number(coupon.value);
        const valueText = coupon.type === "percentage"
          ? `${val.toFixed(0)}% off`
          : formatInr(val) + " off";

        return (
          <button
            key={coupon.id}
            disabled={!isEligible}
            onClick={() => isEligible && onSelect(coupon.code)}
            className={cn(
              "w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors",
              isEligible
                ? "border border-primary/20 bg-primary/5 hover:bg-primary/10 cursor-pointer"
                : "border border-border/40 bg-muted/20 cursor-not-allowed",
            )}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-[11px] font-bold tracking-[0.16em] uppercase",
                  isEligible ? "text-primary" : "text-muted-foreground/40",
                )}>
                  {coupon.code}
                </span>
                {!isEligible && (
                  <span className="text-[9px] text-muted-foreground/40">
                    Add {formatInr(minCart - subtotal)} more
                  </span>
                )}
              </div>
              {coupon.description && isEligible && (
                <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">
                  {coupon.description}
                </p>
              )}
            </div>
            <span className={cn(
              "shrink-0 text-[12px] font-bold tabular-nums",
              isEligible ? "text-primary" : "text-muted-foreground/30",
            )}>
              {valueText}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Coupon section (dialog-driven) ──────────────────────────────────────────

function CouponSection({
  subtotal,
  couponCode,
  couponDiscount,
  onApply,
  onClear,
}: {
  subtotal: number;
  couponCode: string | null;
  couponDiscount: number | null;
  onApply: (code: string, couponId: string, discount: number) => void;
  onClear: () => void;
}) {
  const { data: session } = authClient.useSession();
  const utils = trpc.useUtils();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [applying, setApplying] = useState(false);

  async function apply(code?: string) {
    const finalCode = (code ?? input).trim().toUpperCase();
    if (!finalCode) return;
    setApplying(true);
    try {
      const data = await utils.coupon.validate.fetch({
        code: finalCode,
        cartTotal: subtotal,
        userId: session?.user.id,
      });
      onApply(data.code, data.couponId, data.discountAmount);
      toast.success(`${data.code} applied — ${formatInr(data.discountAmount)} off`);
      setOpen(false);
      setInput("");
    } catch (err: unknown) {
      toast.error((err as { message?: string })?.message ?? "Invalid coupon code");
    } finally {
      setApplying(false);
    }
  }

  if (couponCode && couponDiscount !== null) {
    return (
      <div className="flex items-center justify-between border border-primary/25 bg-primary/5 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <Tag className="size-3.5 text-primary" />
          <span className="text-[11px] font-bold tracking-[0.16em] text-primary uppercase">
            {couponCode}
          </span>
          <span className="text-[11px] text-muted-foreground">
            · {formatInr(couponDiscount)} off
          </span>
        </div>
        <button
          onClick={onClear}
          className="text-muted-foreground/40 hover:text-foreground transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 border border-border px-5 py-3 text-left transition-colors hover:border-foreground/40"
      >
        <Tag className="size-3.5 text-muted-foreground/40 shrink-0" />
        <span className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground/50 uppercase">
          Apply coupon or promo code
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden rounded-none border-border">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
            <DialogTitle className="text-[13px] font-bold tracking-[0.18em] uppercase">
              Coupon code
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 py-5 space-y-5">
            <div className="flex">
              <input
                autoFocus
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === "Enter") apply(); }}
                placeholder="ENTER CODE"
                className="flex-1 border border-border bg-background px-4 py-3 text-[12px] font-semibold tracking-[0.16em] placeholder:text-muted-foreground/30 focus:border-foreground focus:outline-none uppercase transition-colors"
              />
              <button
                onClick={() => apply()}
                disabled={applying || !input.trim()}
                className={cn(
                  "shrink-0 border-y border-r border-border px-5 text-[10px] font-bold tracking-[0.2em] uppercase transition-all",
                  input.trim() && !applying
                    ? "bg-foreground text-background hover:opacity-80"
                    : "bg-muted text-muted-foreground/40 cursor-not-allowed",
                )}
              >
                {applying ? "…" : "Apply"}
              </button>
            </div>

            <CouponBrowser subtotal={subtotal} onSelect={(code) => apply(code)} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Order summary ────────────────────────────────────────────────────────────

function OrderSummary({
  subtotal,
  couponCode,
  couponDiscount,
}: {
  subtotal: number;
  couponCode: string | null;
  couponDiscount: number | null;
}) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const discount = couponDiscount ?? 0;
  const shipping = subtotal >= 999 ? 0 : 99;
  const total = Math.max(0, subtotal - discount) + shipping;

  return (
    <div className="border border-border lg:sticky lg:top-24">
      <div className="border-b border-border px-6 py-5">
        <h2 className="text-[11px] font-bold tracking-[0.22em] uppercase text-foreground/70">
          Order summary
        </h2>
      </div>

      <div className="px-6 py-5 space-y-3.5">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium tabular-nums">{formatInr(subtotal)}</span>
        </div>

        {discount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-1.5 text-primary">
              <Tag className="size-3" />
              {couponCode}
            </span>
            <span className="font-medium tabular-nums text-primary">−{formatInr(discount)}</span>
          </div>
        )}

        <div className="flex justify-between text-sm text-muted-foreground/60">
          <span>Shipping</span>
          <span className="tabular-nums">{shipping === 0 ? "Free" : formatInr(shipping)}</span>
        </div>

        {subtotal < 999 && (
          <p className="text-[10.5px] text-muted-foreground/50 border border-dashed border-border rounded-sm px-3 py-2 text-center">
            Add {formatInr(999 - subtotal)} more for free shipping
          </p>
        )}

        <div className="border-t border-border pt-4 flex justify-between">
          <span className="font-semibold text-base">Total</span>
          <div className="text-right">
            <span className="font-bold text-xl tabular-nums">{formatInr(total)}</span>
            <p className="text-[10px] text-muted-foreground/40 mt-0.5">Incl. of all taxes</p>
          </div>
        </div>
      </div>

      <div className="px-6 pb-6">
        <button
          className="w-full bg-foreground py-4 text-[11px] font-bold tracking-[0.26em] text-background uppercase transition-all hover:opacity-85"
          onClick={() => session ? router.push("/checkout") : router.push("/account")}
        >
          Proceed to checkout
        </button>
        <p className="mt-3 text-center text-[9.5px] text-muted-foreground/40 tracking-[0.1em] uppercase">
          Secure · GST invoice included
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CartPage() {
  const cart = useCart();
  const { items, savedItems, couponCode, couponDiscount, isLoading } = cart;

  const subtotal = cartSubtotal(items);

  if (isLoading) {
    return (
      <>
        <SiteHeader />
        <main className="flex min-h-[70vh] items-center justify-center">
          <p className="text-[11px] font-bold tracking-[0.22em] text-muted-foreground/40 uppercase animate-pulse">
            Loading cart…
          </p>
        </main>
        <SiteFooter />
      </>
    );
  }

  if (items.length === 0 && savedItems.length === 0) {
    return (
      <>
        <SiteHeader />
        <main className="flex min-h-[70vh] flex-col items-center justify-center gap-8 px-8 text-center">
          <div className="space-y-3">
            <p className="text-[10px] font-bold tracking-[0.26em] text-muted-foreground/40 uppercase">
              Your cart
            </p>
            <h1 className="font-heading text-5xl font-medium">Empty</h1>
            <p className="text-sm text-muted-foreground/60">
              Add a fragrance to begin.
            </p>
          </div>
          <Link
            href="/shop"
            className="border border-foreground px-10 py-3.5 text-[11px] font-bold tracking-[0.22em] uppercase transition-all hover:bg-foreground hover:text-background"
          >
            Shop the collection
          </Link>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1200px] px-4 md:px-8 py-8 md:py-12 pb-28">
        {/* Header */}
        <div className="mb-10 flex items-end justify-between border-b border-border pb-7">
          <div>
            <p className="mb-1.5 text-[10px] font-bold tracking-[0.26em] text-muted-foreground/40 uppercase">
              Your cart
            </p>
            <h1 className="font-heading text-4xl md:text-5xl font-medium leading-none">
              {items.length} {items.length === 1 ? "item" : "items"}
            </h1>
          </div>
          {items.length > 0 && (
            <button
              onClick={() => cart.clear()}
              className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground/50 uppercase hover:text-foreground transition-colors underline underline-offset-2"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Coupon bar */}
        {items.length > 0 && (
          <div className="mb-8">
            <CouponSection
              subtotal={subtotal}
              couponCode={couponCode}
              couponDiscount={couponDiscount}
              onApply={cart.applyCoupon}
              onClear={cart.clearCoupon}
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px] lg:gap-14 items-start">
          {/* Items */}
          <div>
            {items.length > 0 ? (
              items.map((item) => (
                <CartRow
                  key={item.variantId}
                  item={item}
                  onRemove={cart.remove}
                  onUpdateQty={cart.updateQty}
                  onSaveForLater={cart.saveForLater}
                />
              ))
            ) : (
              <div className="py-10 text-center border border-dashed border-border">
                <p className="text-sm text-muted-foreground/50">No active items.</p>
                <Link href="/shop" className="mt-2 inline-block text-[11px] font-semibold tracking-[0.1em] text-foreground underline underline-offset-2 uppercase">
                  Browse shop
                </Link>
              </div>
            )}

            {/* Saved for later */}
            {savedItems.length > 0 && (
              <div className="mt-10">
                <p className="mb-4 flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-muted-foreground/40 uppercase">
                  <Bookmark className="size-3" />
                  Saved for later ({savedItems.length})
                </p>
                {savedItems.map((item) => (
                  <SavedRow
                    key={item.variantId}
                    item={item}
                    onMoveToCart={cart.moveToCart}
                    onRemoveSaved={cart.removeSaved}
                  />
                ))}
              </div>
            )}

            <div className="mt-8">
              <Link
                href="/shop"
                className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground/50 uppercase hover:text-foreground transition-colors"
              >
                ← Continue shopping
              </Link>
            </div>
          </div>

          {/* Order summary */}
          {items.length > 0 && (
            <OrderSummary
              subtotal={subtotal}
              couponCode={couponCode}
              couponDiscount={couponDiscount}
            />
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
