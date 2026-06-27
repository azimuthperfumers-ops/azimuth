"use client";

import { use, useState } from "react";
import Link from "next/link";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@azimuth/api";
import { ArrowLeft, MapPin } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatInr } from "@/lib/format";
import { trpc } from "@/lib/trpc";

// ─── Types ────────────────────────────────────────────────────────────────────

type RouterOutputs = inferRouterOutputs<AppRouter>;
type Order = NonNullable<RouterOutputs["order"]["adminGet"]>;
type OrderItem = Order["items"][number];
type StatusHistoryEntry = NonNullable<Order["statusHistory"]>[number];

// ─── Status config ─────────────────────────────────────────────────────────────

const ORDER_STATUSES = [
  "pending_payment", "paid", "processing",
  "picked_up", "out_for_delivery", "delivery_attempted",
  "shipped", "delivered", "cancelled", "refunded",
  "rto_initiated", "rto_delivered",
] as const;

type OrderStatus = (typeof ORDER_STATUSES)[number];

const STATUS_LABEL: Record<OrderStatus, string> = {
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

const STATUS_VARIANT: Record<OrderStatus, "default" | "secondary" | "destructive" | "outline"> = {
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

// ─── Update status dialog ─────────────────────────────────────────────────────

function UpdateStatusDialog({
  orderId,
  currentStatus,
  open,
  onOpenChange,
}: {
  orderId: string;
  currentStatus: OrderStatus;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const [status, setStatus] = useState<OrderStatus>(currentStatus);
  const [note, setNote] = useState("");
  const [waybill, setWaybill] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [invoiceNum, setInvoiceNum] = useState("");

  const update = trpc.order.updateStatus.useMutation({
    onSuccess: async () => {
      await utils.order.adminGet.invalidate({ orderId });
      toast.success("Status updated");
      onOpenChange(false);
      setNote(""); setWaybill(""); setTrackingUrl(""); setInvoiceNum("");
    },
    onError: (err) => toast.error(err.message),
  });

  function onSave() {
    update.mutate({
      orderId,
      status,
      note: note || undefined,
      delhiveryWaybill: waybill || undefined,
      trackingUrl: trackingUrl || undefined,
      gstInvoiceNumber: invoiceNum || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update order status</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              New status
            </label>
            <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ORDER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {status === "shipped" && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Delhivery waybill
                </label>
                <input
                  type="text"
                  value={waybill}
                  onChange={(e) => setWaybill(e.target.value)}
                  placeholder="AWB number"
                  className="w-full border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tracking URL
                </label>
                <input
                  type="url"
                  value={trackingUrl}
                  onChange={(e) => setTrackingUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none"
                />
              </div>
            </>
          )}

          {status === "paid" && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                GST invoice number
              </label>
              <input
                type="text"
                value={invoiceNum}
                onChange={(e) => setInvoiceNum(e.target.value)}
                placeholder="INV-2026-001"
                className="w-full border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Note (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Internal note for audit trail…"
              className="w-full border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave} disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground/50 mb-3">
      {children}
    </p>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const [statusDialog, setStatusDialog] = useState(false);

  const { data: order, isLoading } = trpc.order.adminGet.useQuery({ orderId });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        Order not found.{" "}
        <Link href="/orders" className="underline">Back to orders</Link>
      </div>
    );
  }

  const addr = order.shippingAddress as {
    fullName?: string; phone?: string; line1?: string; line2?: string | null;
    city?: string; state?: string; pincode?: string;
  };

  const timeline = order.statusHistory
    ? [...order.statusHistory].reverse()
    : [];

  return (
    <div className="space-y-8">

      {/* Back + header */}
      <div>
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground hover:text-foreground transition-colors mb-5"
        >
          <ArrowLeft className="size-3.5" />
          All orders
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground/40 mb-1">
              Order
            </p>
            <h1 className="text-title font-semibold font-mono">{order.orderNumber}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {new Date(order.createdAt).toLocaleString("en-IN", {
                day: "numeric", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={STATUS_VARIANT[order.status as OrderStatus] ?? "outline"}>
              {STATUS_LABEL[order.status as OrderStatus] ?? order.status}
            </Badge>
            <Button size="sm" onClick={() => setStatusDialog(true)}>
              Update status
            </Button>
          </div>
        </div>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">

        {/* Left column */}
        <div className="space-y-8">

          {/* Items */}
          <section>
            <SectionLabel>Items</SectionLabel>
            <div className="border border-border divide-y divide-border/50">
              {order.items.map((item: OrderItem) => (
                <div key={item.id} className="flex items-center gap-4 p-4">
                  {item.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={item.productName}
                      className="w-10 h-12 object-cover shrink-0 bg-muted"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{item.productName}</p>
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                      {item.variantSku} · {item.sizeMl}ml · qty {item.quantity}
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums shrink-0 text-sm">
                    {formatInr(Number(item.lineTotal))}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Audit trail */}
          {timeline.length > 0 && (
            <section>
              <SectionLabel>Audit trail</SectionLabel>
              <div className="relative pl-5">
                <div className="absolute left-1.5 top-0 bottom-0 w-px bg-border" />
                <div className="space-y-5">
                  {timeline.map((h: StatusHistoryEntry, i) => {
                    const isLast = i === timeline.length - 1;
                    return (
                      <div key={h.id} className="relative flex items-start gap-4">
                        <div className={`absolute -left-5 mt-1 size-2.5 rounded-full border-2 ${isLast ? "border-foreground bg-foreground" : "border-border bg-background"}`} />
                        <div>
                          <p className={`text-[12px] font-semibold ${isLast ? "text-foreground" : "text-muted-foreground"}`}>
                            {h.fromStatus
                              ? `${STATUS_LABEL[h.fromStatus as OrderStatus] ?? h.fromStatus} → `
                              : ""}
                            {STATUS_LABEL[h.toStatus as OrderStatus] ?? h.toStatus}
                          </p>
                          <p className="text-[10.5px] text-muted-foreground/50 mt-0.5">
                            {new Date(h.createdAt).toLocaleString("en-IN", {
                              day: "numeric", month: "short", year: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })}
                            {h.actorId && (
                              <span className="ml-1.5 text-muted-foreground/40">· {h.actorId}</span>
                            )}
                          </p>
                          {h.note && (
                            <p className="text-[11px] text-muted-foreground/60 mt-0.5 italic">{h.note}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">

          {/* Financials */}
          <section>
            <SectionLabel>Financials</SectionLabel>
            <div className="border border-border p-4 space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span><span>{formatInr(Number(order.subtotal))}</span>
              </div>
              {Number(order.discountAmount) > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</span>
                  <span>−{formatInr(Number(order.discountAmount))}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>Shipping</span>
                <span>{Number(order.shippingCharge) === 0 ? "Free" : formatInr(Number(order.shippingCharge))}</span>
              </div>
              {Number(order.taxAmount) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax</span><span>{formatInr(Number(order.taxAmount))}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-foreground border-t border-border pt-2 mt-1">
                <span>Total</span><span>{formatInr(Number(order.total))}</span>
              </div>
            </div>
          </section>

          {/* Payment */}
          <section>
            <SectionLabel>Payment</SectionLabel>
            <div className="border border-border p-4 space-y-1.5 text-[12px]">
              {order.razorpayOrderId && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Rzp order</span>
                  <span className="font-mono text-[11px] truncate">{order.razorpayOrderId}</span>
                </div>
              )}
              {order.razorpayPaymentId && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Rzp payment</span>
                  <span className="font-mono text-[11px] truncate">{order.razorpayPaymentId}</span>
                </div>
              )}
              {order.gstInvoiceNumber && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">GST invoice</span>
                  <span className="font-mono text-[11px]">{order.gstInvoiceNumber}</span>
                </div>
              )}
              {!order.razorpayOrderId && !order.gstInvoiceNumber && (
                <p className="text-muted-foreground/50">No payment data yet.</p>
              )}
            </div>
          </section>

          {/* Shipping */}
          {(order.delhiveryWaybill || order.trackingUrl || order.podImageUrl) && (
            <section>
              <SectionLabel>Shipping</SectionLabel>
              <div className="border border-border p-4 space-y-2 text-[12px]">
                {order.delhiveryWaybill && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Waybill</span>
                    <span className="font-mono">{order.delhiveryWaybill}</span>
                  </div>
                )}
                {order.trackingUrl && (
                  <a
                    href={order.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-primary underline underline-offset-2 hover:opacity-70 truncate"
                  >
                    {order.trackingUrl}
                  </a>
                )}
                {order.podImageUrl && (
                  <div className="pt-1 space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/50">
                      Proof of delivery
                    </p>
                    <a href={order.podImageUrl} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={order.podImageUrl}
                        alt="Proof of delivery"
                        className="max-h-48 border border-border object-contain hover:opacity-80 transition-opacity"
                      />
                    </a>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Delivery address */}
          <section>
            <SectionLabel>Delivery address</SectionLabel>
            <div className="border border-border p-4 flex gap-3 text-[13px]">
              <MapPin className="size-3.5 shrink-0 text-muted-foreground/40 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold">{addr.fullName}</p>
                <p className="text-muted-foreground">{addr.phone}</p>
                <p className="text-muted-foreground">
                  {addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}
                </p>
                <p className="text-muted-foreground">
                  {addr.city}, {addr.state} — {addr.pincode}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <UpdateStatusDialog
        orderId={order.id}
        currentStatus={order.status as OrderStatus}
        open={statusDialog}
        onOpenChange={setStatusDialog}
      />
    </div>
  );
}
