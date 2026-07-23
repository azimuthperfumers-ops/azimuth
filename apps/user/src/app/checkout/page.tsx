"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Lock, MapPin, Plus, Tag } from "lucide-react";
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
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
};

type SavedAddress = {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
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

const CONCENTRATION_LABEL: Record<string, string> = {
  edp: "Eau de Parfum",
  edt: "Eau de Toilette",
  parfum: "Parfum",
  cologne: "Cologne",
  attar: "Attar",
};

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

const EMPTY_FORM: AddressForm = {
  label: "Home", fullName: "", phone: "", line1: "", line2: "",
  city: "", state: "", pincode: "",
};

function addressToForm(a: SavedAddress): AddressForm {
  return {
    label: a.label,
    fullName: a.fullName,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2 ?? "",
    city: a.city,
    state: a.state,
    pincode: a.pincode,
  };
}

// ─── Saved address card ───────────────────────────────────────────────────────

function AddressCard({
  address,
  selected,
  onSelect,
}: {
  address: SavedAddress;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left border p-4 transition-colors relative",
        selected ? "border-foreground bg-foreground/[0.02]" : "border-border hover:border-foreground/40",
      )}
    >
      {selected && (
        <span className="absolute right-3 top-3 flex size-4 items-center justify-center rounded-full bg-foreground">
          <Check className="size-2.5 text-background" />
        </span>
      )}
      {address.isDefault && (
        <span className="mb-1.5 inline-block text-[9px] font-bold tracking-[0.18em] uppercase text-muted-foreground/50">
          Default
        </span>
      )}
      <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase mb-1">
        {address.label}
      </p>
      <p className="text-sm font-medium">{address.fullName}</p>
      <p className="text-[12px] text-muted-foreground/70 mt-0.5 leading-relaxed">
        {address.line1}{address.line2 ? `, ${address.line2}` : ""}
        <br />{address.city}, {address.state} — {address.pincode}
        <br />{address.phone}
      </p>
    </button>
  );
}

// ─── New address form ─────────────────────────────────────────────────────────

const ADDRESS_LABELS = ["Home", "Work", "Other"];

function NewAddressForm({
  form,
  onChange,
  saveToAccount,
  onSaveToAccountChange,
  formRef,
  errors = {},
}: {
  form: AddressForm;
  onChange: (key: keyof AddressForm, value: string) => void;
  saveToAccount: boolean;
  onSaveToAccountChange: (v: boolean) => void;
  formRef?: React.RefObject<HTMLFormElement | null>;
  errors?: Partial<Record<keyof AddressForm, string>>;
}) {
  return (
    <div className="border border-border p-5 space-y-4 mt-3">
      {/* Label selector */}
      <div className="flex gap-2">
        {ADDRESS_LABELS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => onChange("label", l)}
            className={cn(
              "border px-3 py-1.5 text-[10px] font-bold tracking-[0.14em] uppercase transition-colors",
              form.label === l
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground/40",
            )}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { key: "fullName" as const, label: "Full name", type: "text" },
          { key: "phone" as const, label: "Phone", type: "tel", hint: "10-digit mobile" },
        ].map(({ key, label, type, hint }) => (
          <div key={key} className="space-y-1.5">
            <label className="text-[11px] font-semibold tracking-[0.1em] uppercase text-muted-foreground">{label}</label>
            <input
              form={formRef ? undefined : "checkout-form"}
              type={type}
              value={form[key]}
              onChange={(e) => onChange(key, e.target.value)}
              className={cn(
                "w-full border bg-background px-3 py-2.5 text-sm focus:outline-none transition-colors",
                errors[key] ? "border-primary focus:border-primary" : "border-border focus:border-foreground",
              )}
            />
            {errors[key]
              ? <p className="mt-1 text-[11px] text-primary">{errors[key]}</p>
              : hint && <p className="text-[10.5px] text-muted-foreground/40">{hint}</p>
            }
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold tracking-[0.1em] uppercase text-muted-foreground">Address line 1</label>
        <input
          type="text"
          value={form.line1}
          onChange={(e) => onChange("line1", e.target.value)}
          className={cn(
            "w-full border bg-background px-3 py-2.5 text-sm focus:outline-none transition-colors",
            errors.line1 ? "border-primary focus:border-primary" : "border-border focus:border-foreground",
          )}
        />
        {errors.line1 && <p className="mt-1 text-[11px] text-primary">{errors.line1}</p>}
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold tracking-[0.1em] uppercase text-muted-foreground">
          Address line 2 <span className="text-muted-foreground/40">(optional)</span>
        </label>
        <input
          type="text"
          value={form.line2}
          onChange={(e) => onChange("line2", e.target.value)}
          className="w-full border border-border bg-background px-3 py-2.5 text-sm focus:border-foreground focus:outline-none transition-colors"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { key: "city" as const, label: "City", hint: undefined },
          { key: "state" as const, label: "State", hint: undefined },
          { key: "pincode" as const, label: "Pincode", maxLength: 6, hint: undefined },
        ].map(({ key, label, maxLength, hint }) => (
          <div key={key} className="space-y-1.5">
            <label className="text-[11px] font-semibold tracking-[0.1em] uppercase text-muted-foreground flex items-baseline justify-between gap-2">
              {label}
              {!errors[key] && hint && <span className="text-[10px] normal-case font-normal tracking-normal text-muted-foreground/50">{hint}</span>}
            </label>
            <input
              type="text"
              value={form[key]}
              onChange={(e) => onChange(key, e.target.value)}
              maxLength={maxLength}
              className={cn(
                "w-full border bg-background px-3 py-2.5 text-sm focus:outline-none transition-colors",
                errors[key] ? "border-primary focus:border-primary" : "border-border focus:border-foreground",
              )}
            />
            {errors[key] && <p className="mt-1 text-[11px] text-primary">{errors[key]}</p>}
          </div>
        ))}
      </div>

      <label className="flex items-center gap-2 text-[12px] text-muted-foreground cursor-pointer select-none">
        <input
          type="checkbox"
          checked={saveToAccount}
          onChange={(e) => onSaveToAccountChange(e.target.checked)}
          className="size-3.5"
        />
        Save this address to my account
      </label>
    </div>
  );
}

