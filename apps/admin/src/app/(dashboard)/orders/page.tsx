"use client";

import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@azimuth/api";
import { toast } from "sonner";
import { ChevronDown, ChevronRight } from "lucide-react";

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
import { cn } from "@/lib/utils";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type Order = RouterOutputs["order"]["adminList"][number];
type OrderItem = Order["items"][number];
type StatusHistoryEntry = NonNullable<Order["statusHistory"]>[number];

// ─── Constants ────────────────────────────────────────────────────────────────

const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
  "rto_initiated",
  "rto_delivered",
] as const;

type OrderStatus = (typeof ORDER_STATUSES)[number];

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  paid: "Paid",
  processing: "Processing",
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
  shipped: "default",
  delivered: "default",
  cancelled: "destructive",
  refunded: "outline",
  rto_initiated: "destructive",
  rto_delivered: "outline",
};

// ─── Advance status dialog ────────────────────────────────────────────────────

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
      await utils.order.adminList.invalidate();
      toast.success("Status updated");
      onOpenChange(false);
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

  const needsShipping = status === "shipped";

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
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORDER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsShipping && (
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

// ─── Order detail row (expandable) ───────────────────────────────────────────

function OrderDetailPanel({ order }: { order: Order }) {
  const addr = order.shippingAddress as {
    fullName?: string; phone?: string; line1?: string; line2?: string;
    city?: string; state?: string; pincode?: string;
  };

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 p-4 bg-muted/30 text-sm">
      {/* Shipping address */}
      <div>
        <p className="text-[10px] font-bold tracking-[0.16em] text-muted-foreground uppercase mb-2">
          Delivery address
        </p>
        <p className="font-medium">{addr.fullName}</p>
        <p className="text-muted-foreground">{addr.phone}</p>
        <p className="text-muted-foreground mt-1">
          {addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}
          <br />{addr.city}, {addr.state} — {addr.pincode}
        </p>
      </div>

      {/* Financials */}
      <div>
        <p className="text-[10px] font-bold tracking-[0.16em] text-muted-foreground uppercase mb-2">
          Financials
        </p>
        <div className="space-y-1 text-muted-foreground">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatInr(Number(order.subtotal))}</span></div>
          {Number(order.discountAmount) > 0 && (
            <div className="flex justify-between text-primary"><span>Discount {order.couponCode ? `(${order.couponCode})` : ""}</span><span>−{formatInr(Number(order.discountAmount))}</span></div>
          )}
          <div className="flex justify-between"><span>Shipping</span><span>{Number(order.shippingCharge) === 0 ? "Free" : formatInr(Number(order.shippingCharge))}</span></div>
          <div className="flex justify-between font-semibold text-foreground border-t border-border pt-1 mt-1"><span>Total</span><span>{formatInr(Number(order.total))}</span></div>
        </div>
        {order.razorpayOrderId && (
          <p className="text-[10px] text-muted-foreground/60 mt-2 font-mono">
            Rzp: {order.razorpayOrderId}
          </p>
        )}
        {order.gstInvoiceNumber && (
          <p className="text-[10px] text-muted-foreground/60 font-mono">
            GST invoice: {order.gstInvoiceNumber}
          </p>
        )}
      </div>

      {/* Items */}
      <div className="md:col-span-2">
        <p className="text-[10px] font-bold tracking-[0.16em] text-muted-foreground uppercase mb-2">
          Items
        </p>
        <div className="space-y-2">
          {order.items.map((item: OrderItem) => (
            <div key={item.id} className="flex items-center gap-3 border border-border/50 p-2">
              {item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt={item.productName} className="w-9 h-11 object-cover bg-muted shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{item.productName}</p>
                <p className="text-[11px] text-muted-foreground">{item.variantSku} · {item.sizeMl}ml · qty {item.quantity}</p>
              </div>
              <p className="font-semibold tabular-nums shrink-0">{formatInr(Number(item.lineTotal))}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Status history */}
      {order.statusHistory && order.statusHistory.length > 0 && (
        <div className="md:col-span-2">
          <p className="text-[10px] font-bold tracking-[0.16em] text-muted-foreground uppercase mb-2">
            Audit trail
          </p>
          <div className="space-y-1.5">
            {order.statusHistory.map((h: StatusHistoryEntry) => (
              <div key={h.id} className="flex items-start gap-2 text-[12px]">
                <span className="text-muted-foreground/50 tabular-nums shrink-0 w-36">
                  {new Date(h.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                </span>
                <span className="text-muted-foreground">
                  {h.fromStatus ? `${STATUS_LABEL[h.fromStatus as OrderStatus] ?? h.fromStatus} → ` : ""}
                  <span className="font-medium text-foreground">{STATUS_LABEL[h.toStatus as OrderStatus] ?? h.toStatus}</span>
                  {h.note && <span className="text-muted-foreground/60"> · {h.note}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Expanded order row ───────────────────────────────────────────────────────

function OrderRow({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false);
  const [statusDialog, setStatusDialog] = useState(false);

  return (
    <>
      <TableRow
        className={cn("cursor-pointer hover:bg-muted/40", expanded && "bg-muted/30")}
        onClick={() => setExpanded((v) => !v)}
      >
        <TableCell>
          {expanded ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
        </TableCell>
        <TableCell className="font-mono text-sm font-medium">{order.orderNumber}</TableCell>
        <TableCell className="text-muted-foreground text-sm">
          {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </TableCell>
        <TableCell>
          <Badge variant={STATUS_VARIANT[order.status as OrderStatus] ?? "outline"}>
            {STATUS_LABEL[order.status as OrderStatus] ?? order.status}
          </Badge>
        </TableCell>
        <TableCell className="font-semibold tabular-nums">{formatInr(Number(order.total))}</TableCell>
        <TableCell>{order.items.length} item{order.items.length !== 1 ? "s" : ""}</TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            onClick={() => setStatusDialog(true)}
          >
            Update
          </Button>
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow>
          <TableCell colSpan={7} className="p-0">
            <OrderDetailPanel order={order} />
          </TableCell>
        </TableRow>
      )}

      <UpdateStatusDialog
        orderId={order.id}
        currentStatus={order.status as OrderStatus}
        open={statusDialog}
        onOpenChange={setStatusDialog}
      />
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");

  const { data: orders, isLoading } = trpc.order.adminList.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 100,
    offset: 0,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-title font-semibold">Orders</h1>
          <p className="text-sm text-muted-foreground">
            All customer orders. Click a row to expand details and audit trail.
          </p>
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Order #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Items</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Loading orders…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (!orders || orders.length === 0) && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No orders found.
                </TableCell>
              </TableRow>
            )}
            {orders?.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
