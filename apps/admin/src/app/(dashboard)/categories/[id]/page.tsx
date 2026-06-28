"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatInr } from "@/lib/format";
import { trpc } from "@/lib/trpc";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  active: "default",
  draft: "secondary",
  archived: "outline",
};

export default function CategoryDetailPage() {
  const { id } = useParams<{ id: string }>();

  const categories = trpc.catalog.listCategoriesWithCount.useQuery();
  const products = trpc.catalog.listProducts.useQuery({ categoryId: id, limit: 100 });

  const category = categories.data?.find((c) => c.id === id);

  const data = products.data ?? [];
  const activeCount = data.filter((p) => p.status === "active").length;
  const totalStock = data.flatMap((p) => p.variants).reduce((sum, v) => sum + v.stockCached, 0);

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/categories">
              <ChevronLeft className="size-4" />
              Categories
            </Link>
          </Button>
          <div>
            <h1 className="text-title font-semibold leading-tight">
              {category?.name ?? "Category"}
            </h1>
            {category && (
              <p className="mt-0.5 text-sm text-muted-foreground font-mono">/{category.slug}</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total products", value: data.length },
          { label: "Active", value: activeCount },
          { label: "Total stock", value: totalStock },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="pt-5 pb-4">
              <p className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                {label}
              </p>
              <p className="mt-1.5 text-kpi font-semibold leading-none tabular-nums">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Products table */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14" />
              <TableHead>Name</TableHead>
              <TableHead>Concentration</TableHead>
              <TableHead>Price range</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell>
              </TableRow>
            )}
            {!products.isLoading && data.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No products in this category yet.{" "}
                  <Link href="/products/new" className="text-primary hover:underline">
                    Add one →
                  </Link>
                </TableCell>
              </TableRow>
            )}
            {data.map((product) => {
              const totalStock = product.variants.reduce((sum, v) => sum + v.stockCached, 0);
              const prices = product.variants.map((v) => Number(v.mrp)).filter(Boolean);
              const minPrice = prices.length ? Math.min(...prices) : null;
              const maxPrice = prices.length ? Math.max(...prices) : null;
              const priceRange =
                minPrice === null
                  ? "—"
                  : minPrice === maxPrice
                    ? formatInr(minPrice)
                    : `${formatInr(minPrice)} – ${formatInr(maxPrice!)}`;
              const primaryImg = (product.images.find((i) => i.isPrimary) ?? product.images[0]) as
                | (typeof product.images)[number] & { url?: string }
                | undefined;

              return (
                <TableRow key={product.id}>
                  <TableCell className="px-3">
                    {primaryImg?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={primaryImg.url}
                        alt={product.name}
                        className="size-10 rounded object-cover ring-1 ring-border"
                      />
                    ) : (
                      <div className="size-10 flex items-center justify-center rounded bg-muted text-[11px] font-bold text-muted-foreground">
                        {product.name[0]?.toUpperCase()}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/products/${product.id}`}
                      className="font-medium hover:underline"
                    >
                      {product.name}
                    </Link>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {product.variants.length} variant{product.variants.length !== 1 ? "s" : ""}
                    </p>
                  </TableCell>
                  <TableCell className="text-muted-foreground uppercase text-[12px] tracking-wide">
                    {product.concentration}
                  </TableCell>
                  <TableCell className="font-medium tabular-nums">{priceRange}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[product.status] ?? "outline"}>{product.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{totalStock}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
