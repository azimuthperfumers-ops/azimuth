"use client";

import { use, useState } from "react";
import Link from "next/link";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@azimuth/api";
import { AlertTriangle, ArrowLeft, MapPin, RotateCcw } from "lucide-react";
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
  "pending_payment", "payment_failed", "paid", "processing",
  "picked_up", "out_for_delivery", "delivery_attempted",
  "shipped", "delivered", "cancelled", "refunded",
  "rto_initiated", "rto_delivered",
] as const;

type OrderStatus = (typeof ORDER_STATUSES)[number];

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  payment_failed: "Payment failed",
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
  payment_failed: "destructive",
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

const PAID_STATUSES: OrderStatus[] = ["paid", "processing", "picked_up", "shipped", "out_for_delivery", "delivery_attempted"];
const REFUND_TRIGGERS: OrderStatus[] = ["cancelled", "rto_delivered"];

// Statuses an admin can manually set — excludes system/payment/courier-driven states
const ADMIN_SETTABLE_STATUSES: OrderStatus[] = [
  "processing", "picked_up", "out_for_delivery", "delivery_attempted",
  "shipped", "delivered", "cancelled", "rto_delivered",
];

function UpdateStatusDialog({
  orderId,
  currentStatus,
  hasPaid,
  open,
  onOpenChange,
}: {
  orderId: string;
  currentStatus: OrderStatus;
  hasPaid: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const defaultStatus = ADMIN_SETTABLE_STATUSES.includes(currentStatus)
    ? currentStatus
    : ADMIN_SETTABLE_STATUSES[0];
  const [status, setStatus] = useState<OrderStatus>(defaultStatus);
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

  const willTriggerRefund =
    hasPaid &&
    REFUND_TRIGGERS.includes(status) &&
    PAID_STATUSES.includes(currentStatus);

  function onSave() {
    update.mutate({
      orderId,
      status,
      note: note || undefined,
      waybill: waybill || undefined,
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
                {ADMIN_SETTABLE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {willTriggerRefund && (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300">
              <strong>Razorpay refund will be initiated automatically.</strong> Full order amount will be refunded to the customer. This cannot be undone.
            </div>
          )}

          {status === "shipped" && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Shiprocket AWB
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
  const [refundDialog, setRefundDialog] = useState(false);
  const [refundNote, setRefundNote] = useState("");
  const [refundDest, setRefundDest] = useState<"razorpay" | "wallet">("wallet");
  const utils = trpc.useUtils();

  const retryBooking = trpc.order.retryShipmentBooking.useMutation({
    onSuccess: async () => {
      await utils.order.adminGet.invalidate({ orderId });
      toast.success("Shipment booking re-queued");
    },
    onError: (err) => toast.error(err.message),
  });

  const issueRefund = trpc.order.issueRefund.useMutation({
    onSuccess: async (res) => {
      await utils.order.adminGet.invalidate({ orderId });
      toast.success(res.destination === "wallet" ? "Refunded to customer's wallet" : "Bank refund queued via Razorpay");
      setRefundDialog(false);
      setRefundNote("");
    },
    onError: (err) => toast.error(err.message),
  });

  const markPaid = trpc.order.confirmPayment.useMutation({
    onSuccess: async () => {
      await utils.order.adminGet.invalidate({ orderId });
      toast.success("Marked as paid — shipment booking queued");
    },
    onError: (err) => toast.error(err.message),
  });

  const generateInvoice = trpc.order.generateInvoice.useMutation({
    onSuccess: async (res) => {
      await utils.order.adminGet.invalidate({ orderId });
      toast.success(`Invoice ${res.gstInvoiceNumber} generated`);
    },
    onError: (err) => toast.error(err.message),
  });

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

  // Detect incomplete shipment booking. An order ships as one parcel per unit and
  // booking can succeed for some and fail for others, so the order-level waybill
  // being set no longer means the order is fully booked — check every parcel.
  const unbookedPackages = (order.shipments ?? []).filter(
    (s) => !s.waybill && s.status !== "cancelled",
  );
  const needsShipmentRetry =
    order.status === "processing" &&
    (order.shipments && order.shipments.length > 0 ? unbookedPackages.length > 0 : !order.waybill);

  const bookingErrorEntry = needsShipmentRetry
    ? timeline.find(
        (h) =>
          h.actorId === "worker:order" &&
          h.note != null &&
          h.note.includes("booking failed"),
      )
    : undefined;

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
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={STATUS_VARIANT[order.status as OrderStatus] ?? "outline"}>
              {STATUS_LABEL[order.status as OrderStatus] ?? order.status}
            </Badge>
            {needsShipmentRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => retryBooking.mutate({ orderId })}
                disabled={retryBooking.isPending}
                className="border-orange-400 text-orange-700 hover:bg-orange-50"
              >
                <RotateCcw className="size-3.5 mr-1.5" />
                {retryBooking.isPending ? "Queueing…" : "Retry shipment booking"}
              </Button>
            )}
            {(order.status === "pending_payment" || order.status === "payment_failed") && (
              <Button
                size="sm"
                variant="outline"
                className="border-green-500 text-green-700 hover:bg-green-50"
                onClick={() => markPaid.mutate({ orderId })}
                disabled={markPaid.isPending}
              >
                {markPaid.isPending ? "Processing…" : "Mark as paid"}
              </Button>
            )}
            {/* Wallet-paid orders have no razorpayPaymentId but are still refundable (to wallet). */}
            {(order.razorpayPaymentId || (order as { paymentMethod?: string }).paymentMethod === "wallet") &&
              !["refund_processing", "refunded", "cancelled", "pending_payment", "payment_failed"].includes(order.status) && (
              <Button
                size="sm"
                variant="outline"
                className="border-red-400 text-red-700 hover:bg-red-50"
                onClick={() => {
                  setRefundDest((order as { paymentMethod?: string }).paymentMethod === "wallet" ? "wallet" : "wallet");
                  setRefundDialog(true);
                }}
              >
                Issue refund
              </Button>
            )}
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

          {/* Shipment booking error alert. Booking is per parcel, so this reports
              which packages are missing an AWB and why, not just "it failed". */}
          {(bookingErrorEntry || unbookedPackages.length > 0) && (
            <div className="flex items-start gap-3 border border-orange-300 bg-orange-50 p-4 text-[12px]">
              <AlertTriangle className="size-4 text-orange-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-orange-800">
                  {unbookedPackages.length > 0 && order.shipments
                    ? `Shipment booking incomplete — ${unbookedPackages.length} of ${order.shipments.length} package(s) unbooked`
                    : "Shipment booking failed"}
                </p>
                {unbookedPackages.map((pkg) => (
                  <p key={pkg.id} className="text-orange-700">
                    Package {pkg.packageNumber}: {pkg.errorMessage ?? "not yet booked"}
                  </p>
                ))}
                {bookingErrorEntry && (
                  <>
                    <p className="text-orange-700">{bookingErrorEntry.note}</p>
                    <p className="text-orange-500/70">
                      {new Date(bookingErrorEntry.createdAt).toLocaleString("en-IN", {
                        day: "numeric", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

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
              {/* Plain-language proof for the admin: how it was paid, and if refunded, where it went. */}
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground shrink-0">Paid via</span>
                <span className="font-medium">
                  {(order as { paymentMethod?: string }).paymentMethod === "wallet" ? "Wallet (store credit)" : "Bank / card"}
                </span>
              </div>
              {(order as { refundMethod?: string | null }).refundMethod && (
                <div className="flex items-center justify-between gap-2 rounded bg-emerald-50 px-2 py-1.5 dark:bg-emerald-950/30">
                  <span className="text-emerald-800 dark:text-emerald-300 shrink-0 font-medium">Refunded to</span>
                  <span className="font-medium text-emerald-800 dark:text-emerald-300">
                    {(order as { refundMethod?: string }).refundMethod === "wallet"
                      ? `Wallet · ${order.status === "refunded" ? "credited ✓" : "processing"}`
                      : `Bank / card · ${order.status === "refunded" ? "sent ✓" : "processing"}`}
                  </span>
                </div>
              )}
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
                  <span className="flex items-center gap-2 text-right">
                    <span className="font-mono text-[11px]">{order.gstInvoiceNumber}</span>
                    {order.invoiceUrl && (
                      <a
                        href={order.invoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-semibold uppercase tracking-wider text-primary hover:underline"
                      >
                        PDF ↓
                      </a>
                    )}
                  </span>
                </div>
              )}
              {!order.razorpayOrderId && !order.gstInvoiceNumber && (
                <p className="text-muted-foreground/50">No payment data yet.</p>
              )}
              {order.status !== "pending_payment" && order.status !== "payment_failed" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-1 w-full"
                  onClick={() => generateInvoice.mutate({ orderId })}
                  disabled={generateInvoice.isPending}
                >
                  {generateInvoice.isPending
                    ? "Generating…"
                    : order.gstInvoiceNumber
                      ? "Regenerate invoice"
                      : "Generate invoice"}
                </Button>
              )}
            </div>
          </section>

          {/* Packages — perfume ships one unit per parcel, each with its own AWB */}
          {order.shipments && order.shipments.length > 0 && (
            <section>
              <SectionLabel>
                Packages ({order.shipments.length})
              </SectionLabel>
              <div className="border border-border divide-y divide-border">
                {order.shipments.map((pkg) => (
                  <div key={pkg.id} className="p-4 space-y-2 text-[12px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">
                        Package {pkg.packageNumber}
                        <span className="ml-2 font-normal text-muted-foreground">
                          {pkg.productName} · {pkg.sizeMl}ml
                        </span>
                      </span>
                      <span className="uppercase tracking-[0.12em] text-[10px] text-muted-foreground">
                        {pkg.status.replace(/_/g, " ")}
                      </span>
                    </div>

                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">Weight</span>
                      <span>
                        {(pkg.weightGrams / 1000).toFixed(2)} kg · {pkg.lengthCm}×{pkg.widthCm}×{pkg.heightCm} cm
                      </span>
                    </div>

                    {pkg.waybill ? (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">AWB</span>
                        <span className="font-mono">{pkg.waybill}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">AWB</span>
                        <span className="text-destructive">not booked</span>
                      </div>
                    )}

                    {pkg.courierName && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Courier</span>
                        <span>{pkg.courierName}</span>
                      </div>
                    )}

                    {pkg.estimatedDeliveryDate && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Est. delivery</span>
                        <span>{pkg.estimatedDeliveryDate}</span>
                      </div>
                    )}

                    {pkg.errorMessage && (
                      <p className="text-destructive break-words">{pkg.errorMessage}</p>
                    )}

                    {pkg.trackingUrl && (
                      <a
                        href={pkg.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-primary underline underline-offset-2 hover:opacity-70 truncate"
                      >
                        {pkg.trackingUrl}
                      </a>
                    )}

                    {pkg.podImageUrl && (
                      <a href={pkg.podImageUrl} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={pkg.podImageUrl}
                          alt={`Proof of delivery — package ${pkg.packageNumber}`}
                          className="max-h-40 border border-border object-contain hover:opacity-80 transition-opacity"
                        />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Shipping */}
          {(order.waybill || order.trackingUrl || order.podImageUrl) && (
            <section>
              <SectionLabel>Shipping</SectionLabel>
              <div className="border border-border p-4 space-y-2 text-[12px]">
                {order.waybill && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Waybill</span>
                    <span className="font-mono">{order.waybill}</span>
                  </div>
                )}
                {order.estimatedDeliveryDate && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Est. delivery</span>
                    <span>{order.estimatedDeliveryDate}</span>
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
        hasPaid={!!order.razorpayPaymentId}
        open={statusDialog}
        onOpenChange={setStatusDialog}
      />

      {(() => {
        const walletPaid = (order as { paymentMethod?: string }).paymentMethod === "wallet";
        const canBank = !!order.razorpayPaymentId && !walletPaid;
        const dest = walletPaid ? "wallet" : refundDest;
        return (
          <Dialog open={refundDialog} onOpenChange={setRefundDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Refund {formatInr(Number(order.total))}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <p className="text-muted-foreground">
                  Choose where the full order amount goes. For damaged / incorrect items — no return required.
                </p>

                {/* Destination choice */}
                <div className="grid gap-2.5">
                  <button
                    type="button"
                    onClick={() => setRefundDest("wallet")}
                    className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${dest === "wallet" ? "border-foreground bg-muted/50" : "border-border hover:border-foreground/40"}`}
                  >
                    <span className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${dest === "wallet" ? "border-foreground" : "border-muted-foreground/40"}`}>
                      {dest === "wallet" && <span className="size-2 rounded-full bg-foreground" />}
                    </span>
                    <span>
                      <span className="block font-medium text-foreground">To customer&apos;s wallet</span>
                      <span className="block text-[12px] text-muted-foreground">Instant store credit. Recommended — this is our standard refund method.</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={!canBank}
                    onClick={() => canBank && setRefundDest("razorpay")}
                    className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${dest === "razorpay" ? "border-foreground bg-muted/50" : "border-border hover:border-foreground/40"} ${!canBank ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <span className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${dest === "razorpay" ? "border-foreground" : "border-muted-foreground/40"}`}>
                      {dest === "razorpay" && <span className="size-2 rounded-full bg-foreground" />}
                    </span>
                    <span>
                      <span className="block font-medium text-foreground">To bank / card (Razorpay)</span>
                      <span className="block text-[12px] text-muted-foreground">
                        {canBank ? "Reverses the original payment. Reaches the customer in 5–7 days." : "Unavailable — this order was paid from wallet, so there is no bank payment to reverse."}
                      </span>
                    </span>
                  </button>
                </div>

                <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300">
                  Cannot be undone once confirmed.
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reason (internal note)</label>
                  <textarea
                    value={refundNote}
                    onChange={(e) => setRefundNote(e.target.value)}
                    rows={2}
                    placeholder="e.g. Bottle arrived damaged"
                    className="w-full border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none resize-none"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRefundDialog(false)}>Cancel</Button>
                <Button
                  variant="destructive"
                  disabled={issueRefund.isPending}
                  onClick={() => issueRefund.mutate({ orderId: order.id, destination: dest, note: refundNote || undefined })}
                >
                  {issueRefund.isPending ? "Processing…" : dest === "wallet" ? "Refund to wallet" : "Refund to bank"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
