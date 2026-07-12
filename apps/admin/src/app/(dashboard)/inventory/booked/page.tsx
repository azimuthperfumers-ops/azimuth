"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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

// Stock that is sold online but still physically in the warehouse (paid /
// processing orders awaiting pickup). Keep these units aside — they must not
// be sold offline. In-transit units have already left the building.
export default function BookedStockPage() {
  const booked = trpc.inventory.bookedStock.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  const rows = booked.data ?? [];
  const withBooked = rows.filter((r) => r.bookedQty > 0);
  const transitOnly = rows.filter((r) => r.bookedQty === 0 && r.inTransitQty > 0);
  const totalBookedUnits = withBooked.reduce((s, r) => s + r.bookedQty, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/inventory"
          className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Inventory
        </Link>
        <h1 className="text-title font-semibold">Booked stock</h1>
        <p className="text-sm text-muted-foreground">
          Paid orders awaiting pickup — keep {totalBookedUnits > 0 ? <strong>{totalBookedUnits} unit{totalBookedUnits === 1 ? "" : "s"}</strong> : "these units"} physically
          aside so they are not sold offline. Sellable stock already excludes them.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Size</TableHead>
              <TableHead className="text-right">Keep aside</TableHead>
              <TableHead className="text-right">Sellable stock</TableHead>
              <TableHead>Orders</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {booked.isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            )}

            {!booked.isLoading && withBooked.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nothing booked right now — all paid orders have been picked up.
                </TableCell>
              </TableRow>
            )}

            {withBooked.map((row) => (
              <TableRow key={row.variantId}>
                <TableCell className="font-medium">{row.productName}</TableCell>
                <TableCell className="text-muted-foreground">{row.sku}</TableCell>
                <TableCell>{row.sizeMl}ml</TableCell>
                <TableCell className="text-right">
                  <Badge variant="destructive">{row.bookedQty}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.stockCached < 0 ? (
                    <Badge variant="destructive">oversold {Math.abs(row.stockCached)}</Badge>
                  ) : (
                    row.stockCached
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {row.bookedOrders.map((o) => (
                      <Badge key={`${o.orderNumber}`} variant="outline" className="font-mono text-[10px]">
                        {o.orderNumber} ×{o.quantity}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {transitOnly.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">In transit (already dispatched)</h2>
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Units in transit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transitOnly.map((row) => (
                  <TableRow key={row.variantId}>
                    <TableCell className="font-medium">{row.productName}</TableCell>
                    <TableCell className="text-muted-foreground">{row.sku}</TableCell>
                    <TableCell>{row.sizeMl}ml</TableCell>
                    <TableCell className="text-right tabular-nums">{row.inTransitQty}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