// ─── Address section (saved + new) ────────────────────────────────────────────

function AddressSection({
  addresses,
  loadingAddresses,
  selectedId,
  onSelectSaved,
  showNewForm,
  onShowNewForm,
  newForm,
  onNewFormChange,
  saveToAccount,
  onSaveToAccountChange,
  newFormErrors,
}: {
  addresses: SavedAddress[];
  loadingAddresses: boolean;
  selectedId: string | null;
  onSelectSaved: (id: string) => void;
  showNewForm: boolean;
  onShowNewForm: () => void;
  newForm: AddressForm;
  onNewFormChange: (key: keyof AddressForm, value: string) => void;
  saveToAccount: boolean;
  onSaveToAccountChange: (v: boolean) => void;
  newFormErrors?: Partial<Record<keyof AddressForm, string>>;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-[11px] font-bold tracking-[0.22em] text-muted-foreground/60 uppercase">
        Delivery address
      </h2>

      {loadingAddresses && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 border border-border bg-muted/30 animate-pulse" />
          ))}
        </div>
      )}

      {!loadingAddresses && (
        <>
          {addresses.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {addresses.map((addr) => (
                <AddressCard
                  key={addr.id}
                  address={addr}
                  selected={selectedId === addr.id && !showNewForm}
                  onSelect={() => onSelectSaved(addr.id)}
                />
              ))}
            </div>
          )}

          {/* Add new address toggle */}
          <button
            type="button"
            onClick={onShowNewForm}
            className={cn(
              "flex w-full items-center gap-2.5 border px-4 py-3.5 text-left transition-colors",
              showNewForm
                ? "border-foreground"
                : "border-dashed border-border hover:border-foreground/40",
            )}
          >
            <Plus className={cn("size-3.5 shrink-0", showNewForm ? "text-foreground" : "text-muted-foreground/40")} />
            <span className={cn(
              "text-[11px] font-semibold tracking-[0.14em] uppercase",
              showNewForm ? "text-foreground" : "text-muted-foreground/50",
            )}>
              {addresses.length === 0 ? "Enter delivery address" : "Use a different address"}
            </span>
          </button>

          {showNewForm && (
            <NewAddressForm
              form={newForm}
              onChange={onNewFormChange}
              saveToAccount={saveToAccount}
              onSaveToAccountChange={onSaveToAccountChange}
              errors={newFormErrors}
            />
          )}
        </>
      )}
    </div>
  );
}

