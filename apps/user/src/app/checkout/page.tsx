"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Lock, Tag } from "lucide-react";
import { toast } from "sonner";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { AuthCard } from "@/components/auth-card";
import { authClient } from "@/lib/auth-client";
import { cartSubtotal } from "@/lib/cart";
import { trpc } from "@/lib/trpc";
import { useCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type AddressForm = {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
};

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatInr(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function shippingCharge(subtotal: number) {
  return subtotal >= 999 ? 0 : 99;
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// ─── Address form ─────────────────────────────────────────────────────────────

const FIELDS: { key: keyof AddressForm; label: string; type: string; required: boolean; hint?: string }[] = [
  { key: "fullName", label: "Full name", type: "text", required: true },
  { key: "phone", label: "Phone number", type: "tel", required: true, hint: "10-digit mobile number" },
  { key: "line1", label: "Address line 1", type: "text", required: true },
  { key: "line2", label: "Address line 2", type: "text", required: false },
  { key: "city", label: "City", type: "text", required: true },
  { key: "state", label: "State", type: "text", required: true },
  { key: "pincode", label: "Pincode", type: "text", required: true, hint: "6-digit postal code" },
];

function AddressSection({
  form,
  onChange,
}: {
  form: AddressForm;
  onChange: (key: keyof AddressForm, value: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[11px] font-bold tracking-[0.22em] text-muted-foreground/60 uppercase mb-4">
          Delivery address
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FIELDS.slice(0, 2).map(({ key, label, type, required, hint }) => (
              <div key={key} className="space-y-1.5">
                <label className="text-[11px] font-semibold tracking-[0.1em] uppercase text-muted-foreground">
                  {label}
                </label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={(e) => onChange(key, e.target.value)}
                  required={required}
                  className="w-full border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/30 focus:border-foreground focus:outline-none transition-colors"
                />
                {hint && <p className="text-[10.5px] text-muted-foreground/40">{hint}</p>}
              </div>
            ))}
          </div>

          {FIELDS.slice(2, 4).map(({ key, label, type, required }) => (
            <div key={key} className="space-y-1.5">
              <label className="text-[11px] font-semibold tracking-[0.1em] uppercase text-muted-foreground">
                {label}{!required && <span className="ml-1 text-muted-foreground/40">(optional)</span>}
              </label>
              <input
                type={type}
                value={form[key]}
                onChange={(e) => onChange(key, e.target.value)}
                required={required}
                className="w-full border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/30 focus:border-foreground focus:outline-none transition-colors"
              />
            </div>
          ))}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {FIELDS.slice(4).map(({ key, label, type, required, hint }) => (
              <div key={key} className="space-y-1.5">
                <label className="text-[11px] font-semibold tracking-[0.1em] uppercase text-muted-foreground">
                  {label}
                </label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={(e) => onChange(key, e.target.value)}
                  required={required}
                  maxLength={key === "pincode" ? 6 : undefined}
                  className="w-full border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/30 focus:border-foreground focus:outline-none transition-colors"
                />
                {hint && <p className="text-[10.5px] text-muted-foreground/40">{hint}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Order summary panel ──────────────────────────────────────────────────────

function CheckoutSummary({
  subtotal,
  couponCode,
  couponDiscount,
  paying,
  onPay,
}: {
  subtotal: number;
  couponCode: string | null;
  couponDiscount: number | null;
  paying: boolean;
  onPay: () => void;
}) {
  const discount = couponDiscount ?? 0;
  const shipping = shippingCharge(subtotal);
  const total = Math.max(0, subtotal - discount) + shipping;

  return (
    <div className="border border-border lg:sticky lg:top-24">
      <div className="border-b border-border px-6 py-5">
        <h2 className="text-[11px] font-bold tracking-[0.22em] uppercase text-foreground/70">
          Order summary
        </h2>
      </div>

      <div className="px-6 py-5 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium tabular-nums">{formatInr(subtotal)}</span>
        </div>

        {discount > 0 && couponCode && (
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
          <p className="text-[10.5px] text-muted-foreground/50 border border-dashed border-border px-3 py-2 text-center">
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

      <div className="px-6 pb-6 space-y-3">
        <button
          type="submit"
          form="checkout-form"
          disabled={paying}
          onClick={onPay}
          className={cn(
            "w-full py-4 text-[11px] font-bold tracking-[0.26em] uppercase transition-all",
            paying
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-foreground text-background hover:opacity-85",
          )}
        >
          {paying ? "Processing…" : `Pay ${formatInr(total)}`}
        </button>
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/40">
          <Lock className="size-3" />
          <span>Secured by Razorpay · GST invoice included</span>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const cart = useCart();

  const [form, setForm] = useState<AddressForm>({
    fullName: "", phone: "", line1: "", line2: "", city: "", state: "", pincode: "",
  });
  const [paying, setPaying] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const utils = trpc.useUtils();
  const createOrder = trpc.order.create.useMutation();
  const createRazorpayOrder = trpc.payment.createRazorpayOrder.useMutation();
  const verifyPayment = trpc.payment.verifyAndConfirmPayment.useMutation();

  // Pre-fill name/phone from session
  useEffect(() => {
    if (session?.user) {
      setForm((prev) => ({
        ...prev,
        fullName: prev.fullName || session.user.name || "",
      }));
    }
  }, [session]);

  function setField(key: keyof AddressForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const items = cart.items;
  const subtotal = cartSubtotal(items);
  const discount = cart.couponDiscount ?? 0;
  const shipping = shippingCharge(subtotal);
  const total = Math.max(0, subtotal - discount) + shipping;

  async function handlePay() {
    if (!formRef.current?.checkValidity()) {
      formRef.current?.reportValidity();
      return;
    }

    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    setPaying(true);
    try {
      // 1. Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error("Could not load payment gateway. Check your connection.");
        return;
      }

      // 2. Create order in DB
      const order = await createOrder.mutateAsync({
        shippingAddress: {
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          line1: form.line1.trim(),
          line2: form.line2.trim() || null,
          city: form.city.trim(),
          state: form.state.trim(),
          pincode: form.pincode.trim(),
        },
        items: items.map((item) => ({
          variantId: item.variantId,
          productName: item.productName,
          variantSku: item.variantSku,
          sizeMl: item.sizeMl,
          unitPrice: item.sellingPrice,
          mrp: item.mrp,
          quantity: item.quantity,
          imageUrl: item.imageUrl ?? null,
        })),
        subtotal,
        discountAmount: discount,
        shippingCharge: shipping,
        taxAmount: 0,
        total,
        couponId: cart.couponId ?? null,
        couponCode: cart.couponCode ?? null,
      });

      // 3. Create Razorpay order on server
      const rzpData = await createRazorpayOrder.mutateAsync({ orderId: order.id });

      // 4. Open Razorpay checkout modal
      await new Promise<void>((resolve, reject) => {
        const options = {
          key: rzpData.keyId,
          amount: rzpData.amount,
          currency: rzpData.currency,
          name: "Azimuth Perfumers",
          description: `Order ${rzpData.orderNumber}`,
          order_id: rzpData.razorpayOrderId,
          prefill: {
            name: form.fullName.trim(),
            contact: form.phone.trim(),
          },
          theme: { color: "#0a0a0a" },
          modal: {
            ondismiss: () => reject(new Error("Payment cancelled")),
          },
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              await verifyPayment.mutateAsync({
                orderId: order.id,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              resolve();
            } catch (err) {
              reject(err);
            }
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      });

      // 5. Success
      await utils.order.list.invalidate();
      toast.success("Payment successful! Redirecting to your orders…");
      router.push("/account?tab=orders");
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message;
      if (msg && msg !== "Payment cancelled") {
        toast.error(msg ?? "Payment failed. Please try again.");
      }
    } finally {
      setPaying(false);
    }
  }

  // Auth guard
  if (sessionLoading) return null;

  if (!session) {
    return (
      <>
        <SiteHeader />
        <main className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6">
          <p className="text-sm text-muted-foreground">Sign in to continue checkout.</p>
          <AuthCard />
        </main>
        <SiteFooter />
      </>
    );
  }

  if (!cart.isLoading && items.length === 0) {
    router.replace("/cart");
    return null;
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1100px] px-4 md:px-8 py-8 md:py-12 pb-28">
        {/* Header */}
        <div className="mb-10 border-b border-border pb-7">
          <button
            onClick={() => router.back()}
            className="mb-5 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground/50 uppercase hover:text-foreground transition-colors"
          >
            <ChevronLeft className="size-3" />
            Back to cart
          </button>
          <p className="mb-1 text-[10px] font-bold tracking-[0.26em] text-muted-foreground/40 uppercase">
            Checkout
          </p>
          <h1 className="font-heading text-4xl md:text-5xl font-medium leading-none">
            Almost there
          </h1>
        </div>

        <form
          id="checkout-form"
          ref={formRef}
          onSubmit={(e) => e.preventDefault()}
          className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px] lg:gap-14 items-start"
        >
          {/* Left: address + items preview */}
          <div className="space-y-10">
            <AddressSection form={form} onChange={setField} />

            {/* Items preview */}
            <div>
              <h2 className="text-[11px] font-bold tracking-[0.22em] text-muted-foreground/60 uppercase mb-4">
                Items ({items.length})
              </h2>
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.variantId}
                    className="flex items-center gap-4 border border-border/50 p-3"
                  >
                    <div
                      className="w-14 h-[60px] shrink-0 overflow-hidden"
                      style={{ backgroundColor: item.themeColor ?? "#e8e0d5" }}
                    >
                      {item.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={item.productName}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.productName}</p>
                      <p className="text-[11px] text-muted-foreground/50">
                        {item.sizeMl}ml · qty {item.quantity}
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums shrink-0">
                      {formatInr(item.sellingPrice * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: summary + pay */}
          <CheckoutSummary
            subtotal={subtotal}
            couponCode={cart.couponCode}
            couponDiscount={cart.couponDiscount}
            paying={paying}
            onPay={handlePay}
          />
        </form>
      </main>
      <SiteFooter />
    </>
  );
}
