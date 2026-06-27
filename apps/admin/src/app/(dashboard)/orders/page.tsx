"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@azimuth/api";
import { toast } from "sonner";
import { ChevronRight, Search, X, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type RouterOutputs = inferRouterOutputs<AppRouter>;
type Order = RouterOutputs["order"]["adminList"][number];

// ─── Constants ────────────────────────────────────────────────────────────────

const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "processing",
  "picked_up",
  "out_for_delivery",
  "delivery_attempted",
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCustomer(order: Order): { name: string; phone: string } {
  const addr = order.shippingAddress as { fullName?: string; phone?: string } | null;
  return {
    name: addr?.fullName ?? "—",
    phone: addr?.phone ?? "—",
  };
}

function fmtDate(iso: string | Date) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

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
  const [shippingCostActual, setShippingCostActual] = useState("");

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
      shippingCostActual: shippingCostActual ? Number(shippingCostActual) : undefined,
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
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Delhivery charge (₹) <span className="text-muted-foreground/60 normal-case font-normal">— actual cost to us</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={shippingCostActual}
                  onChange={(e) => setShippingCostActual(e.target.value)}
                  placeholder="e.g. 120"
                  className="w-full border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none"
                />
                {shippingCostActual && Number(shippingCostActual) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    ₹{Number(shippingCostActual).toFixed(2)} charged to customer in full
                  </p>
                )}
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

// ─── Order row ────────────────────────────────────────────────────────────────

function OrderRow({ order }: { order: Order }) {
  const router = useRouter();
  const [statusDialog, setStatusDialog] = useState(false);
  const customer = getCustomer(order);

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/40"
        onClick={() => router.push(`/orders/${order.id}`)}
      >
        <TableCell>
          <ChevronRight className="size-3.5 text-muted-foreground" />
        </TableCell>
        <TableCell className="font-mono text-sm font-medium">{order.orderNumber}</TableCell>
        <TableCell>
          <div className="text-sm font-medium leading-tight">{customer.name}</div>
          <div className="text-xs text-muted-foreground">{customer.phone}</div>
        </TableCell>
        <TableCell className="text-muted-foreground text-sm">{fmtDate(order.createdAt)}</TableCell>
        <TableCell>
          <Badge variant={STATUS_VARIANT[order.status as OrderStatus] ?? "outline"}>
            {STATUS_LABEL[order.status as OrderStatus] ?? order.status}
          </Badge>
        </TableCell>
        <TableCell className="font-semibold tabular-nums">{formatInr(Number(order.total))}</TableCell>
        <TableCell>
          <div className="text-sm">{order.items.length} item{order.items.length !== 1 ? "s" : ""}</div>
          {order.delhiveryWaybill && (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="font-mono text-[11px] text-muted-foreground">{order.delhiveryWaybill}</span>
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
          )}
        </TableCell>
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search = searchParams.get("q") ?? "";
  const statusFilter = (searchParams.get("status") ?? "all") as OrderStatus | "all";
  const dateFrom = searchParams.get("from") ?? "";
  const dateTo = searchParams.get("to") ?? "";

  const hasFilters = search || statusFilter !== "all" || dateFrom || dateTo;

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function setSearch(v: string) { setParam("q", v); }
  function setStatusFilter(v: string) { setParam("status", v === "all" ? "" : v); }
  function setDateFrom(v: string) { setParam("from", v); }
  function setDateTo(v: string) { setParam("to", v); }

  function clearFilters() {
    router.replace(pathname);
  }

  const { data: orders, isLoading } = trpc.order.adminList.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    search: search || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    limit: 200,
    offset: 0,
  });

  const stats = useMemo(() => {
    if (!orders) return null;
    const total = orders.reduce((sum, o) => sum + Number(o.total), 0);
    return { count: orders.length, total };
  }, [orders]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-title font-semibold">Orders</h1>
        <p className="text-sm text-muted-foreground">
          All customer orders. Click a row to expand details and audit trail.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-8 h-9 text-sm"
            placeholder="Order #, customer name, AWB…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="h-9 w-44 text-sm">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 border border-input bg-background px-3 text-sm rounded-md focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 border border-input bg-background px-3 text-sm rounded-md focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
          />
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground" onClick={clearFilters}>
            <X className="size-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Summary bar */}
      {stats && (
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground tabular-nums">{stats.count}</span>{" "}
            order{stats.count !== 1 ? "s" : ""}
          </span>
          <span>
            Total{" "}
            <span className="font-semibold text-foreground tabular-nums">{formatInr(stats.total)}</span>
          </span>
          {hasFilters && <span className="text-xs">(filtered)</span>}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Order #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Items / AWB</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  Loading orders…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (!orders || orders.length === 0) && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
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
