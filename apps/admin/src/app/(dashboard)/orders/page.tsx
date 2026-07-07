"use client";

export const dynamic = "force-dynamic";

import { useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@azimuth/api";
import { ArrowRight, Search, X, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  "payment_failed",
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

// ─── Order row ────────────────────────────────────────────────────────────────

function OrderRow({ order }: { order: Order }) {
  const router = useRouter();
  const customer = getCustomer(order);

  return (
    <TableRow
      className="cursor-pointer group hover:bg-muted/50 transition-colors"
      onClick={() => router.push(`/orders/${order.id}`)}
    >
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
      <TableCell>
        <ArrowRight className="size-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
      </TableCell>
    </TableRow>
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
          All customer orders. Click a row to open details.
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
              <TableHead>Order #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Items / AWB</TableHead>
              <TableHead className="w-8" />
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
