"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Info, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { AuthCard } from "@/components/auth-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { authClient } from "@/lib/auth-client";
import { formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const TXN_LABEL: Record<string, string> = {
  topup: "Top-up",
  order_payment: "Order payment",
  refund_credit: "Refund credit",
  reversal: "Reversal",
  adjustment: "Adjustment",
};

const rupee = (n: number) =>
  `₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-border bg-background px-2.5 py-2 text-[13px] focus:border-foreground focus:outline-none"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </div>
  );
}

export default function WalletPage() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return null;

  if (!session) {
    return (
      <>
        <SiteHeader />
        <main className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6">
          <p className="text-sm text-muted-foreground">Sign in to view your wallet.</p>
          <AuthCard next="/wallet" />
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[900px] px-4 md:px-6 py-8 md:py-14 pb-24">
        <Link
          href="/account"
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] uppercase text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="size-3.5" /> Account
        </Link>
        <WalletView userEmail={session.user.email} userName={session.user.name ?? undefined} />
      </main>
      <SiteFooter />
    </>
  );
}

function WalletView({ userEmail, userName }: { userEmail?: string; userName?: string }) {
  const PAGE = 20;
  const utils = trpc.useUtils();
  const wallet = trpc.wallet.get.useQuery();
  const createTopup = trpc.wallet.createTopupOrder.useMutation();
  const verifyTopup = trpc.wallet.verifyTopup.useMutation();

  // ── Transaction filters + pagination ──────────────────────────────────────
  const [page, setPage] = useState(0);
  const [direction, setDirection] = useState<"all" | "credit" | "debit">("all");
  const [source, setSource] = useState<"all" | "bank" | "wallet">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // "Bank" = money that entered from a bank/card (top-ups); "Wallet" = in-app movements.
  const typesForSource =
    source === "bank"
      ? (["topup"] as const)
      : source === "wallet"
        ? (["order_payment", "refund_credit", "reversal", "adjustment"] as const)
        : undefined;

  const txns = trpc.wallet.transactions.useQuery({
    limit: PAGE,
    offset: page * PAGE,
    direction: direction === "all" ? undefined : direction,
    types: typesForSource ? [...typesForSource] : undefined,
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(`${dateTo}T23:59:59`) : undefined,
  });

  const total = txns.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE));
  const hasFilters = direction !== "all" || source !== "all" || !!dateFrom || !!dateTo;

  // Any filter change resets to the first page.
  function resetTo(fn: () => void) {
    fn();
    setPage(0);
  }

  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const firstName = userName?.trim().split(/\s+/)[0] || "Your";
  const minTopup = wallet.data?.minTopup ?? 500;
  const balance = wallet.data?.balance ?? 0;
  const amountNum = Number(amount);
  const canTopup = Number.isFinite(amountNum) && amountNum >= minTopup && !busy;

  async function handleTopup() {
    if (!canTopup) return;
    setBusy(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) {
        toast.error("Could not load payment. Check your connection.");
        return;
      }
      const data = await createTopup.mutateAsync({ amountInr: Math.round(amountNum) });

      await new Promise<void>((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rzp = new (window as any).Razorpay({
          key: data.keyId,
          amount: data.amount,
          currency: data.currency,
          name: "Azimuth Perfumers",
          description: "Wallet top-up",
          order_id: data.razorpayOrderId,
          prefill: { name: userName ?? "", email: userEmail ?? "" },
          theme: { color: "#1B1611" },
          modal: { ondismiss: () => reject(new Error("cancelled")) },
          handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
            try {
              await verifyTopup.mutateAsync({
                topupId: data.topupId,
                razorpayOrderId: r.razorpay_order_id,
                razorpayPaymentId: r.razorpay_payment_id,
                razorpaySignature: r.razorpay_signature,
              });
              resolve();
            } catch (e) {
              reject(e);
            }
          },
        });
        rzp.open();
      });

      setAmount("");
      toast.success("Wallet topped up");
      await Promise.all([utils.wallet.get.invalidate(), utils.wallet.transactions.invalidate()]);
    } catch (e) {
      const msg = (e as { message?: string })?.message;
      if (msg !== "cancelled") toast.error(msg ?? "Top-up failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-10">
      {/* ── Balance — the "membership card" ─────────────────────────────────── */}
      <section>
        <p className="mb-1 text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">Azimuth</p>
        <div className="flex items-start gap-2.5">
          <h1 className="font-heading text-4xl font-medium leading-tight md:text-5xl">{firstName}&rsquo;s Wallet</h1>
          {/* Info affordance — hover/focus reveals a short note + link to the full policy */}
          <div className="group relative mt-2">
            <button
              type="button"
              aria-label="About the wallet"
              className="flex size-6 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:text-foreground focus:outline-none focus-visible:text-foreground"
            >
              <Info className="size-4" />
            </button>
            <div className="pointer-events-none absolute left-0 top-full z-30 mt-2 w-72 rounded-lg border border-border bg-background p-4 text-left opacity-0 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.35)] transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                Wallet balance is store credit. It is{" "}
                <span className="font-medium text-foreground">non-refundable</span>, cannot be withdrawn or
                transferred to a bank, and is spendable only at checkout. Top-ups start at ₹500.
              </p>
              <Link
                href="/wallet/policy"
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary hover:underline"
              >
                Read the full policy →
              </Link>
            </div>
          </div>
        </div>

        <div className="relative mt-6 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-background to-accent/50 p-8 md:p-10">
          {/* faint compass watermark */}
          <Image
            src="/logo-icon.png"
            alt=""
            width={1010}
            height={1019}
            className="pointer-events-none absolute -bottom-12 -right-10 h-60 w-auto opacity-[0.04] select-none"
          />

          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="h-px w-6 bg-primary" />
              <p className="text-[10px] font-semibold tracking-[0.28em] uppercase text-primary">Available balance</p>
            </div>
            <p className="mt-4 text-6xl font-medium leading-none tabular-nums text-foreground md:text-7xl">
              {rupee(balance)}
            </p>
            <div className="mt-7 flex items-center gap-2 text-muted-foreground">
              <ShieldCheck className="size-3.5 text-primary" />
              <p className="text-[11px] leading-relaxed">
                Store credit — spendable at checkout. It can never be withdrawn or moved to a bank.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Add money ───────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-heading text-xl font-medium">Add money</h2>
          <span className="text-[11px] text-muted-foreground">Minimum ₹{minTopup}</span>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-2 block text-[10px] font-semibold tracking-[0.16em] uppercase text-muted-foreground">
              Amount
            </label>
            <div className="flex items-center border-b-2 border-foreground/80 focus-within:border-primary transition-colors">
              <span className="pb-2 pr-1 text-2xl text-muted-foreground tabular-nums">₹</span>
              <input
                type="number"
                inputMode="numeric"
                min={minTopup}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full bg-transparent pb-2 text-2xl font-medium tabular-nums focus:outline-none placeholder:text-muted-foreground/30"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[500, 1000, 2000, 5000].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(String(v))}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-all",
                    amountNum === v
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
                  )}
                >
                  ₹{v.toLocaleString("en-IN")}
                </button>
              ))}
            </div>
            {amount && amountNum < minTopup && (
              <p className="mt-2 text-[11px] text-primary">Minimum top-up is ₹{minTopup}.</p>
            )}
          </div>

          <button
            onClick={handleTopup}
            disabled={!canTopup}
            className="h-[52px] shrink-0 bg-primary px-8 text-[11px] font-semibold tracking-[0.2em] uppercase text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed sm:min-w-[180px]"
          >
            {busy ? "Processing…" : "Add money"}
          </button>
        </div>
      </section>

      {/* ── Transactions ────────────────────────────────────────────────────── */}
      <section>
        <h2 className="font-heading text-xl font-medium mb-4">Transactions</h2>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border/70 bg-accent/20 p-4">
          <FilterSelect
            label="Direction"
            value={direction}
            onChange={(v) => resetTo(() => setDirection(v as typeof direction))}
            options={[["all", "All"], ["credit", "Credit (in)"], ["debit", "Debit (out)"]]}
          />
          <FilterSelect
            label="Source"
            value={source}
            onChange={(v) => resetTo(() => setSource(v as typeof source))}
            options={[["all", "All"], ["bank", "From bank (top-ups)"], ["wallet", "In-app (spend / refund)"]]}
          />
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">From</label>
            <input type="date" value={dateFrom} onChange={(e) => resetTo(() => setDateFrom(e.target.value))}
              className="border border-border bg-background px-2.5 py-2 text-[13px] focus:border-foreground focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">To</label>
            <input type="date" value={dateTo} onChange={(e) => resetTo(() => setDateTo(e.target.value))}
              className="border border-border bg-background px-2.5 py-2 text-[13px] focus:border-foreground focus:outline-none" />
          </div>
          {hasFilters && (
            <button
              onClick={() => resetTo(() => { setDirection("all"); setSource("all"); setDateFrom(""); setDateTo(""); })}
              className="ml-auto text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>

        {txns.isLoading ? (
          <p className="py-8 text-center text-[13px] text-muted-foreground">Loading…</p>
        ) : (txns.data?.items.length ?? 0) === 0 ? (
          <div className="rounded-xl border border-border/70 bg-accent/30 py-14 text-center">
            <p className="font-heading text-lg text-foreground/80">{hasFilters ? "No matching transactions" : "No activity yet"}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {hasFilters ? "Try widening the date range or clearing filters." : "Add money above, or receive a refund straight to your wallet."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-border/70">
              {txns.data!.items.map((t, i) => {
                const amt = Number(t.amount);
                const credit = amt >= 0;
                return (
                  <div
                    key={t.id}
                    className={cn(
                      "flex items-center gap-4 bg-background px-5 py-4 transition-colors hover:bg-accent/30",
                      i > 0 && "border-t border-border/60",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-full",
                        credit ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {credit ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium">{TXN_LABEL[t.type] ?? t.type}</p>
                      {t.note && <p className="truncate text-[12px] text-muted-foreground">{t.note}</p>}
                      <p className="text-[11px] text-muted-foreground/50">{formatDate(t.createdAt)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={cn("text-base font-semibold tabular-nums", credit ? "text-emerald-700" : "text-foreground")}>
                        {credit ? "+" : "−"}{rupee(amt)}
                      </p>
                      <p className="text-[11px] text-muted-foreground/50 tabular-nums">Balance {rupee(Number(t.balanceAfter))}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {pageCount > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-[12px] text-muted-foreground tabular-nums">
                  Page {page + 1} of {pageCount} · {total} total
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="border border-border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors hover:border-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    disabled={page >= pageCount - 1}
                    className="border border-border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors hover:border-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