// ─── Order summary panel ──────────────────────────────────────────────────────

function CheckoutSummary({
  subtotal,
  couponCode,
  couponDiscount,
  shippingRate,
  shippingLoading,
  estimatedDays,
  packageCount,
  pincode,
  freeShippingAbove,
  paying,
  onPay,
  walletBalance,
  payMethod,
  onPayMethodChange,
}: {
  subtotal: number;
  couponCode: string | null;
  couponDiscount: number | null;
  shippingRate: number | null;
  shippingLoading: boolean;
  estimatedDays: number | null;
  packageCount: number | null;
  pincode: string;
  freeShippingAbove: number;
  paying: boolean;
  onPay: () => void;
  walletBalance: number;
  payMethod: "razorpay" | "wallet";
  onPayMethodChange: (m: "razorpay" | "wallet") => void;
}) {
  const discount = couponDiscount ?? 0;
  const shipping = shippingRate ?? 0;
  const total = Math.max(0, subtotal - discount) + shipping;
  const needsPincode = pincode.length < 6;
  const isFreeShipping = subtotal >= freeShippingAbove;
  // Pincode complete, not loading, but no rate came back → not serviceable.
  // Free-shipping orders are always deliverable, so they're never "unavailable".
  const shippingUnavailable = !isFreeShipping && !needsPincode && !shippingLoading && shippingRate === null;
  const blocked = paying || shippingLoading || needsPincode || shippingUnavailable;

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
          <span className="tabular-nums">
            {subtotal >= freeShippingAbove
              ? <span className="text-green-600 font-semibold text-xs">Free</span>
              : needsPincode
              ? <span className="text-xs italic">Enter pincode</span>
              : shippingLoading
              ? <span className="animate-pulse">Calculating…</span>
              : shippingRate === null
              ? <span className="text-destructive text-xs">Not available</span>
              : formatInr(shippingRate)}
          </span>
        </div>

        {estimatedDays != null && pincode.length === 6 && !shippingLoading && (
          <div className="flex justify-between text-sm text-muted-foreground/60">
            <span>Estimated delivery</span>
            <span className="tabular-nums text-foreground/80 font-medium">
              {estimatedDays} {estimatedDays === 1 ? "day" : "days"}
            </span>
          </div>
        )}

        {/* Every bottle travels in its own box, so shipping is charged per parcel.
            Without this the multi-parcel rate reads as an error. */}
        {packageCount != null && packageCount > 1 && pincode.length === 6 && !shippingLoading && (
          <p className="text-[10.5px] text-muted-foreground/60 leading-relaxed border-t border-border/60 pt-3">
            Each fragrance is packed and shipped in its own box, so this order goes out as{" "}
            <span className="font-semibold text-foreground/80">{packageCount} separate packages</span>
            {isFreeShipping ? " — shipping is on us." : " and shipping is charged per package."} They may arrive on different days.
          </p>
        )}

        {subtotal < freeShippingAbove && (
          <p className="text-[10.5px] text-muted-foreground/50 border border-dashed border-border px-3 py-2 text-center">
            Add {formatInr(freeShippingAbove - subtotal)} more for free shipping
          </p>
        )}

        <div className="border-t border-border pt-4 flex justify-between">
          <span className="font-semibold text-base">Total</span>
          <div className="text-right">
            <span className="font-bold text-xl tabular-nums">
              {shippingLoading || needsPincode ? "—" : formatInr(total)}
            </span>
            <p className="text-[10px] text-muted-foreground/40 mt-0.5">Incl. of all taxes</p>
          </div>
        </div>
      </div>

      {/* Payment method */}
      <div className="px-6 pb-1">
        <p className="mb-2 text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground/60">Pay with</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onPayMethodChange("razorpay")}
            className={cn(
              "border px-3 py-2.5 text-left transition-colors",
              payMethod === "razorpay" ? "border-foreground bg-muted/40" : "border-border hover:border-foreground/40",
            )}
          >
            <span className="block text-[12px] font-semibold">Card / UPI</span>
            <span className="block text-[10px] text-muted-foreground">Razorpay</span>
          </button>
          {(() => {
            const enough = walletBalance >= total;
            return (
              <button
                type="button"
                disabled={!enough}
                onClick={() => enough && onPayMethodChange("wallet")}
                className={cn(
                  "border px-3 py-2.5 text-left transition-colors",
                  payMethod === "wallet" && enough ? "border-foreground bg-muted/40" : "border-border hover:border-foreground/40",
                  !enough && "opacity-50 cursor-not-allowed",
                )}
              >
                <span className="block text-[12px] font-semibold">Wallet</span>
                <span className="block text-[10px] tabular-nums text-muted-foreground">
                  {formatInr(walletBalance)}{!enough && " · low"}
                </span>
              </button>
            );
          })()}
        </div>
        {payMethod === "wallet" && walletBalance >= total && (
          <p className="mt-2 text-[11px] text-muted-foreground">Paid instantly from your wallet balance.</p>
        )}
      </div>

      <div className="px-6 pb-6 pt-4 space-y-3">
        <button
          type="button"
          disabled={blocked}
          onClick={onPay}
          className={cn(
            "w-full py-4 text-[11px] font-bold tracking-[0.26em] uppercase transition-all",
            blocked
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-foreground text-background hover:opacity-85",
          )}
        >
          {paying
            ? "Processing…"
            : shippingLoading
            ? "Calculating shipping…"
            : shippingUnavailable
            ? "Delivery unavailable"
            : `Pay ${needsPincode ? "—" : formatInr(total)}`}
        </button>
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/40">
          <Lock className="size-3" />
          <span>{payMethod === "wallet" ? "Paid from Azimuth wallet" : "Secured by Razorpay"} · GST invoice included</span>
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

  // Saved addresses
  const { data: savedAddresses, isLoading: loadingAddresses } = trpc.userData.listAddresses.useQuery(
    undefined,
    { enabled: !!session },
  );
  const addAddressMut = trpc.userData.addAddress.useMutation();

  // Which saved address is selected (null = show new form)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState<AddressForm>({ ...EMPTY_FORM });
  const [newFormErrors, setNewFormErrors] = useState<Partial<Record<keyof AddressForm, string>>>({});
  const [saveToAccount, setSaveToAccount] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payMethod, setPayMethod] = useState<"razorpay" | "wallet">("razorpay");
  const walletQuery = trpc.wallet.get.useQuery();
  const walletBalance = walletQuery.data?.balance ?? 0;
  const newFormRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();
  const createOrder = trpc.order.create.useMutation();
  const createRazorpayOrder = trpc.payment.createRazorpayOrder.useMutation();
  const verifyPayment = trpc.payment.verifyAndConfirmPayment.useMutation();
  const markAbandoned = trpc.payment.markPaymentAbandoned.useMutation();

  // Auto-select default address once loaded
  useEffect(() => {
    if (!savedAddresses) return;
    if (savedAddresses.length === 0) {
      setShowNewForm(true);
      return;
    }
    const def = savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0];
    if (def) setSelectedId(def.id);
  }, [savedAddresses]);

  // Pre-fill new form name from session
  useEffect(() => {
    if (session?.user?.name) {
      setNewForm((prev) => ({ ...prev, fullName: prev.fullName || session.user.name || "" }));
    }
  }, [session]);

  function setNewFormField(key: keyof AddressForm, value: string) {
    setNewForm((prev) => ({ ...prev, [key]: value }));
    if (newFormErrors[key]) setNewFormErrors((p) => { const n = { ...p }; delete n[key]; return n; });
  }

  function handleSelectSaved(id: string) {
    setSelectedId(id);
    setShowNewForm(false);
  }

  function handleShowNewForm() {
    setShowNewForm(true);
    setSelectedId(null);
  }

  const items = cart.items;
  const subtotal = cartSubtotal(items);
  const discount = cart.couponDiscount ?? 0;

  // Derive current pincode from whichever address is active
  const currentPincode = useMemo(() => {
    if (showNewForm) return newForm.pincode;
    const saved = (savedAddresses ?? []).find((a) => a.id === selectedId);
    return saved?.pincode ?? "";
  }, [showNewForm, newForm.pincode, savedAddresses, selectedId]);

  const settingsQuery = trpc.settings.get.useQuery(undefined, { staleTime: 10 * 60 * 1000 });
  const freeShippingAbove = settingsQuery.data?.freeShippingAboveInr ?? 999;

  const shippingQuery = trpc.order.estimateShipping.useQuery(
    { pincode: currentPincode, subtotal, items: items.map((i) => ({ variantId: i.variantId, sizeMl: i.sizeMl, quantity: i.quantity })) },
    { enabled: currentPincode.length === 6, staleTime: 5 * 60 * 1000 },
  );

  // null = serviceable rate; null = not available/loading
  const shippingRate: number | null =
    shippingQuery.data?.available ? shippingQuery.data.chargeInr : null;
  const estimatedDays: number | null = shippingQuery.data?.estimatedDays ?? null;
  const packageCount: number | null = shippingQuery.data?.packageCount ?? null;
  const shippingLoading = currentPincode.length === 6 && shippingQuery.isLoading;

  const shippingForOrder = shippingRate ?? 0;
  const total = Math.max(0, subtotal - discount) + shippingForOrder;

  function resolveShippingAddress(): AddressForm | null {
    if (showNewForm) return newForm;
    const saved = (savedAddresses ?? []).find((a) => a.id === selectedId);
    if (saved) return addressToForm(saved);
    return null;
  }

  function validateAddress(addr: AddressForm): boolean {
    return !!(
      addr.fullName.trim() &&
      addr.phone.trim() &&
      addr.line1.trim() &&
      addr.city.trim() &&
      addr.state.trim() &&
      addr.pincode.trim()
    );
  }

  async function handlePay() {
    // Wallet only if the customer chose it AND the balance covers the order.
    const method: "razorpay" | "wallet" = payMethod === "wallet" && walletBalance >= total ? "wallet" : "razorpay";

    const addr = resolveShippingAddress();

    if (!addr) {
      toast.error("Select a delivery address");
      return;
    }

    if (!validateAddress(addr)) {
      if (showNewForm) {
        const errs: Partial<Record<keyof AddressForm, string>> = {};
        if (!addr.fullName.trim()) errs.fullName = "Required";
        if (!addr.phone.trim()) errs.phone = "Required";
        else if (!/^\d{10}$/.test(addr.phone.replace(/[\s-]/g, ""))) errs.phone = "Enter a valid 10-digit number";
        if (!addr.line1.trim()) errs.line1 = "Required";
        if (!addr.city.trim()) errs.city = "Required";
        if (!addr.state.trim()) errs.state = "Required";
        if (!addr.pincode.trim()) errs.pincode = "Required";
        else if (!/^\d{6}$/.test(addr.pincode)) errs.pincode = "Enter a valid 6-digit pincode";
        setNewFormErrors(errs);
        newFormRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else {
        toast.error("Fill in all required address fields");
      }
      return;
    }

    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    if (shippingLoading) {
      toast.error("Calculating shipping cost, please wait…");
      return;
    }

    // Fail-closed: only proceed when delivery is positively confirmed available —
    // free-shipping orders, or a successful quote marked available. A query error
    // or an "unavailable" result blocks payment rather than silently charging.
    const shippingConfirmed =
      subtotal >= freeShippingAbove ||
      (shippingQuery.isSuccess && shippingQuery.data?.available === true);
    if (addr.pincode.length === 6 && !shippingConfirmed) {
      toast.error("Delivery isn't available to this pincode right now. Please try a different address or check back shortly.");
      return;
    }

    setPaying(true);
    let createdOrderId: string | null = null;
    try {
      // Optionally save new address to account first
      if (showNewForm && saveToAccount) {
        await addAddressMut.mutateAsync({
          label: addr.label,
          fullName: addr.fullName.trim(),
          phone: addr.phone.trim(),
          line1: addr.line1.trim(),
          line2: addr.line2.trim() || undefined,
          city: addr.city.trim(),
          state: addr.state.trim(),
          pincode: addr.pincode.trim(),
          isDefault: (savedAddresses ?? []).length === 0,
        });
        await utils.userData.listAddresses.invalidate();
      }

      // 1. Load Razorpay script (bank/card only — wallet needs no gateway)
      if (method === "razorpay") {
        const scriptLoaded = await loadRazorpayScript();
        if (!scriptLoaded) {
          toast.error("Could not load payment gateway. Check your connection.");
          return;
        }
      }

      // 2. Create order in DB
      const order = await createOrder.mutateAsync({
        paymentMethod: method,
        shippingAddress: {
          fullName: addr.fullName.trim(),
          phone: addr.phone.trim(),
          line1: addr.line1.trim(),
          line2: addr.line2.trim() || null,
          city: addr.city.trim(),
          state: addr.state.trim(),
          pincode: addr.pincode.trim(),
        },
        items: items.map((item) => ({
          variantId: item.variantId,
          productName: item.productName,
          variantSku: item.variantSku,
          sizeMl: item.sizeMl,
          unitPrice: item.effectivePrice,
          mrp: item.mrp,
          quantity: item.quantity,
          imageUrl: item.imageUrl ?? null,
        })),
        subtotal,
        discountAmount: discount,
        shippingCharge: shippingForOrder,
        taxAmount: 0,
        total,
        couponId: cart.couponId ?? null,
        couponCode: cart.couponCode ?? null,
      });
      createdOrderId = order.id;

      // Wallet order is already paid + booked server-side — no gateway step.
      if (method === "wallet") {
        await Promise.all([utils.order.list.invalidate(), utils.wallet.get.invalidate(), utils.wallet.transactions.invalidate()]);
        toast.success("Paid from wallet! Redirecting to your orders…");
        router.push("/account?tab=orders");
        return;
      }

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
            name: addr.fullName.trim(),
            contact: addr.phone.trim(),
            email: session?.user?.email ?? "",
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
      if (msg === "Payment cancelled") {
        // User dismissed the Razorpay window — close out the order right away
        // (server re-checks Razorpay first, so an in-flight UPI payment is never failed)
        if (createdOrderId) {
          markAbandoned.mutate(
            { orderId: createdOrderId },
            { onSettled: () => utils.order.list.invalidate() },
          );
        }
        toast.info("Payment cancelled — your cart is untouched.");
      } else if (msg) {
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

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px] lg:gap-14 items-start">
          {/* Left: address + items */}
          <div className="space-y-10">
            <AddressSection
              addresses={(savedAddresses ?? []) as SavedAddress[]}
              loadingAddresses={loadingAddresses}
              selectedId={selectedId}
              onSelectSaved={handleSelectSaved}
              showNewForm={showNewForm}
              onShowNewForm={handleShowNewForm}
              newForm={newForm}
              onNewFormChange={setNewFormField}
              saveToAccount={saveToAccount}
              onSaveToAccountChange={setSaveToAccount}
              newFormErrors={newFormErrors}
            />

            {/* Items preview */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-[11px] font-bold tracking-[0.22em] text-muted-foreground/60 uppercase">
                  Items ({items.length})
                </h2>
              </div>
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
                        {CONCENTRATION_LABEL[item.concentration] ?? item.concentration} · {item.sizeMl}ml · qty {item.quantity}
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums shrink-0">
                      {formatInr(item.effectivePrice * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected address confirmation (mobile: show below items) */}
            {!showNewForm && selectedId && (
              <div className="lg:hidden border border-border p-4 flex gap-3">
                <MapPin className="size-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                <div className="text-sm">
                  {(() => {
                    const a = (savedAddresses ?? []).find((x) => x.id === selectedId);
                    if (!a) return null;
                    return (
                      <>
                        <p className="font-medium">{a.fullName}</p>
                        <p className="text-muted-foreground/60 text-[12px] mt-0.5">
                          {a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} — {a.pincode}
                        </p>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Right: summary + pay */}
          <CheckoutSummary
            subtotal={subtotal}
            couponCode={cart.couponCode}
            couponDiscount={cart.couponDiscount}
            shippingRate={shippingRate}
            shippingLoading={shippingLoading}
            estimatedDays={estimatedDays}
            packageCount={packageCount}
            pincode={currentPincode}
            freeShippingAbove={freeShippingAbove}
            paying={paying}
            onPay={handlePay}
            walletBalance={walletBalance}
            payMethod={payMethod}
            onPayMethodChange={setPayMethod}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
