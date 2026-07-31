"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2, PackageX, TicketIcon, Wallet } from "lucide-react";
import { toast } from "sonner";

import { AuthCard } from "@/components/auth-card";
import { authClient } from "@/lib/auth-client";
import { orderStatusLabel } from "@/lib/order-status";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const rupee = (n: number) =>
  `₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

// ─── Presentational bits ─────────────────────────────────────────────────────

function Callout({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: "warning" | "danger";
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "border p-4 sm:p-5",
        tone === "danger" ? "border-primary/40 bg-primary/[0.04]" : "border-amber-500/40 bg-amber-500/[0.06]",
      )}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={cn("mt-0.5 size-4 shrink-0", tone === "danger" ? "text-primary" : "text-amber-600")}
          strokeWidth={1.6}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground">{title}</p>
          <div className="mt-1.5 space-y-2 text-[13px] leading-relaxed text-muted-foreground">{children}</div>
        </div>
      </div>
    </div>
  );
}

function BlockerRow({ label, sub, href }: { label: string; sub: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 border border-border px-3.5 py-3 transition-colors hover:border-foreground"
    >
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
      </div>
      <span className="shrink-0 text-[10px] font-semibold tracking-[0.16em] uppercase text-muted-foreground">
        View
      </span>
    </Link>
  );
}

// ─── Done state ──────────────────────────────────────────────────────────────

function DeletedConfirmation({ ordersRetained }: { ordersRetained: number }) {
  return (
    <div className="border border-border p-6 sm:p-8">
      <div className="flex size-9 items-center justify-center border border-foreground">
        <Check className="size-4" strokeWidth={1.8} />
      </div>
      <h2 className="mt-5 font-heading text-2xl font-medium">Your account has been deleted</h2>
      <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
        Your name, email, phone number, saved addresses, cart and wishlist have been erased, and you've been
        signed out everywhere.
        {ordersRetained > 0 && (
          <>
            {" "}
            {ordersRetained === 1 ? "One past order and its" : `${ordersRetained} past orders and their`} GST
            invoice{ordersRetained === 1 ? "" : "s"} remain in our accounting records, no longer linked to a
            named person — we're required to keep those.
          </>
        )}
      </p>
      <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
        You're welcome back any time; signing up again starts a fresh account.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex border border-foreground bg-foreground px-6 py-2.5 text-[11px] font-semibold tracking-[0.18em] uppercase text-background transition-all hover:bg-transparent hover:text-foreground"
      >
        Back to the shop
      </Link>
    </div>
  );
}

// ─── The flow ────────────────────────────────────────────────────────────────

function DeleteForm({ onDeleted }: { onDeleted: (ordersRetained: number) => void }) {
  const router = useRouter();
  const preview = trpc.user.deletionPreview.useQuery();

  const [confirmEmail, setConfirmEmail] = useState("");
  const [reason, setReason] = useState("");
  const [ackWallet, setAckWallet] = useState(false);

  const deleteAccount = trpc.user.deleteAccount.useMutation({
    onSuccess: async (result) => {
      // The server already dropped every session row; this just clears the
      // client-side cache and cookie, so a failure here is not worth surfacing.
      try {
        await authClient.signOut();
      } catch {
        /* already gone */
      }
      onDeleted(result.ordersRetained);
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  if (preview.isLoading) {
    return (
      <div className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Checking your account…
      </div>
    );
  }

  if (preview.error) {
    return (
      <Callout tone="danger" icon={AlertTriangle} title="We couldn't load your account">
        <p>{preview.error.message}</p>
      </Callout>
    );
  }

  const data = preview.data!;
  const { blockingOrders, openTickets, walletBalance, orderCount } = data;
  const isBlocked = !data.canDelete;
  const emailMatches = confirmEmail.trim().toLowerCase() === data.email.toLowerCase();
  const walletOk = walletBalance <= 0 || ackWallet;
  const canSubmit = !isBlocked && emailMatches && walletOk && !deleteAccount.isPending;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    deleteAccount.mutate({
      confirmEmail: confirmEmail.trim(),
      acknowledgeWalletForfeit: ackWallet,
      reason: reason.trim() || undefined,
    });
  }

  return (
    <div className="space-y-8">
      {/* Which account this is */}
      <div className="border border-border p-4 sm:p-5">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
          Signed in as
        </p>
        <p className="mt-1.5 text-[15px] font-medium break-all">{data.email}</p>
      </div>

      {/* Blockers — deletion is off the table until these land */}
      {isBlocked && (
        <div className="space-y-4">
          <Callout tone="warning" icon={AlertTriangle} title="You can't delete your account just yet">
            <p>
              We still owe you something, and settling it needs your name, address and a way to reach you.
              Once everything below is closed, come back here and the delete button will work.
            </p>
          </Callout>

          {blockingOrders.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">
                <PackageX className="size-3.5" /> Orders in progress
              </p>
              {blockingOrders.map((order) => (
                <BlockerRow
                  key={order.id}
                  href={`/orders/${order.id}`}
                  label={order.orderNumber}
                  sub={orderStatusLabel(order.status)}
                />
              ))}
            </div>
          )}

          {openTickets.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">
                <TicketIcon className="size-3.5" /> Open support requests
              </p>
              {openTickets.map((ticket) => (
                <BlockerRow
                  key={ticket.id}
                  href={`/support/${ticket.id}`}
                  label={ticket.subject}
                  sub={`${ticket.ticketNumber} · ${ticket.status.replace(/_/g, " ")}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Wallet credit is lost, not refunded — say so before anything else */}
      {!isBlocked && walletBalance > 0 && (
        <Callout tone="warning" icon={Wallet} title={`You still have ${rupee(walletBalance)} in wallet credit`}>
          <p>
            Store credit can't be transferred out or paid back to a bank, so deleting your account leaves it
            behind. If you'd rather use it,{" "}
            <Link href="/shop" className="text-primary hover:underline">
              spend it on an order
            </Link>{" "}
            first — your account will still be here afterwards.
          </p>
          <label className="mt-1 flex cursor-pointer items-start gap-2.5 pt-1">
            <input
              type="checkbox"
              checked={ackWallet}
              onChange={(e) => setAckWallet(e.target.checked)}
              className="mt-0.5 size-3.5 shrink-0"
            />
            <span className="text-[13px] text-foreground">
              I understand my {rupee(walletBalance)} of store credit will be lost.
            </span>
          </label>
        </Callout>
      )}

      {/* The irreversible part */}
      {!isBlocked && (
        <form onSubmit={onSubmit} className="space-y-6">
          <Callout tone="danger" icon={AlertTriangle} title="This cannot be undone">
            <p>
              There is no recovery window and no way to restore the account afterwards.
              {orderCount > 0 && (
                <>
                  {" "}
                  Your {orderCount === 1 ? "past order" : `${orderCount} past orders`} and the GST invoice
                  {orderCount === 1 ? "" : "s"} behind {orderCount === 1 ? "it" : "them"} stay in our
                  accounting records — the law requires it — but they stop being linked to a named person.
                </>
              )}
            </p>
          </Callout>

          <div className="space-y-1.5">
            <label
              htmlFor="confirm-email"
              className="block text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground"
            >
              Type <span className="text-foreground">{data.email}</span> to confirm
            </label>
            <input
              id="confirm-email"
              type="email"
              autoComplete="off"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-foreground focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="delete-reason"
              className="block text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground"
            >
              Why are you leaving? <span className="normal-case tracking-normal opacity-60">(optional)</span>
            </label>
            <textarea
              id="delete-reason"
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Anything you'd like us to know."
              className="w-full resize-y border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-foreground focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              "inline-flex items-center gap-2 border px-6 py-3 text-[11px] font-semibold tracking-[0.18em] uppercase transition-all",
              canSubmit
                ? "border-primary bg-primary text-primary-foreground hover:bg-transparent hover:text-primary"
                : "cursor-not-allowed border-border text-muted-foreground",
            )}
          >
            {deleteAccount.isPending && <Loader2 className="size-3.5 animate-spin" />}
            {deleteAccount.isPending ? "Deleting…" : "Delete my account permanently"}
          </button>

          {!emailMatches && confirmEmail.length > 0 && (
            <p className="text-[12px] text-primary">That doesn't match the email on this account.</p>
          )}
        </form>
      )}
    </div>
  );
}

// ─── Entry point ─────────────────────────────────────────────────────────────

/**
 * The delete-account flow. Rendered both on the standalone /delete-account page
 * (the public URL the Play Store listing points at) and inside the account area,
 * so the two can never drift apart.
 *
 * Signed-out visitors get the sign-in card rather than a dead end — the page
 * around this component explains the policy without needing an account.
 */
export function DeleteAccountPanel() {
  const { data: session, isPending } = authClient.useSession();
  const [deletedOrders, setDeletedOrders] = useState<number | null>(null);

  if (deletedOrders !== null) return <DeletedConfirmation ordersRetained={deletedOrders} />;

  if (isPending) {
    return (
      <div className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="space-y-6">
        <p className="text-[14px] leading-relaxed text-muted-foreground">
          Sign in to the account you want to delete. The request has to come from the account itself, so we
          can't action it from an email alone.
        </p>
        <AuthCard next="/delete-account" />
      </div>
    );
  }

  return <DeleteForm onDeleted={setDeletedOrders} />;
}
