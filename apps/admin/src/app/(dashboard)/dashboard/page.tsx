"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

const LOW_STOCK_THRESHOLD = 5;

function todayLabel() {
  const d = new Date();
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Ascending sparkbars — all filled, height 6px→30px left→right */
function SparkBars({ color = "primary" }: { color?: "primary" | "destructive" }) {
  const heights = [6, 8, 10, 12, 14, 17, 20, 24, 27, 30];
  return (
    <div className="mt-4 flex items-end gap-[3px]" aria-hidden>
      {heights.map((h, i) => (
        <div
          key={i}
          style={{ height: `${h}px` }}
          className={cn(
            "flex-1 rounded-[2px]",
            color === "primary" ? "bg-primary/80" : "bg-destructive/60",
          )}
        />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const products = trpc.catalog.listProducts.useQuery({ limit: 100 });
  const categories = trpc.catalog.listCategories.useQuery();

  const data = products.data ?? [];
  const variants = data.flatMap((p) =>
    p.variants.map((v) => ({ ...v, productName: p.name, productId: p.id })),
  );

  const activeCount = data.filter((p) => p.status === "active").length;
  const totalStock = variants.reduce((sum, v) => sum + v.stockCached, 0);
  const lowCount = variants.filter((v) => v.stockCached <= LOW_STOCK_THRESHOLD).length;

  const kpis = [
    { label: "Products", value: data.length, sub: `${activeCount} active`, warn: false },
    { label: "Categories", value: categories.data?.length ?? 0, sub: "in catalogue", warn: false },
    { label: "Stock on hand", value: totalStock, sub: `${variants.length} variant${variants.length !== 1 ? "s" : ""}`, warn: false },
    { label: "Low stock", value: lowCount, sub: `≤ ${LOW_STOCK_THRESHOLD} units`, warn: lowCount > 0 },
  ] as const;

  const recentProducts = [...data]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  const lowStockVariants = variants
    .filter((v) => v.stockCached <= LOW_STOCK_THRESHOLD)
    .sort((a, b) => a.stockCached - b.stockCached)
    .slice(0, 6);

  const loading = products.isLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-title font-semibold leading-tight">Dashboard</h1>
        <p className="mt-1 text-body-md text-muted-foreground">
          {todayLabel()} · here&apos;s how the maison is doing
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-5">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="px-5 pt-5 pb-4">
              <div className="flex items-start justify-between">
                <p className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">{k.label}</p>
                {k.warn && k.value > 0 && (
                  <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">
                    alert
                  </Badge>
                )}
              </div>
              <p className="mt-3 text-kpi font-semibold leading-none tabular-nums text-foreground">
                {loading ? "—" : k.value}
              </p>
              <p className="mt-1.5 text-caption text-muted-foreground">{k.sub}</p>
              <SparkBars color={k.warn ? "destructive" : "primary"} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content row */}
      <div className="grid grid-cols-[1.7fr_1fr] gap-5">
        {/* Recently added */}
        <Card>
          <CardHeader className="flex-row items-center justify-between px-5 pt-5 pb-0">
            <CardTitle>Recently added</CardTitle>
            <Link href="/products" className="text-caption font-semibold text-primary hover:underline">
              View all →
            </Link>
          </CardHeader>
          <CardContent className="px-5 pt-4 pb-2">
            {recentProducts.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">No products yet.</p>
            )}
            <div className="divide-y divide-border/50">
              {recentProducts.map((p) => (
                <Link
                  key={p.id}
                  href={`/products/${p.id}`}
                  className="flex items-center justify-between py-3 transition-colors hover:text-primary"
                >
                  <div className="flex items-center gap-3">
                    {(() => {
                      const img = p.images.find((i) => i.isPrimary) ?? p.images[0];
                      return img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={(img as typeof img & { url?: string }).url ?? ""}
                          alt={p.name}
                          className="size-8 shrink-0 rounded object-cover ring-1 ring-border"
                        />
                      ) : (
                        <div className="size-8 shrink-0 flex items-center justify-center rounded bg-muted text-[11px] font-bold text-muted-foreground">
                          {p.name[0]?.toUpperCase()}
                        </div>
                      );
                    })()}
                    <div>
                      <p className="text-body-md font-medium leading-tight">{p.name}</p>
                      <p className="text-caption text-muted-foreground">
                        {p.category.name} · {p.concentration.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <Badge variant={p.status === "active" ? "default" : "secondary"}>
                    {p.status}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Low stock */}
        <Card>
          <CardHeader className="flex-row items-center justify-between px-5 pt-5 pb-0">
            <CardTitle>Low stock</CardTitle>
            {lowStockVariants.length > 0 && (
              <Badge variant="destructive" className="tabular-nums">
                {lowStockVariants.length} items
              </Badge>
            )}
          </CardHeader>
          <CardContent className="px-5 pt-4 pb-2">
            {lowStockVariants.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Nothing critical. All good.
              </p>
            )}
            <div className="divide-y divide-border/50">
              {lowStockVariants.map((v) => (
                <Link
                  key={v.id}
                  href={`/products/${v.productId}`}
                  className="flex items-center justify-between py-3 transition-colors hover:text-primary"
                >
                  <div>
                    <p className="text-body-md font-medium leading-tight">{v.productName}</p>
                    <p className="text-caption text-muted-foreground">{v.sku}</p>
                  </div>
                  <Badge variant="destructive" className="tabular-nums">
                    {v.stockCached} left
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
