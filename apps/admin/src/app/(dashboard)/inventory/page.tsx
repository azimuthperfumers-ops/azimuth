"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";

const LOW_STOCK_THRESHOLD = 5;

export default function InventoryPage() {
  const products = trpc.catalog.listProducts.useQuery({ limit: 100 });

  const rows = (products.data ?? []).flatMap((product) =>
    product.variants.map((variant) => ({
      ...variant,
      productId: product.id,
      productName: product.name,
    })),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title font-semibold">Inventory</h1>
        <p className="text-sm text-muted-foreground">
          Stock across every variant. Add stock from a product&apos;s page.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Size</TableHead>
              <TableHead className="text-right">Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            )}

            {!products.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No variants yet.
                </TableCell>
              </TableRow>
            )}

            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link href={`/products/${row.productId}`} className="font-medium hover:underline">
                    {row.productName}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{row.sku}</TableCell>
                <TableCell>{row.sizeMl}ml</TableCell>
                <TableCell className="text-right">
                  {row.stockCached <= LOW_STOCK_THRESHOLD ? (
                    <Badge variant="destructive">{row.stockCached} low</Badge>
                  ) : (
                    row.stockCached
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
