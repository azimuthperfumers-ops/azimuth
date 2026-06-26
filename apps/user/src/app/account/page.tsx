"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ChevronRight, Heart, LogOut, MapPin, Package, User } from "lucide-react";
import { toast } from "sonner";

import { AuthCard } from "@/components/auth-card";
import { ProductCard } from "@/components/product-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

// ─── Shared primitives ──────────────────────────────────────────────────────

function SectionEmpty({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Icon className="mb-4 size-8 text-muted-foreground/30" strokeWidth={1.2} />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-[13px] text-muted-foreground">{sub}</p>
    </div>
  );
}

// ─── Personal info tab ───────────────────────────────────────────────────────

function PersonalInfoTab({ user }: { user: { name: string; email: string; image?: string | null; phone?: string | null } }) {
  const [name, setName] = useState(user.name ?? "");
  const [phone, setPhone] = useState((user as any).phone ?? "");
  const [pending, setPending] = useState(false);

  const isDirty = name.trim() !== user.name || phone.trim() !== ((user as any).phone ?? "");

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    const { error } = await (authClient as any).updateUser({
      name: name.trim(),
      phone: phone.trim() || null,
    });
    setPending(false);
    if (error) toast.error(error.message ?? "Update failed");
    else toast.success("Profile updated");
  }

  return (
    <div className="max-w-md space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Personal information</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">Update your name and contact details.</p>
      </div>

      <form onSubmit={onSave} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">
            Full name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-foreground focus:outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">
            Phone number
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            className="w-full border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-foreground focus:outline-none"
          />
          <p className="text-[11px] text-muted-foreground/50">Used for order delivery updates.</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">
            Email
          </label>
          <input
            type="email"
            value={user.email}
            disabled
            className="w-full border border-border bg-muted px-3 py-2.5 text-sm text-muted-foreground"
          />
          <p className="text-[11px] text-muted-foreground/50">Email cannot be changed here.</p>
        </div>

        <button
          type="submit"
          disabled={pending || !isDirty}
          className={cn(
            "border px-6 py-2.5 text-[11px] font-semibold tracking-[0.18em] uppercase transition-all",
            pending || !isDirty
              ? "border-border text-muted-foreground cursor-not-allowed"
              : "border-foreground bg-foreground text-background hover:bg-transparent hover:text-foreground",
          )}
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}

// ─── Addresses tab ───────────────────────────────────────────────────────────

