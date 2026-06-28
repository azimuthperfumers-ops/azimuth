"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, MapPin, Package } from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { authClient } from "@/lib/auth-client";
import { formatDate, formatDateTime, formatInr } from "@/lib/format";
import { trpc } from "@/lib/trpc";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
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

const STATUS_COLOR: Record<string, string> = {
  pending_payment: "text-yellow-600 bg-yellow-50 border-yellow-200",
  paid: "text-blue-600 bg-blue-50 border-blue-200",
  processing: "text-blue-600 bg-blue-50 border-blue-200",
  picked_up: "text-blue-600 bg-blue-50 border-blue-200",
  out_for_delivery: "text-indigo-600 bg-indigo-50 border-indigo-200",
  delivery_attempted: "text-orange-600 bg-orange-50 border-orange-200",
  shipped: "text-indigo-600 bg-indigo-50 border-indigo-200",
  delivered: "text-green-700 bg-green-50 border-green-200",
  cancelled: "text-red-600 bg-red-50 border-red-200",
  refunded: "text-muted-foreground bg-muted border-border",
  rto_initiated: "text-orange-600 bg-orange-50 border-orange-200",
  rto_delivered: "text-muted-foreground bg-muted border-border",
};

const TERMINAL_STATUSES = ["delivered", "cancelled", "refunded", "rto_delivered"];

// ─── Order detail page ───────────────────────────────────────────────────────

