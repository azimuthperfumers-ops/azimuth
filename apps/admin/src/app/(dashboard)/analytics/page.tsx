"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  BarChart,
} from "recharts";
import {
  TrendingDown,
  RefreshCw,
  ArrowLeftRight,
  IndianRupee,
  Truck,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

// ─── Types ────────────────────────────────────────────────────────────────────

type Zoom = "week" | "month" | "year";

// ─── Period helpers ────────────────────────────────────────────────────────────

function getInitialAnchor(z: Zoom): Date {
  const now = new Date();
  if (z === "week") {
    const d = new Date(now);
    const diff = (d.getDay() + 6) % 7; // days since Monday
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (z === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  return new Date(now.getFullYear(), 0, 1);
}

function navigatePeriod(anchor: Date, z: Zoom, dir: -1 | 1): Date {
  const d = new Date(anchor);
  if (z === "week") d.setDate(d.getDate() + dir * 7);
  else if (z === "month") d.setMonth(d.getMonth() + dir);
  else d.setFullYear(d.getFullYear() + dir);
  return d;
}

function formatPeriodLabel(anchor: Date, z: Zoom): string {
  if (z === "week") {
    const end = new Date(anchor);
    end.setDate(end.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    return `${fmt(anchor)} – ${end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
  }
  if (z === "month") {
    return anchor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  }
  return String(anchor.getFullYear());
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBucket(bucket: string, zoom: Zoom): string {
  const d = new Date(bucket);
  if (zoom === "year") {
    return d.toLocaleDateString("en-IN", { month: "short" });
  }
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function getCustomerName(addr: unknown): string {
  if (addr && typeof addr === "object" && "fullName" in addr) {
    return (addr as { fullName: string }).fullName ?? "—";
  }
  return "—";
}

// ─── Status helpers (reuse from orders page) ──────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Awaiting payment",
  paid: "Paid",
  processing: "Processing",
  picked_up: "Picked up",
  out_for_delivery: "Out for delivery",
  delivery_attempted: "Del. attempted",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
  rto_initiated: "RTO initiated",
  rto_delivered: "RTO delivered",
};

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, warn }: {
  label: string; value: string; sub?: string; icon: React.ElementType; warn?: boolean;
}) {
  return (
    <Card>
      <CardContent className="px-5 pt-5 pb-5">
        <div className="flex items-start justify-between">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
          <Icon className={`size-4 ${warn ? "text-destructive" : "text-muted-foreground/60"}`} />
        </div>
        <p className={`mt-3 text-2xl font-bold tabular-nums leading-none ${warn ? "text-destructive" : ""}`}>{value}</p>
        {sub && <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

const chartTooltipStyle = {
  fontSize: 12,
  borderRadius: 8,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--foreground))",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const ZOOM_LABELS: Record<Zoom, string> = { week: "Week", month: "Month", year: "Year" };

export default function AnalyticsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const zoom = (searchParams.get("zoom") ?? "month") as Zoom;

  const anchor = useMemo(() => {
    const p = searchParams.get("period");
    if (p) {
      const d = new Date(p);
      if (!isNaN(d.getTime())) return d;
    }
    return getInitialAnchor(zoom);
  }, [searchParams, zoom]);

  function setZoom(z: Zoom) {
    const params = new URLSearchParams();
    params.set("zoom", z);
    params.set("period", getInitialAnchor(z).toISOString().split("T")[0]);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function navigateAnchor(dir: -1 | 1) {
    const next = navigatePeriod(anchor, zoom, dir);
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", next.toISOString().split("T")[0]);
    router.replace(`${pathname}?${params.toString()}`);
  }

  const periodStart = anchor.toISOString();
  const periodLabel = formatPeriodLabel(anchor, zoom);

  const { data, isLoading, isError, error, refetch, isFetching } = trpc.analytics.orders.useQuery(
    { zoom, periodStart },
    { staleTime: 10 * 60 * 1000 },
  );

  // Orders table query — uses dateFrom/dateTo echoed back from router
  const ordersQuery = trpc.order.adminList.useQuery(
    {
      dateFrom: data?.periodDateFrom,
      dateTo: data?.periodDateTo,
      limit: 200,
    },
    { enabled: !!data?.periodDateFrom, staleTime: 5 * 60 * 1000 },
  );

  // "View all" URL
  const viewAllHref = data
    ? `/orders?from=${data.periodDateFrom}&to=${data.periodDateTo}`
    : "/orders";

  const s = data?.summary;

  if (isError) {
    return (
      <div className="space-y-4">
        <h1 className="text-title font-semibold">Analytics</h1>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
          Failed to load analytics: {error?.message ?? "Unknown error"}. Restart the server and try again.
        </div>
      </div>
    );
  }

  const chartData = (data?.timeSeries ?? []).map((r) => ({
    ...r,
    label: fmtBucket(r.bucket, zoom),
    revenueK: r.revenue / 1000,
  }));

  const shippingChartData = (data?.timeSeries ?? []).map((r) => ({
    label: fmtBucket(r.bucket, zoom),
    "Customer paid": r.shippingCustomer,
    "We absorbed": r.shippingAbsorbed,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-title font-semibold">Analytics</h1>
          <p className="text-sm text-muted-foreground">Revenue, shipping costs, and fulfilment health.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period navigator */}
          <div className="flex items-center gap-1 border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => navigateAnchor(-1)}
              className="px-2 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              aria-label="Previous period"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="px-3 py-1.5 text-sm font-medium min-w-[160px] text-center border-x border-border">
              {periodLabel}
            </span>
            <button
              onClick={() => navigateAnchor(1)}
              className="px-2 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              aria-label="Next period"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* Zoom toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["week", "month", "year"] as Zoom[]).map((z) => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  zoom === z
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                {ZOOM_LABELS[z]}
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Revenue" value={s ? formatInr(s.totalRevenue) : "—"} icon={IndianRupee} />
        <StatCard label="Orders" value={s ? String(s.totalOrders) : "—"} icon={ShoppingBag} />
        <StatCard
          label="Shipping (actual)"
          value={s ? formatInr(s.totalShippingActual) : "—"}
          sub={s ? `Customer paid ${formatInr(s.totalShippingCustomer)}` : undefined}
          icon={Truck}
        />
        <StatCard
          label="Shipping absorbed"
          value={s ? formatInr(s.totalShippingAbsorbed) : "—"}
          sub="Our net shipping cost"
          icon={Truck}
          warn={(s?.totalShippingAbsorbed ?? 0) > 0}
        />
        <StatCard
          label="Return rate"
          value={s ? pct(s.returnRate) : "—"}
          sub={s ? `${s.returnCount} RTO orders` : undefined}
          icon={TrendingDown}
          warn={(s?.returnRate ?? 0) > 0.1}
        />
        <StatCard
          label="Exchange rate"
          value={s ? pct(s.exchangeRate) : "—"}
          sub={s ? `${s.exchangeCount} exchanges` : undefined}
          icon={ArrowLeftRight}
        />
      </div>

      {/* Revenue + Orders chart */}
      <Card>
        <CardHeader className="px-5 pt-5 pb-2">
          <CardTitle>Revenue & Orders</CardTitle>
          <p className="text-xs text-muted-foreground">Revenue in ₹ thousands (bars) · Order count (line)</p>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          {isLoading ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
          ) : chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">No data for this period.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  yAxisId="rev"
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `₹${v}k`}
                />
                <YAxis
                  yAxisId="cnt"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(value, name) =>
                    name === "Revenue (₹k)"
                      ? [`₹${Number(value).toFixed(1)}k`, name]
                      : [String(value), name]
                  }
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="rev" dataKey="revenueK" name="Revenue (₹k)" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                <Line yAxisId="cnt" dataKey="orderCount" name="Orders" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Shipping cost split chart */}
      <Card>
        <CardHeader className="px-5 pt-5 pb-2">
          <CardTitle>Shipping cost split</CardTitle>
          <p className="text-xs text-muted-foreground">
            Customer paid vs what we absorbed
          </p>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          {isLoading ? (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
          ) : shippingChartData.every((d) => d["Customer paid"] === 0 && d["We absorbed"] === 0) ? (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
              No shipping cost data yet. Enter actual Delhivery cost when marking orders as shipped.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={shippingChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `₹${v}`} />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(v, name) => [formatInr(Number(v)), name]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Customer paid" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="We absorbed" stackId="a" fill="#f43f5e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Orders table for this period */}
      <Card>
        <CardHeader className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Orders — {periodLabel}</CardTitle>
              {ordersQuery.data && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {ordersQuery.data.length} order{ordersQuery.data.length !== 1 ? "s" : ""}
                  {" · "}
                  {formatInr(ordersQuery.data.reduce((sum, o) => sum + Number(o.total), 0))} total
                </p>
              )}
            </div>
            <Link
              href={viewAllHref}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              View all
              <ExternalLink className="size-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordersQuery.isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    Loading orders…
                  </TableCell>
                </TableRow>
              )}
              {!ordersQuery.isLoading && (!ordersQuery.data || ordersQuery.data.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    No orders in this period.
                  </TableCell>
                </TableRow>
              )}
              {ordersQuery.data?.map((order) => (
                <TableRow
                  key={order.id}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => router.push(`/orders/${order.id}`)}
                >
                  <TableCell className="font-mono text-sm font-medium">{order.orderNumber}</TableCell>
                  <TableCell className="text-sm">
                    {getCustomerName(order.shippingAddress)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fmtDate(order.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[11px]">
                      {STATUS_LABEL[order.status] ?? order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatInr(Number(order.total))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Returns + Exchanges + Refunds */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Returns (RTO) */}
        <Card>
          <CardHeader className="px-5 pt-5 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="size-4 text-muted-foreground" />
                RTO / Returns
              </CardTitle>
              {data && (
                <Badge variant={data.returns.length > 0 ? "destructive" : "outline"}>
                  {data.returns.length}
                </Badge>
              )}
            </div>
            {s && s.returnCount > 0 && (
              <p className="text-xs text-muted-foreground">{pct(s.returnRate)} return rate</p>
            )}
          </CardHeader>
          <CardContent className="px-5 pb-3">
            {(!data || data.returns.length === 0) ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No returns in this period.</p>
            ) : (
              <div className="divide-y divide-border/50">
                {data.returns.map((o) => (
                  <button
                    key={o.id}
                    className="w-full flex items-start justify-between py-2.5 text-left hover:text-primary transition-colors gap-2"
                    onClick={() => router.push(`/orders/${o.id}`)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-mono font-medium">{o.orderNumber}</p>
                      <p className="text-xs text-muted-foreground truncate">{getCustomerName(o.shippingAddress)}</p>
                      <p className="text-[11px] text-muted-foreground">{fmtDate(o.createdAt)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-sm font-semibold tabular-nums">{formatInr(Number(o.total))}</span>
                      <Badge variant="destructive" className="text-[10px]">
                        {o.status === "rto_delivered" ? "RTO delivered" : "RTO initiated"}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Exchanges */}
        <Card>
          <CardHeader className="px-5 pt-5 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ArrowLeftRight className="size-4 text-muted-foreground" />
                Exchanges
              </CardTitle>
              {data && (
                <Badge variant={data.exchanges.length > 0 ? "secondary" : "outline"}>
                  {data.exchanges.length}
                </Badge>
              )}
            </div>
            {s && s.exchangeCount > 0 && (
              <p className="text-xs text-muted-foreground">{pct(s.exchangeRate)} exchange rate</p>
            )}
          </CardHeader>
          <CardContent className="px-5 pb-3">
            {(!data || data.exchanges.length === 0) ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No exchanges in this period.</p>
            ) : (
              <div className="divide-y divide-border/50">
                {data.exchanges.map((t) => (
                  <button
                    key={t.id}
                    className="w-full flex items-start justify-between py-2.5 text-left hover:text-primary transition-colors gap-2"
                    onClick={() => router.push(`/support/${t.id}`)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.subject}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {t.user?.name ?? t.user?.email ?? "—"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{fmtDate(t.createdAt)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {t.order && (
                        <span className="text-xs font-mono text-muted-foreground">{t.order.orderNumber}</span>
                      )}
                      <Badge variant="outline" className={`text-[10px] capitalize ${
                        t.status === "open" || t.status === "awaiting_admin" ? "border-destructive/40 text-destructive" : ""
                      }`}>
                        {t.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Refunds */}
        <Card>
          <CardHeader className="px-5 pt-5 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <IndianRupee className="size-4 text-muted-foreground" />
                Refunds
              </CardTitle>
              {data && (
                <Badge variant={data.refunds.length > 0 ? "destructive" : "outline"}>
                  {data.refunds.length}
                </Badge>
              )}
            </div>
            {s && s.refundCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {pct(s.refundRate)} refund rate · {formatInr(data?.refunds.reduce((sum, o) => sum + Number(o.total), 0) ?? 0)} lost
              </p>
            )}
          </CardHeader>
          <CardContent className="px-5 pb-3">
            {(!data || data.refunds.length === 0) ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No refunds in this period.</p>
            ) : (
              <div className="divide-y divide-border/50">
                {data.refunds.map((o) => (
                  <button
                    key={o.id}
                    className="w-full flex items-start justify-between py-2.5 text-left hover:text-primary transition-colors gap-2"
                    onClick={() => router.push(`/orders/${o.id}`)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-mono font-medium">{o.orderNumber}</p>
                      <p className="text-xs text-muted-foreground truncate">{getCustomerName(o.shippingAddress)}</p>
                      <p className="text-[11px] text-muted-foreground">{fmtDate(o.createdAt)}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-destructive shrink-0">
                      {formatInr(Number(o.total))}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