type Address = {
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

function AddressCard({
  address,
  onDelete,
  onSetDefault,
}: {
  address: Address;
  onDelete: () => void;
  onSetDefault: () => void;
}) {
  return (
    <div className={cn("border p-5 space-y-2 relative", address.isDefault && "border-foreground")}>
      {address.isDefault && (
        <span className="absolute right-3 top-3 text-[9px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">
          Default
        </span>
      )}
      <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">
        {address.label}
      </p>
      <p className="text-sm font-semibold">{address.fullName}</p>
      <p className="text-[13px] text-muted-foreground">
        {address.line1}{address.line2 ? `, ${address.line2}` : ""}
        <br />
        {address.city}, {address.state} — {address.pincode}
        <br />
        {address.phone}
      </p>
      <div className="flex gap-4 pt-1">
        {!address.isDefault && (
          <button
            onClick={onSetDefault}
            className="text-[11px] font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Set as default
          </button>
        )}
        <button
          onClick={onDelete}
          className="text-[11px] font-semibold text-muted-foreground underline underline-offset-2 hover:text-primary"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function AddAddressForm({ onDone }: { onDone: () => void }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    label: "Home", fullName: "", phone: "", line1: "", line2: "",
    city: "", state: "", pincode: "", isDefault: false,
  });

  const add = (trpc as any).userData?.addAddress?.useMutation({
    onSuccess: async () => {
      await (utils as any).userData?.listAddresses?.invalidate();
      toast.success("Address saved");
      onDone();
    },
    onError: (err: any) => toast.error(err.message),
  });

  function f(key: string, val: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  if (!add) {
    return <p className="text-sm text-muted-foreground">Address management coming soon.</p>;
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); add.mutate(form); }}
      className="space-y-4 border border-border p-5"
    >
      <p className="text-sm font-semibold">New address</p>
      <div className="grid grid-cols-2 gap-3">
        {["Home", "Work", "Other"].map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => f("label", l)}
            className={cn(
              "border px-3 py-2 text-[11px] font-semibold tracking-[0.1em] uppercase transition-colors",
              form.label === l ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/40",
            )}
          >
            {l}
          </button>
        ))}
      </div>
      {[
        { key: "fullName", label: "Full name", type: "text" },
        { key: "phone", label: "Phone", type: "tel" },
        { key: "line1", label: "Address line 1", type: "text" },
        { key: "line2", label: "Address line 2 (optional)", type: "text" },
        { key: "city", label: "City", type: "text" },
        { key: "state", label: "State", type: "text" },
        { key: "pincode", label: "Pincode", type: "text" },
      ].map(({ key, label, type }) => (
        <div key={key} className="space-y-1.5">
          <label className="text-[11px] font-semibold tracking-[0.1em] uppercase text-muted-foreground">{label}</label>
          <input
            type={type}
            value={(form as any)[key]}
            onChange={(e) => f(key, e.target.value)}
            required={key !== "line2"}
            className="w-full border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none"
          />
        </div>
      ))}
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={form.isDefault} onChange={(e) => f("isDefault", e.target.checked)} />
        Set as default address
      </label>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={add.isPending}
          className="border border-foreground bg-foreground px-5 py-2.5 text-[11px] font-semibold tracking-[0.14em] text-background uppercase hover:bg-transparent hover:text-foreground transition-all"
        >
          {add.isPending ? "Saving…" : "Save address"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="border border-border px-5 py-2.5 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase hover:border-foreground hover:text-foreground transition-all"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function AddressesTab() {
  const [adding, setAdding] = useState(false);
  const utils = trpc.useUtils();

  const addressQuery = (trpc as any).userData?.listAddresses?.useQuery();
  const addresses: Address[] = addressQuery?.data ?? [];

  const deleteAddr = (trpc as any).userData?.deleteAddress?.useMutation({
    onSuccess: async () => { await (utils as any).userData?.listAddresses?.invalidate(); toast.success("Address removed"); },
    onError: (err: any) => toast.error(err.message),
  });

  const setDefault = (trpc as any).userData?.setDefaultAddress?.useMutation({
    onSuccess: async () => { await (utils as any).userData?.listAddresses?.invalidate(); toast.success("Default updated"); },
    onError: (err: any) => toast.error(err.message),
  });

  const available = !!(trpc as any).userData?.listAddresses;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Addresses</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">Saved delivery addresses.</p>
        </div>
        {available && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="border border-foreground px-4 py-2 text-[10.5px] font-semibold tracking-[0.16em] uppercase transition-all hover:bg-foreground hover:text-background"
          >
            + Add address
          </button>
        )}
      </div>

      {adding && <AddAddressForm onDone={() => setAdding(false)} />}

      {!available && !adding && (
        <SectionEmpty icon={MapPin} title="Address management coming soon" sub="You'll be able to save delivery addresses here." />
      )}

      {available && !adding && addresses.length === 0 && !addressQuery?.isLoading && (
        <SectionEmpty icon={MapPin} title="No saved addresses" sub="Add an address for faster checkout." />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {addresses.map((addr) => (
          <AddressCard
            key={addr.id}
            address={addr}
            onDelete={() => deleteAddr?.mutate({ id: addr.id })}
            onSetDefault={() => setDefault?.mutate({ id: addr.id })}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Orders tab ──────────────────────────────────────────────────────────────

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending_payment: "Awaiting payment",
  paid: "Payment confirmed",
  processing: "Processing",
  picked_up: "Picked up by courier",
  out_for_delivery: "Out for delivery",
  delivery_attempted: "Delivery attempted",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
  rto_initiated: "Return in transit",
  rto_delivered: "Return delivered",
};

const ORDER_STATUS_COLOR: Record<string, string> = {
  pending_payment: "text-yellow-600",
  paid: "text-blue-600",
  processing: "text-blue-600",
  picked_up: "text-blue-600",
  out_for_delivery: "text-indigo-600",
  delivery_attempted: "text-orange-500",
  shipped: "text-indigo-600",
  delivered: "text-green-600",
  cancelled: "text-red-500",
  refunded: "text-muted-foreground",
  rto_initiated: "text-orange-500",
  rto_delivered: "text-muted-foreground",
};

function formatInr(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function OrdersTab() {
  const { data: orders, isLoading } = trpc.order.list.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Orders</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">Your purchase history.</p>
      </div>

      {isLoading && (
        <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground/40 uppercase animate-pulse">
          Loading…
        </p>
      )}

      {!isLoading && (!orders || orders.length === 0) && (
        <>
          <SectionEmpty
            icon={Package}
            title="No orders yet"
            sub="Your orders will appear here once you've made a purchase."
          />
          <div className="text-center">
            <Link
              href="/shop"
              className="inline-flex border border-foreground px-8 py-3 text-[11px] font-semibold tracking-[0.18em] uppercase transition-all hover:bg-foreground hover:text-background"
            >
              Shop the collection
            </Link>
          </div>
        </>
      )}

      {orders && orders.length > 0 && (
        <div className="space-y-4">
          {orders.map((order) => (
            <Link key={order.id} href={`/orders/${order.id}`} className="block border border-border p-5 space-y-4 hover:border-foreground/40 transition-colors">
              {/* Order header */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground/50 uppercase mb-1">
                    Order
                  </p>
                  <p className="text-sm font-semibold font-mono">{order.orderNumber}</p>
                  <p className="text-[12px] text-muted-foreground/60 mt-0.5">
                    {new Date(order.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className={`text-[11px] font-bold tracking-[0.12em] uppercase ${ORDER_STATUS_COLOR[order.status] ?? "text-foreground"}`}>
                    {ORDER_STATUS_LABEL[order.status] ?? order.status}
                  </p>
                  <p className="text-xl font-bold tabular-nums mt-1">{formatInr(Number(order.total))}</p>
                  {order.delhiveryWaybill && order.trackingUrl && (
                    <a
                      href={order.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-semibold tracking-[0.1em] uppercase text-primary underline underline-offset-2 hover:opacity-70"
                    >
                      Track — {order.delhiveryWaybill}
                    </a>
                  )}
                </div>
              </div>

              {/* Items */}
              <div className="divide-y divide-border/50">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 py-2.5">
                    {item.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt={item.productName}
                        className="w-10 h-12 object-cover shrink-0 bg-muted"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.productName}</p>
                      <p className="text-[11px] text-muted-foreground/50">
                        {item.sizeMl}ml · qty {item.quantity}
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums shrink-0">
                      {formatInr(Number(item.lineTotal))}
                    </p>
                  </div>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Wishlist tab ─────────────────────────────────────────────────────────────

function WishlistTab() {
  const utils = trpc.useUtils();
  const wishlistQuery = (trpc as any).userData?.listWishlist?.useQuery();
  const items = wishlistQuery?.data ?? [];

  const remove = (trpc as any).userData?.removeFromWishlist?.useMutation({
    onSuccess: async () => { await (utils as any).userData?.listWishlist?.invalidate(); },
    onError: (err: any) => toast.error(err.message),
  });

  const available = !!(trpc as any).userData?.listWishlist;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Wishlist</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">Fragrances you've saved.</p>
      </div>

      {!available && (
        <SectionEmpty icon={Heart} title="Wishlist coming soon" sub="Save your favourite fragrances for later." />
      )}

      {available && items.length === 0 && !wishlistQuery?.isLoading && (
        <SectionEmpty icon={Heart} title="Your wishlist is empty" sub="Tap the ♡ on any fragrance to save it here." />
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3">
          {items.map((item: any) => {
            const product = item.product;
            if (!product) return null;
            return (
              <div key={item.id} className="relative">
                <ProductCard
                  product={{
                    id: product.id,
                    name: product.name,
                    slug: product.slug,
                    themeColor: product.themeColor ?? null,
                    concentration: product.concentration,
                    gender: product.gender,
                    category: product.category ?? null,
                    images: (product.images ?? []).map((i: any) => ({ url: i.url ?? "", isPrimary: !!i.isPrimary })),
                    variants: (product.variants ?? []).map((v: any) => ({
                      sellingPrice: String(v.sellingPrice ?? 0),
                      mrp: String(v.mrp ?? v.sellingPrice ?? 0),
                      status: v.status ?? "active",
                    })),
                  }}
                />
                <button
                  onClick={() => remove?.mutate({ id: item.id })}
                  className="absolute right-2 top-2 flex size-7 items-center justify-center border border-border bg-background/90 text-primary hover:bg-primary hover:text-primary-foreground backdrop-blur-sm transition-colors"
                  title="Remove from wishlist"
                >
                  <Heart className="size-3.5 fill-current" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tab nav ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: "info", label: "Personal info", icon: User },
  { id: "addresses", label: "Addresses", icon: MapPin },
  { id: "orders", label: "Orders", icon: Package },
  { id: "wishlist", label: "Wishlist", icon: Heart },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending } = authClient.useSession();

  const activeTab = (searchParams.get("tab") ?? "info") as TabId;

  function setTab(tab: TabId) {
    router.replace(`/account?tab=${tab}`, { scroll: false });
  }

  async function signOut() {
    await authClient.signOut();
    router.push("/");
  }

  if (isPending) return null;

  if (!session) {
    return (
      <>
        <SiteHeader />
        <main className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6">
          <AuthCard />
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1100px] px-4 md:px-8 py-8 md:py-12 pb-24">
        {/* Page header */}
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-border pb-8">
          <div>
            <p className="mb-1 text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              Account
            </p>
            <h1 className="font-heading text-4xl font-medium leading-tight">
              {session.user.name || "My Account"}
            </h1>
            <p className="mt-1.5 text-[13px] text-muted-foreground">{session.user.email}</p>
          </div>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 border border-border px-4 py-2.5 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:border-foreground hover:text-foreground"
          >
            <LogOut className="size-3.5" />
            Sign out
          </button>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-[200px_1fr] md:gap-12">
          {/* Sidebar nav */}
          <nav className="flex overflow-x-auto gap-1 pb-2 md:flex-col md:overflow-x-visible md:pb-0 md:space-y-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "flex shrink-0 w-auto md:w-full items-center gap-3 px-3 py-2.5 text-left text-[13px] font-medium transition-colors whitespace-nowrap",
                  activeTab === id
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                {label}
                {activeTab === id && <ChevronRight className="ml-auto size-3.5 opacity-40 hidden md:block" />}
              </button>
            ))}
          </nav>

          {/* Tab content */}
          <div className="min-h-[400px]">
            {activeTab === "info" && <PersonalInfoTab user={session.user} />}
            {activeTab === "addresses" && <AddressesTab />}
            {activeTab === "orders" && <OrdersTab />}
            {activeTab === "wishlist" && <WishlistTab />}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
