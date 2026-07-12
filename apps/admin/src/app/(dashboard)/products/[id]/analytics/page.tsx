"use client";

import { use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Heart,
  IndianRupee,
  Package,
  Repeat,
  ShoppingBag,
  ShoppingCart,
  Star,
  TrendingDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

// Heavy aggregates are Redis-cached server-side for 10 min — numbers can lag
// live orders by up to that long.

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  warn?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <Icon className="size-4 text-muted-foreground/50" />
        </div>
        <p className={`mt-3 text-2xl font-bold tabular-nums leading-none ${warn ? "text-destructive" : ""}`}>{value}</p>
        {sub && <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

const chartTooltipStyle = {
  fontSize: 12,
  borderRadius: 8,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--foreground))",
};

export default function ProductAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data, isLoading } = trpc.analytics.productDetail.useQuery(
    { productId: id },
    { staleTime: 10 * 60 * 1000 },
  );

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Link href={`/products/${id}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" /> Product
        </Link>
        <p className="text-sm text-muted-foreground">No analytics available — product not found or has no variants.</p>
      </div>
    );
  }

  const trendData = data.monthlyTrend.map((t) => ({
    label: new Date(t.month).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
    revenueK: Math.round(t.revenue / 100) / 10,
    units: t.units,
  }));

  const momentum =
    data.revenue.prev30To90Days > 0
      ? data.revenue.last30Days / data.revenue.prev30To90Days - 1
      : null;

  const maxDist = Math.max(1, ...data.rating.distribution.map((d) => d.count));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href={`/products/${id}`} className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" /> Product
        </Link>
        <h1 className="text-title font-semibold">{data.product.name} — analytics</h1>
        <p className="text-sm text-muted-foreground">
          Product-level performance across all sizes. Cached — refreshed every 10 minutes.
        </p>
      </div>

      {/* Revenue + orders tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Lifetime revenue"
          value={formatInr(data.revenue.lifetime)}
          sub={`${pct(data.revenue.storeShare)} of store revenue`}
          icon={IndianRupee}
        />
        <StatCard
          label="Last 30 days"
          value={formatInr(data.revenue.last30Days)}
          sub={
            momentum == null
              ? `${data.units.last30Days} units`
              : `${momentum >= 0 ? "+" : ""}${pct(momentum)} vs prior 30d · ${data.units.last30Days} units`
          }
          icon={IndianRupee}
          warn={momentum != null && momentum < -0.2}
        />
        <StatCard
          label="Orders"
          value={String(data.orders.confirmed)}
          sub={`${formatInr(data.orders.avgRevenuePerOrder)} avg per order`}
          icon={ShoppingBag}
        />
        <StatCard
          label="Units sold"
          value={String(data.units.lifetime)}
          sub={
            data.units.stockCoverMonths != null
              ? `${data.units.currentStock} in stock · ~${data.units.stockCoverMonths.toFixed(1)} months cover`
              : `${data.units.currentStock} in stock`
          }
          icon={Package}
        />
      </div>

      {/* Business ratios */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Return rate"
          value={pct(data.ratios.returnRate)}
          sub="Of completed orders"
          icon={TrendingDown}
          warn={data.ratios.returnRate > 0.1}
        />
        <StatCard
          label="Cancellation rate"
          value={pct(data.ratios.cancellationRate)}
          icon={TrendingDown}
          warn={data.ratios.cancellationRate > 0.1}
        />
        <StatCard
          label="Repeat buyers"
          value={pct(data.orders.repeatRate)}
          sub={`${data.orders.repeatBuyers} of ${data.orders.buyers} buyers came back`}
          icon={Repeat}
        />
        <StatCard
          label="Realized discount"
          value={pct(data.ratios.realizedDiscount)}
          sub={`Avg selling price ${formatInr(data.ratios.avgSellingPrice)}`}
          icon={IndianRupee}
        />
      </div>

      {/* Demand signals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Rating"
          value={data.rating.real != null ? `${data.rating.real.toFixed(1)} ★` : "—"}
          sub={
            data.rating.displayMode === "mock"
              ? `${data.rating.realCount} real · storefront shows mock ${data.rating.mock.toFixed(1)} (${data.rating.mockCount})`
              : `${data.rating.realCount} customer ratings (shown on storefront)`
          }
          icon={Star}
        />
        <StatCard label="Wishlisted" value={String(data.demand.wishlisted)} icon={Heart} />
        <StatCard label="In carts now" value={String(data.demand.inCarts)} icon={ShoppingCart} />
        <StatCard label="Unique buyers" value={String(data.orders.buyers)} icon={ShoppingBag} />
      </div>

      {/* Monthly trend */}
      <Card>
        <CardHeader className="px-5 pt-5 pb-2">
          <CardTitle>Monthly revenue & units — last 12 months</CardTitle>
          <p className="text-xs text-muted-foreground">Revenue in ₹ thousands (bars) · Units sold (line)</p>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          {trendData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">No confirmed sales yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={trendData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="rev" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `₹${v}k`} />
                <YAxis yAxisId="units" orientation="right" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(value, name) =>
                    name === "Revenue (₹k)" ? [`₹${Number(value).toFixed(1)}k`, name] : [String(value), name]
                  }
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="rev" dataKey="revenueK" name="Revenue (₹k)" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                <Line yAxisId="units" dataKey="units" name="Units" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Rating distribution */}
      <Card>
        <CardHeader className="px-5 pt-5 pb-2">
          <CardTitle>Rating distribution</CardTitle>
          <p className="text-xs text-muted-foreground">Real customer ratings only — mock display numbers are not included.</p>
        </CardHeader>
        <CardContent className="p-5 pt-2">
          {data.rating.realCount === 0 ? (
            <p className="text-sm text-muted-foreground">No customer ratings yet.</p>
          ) : (
            <div className="space-y-2">
              {[...data.rating.distribution].reverse().map((d) => (
                <div key={d.rating} className="flex items-center gap-3">
                  <span className="w-8 text-xs font-medium tabular-nums">{d.rating} ★</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-foreground"
                      style={{ width: `${(d.count / maxDist) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">{d.count}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Variant split */}
      <Card>
        <CardHeader className="px-5 pt-5 pb-2">
          <CardTitle>Size breakdown</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="text-right">Units sold</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.variantSplit.map((v) => (
                <TableRow key={v.variantId}>
                  <TableCell className="font-mono text-xs">{v.sku}</TableCell>
                  <TableCell>{v.sizeMl}ml</TableCell>
                  <TableCell className="text-right tabular-nums">{v.units}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatInr(v.revenue)}</TableCell>
                  <TableCell className="text-right tabular-nums">{v.stock}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Data cached at {new Date(data.cachedAt).toLocaleTimeString("en-IN")} — refreshes automatically every 10 minutes.
      </p>
    </div>
  );
}
