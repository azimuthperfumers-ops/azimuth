"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

export default function ProductsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search = searchParams.get("q") ?? "";
  const statusFilter = (searchParams.get("status") ?? "all") as StatusFilter;

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set(key, value); else params.delete(key);
    router.replace(`${pathname}?${params.toString()}`);
  }

  const products = trpc.catalog.listProducts.useQuery({
    limit: 50,
    search: search || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
  });
  const linkedVariants = trpc.discount.listLinkedVariants.useQuery();

  const discountMap = new Map(
    (linkedVariants.data ?? [])
      .filter((lv) => lv.discount.isActive)
      .map((lv) => [lv.variantId, { type: lv.discount.type, value: Number(lv.discount.value) }]),
  );

  function discountedPrice(sellingPrice: number, variantId: string): number | null {
    const d = discountMap.get(variantId);
    if (!d) return null;
    return d.type === "percentage" ? sellingPrice * (1 - d.value / 100) : sellingPrice - d.value;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-title font-semibold">Products</h1>
          <p className="text-sm text-muted-foreground">Perfumes in the catalogue.</p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="search"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setParam("q", e.target.value)}
            className="w-60"
          />
          <Button asChild>
            <Link href="/products/new">+ Add product</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2.5">
        {STATUS_FILTERS.map((filter) => (
          <Button
            key={filter.value}
            size="sm"
            variant={statusFilter === filter.value ? "default" : "outline"}
            onClick={() => setParam("status", filter.value)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14" />
              <TableHead>Name</TableHead>
              <TableHead>Concentration</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price range</TableHead>
              <TableHead>Discounted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            )}

            {!products.isLoading && products.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  {search ? "No products match that search." : "No products yet."}
                </TableCell>
              </TableRow>
            )}

            {products.data?.map((product) => {
              const totalStock = product.variants.reduce((sum, v) => sum + v.stockCached, 0);
              const prices = product.variants.map((v) => Number(v.sellingPrice)).filter(Boolean);
              const minPrice = prices.length ? Math.min(...prices) : null;
              const maxPrice = prices.length ? Math.max(...prices) : null;
              const priceRange =
                minPrice === null
                  ? "—"
                  : minPrice === maxPrice
                    ? formatInr(minPrice)
                    : `${formatInr(minPrice)} – ${formatInr(maxPrice!)}`;

              const discPrices = product.variants
                .map((v) => discountedPrice(Number(v.sellingPrice), v.id))
                .filter((p): p is number => p !== null);
              const minDisc = discPrices.length ? Math.min(...discPrices) : null;
              const maxDisc = discPrices.length ? Math.max(...discPrices) : null;
              const discRange =
                minDisc === null
                  ? null
                  : minDisc === maxDisc
                    ? formatInr(minDisc)
                    : `${formatInr(minDisc)} – ${formatInr(maxDisc!)}`;

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
                    <Link href={`/products/${product.id}`} className="font-medium hover:underline">
                      {product.name}
                    </Link>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {product.variants.length} variant{product.variants.length !== 1 ? "s" : ""}
                    </p>
                  </TableCell>
                  <TableCell className="text-muted-foreground uppercase text-[12px] tracking-wide">
                    {product.concentration}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{product.category.name}</TableCell>
                  <TableCell className="font-medium tabular-nums">{priceRange}</TableCell>
                  <TableCell className="tabular-nums">
                    {discRange ? (
                      <span className="font-semibold text-emerald-600">{discRange}</span>
                    ) : (
                      <span className="text-muted-foreground text-[12px]">—</span>
                    )}
                  </TableCell>
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
