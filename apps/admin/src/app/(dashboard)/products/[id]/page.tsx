"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BookOpen } from "lucide-react";

import { AddStockDialog } from "@/components/products/add-stock-dialog";
import { AddVariantDialog } from "@/components/products/add-variant-dialog";
import { EditProductDialog } from "@/components/products/edit-product-dialog";
import { EditVariantDialog } from "@/components/products/edit-variant-dialog";
import { ProductImagesCard } from "@/components/products/product-images-card";
import { ProductNotesCard } from "@/components/products/product-notes-card";
import { ProductRatingCard } from "@/components/products/product-rating-card";
import { RemoveStockDialog } from "@/components/products/remove-stock-dialog";
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
import { formatInr } from "@/lib/format";
import { trpc } from "@/lib/trpc";

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const productId = params.id;

  const product = trpc.catalog.getProduct.useQuery({ id: productId });
  const variantDiscounts = trpc.discount.listForProduct.useQuery({ productId });
  const [stockDialogVariantId, setStockDialogVariantId] = useState<string | null>(null);
  const [removeStockVariantId, setRemoveStockVariantId] = useState<string | null>(null);
  const [editVariantId, setEditVariantId] = useState<string | null>(null);

  // variantId → { id, name, type, value } (active only)
  const discountByVariant = new Map(
    (variantDiscounts.data ?? [])
      .filter((d) => d.discount.isActive)
      .map((d) => [
        d.variantId,
        { id: d.discount.id, name: d.discount.name, type: d.discount.type, value: Number(d.discount.value) },
      ]),
  );

  function discountedPrice(mrp: number | string, variantId: string): number | null {
    const disc = discountByVariant.get(variantId);
    if (!disc) return null;
    const base = Number(mrp);
    return disc.type === "percentage" ? base * (1 - disc.value / 100) : base - disc.value;
  }

  if (product.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (!product.data) {
    return <p className="text-sm text-muted-foreground">Product not found.</p>;
  }

  const data = product.data;
  const stockVariant = data.variants.find((v) => v.id === stockDialogVariantId);
  const removeStockVariant = data.variants.find((v) => v.id === removeStockVariantId);
  const variantBeingEdited = data.variants.find((v) => v.id === editVariantId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {(() => {
            const img = data.images.find((i) => i.isPrimary) ?? data.images[0];
            return img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={(img as typeof img & { url?: string }).url ?? ""}
                alt={data.name}
                className="size-11 shrink-0 rounded object-cover ring-1 ring-border"
              />
            ) : (
              <div className="size-11 shrink-0 flex items-center justify-center rounded bg-muted text-base font-bold text-muted-foreground">
                {data.name[0]?.toUpperCase()}
              </div>
            );
          })()}
          <div>
            <h1 className="font-heading text-[2rem] font-medium leading-tight">{data.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {data.category.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={data.status === "active" ? "default" : "secondary"}>{data.status}</Badge>
          <Button asChild variant="outline" size="sm">
            <Link href={`/products/${data.id}/ledger`}>
              <BookOpen className="size-3.5 mr-1.5" />
              Ledger
            </Link>
          </Button>
          <EditProductDialog product={data} />
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Variants</CardTitle>
          <AddVariantDialog productId={data.id} />
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Concentration</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>MRP</TableHead>
                <TableHead>Discounted</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.variants.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No variants yet — add one to start tracking stock.
                  </TableCell>
                </TableRow>
              )}
              {data.variants.map((variant) => (
                <TableRow key={variant.id}>
                  <TableCell className="font-medium">
                    {variant.sku}
                    {variant.isDefault && (
                      <Badge variant="outline" className="ml-2">
                        Default
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="uppercase text-[12px] tracking-wide text-muted-foreground">
                    {variant.concentration}
                  </TableCell>
                  <TableCell>{variant.sizeMl}ml</TableCell>
                  <TableCell>{formatInr(variant.mrp)}</TableCell>
                  <TableCell>
                    {(() => {
                      const dp = discountedPrice(variant.mrp, variant.id);
                      return dp !== null ? (
                        <span className="font-semibold text-emerald-600 tabular-nums">{formatInr(dp)}</span>
                      ) : (
                        <span className="text-muted-foreground text-[12px]">—</span>
                      );
                    })()}
                  </TableCell>
                  <TableCell>{variant.stockCached}</TableCell>
                  <TableCell>
                    {(() => {
                      const disc = discountByVariant.get(variant.id);
                      return disc ? (
                        <Link
                          href={`/discounts/${disc.id}`}
                          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary ring-1 ring-primary/20 hover:bg-primary/20 hover:ring-primary/40 transition-colors"
                        >
                          {disc.name}
                          <span className="opacity-60 text-[10px]">↗</span>
                        </Link>
                      ) : (
                        <span className="text-muted-foreground text-[12px]">—</span>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={variant.status === "active" ? "default" : "outline"}>
                      {variant.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditVariantId(variant.id)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setStockDialogVariantId(variant.id)}>
                        Add stock
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={variant.stockCached === 0}
                        onClick={() => setRemoveStockVariantId(variant.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ProductImagesCard productId={data.id} images={data.images} />

      <ProductNotesCard productId={data.id} notes={data.notes} />

      <ProductRatingCard productId={data.id} />

      {stockVariant && (
        <AddStockDialog
          productId={data.id}
          variantId={stockVariant.id}
          sku={stockVariant.sku}
          open={stockDialogVariantId === stockVariant.id}
          onOpenChange={(open) => setStockDialogVariantId(open ? stockVariant.id : null)}
        />
      )}

      {removeStockVariant && (
        <RemoveStockDialog
          productId={data.id}
          variantId={removeStockVariant.id}
          sku={removeStockVariant.sku}
          currentStock={removeStockVariant.stockCached}
          open={removeStockVariantId === removeStockVariant.id}
          onOpenChange={(open) => setRemoveStockVariantId(open ? removeStockVariant.id : null)}
        />
      )}

      {variantBeingEdited && (
        <EditVariantDialog
          productId={data.id}
          variant={variantBeingEdited}
          open={editVariantId === variantBeingEdited.id}
          onOpenChange={(open) => setEditVariantId(open ? variantBeingEdited.id : null)}
        />
      )}
    </div>
  );
}
