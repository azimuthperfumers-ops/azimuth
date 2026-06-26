"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const PAGE_SIZE = 50;

export default function ProductLedgerPage() {
  const params = useParams<{ id: string }>();
  const productId = params.id;

  const [page, setPage] = useState(0);
  const [variantId, setVariantId] = useState<string>("");
  const [type, setType] = useState<"" | "credit" | "debit">("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const product = trpc.catalog.getProduct.useQuery({ id: productId });

  const ledger = trpc.inventory.productLedger.useQuery({
    productId,
    page,
    pageSize: PAGE_SIZE,
    variantId: variantId || undefined,
    type: (type || undefined) as "credit" | "debit" | undefined,
    fromDate: fromDate ? new Date(fromDate) : undefined,
    toDate: toDate ? new Date(toDate) : undefined,
  });

  const totalPages = Math.ceil((ledger.data?.total ?? 0) / PAGE_SIZE);
  const variants = ledger.data?.variants ?? [];

  function resetFilters() {
    setVariantId("");
    setType("");
    setFromDate("");
    setToDate("");
    setPage(0);
  }

  function applyFilter() {
    setPage(0);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/products/${productId}`}>
            <ChevronLeft className="size-4" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-title font-semibold leading-tight">
            {product.data?.name ?? "Product"} — Inventory Ledger
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Full movement history across all variants
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Variant
              </Label>
              <Select
                value={variantId || "all"}
                onValueChange={(v) => { setVariantId(v === "all" ? "" : v); applyFilter(); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All variants" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All variants</SelectItem>
                  {variants.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.sku}{v.sizeMl ? ` · ${v.sizeMl} ml` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Type
              </Label>
              <Select
                value={type || "all"}
                onValueChange={(v) => { setType(v === "all" ? "" : v as "credit" | "debit"); applyFilter(); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Credit & Debit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Credit & Debit</SelectItem>
                  <SelectItem value="credit">Credit only</SelectItem>
                  <SelectItem value="debit">Debit only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                From date
              </Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                onBlur={applyFilter}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                To date
              </Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                onBlur={applyFilter}
              />
            </div>
          </div>

          {(variantId || type || fromDate || toDate) && (
            <Button variant="ghost" size="sm" className="mt-3 text-muted-foreground" onClick={resetFilters}>
              Clear filters
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Ledger table */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date & time</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="text-right">Delta</TableHead>
              <TableHead className="text-right">Balance after</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ledger.isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Loading…
                </TableCell>
              </TableRow>
            )}

            {!ledger.isLoading && (ledger.data?.rows.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No movements found for the selected filters.
                </TableCell>
              </TableRow>
            )}

            {ledger.data?.rows.map((row) => {
              const isCredit = row.delta > 0;
              const v = row.variant;
              const variantLabel = v
                ? `${v.sku}${v.sizeMl ? ` · ${v.sizeMl} ml` : ""}`
                : row.variantId.slice(0, 8);

              return (
                <TableRow key={row.id}>
                  <TableCell className="text-[12px] text-muted-foreground tabular-nums">
                    {new Date(row.createdAt).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell className="text-[12px]">{variantLabel}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[11px] capitalize">
                      {row.reason}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[12px] text-muted-foreground max-w-[200px] truncate">
                    {row.note ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    <span className={isCredit ? "text-emerald-600" : "text-destructive"}>
                      {isCredit ? "+" : ""}{row.delta}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.balanceAfter}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages} · {ledger.data?.total ?? 0} movements
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="size-4" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