export default function OrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = authClient.useSession();

  const { data: order, isLoading } = trpc.order.get.useQuery(
    { orderId },
    { enabled: !!session },
  );

  if (sessionLoading) return null;

  if (!session) {
    router.replace("/account");
    return null;
  }

  if (isLoading) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-[780px] px-4 py-12">
          <div className="h-80 animate-pulse bg-muted rounded" />
        </main>
        <SiteFooter />
      </>
    );
  }

  if (!order) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-[780px] px-4 py-12 text-center">
          <p className="text-muted-foreground">Order not found.</p>
          <Link href="/account?tab=orders" className="mt-4 inline-block text-sm underline">
            Back to orders
          </Link>
        </main>
        <SiteFooter />
      </>
    );
  }

  const shippingAddr = order.shippingAddress as {
    fullName?: string; phone?: string;
    line1?: string; line2?: string | null;
    city?: string; state?: string; pincode?: string;
  };

  // Status history ascending (oldest first) for timeline
  const timeline = order.statusHistory
    ? [...order.statusHistory].reverse()
    : [];

  const isComplete = TERMINAL_STATUSES.includes(order.status);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[780px] px-4 md:px-6 py-8 md:py-12 pb-24">

        {/* Back */}
        <Link
          href="/account?tab=orders"
          className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] uppercase text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="size-3.5" />
          All orders
        </Link>

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-8 pb-8 border-b border-border">
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground/50 mb-1">
              Order
            </p>
            <h1 className="text-2xl font-semibold font-mono">{order.orderNumber}</h1>
            <p className="text-[13px] text-muted-foreground mt-1">
              Placed on {formatDate(order.createdAt)}
            </p>
          </div>
          <div className="shrink-0">
            <span className={`inline-block border px-3 py-1.5 text-[10px] font-bold tracking-[0.14em] uppercase ${STATUS_COLOR[order.status] ?? "text-foreground bg-muted border-border"}`}>
              {STATUS_LABEL[order.status] ?? order.status}
            </span>
          </div>
        </div>

        <div className="space-y-8">

          {/* Tracking */}
          {order.delhiveryWaybill && (
            <section>
              <p className="label-xs mb-3">Shipment</p>
              <div className="border border-border p-4 flex flex-col gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] text-muted-foreground/60 uppercase tracking-[0.1em] font-semibold">
                      Waybill
                    </p>
                    <p className="font-mono text-sm font-semibold mt-0.5">{order.delhiveryWaybill}</p>
                  </div>
                  {order.trackingUrl && (
                    <a
                      href={order.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 border border-foreground px-4 py-2 text-[10.5px] font-semibold tracking-[0.14em] uppercase hover:bg-foreground hover:text-background transition-all"
                    >
                      Track shipment
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
                {order.estimatedDeliveryDate && (
                  <div>
                    <p className="text-[11px] text-muted-foreground/60 uppercase tracking-[0.1em] font-semibold">
                      Expected delivery
                    </p>
                    <p className="text-sm font-semibold mt-0.5">{order.estimatedDeliveryDate}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Status timeline */}
          {timeline.length > 0 && (
            <section>
              <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground/50 mb-4">
                Order timeline
              </p>
              <div className="relative pl-5">
                <div className="absolute left-1.5 top-0 bottom-0 w-px bg-border" />
                <div className="space-y-5">
                  {timeline.map((h, i) => {
                    const isLast = i === timeline.length - 1;
                    return (
                      <div key={h.id} className="relative flex items-start gap-4">
                        <div className={`absolute -left-5 mt-0.5 size-3 rounded-full border-2 ${isLast ? "border-foreground bg-foreground" : "border-border bg-background"}`} />
                        <div className="min-w-0">
                          <p className={`text-[12px] font-semibold ${isLast ? "text-foreground" : "text-muted-foreground"}`}>
                            {STATUS_LABEL[h.toStatus] ?? h.toStatus}
                          </p>
                          <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                            {formatDateTime(h.createdAt)}
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

          {/* Items */}
          <section>
            <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground/50 mb-4">
              Items ordered
            </p>
            <div className="border border-border divide-y divide-border/50">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-4 p-4">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={item.productName}
                      className="w-12 h-14 object-cover shrink-0 bg-muted"
                    />
                  ) : (
                    <div className="w-12 h-14 bg-muted shrink-0 flex items-center justify-center">
                      <Package className="size-4 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold tabular-nums">{formatInr(item.lineTotal)}</p>
                    <p className="text-[13px] font-medium truncate mt-0.5">{item.productName}</p>
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                      {item.sizeMl}ml · qty {item.quantity} · {formatInr(item.unitPrice)} each
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Financials */}
          <section>
            <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground/50 mb-4">
              Payment summary
            </p>
            <div className="border border-border p-5 space-y-2.5 text-[13px]">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatInr(order.subtotal)}</span>
              </div>
              {Number(order.discountAmount) > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>
                    Discount{order.couponCode ? ` (${order.couponCode})` : ""}
                  </span>
                  <span>−{formatInr(order.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>Shipping</span>
                <span>
                  {Number(order.shippingCharge) === 0
                    ? "Free"
                    : formatInr(order.shippingCharge)}
                </span>
              </div>
              {Number(order.taxAmount) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax</span>
                  <span>{formatInr(order.taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-foreground border-t border-border pt-2.5 mt-1">
                <span>Total paid</span>
                <span className="text-base">{formatInr(order.total)}</span>
              </div>
              {order.gstInvoiceNumber && (
                <p className="text-[11px] text-muted-foreground/50 font-mono pt-1">
                  GST invoice: {order.gstInvoiceNumber}
                </p>
              )}
            </div>
          </section>

          {/* Delivery address */}
          <section>
            <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground/50 mb-4">
              Delivery address
            </p>
            <div className="border border-border p-5 flex gap-4">
              <MapPin className="size-4 shrink-0 text-muted-foreground/40 mt-0.5" />
              <div className="text-[13px] space-y-0.5">
                <p className="font-semibold text-foreground">{shippingAddr.fullName}</p>
                <p className="text-muted-foreground">{shippingAddr.phone}</p>
                <p className="text-muted-foreground">
                  {shippingAddr.line1}
                  {shippingAddr.line2 ? `, ${shippingAddr.line2}` : ""}
                </p>
                <p className="text-muted-foreground">
                  {shippingAddr.city}, {shippingAddr.state} — {shippingAddr.pincode}
                </p>
              </div>
            </div>
          </section>

          {/* Help */}
          <section className="border border-border p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
                Need help with this order?
              </p>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Returns, refunds, exchanges — raise a support request.
              </p>
            </div>
            <Link
              href={`/support?orderId=${orderId}`}
              className="shrink-0 border border-foreground px-5 py-2.5 text-[10.5px] font-semibold tracking-[0.14em] uppercase hover:bg-foreground hover:text-background transition-all text-center"
            >
              Contact support
            </Link>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
