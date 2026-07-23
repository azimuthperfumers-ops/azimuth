"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IndianRupee,
  PackageCheck,
  MessageSquare,
  ArrowRight,
  AlertTriangle,
  Truck,
} from "lucide-react";
import { Cell, Pie, PieChart, Tooltip, ResponsiveContainer, Legend } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { formatInr } from "@/lib/format";

// ─── Constants ────────────────────────────────────────────────────────────────

const LOW_STOCK_THRESHOLD = 5;

const FULFILLMENT_STATUSES = new Set(["paid", "processing"]);
const IN_TRANSIT_STATUSES = new Set(["picked_up", "shipped", "out_for_delivery", "delivery_attempted"]);

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending_payment: "Awaiting payment",
  paid: "Paid",
  processing: "Processing",
  picked_up: "Picked up",
  out_for_delivery: "Out for delivery",
  delivery_attempted: "Attempted",
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
  shipped: "default",
  picked_up: "secondary",
  out_for_delivery: "default",
  delivery_attempted: "outline",
  delivered: "default",
  cancelled: "destructive",
  refunded: "outline",
  rto_initiated: "destructive",
  rto_delivered: "outline",
};

// Groups for the pie chart
const PIE_GROUPS: { key: string; label: string; statuses: string[]; color: string }[] = [
  { key: "delivered",   label: "Delivered",    statuses: ["delivered"],                        color: "#22c55e" },
  { key: "in_transit",  label: "In transit",   statuses: ["shipped","picked_up","out_for_delivery","delivery_attempted"], color: "#3b82f6" },
  { key: "processing",  label: "Processing",   statuses: ["paid","processing"],                color: "#a855f7" },
  { key: "cancelled",   label: "Cancelled",    statuses: ["cancelled"],                        color: "#f43f5e" },
  { key: "refunded",    label: "Refunded",     statuses: ["refunded"],                        color: "#f59e0b" },
  { key: "rto",         label: "RTO",          statuses: ["rto_initiated","rto_delivered"],   color: "#ef4444" },
  { key: "pending",     label: "Pending pay",  statuses: ["pending_payment"],                 color: "#94a3b8" },
];

const TICKET_STATUS_LABEL: Record<string, string> = {
  open: "Open",
  awaiting_admin: "Needs reply",
  awaiting_user: "Awaiting customer",
  resolved: "Resolved",
  closed: "Closed",
};

const TICKET_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  open: "default",
  awaiting_admin: "destructive",
  awaiting_user: "secondary",
  resolved: "outline",
  closed: "outline",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayLabel() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function getCustomerName(addr: unknown): string {
  if (addr && typeof addr === "object" && "fullName" in addr) {
    return (addr as { fullName: string }).fullName ?? "—";
  }
  return "—";
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, alert, href,
}: {
  label: string; value: string | number; sub: string;
  icon: React.ElementType; alert?: boolean; href?: string;
}) {
  const inner = (
    <CardContent className="px-5 pt-5 pb-5">
      <div className="flex items-start justify-between">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
        <Icon className={`size-4 ${alert ? "text-destructive" : "text-muted-foreground/60"}`} />
      </div>
      <p className={`mt-3 text-3xl font-bold leading-none tabular-nums ${alert ? "text-destructive" : "text-foreground"}`}>
        {value}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{sub}</p>
    </CardContent>
  );
  return (
    <Card className={alert && Number(value) > 0 ? "border-destructive/30" : ""}>
      {href ? <Link href={href}>{inner}</Link> : inner}
    </Card>
  );
}

function SectionHeader({ title, count, href }: { title: string; count?: number; href?: string }) {
  return (
    <div className="flex items-center justify-between px-5 pt-5 pb-0">
      <CardTitle className="flex items-center gap-2">
        {title}
        {count !== undefined && count > 0 && (
          <span className="text-xs font-normal text-muted-foreground">({count})</span>
        )}
      </CardTitle>
      {href && (
        <Link href={href} className="flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline">
          View all <ArrowRight className="size-3" />
        </Link>
      )}
    </div>
  );
}

// ─── Pie chart ────────────────────────────────────────────────────────────────

