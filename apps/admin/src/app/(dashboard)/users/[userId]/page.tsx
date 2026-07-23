"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Mail,
  Phone,
  ShieldCheck,
  Calendar,
  ExternalLink,
  Package,
  TicketIcon,
  MapPin,
  TrendingUp,
  AlertTriangle,
  Wallet,
  Plus,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { formatInr } from "@/lib/format";

// ─── Constants ────────────────────────────────────────────────────────────────

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending_payment: "Awaiting payment",
  paid: "Paid",
  processing: "Processing",
  picked_up: "Picked up",
  out_for_delivery: "Out for delivery",
  delivery_attempted: "Delivery attempted",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
  rto_initiated: "RTO initiated",
  rto_delivered: "RTO delivered",
};

const ORDER_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending_payment: "outline",
  paid: "secondary",
  processing: "secondary",
  picked_up: "secondary",
  out_for_delivery: "default",
  delivery_attempted: "outline",
  shipped: "default",
  delivered: "default",
  cancelled: "destructive",
  refunded: "outline",
  rto_initiated: "destructive",
  rto_delivered: "outline",
};

const TICKET_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  open: "default",
  awaiting_admin: "destructive",
  awaiting_user: "secondary",
  resolved: "outline",
  closed: "outline",
};

const TICKET_TYPE_LABEL: Record<string, string> = {
  general: "General",
  damaged: "Damaged",
  refund: "Refund",
  other: "Other",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(d: string | Date) {
  return new Date(d).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

type ShippingAddr = {
  fullName?: string;
  phone?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

// ─── Right-panel cards ────────────────────────────────────────────────────────

function SideCard({ title, icon: Icon, children }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
      </div>
      {children}
    </div>
  );
}

// ─── Wallet card ──────────────────────────────────────────────────────────────

const WALLET_TXN_LABEL: Record<string, string> = {
  topup: "Top-up",
  order_payment: "Order payment",
  refund_credit: "Refund credit",
  reversal: "Reversal",
  adjustment: "Adjustment",
};

function WalletCard({ userId, userName }: { userId: string; userName: string }) {
  const utils = trpc.useUtils();
  const wallet = trpc.adminUser.wallet.useQuery({ userId });

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const credit = trpc.adminUser.walletCredit.useMutation({
    onSuccess: (res) => {
      toast.success(`₹${amount} added — new balance ${formatInr(res.balance)}`);
      setOpen(false);
      setAmount("");
      setReason("");
      utils.adminUser.wallet.invalidate({ userId });
    },
    onError: (err) => toast.error(err.message),
  });

  const amountNum = Number(amount);
  const canSubmit =
    Number.isFinite(amountNum) && amountNum > 0 && amountNum <= 100000 && reason.trim().length >= 3 && !credit.isPending;

  return (
    <SideCard title="Wallet" icon={Wallet}>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-2xl font-bold tabular-nums">{formatInr(wallet.data?.balance ?? 0)}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Store credit balance</div>
        </div>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => setOpen(true)}>
          <Plus className="size-3.5" />
          Add money
        </Button>
      </div>

      {(wallet.data?.transactions.length ?? 0) > 0 && (
        <>
          <div className="h-px bg-border" />
          <div className="space-y-1.5">
            {wallet.data!.transactions.slice(0, 5).map((t) => {
              const amt = Number(t.amount);
              return (
                <div key={t.id} className="flex items-center justify-between text-xs">
                  <div className="min-w-0 pr-2">
                    <span className="text-muted-foreground">{WALLET_TXN_LABEL[t.type] ?? t.type}</span>
                    <span className="text-[10px] text-muted-foreground/70 ml-1.5">{fmtDate(t.createdAt)}</span>
                  </div>
                  <span className={`font-semibold tabular-nums shrink-0 ${amt >= 0 ? "text-green-600" : "text-foreground"}`}>
                    {amt >= 0 ? "+" : "−"}{formatInr(Math.abs(amt))}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add money to wallet</DialogTitle>
            <DialogDescription>
              Credits {userName}&apos;s wallet as store credit. This is recorded as an adjustment in
              their transaction history with your name on it — a reason is required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="wallet-amount">Amount (₹)</Label>
              <Input
                id="wallet-amount"
                type="number"
                min={1}
                max={100000}
                placeholder="e.g. 250"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wallet-reason">Reason</Label>
              <Textarea
                id="wallet-reason"
                placeholder="e.g. Goodwill credit for delayed delivery of AZ-1042"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">The customer sees this note on the transaction.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={credit.isPending}>
              Cancel
            </Button>
            <Button
              disabled={!canSubmit}
              onClick={() => credit.mutate({ userId, amountInr: amountNum, note: reason.trim() })}
            >
              {credit.isPending ? "Adding…" : `Add ${amount ? `₹${amount}` : "money"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SideCard>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const router = useRouter();

  const { data, isLoading } = trpc.adminUser.get.useQuery({ userId });

  const stats = useMemo(() => {
    if (!data) return null;
    const { orders, tickets } = data;

    const totalSpend = orders.reduce((s, o) => s + Number(o.total), 0);
    const delivered = orders.filter((o) => o.status === "delivered").length;
    const cancelled = orders.filter((o) => o.status === "cancelled").length;
    const refunded = orders.filter((o) => o.status === "refunded").length;
    const rto = orders.filter((o) => o.status === "rto_initiated" || o.status === "rto_delivered").length;
    const openTickets = tickets.filter((t) => t.status === "open" || t.status === "awaiting_admin" || t.status === "awaiting_user");

    // top products by quantity
    const productQty: Record<string, { name: string; qty: number; sku: string }> = {};
    for (const order of orders) {
      for (const item of order.items) {
        const key = item.variantSku;
        if (!productQty[key]) {
          productQty[key] = { name: item.productName, qty: 0, sku: item.variantSku };
        }
        productQty[key].qty += item.quantity;
      }
    }
    const topProducts = Object.values(productQty).sort((a, b) => b.qty - a.qty).slice(0, 5);

    // last shipping address
    const lastAddr = orders[0]?.shippingAddress as ShippingAddr | null;

    const cancellationRate = orders.length > 0 ? Math.round((cancelled / orders.length) * 100) : 0;

    return { totalSpend, delivered, cancelled, refunded, rto, openTickets, topProducts, lastAddr, cancellationRate };
  }, [data]);

  if (isLoading) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!data || !stats) {
    return <div className="py-20 text-center text-sm text-muted-foreground">User not found.</div>;
  }

  const { user, orders, tickets } = data;

  return (
    <div className="space-y-6">
      {/* Back */}
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={() => router.push("/users")}>
        <ArrowLeft className="size-3.5" />
        Users
      </Button>

      {/* Profile card — full width */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-start gap-5">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
            {initials(user.name || user.email)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold">{user.name}</h1>
              <span
                className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                title="Short customer ID — searchable in Users and Wallets"
              >
                #{user.id.slice(0, 8).toUpperCase()}
              </span>
              {user.role === "admin" && <Badge variant="default">Admin</Badge>}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Mail className="size-3.5" />
                {user.email}
                {user.emailVerified && (
                  <span className="inline-block size-1.5 rounded-full bg-green-500" title="Verified" />
                )}
              </span>
              {user.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="size-3.5" />
                  {user.phone}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="size-3.5" />
                Joined {fmtDate(user.createdAt)}
              </span>
              {user.emailVerified && (
                <span className="flex items-center gap-1.5 text-green-600">
                  <ShieldCheck className="size-3.5" />
                  Verified
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-6 shrink-0">
            <div className="text-center">
              <div className="text-2xl font-bold tabular-nums">{orders.length}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Orders</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold tabular-nums">{formatInr(stats.totalSpend)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Lifetime spend</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold tabular-nums">{tickets.length}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Tickets</div>
            </div>
          </div>
        </div>
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_272px] gap-6 items-start">

        {/* LEFT — orders + tickets */}
        <div className="space-y-6 min-w-0">

          {/* Orders */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Package className="size-4 text-muted-foreground" />
              <h2 className="font-semibold">Orders</h2>
              <span className="text-xs text-muted-foreground">({orders.length})</span>
            </div>
            <div className="overflow-hidden rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>AWB</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                        No orders yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {orders.map((order) => (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => router.push(`/orders/${order.id}`)}
                    >
                      <TableCell className="font-mono text-sm font-medium">{order.orderNumber}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(order.createdAt)}</TableCell>
                      <TableCell>
                        <Badge variant={ORDER_STATUS_VARIANT[order.status] ?? "outline"}>
                          {ORDER_STATUS_LABEL[order.status] ?? order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold tabular-nums">{formatInr(Number(order.total))}</TableCell>
                      <TableCell className="text-sm">
                        {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                        {/* One parcel per unit — item count alone understates dispatch. */}
                        {order.shipments && order.shipments.length > 0 && (
                          <span className="block text-[11px] text-muted-foreground">
                            {order.shipments.length} package{order.shipments.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {order.waybill ? (
                          <div className="flex items-center gap-1">
                            {order.waybill}
                            {order.trackingUrl && (
                              <a
                                href={order.trackingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <ExternalLink className="size-3" />
                              </a>
                            )}
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <ExternalLink className="size-3.5 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Support tickets */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TicketIcon className="size-4 text-muted-foreground" />
              <h2 className="font-semibold">Support tickets</h2>
              <span className="text-xs text-muted-foreground">({tickets.length})</span>
            </div>
            <div className="overflow-hidden rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Opened</TableHead>
                    <TableHead>Last update</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                        No tickets.
                      </TableCell>
                    </TableRow>
                  )}
                  {tickets.map((t) => (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => router.push(`/support/${t.id}`)}
                    >
                      <TableCell className="font-medium text-sm max-w-xs truncate">{t.subject}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {TICKET_TYPE_LABEL[t.type] ?? t.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={TICKET_STATUS_VARIANT[t.status] ?? "outline"} className="capitalize text-xs">
                          {t.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(t.createdAt)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDateTime(t.updatedAt)}</TableCell>
                      <TableCell>
                        <ExternalLink className="size-3.5 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* RIGHT — intelligence sidebar */}
        <div className="space-y-4">

          {/* Wallet */}
          <WalletCard userId={userId} userName={user.name || user.email} />

          {/* Order health */}
          <SideCard title="Order health" icon={TrendingUp}>
            <div className="space-y-2">
              {[
                { label: "Delivered", value: stats.delivered, color: "bg-green-500" },
                { label: "Cancelled", value: stats.cancelled, color: "bg-red-400" },
                { label: "Refunded", value: stats.refunded, color: "bg-amber-400" },
                { label: "RTO", value: stats.rto, color: "bg-orange-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block size-2 rounded-full ${color}`} />
                    <span className="text-muted-foreground">{label}</span>
                  </div>
                  <span className="font-semibold tabular-nums">{value}</span>
                </div>
              ))}
            </div>
            {orders.length > 0 && (
              <>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Cancellation rate</span>
                  <span className={`font-semibold tabular-nums ${stats.cancellationRate > 30 ? "text-red-500" : "text-foreground"}`}>
                    {stats.cancellationRate}%
                  </span>
                </div>
              </>
            )}
          </SideCard>

          {/* Open tickets alert */}
          {stats.openTickets.length > 0 && (
            <SideCard title="Open tickets" icon={AlertTriangle}>
              <div className="space-y-2">
                {stats.openTickets.map((t) => (
                  <button
                    key={t.id}
                    className="w-full text-left rounded-lg border border-border px-3 py-2 hover:bg-muted/40 transition-colors"
                    onClick={() => router.push(`/support/${t.id}`)}
                  >
                    <div className="text-xs font-medium truncate">{t.subject}</div>
                    <div className="flex items-center justify-between mt-1">
                      <Badge variant="outline" className="text-[10px] h-4 px-1">
                        {TICKET_TYPE_LABEL[t.type] ?? t.type}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{fmtDate(t.updatedAt)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </SideCard>
          )}

          {/* Last shipping address */}
          {stats.lastAddr && (
            <SideCard title="Last shipping address" icon={MapPin}>
              <div className="text-sm space-y-0.5">
                <p className="font-medium">{stats.lastAddr.fullName}</p>
                {stats.lastAddr.phone && (
                  <p className="text-muted-foreground text-xs">{stats.lastAddr.phone}</p>
                )}
                <p className="text-muted-foreground text-xs mt-1">
                  {stats.lastAddr.line1}
                  {stats.lastAddr.line2 ? `, ${stats.lastAddr.line2}` : ""}
                </p>
                <p className="text-muted-foreground text-xs">
                  {stats.lastAddr.city}, {stats.lastAddr.state} – {stats.lastAddr.pincode}
                </p>
              </div>
            </SideCard>
          )}

          {/* Top products ordered */}
          {stats.topProducts.length > 0 && (
            <SideCard title="Products ordered" icon={Package}>
              <div className="space-y-2">
                {stats.topProducts.map((p) => (
                  <div key={p.sku} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{p.sku}</p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                      ×{p.qty}
                    </span>
                  </div>
                ))}
              </div>
            </SideCard>
          )}

        </div>
      </div>
    </div>
  );
}