function OrderStatusPie({ breakdown }: { breakdown: { status: string; count: number; revenue: number }[] }) {
  const data = useMemo(() => {
    const countByStatus = Object.fromEntries(breakdown.map((r) => [r.status, r.count]));
    return PIE_GROUPS
      .map((g) => ({
        name: g.label,
        value: g.statuses.reduce((s, st) => s + (countByStatus[st] ?? 0), 0),
        color: g.color,
      }))
      .filter((d) => d.value > 0);
  }, [breakdown]);

  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No order data yet.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [
              `${Number(value)} orders (${Math.round((Number(value) / total) * 100)}%)`,
              name as string,
            ]}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--card))",
              color: "hsl(var(--foreground))",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="w-full grid grid-cols-2 gap-x-4 gap-y-1.5 px-2 pb-2">
        {data.map((d) => (
          <div key={d.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-full shrink-0" style={{ background: d.color }} />
              <span className="text-muted-foreground">{d.name}</span>
            </div>
            <span className="font-semibold tabular-nums ml-2">
              {d.value} <span className="text-muted-foreground font-normal">({Math.round((d.value / total) * 100)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function thisMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const to = now.toISOString().split("T")[0];
  return { from, to };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// 5-minute stale time — stats are expensive, don't need real-time
const STATS_QUERY_OPTS = { staleTime: 5 * 60 * 1000 } as const;

export default function DashboardPage() {
  const router = useRouter();
  const { from: mtdFrom, to: mtdTo } = thisMonthRange();

  // Heavy aggregations — server-side, cached 5 min
  const statsQuery = trpc.order.adminStats.useQuery(undefined, STATS_QUERY_OPTS);

  // Operational lists — lighter, shorter cache
  const ordersQuery = trpc.order.adminList.useQuery(
    { limit: 100 },
    { staleTime: 60 * 1000 },
  );
  const ticketsQuery = trpc.ticket.adminList.useQuery(
    { limit: 100 },
    { staleTime: 60 * 1000 },
  );
  const productsQuery = trpc.catalog.listProducts.useQuery(
    { limit: 100 },
    { staleTime: 5 * 60 * 1000 },
  );

  const stats = statsQuery.data;
  const orders = ordersQuery.data ?? [];
  const tickets = ticketsQuery.data ?? [];
  const products = productsQuery.data ?? [];

  const derived = useMemo(() => {
    const fulfillmentQueue = orders
      .filter((o) => FULFILLMENT_STATUSES.has(o.status))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const inTransit = orders.filter((o) => IN_TRANSIT_STATUSES.has(o.status));

    const needsReply = tickets.filter(
      (t) => t.status === "awaiting_admin" || t.status === "open"
    );
    const allOpen = tickets.filter((t) => t.status !== "resolved" && t.status !== "closed");

    const variants = products.flatMap((p) =>
      p.variants.map((v) => ({ ...v, productName: p.name, productId: p.id }))
    );
    const lowStock = variants
      .filter((v) => v.stockCached <= LOW_STOCK_THRESHOLD)
      .sort((a, b) => a.stockCached - b.stockCached)
      .slice(0, 8);

    return { fulfillmentQueue, inTransit, needsReply, allOpen, lowStock };
  }, [orders, tickets, products]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-title font-semibold leading-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">{todayLabel()}</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Revenue MTD"
          value={statsQuery.isError ? "Error" : stats ? formatInr(stats.mtdRevenue) : "—"}
          sub={
            statsQuery.isError
              ? statsQuery.error.message.slice(0, 60)
              : stats
              ? `${formatInr(stats.todayRevenue)} today · ${stats.todayOrderCount} orders`
              : "Loading…"
          }
          icon={IndianRupee}
          href={`/orders?from=${mtdFrom}&to=${mtdTo}`}
        />
        <KpiCard
          label="Needs fulfillment"
          value={derived.fulfillmentQueue.length}
          sub={
            derived.fulfillmentQueue.length > 0
              ? `Oldest: ${fmtDate(derived.fulfillmentQueue[0].createdAt)}`
              : "All caught up"
          }
          icon={PackageCheck}
          alert={derived.fulfillmentQueue.length > 0}
          href="/orders?status=paid"
        />
        <KpiCard
          label="In transit"
          value={derived.inTransit.length}
          sub="shipped / out for delivery"
          icon={Truck}
          href="/orders?status=shipped"
        />
        <KpiCard
          label="Open tickets"
          value={derived.allOpen.length}
          sub={
            derived.needsReply.length > 0
              ? `${derived.needsReply.length} need your reply`
              : "No pending replies"
          }
          icon={MessageSquare}
          alert={derived.needsReply.length > 0}
          href="/support"
        />
      </div>

      {/* Fulfillment queue + Order breakdown pie */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
        <Card>
          <CardHeader className="p-0">
            <SectionHeader
              title="Fulfillment queue"
              count={derived.fulfillmentQueue.length}
              href="/orders?status=paid"
            />
          </CardHeader>
          <CardContent className="px-5 pt-4 pb-2">
            {derived.fulfillmentQueue.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No orders pending fulfillment.</p>
            ) : (
              <div className="divide-y divide-border/50">
                {derived.fulfillmentQueue.map((o) => (
                  <button
                    key={o.id}
                    className="w-full flex items-center justify-between py-3 text-left hover:text-primary transition-colors"
                    onClick={() => router.push(`/orders/${o.id}`)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-mono font-medium">{o.orderNumber}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {getCustomerName(o.shippingAddress)} · {fmtDate(o.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <span className="text-sm font-semibold tabular-nums">{formatInr(Number(o.total))}</span>
                      <Badge variant={ORDER_STATUS_VARIANT[o.status] ?? "outline"} className="text-xs">
                        {ORDER_STATUS_LABEL[o.status] ?? o.status}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order status pie */}
        <Card>
          <CardHeader className="p-0">
            <div className="px-5 pt-5 pb-0">
              <CardTitle>Order breakdown</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">All time · by status</p>
            </div>
          </CardHeader>
          <CardContent className="px-2 pt-3 pb-2">
            {stats ? (
              <OrderStatusPie breakdown={stats.breakdown} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tickets + Recent orders */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">
        <Card>
          <CardHeader className="p-0">
            <SectionHeader title="Tickets needing reply" count={derived.needsReply.length} href="/support" />
          </CardHeader>
          <CardContent className="px-5 pt-4 pb-2">
            {derived.needsReply.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">All caught up.</p>
            ) : (
              <div className="divide-y divide-border/50">
                {derived.needsReply.slice(0, 6).map((t) => (
                  <button
                    key={t.id}
                    className="w-full flex items-start justify-between py-3 text-left hover:text-primary transition-colors gap-3"
                    onClick={() => router.push(`/support/${t.id}`)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.subject}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {t.user?.name ?? t.user?.email ?? "—"}
                      </p>
                    </div>
                    <Badge
                      variant={TICKET_STATUS_VARIANT[t.status] ?? "outline"}
                      className="text-[10px] shrink-0 mt-0.5"
                    >
                      {TICKET_STATUS_LABEL[t.status] ?? t.status}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-0">
            <SectionHeader title="Recent orders" href="/orders" />
          </CardHeader>
          <CardContent className="px-5 pt-4 pb-2">
            {orders.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              <div className="divide-y divide-border/50">
                {orders.slice(0, 7).map((o) => (
                  <button
                    key={o.id}
                    className="w-full flex items-center justify-between py-3 text-left hover:text-primary transition-colors"
                    onClick={() => router.push(`/orders/${o.id}`)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-mono font-medium">{o.orderNumber}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {getCustomerName(o.shippingAddress)} · {fmtDate(o.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <span className="text-sm font-semibold tabular-nums">{formatInr(Number(o.total))}</span>
                      <Badge variant={ORDER_STATUS_VARIANT[o.status] ?? "outline"} className="text-xs">
                        {ORDER_STATUS_LABEL[o.status] ?? o.status}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Low stock */}
      <Card>
        <CardHeader className="p-0">
          <SectionHeader title="Low stock" count={derived.lowStock.length} href="/inventory" />
        </CardHeader>
        <CardContent className="px-5 pt-4 pb-2">
          {derived.lowStock.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">All variants well-stocked.</p>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pb-2">
              {derived.lowStock.map((v) => (
                <Link
                  key={v.id}
                  href={`/products/${v.productId}`}
                  className="rounded-lg border border-border px-3 py-2.5 hover:bg-muted/40 transition-colors"
                >
                  <p className="text-sm font-medium truncate">{v.productName}</p>
                  <p className="text-[11px] font-mono text-muted-foreground">{v.sku}</p>
                  <p className={`mt-1.5 text-sm font-bold tabular-nums ${v.stockCached === 0 ? "text-destructive" : "text-amber-600"}`}>
                    {v.stockCached === 0 ? "Out of stock" : `${v.stockCached} left`}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* In-transit pills */}
      {derived.inTransit.length > 0 && (
        <Card>
          <CardHeader className="p-0">
            <div className="flex items-center gap-2 px-5 pt-5 pb-0">
              <Truck className="size-4 text-muted-foreground" />
              <CardTitle>In transit ({derived.inTransit.length})</CardTitle>
              <Link href="/orders?status=shipped" className="ml-auto flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline">
                View all <ArrowRight className="size-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-5 pt-4 pb-3">
            <div className="flex flex-wrap gap-2">
              {derived.inTransit.map((o) => (
                <button
                  key={o.id}
                  onClick={() => router.push(`/orders/${o.id}`)}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted/40 transition-colors"
                >
                  <span className="font-mono font-medium">{o.orderNumber}</span>
                  <Badge variant={ORDER_STATUS_VARIANT[o.status] ?? "outline"} className="text-[10px] h-4 px-1.5">
                    {ORDER_STATUS_LABEL[o.status] ?? o.status}
                  </Badge>
                  {o.waybill && (
                    <span className="text-muted-foreground font-mono">{o.waybill}</span>
                  )}
                  {/* Flag orders still waiting on parcels — each unit books its own AWB. */}
                  {o.shipments && o.shipments.some((s) => !s.waybill && s.status !== "cancelled") && (
                    <span className="text-orange-600">
                      {o.shipments.filter((s) => !s.waybill && s.status !== "cancelled").length} unbooked
                    </span>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Out-of-stock alert */}
      {derived.lowStock.some((v) => v.stockCached === 0) && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <AlertTriangle className="size-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive font-medium">
            {derived.lowStock.filter((v) => v.stockCached === 0).length} variant(s) are out of stock.{" "}
            <Link href="/inventory" className="underline">Restock now →</Link>
          </p>
        </div>
      )}
    </div>
  );
}
