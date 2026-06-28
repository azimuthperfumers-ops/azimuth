"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Calendar, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { formatInr } from "@/lib/format";
import { trpc } from "@/lib/trpc";

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatValue(type: string, value: string | number) {
  const n = Number(value);
  return type === "percentage" ? `${n}%` : `₹${n.toFixed(2)}`;
}

function fmt(d: Date | string) {
  return format(new Date(d), "dd MMM yyyy");
}

function toDateInput(d: Date | string | undefined | null) {
  if (!d) return "";
  return format(new Date(d), "yyyy-MM-dd");
}

function variantLabel(v: { sizeMl: number | null; isDefault: boolean } | null | undefined) {
  if (!v) return "—";
  if (v.sizeMl) return `${v.sizeMl} ml`;
  return v.isDefault ? "Default" : "—";
}

// ─── Edit dialog ──────────────────────────────────────────────────────────────

type DiscountForm = {
  name: string;
  type: "percentage" | "flat";
  value: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

interface EditDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existing: {
    id: string;
    name: string;
    type: "percentage" | "flat";
    value: string | number;
    startsAt: Date | string;
    endsAt?: Date | string | null;
    isActive: boolean;
  };
  onDone: () => void;
}

function EditDiscountDialog({ open, onOpenChange, existing, onDone }: EditDialogProps) {
  const [form, setForm] = useState<DiscountForm>({
    name: existing.name,
    type: existing.type,
    value: String(existing.value),
    startsAt: toDateInput(existing.startsAt),
    endsAt: toDateInput(existing.endsAt),
    isActive: existing.isActive,
  });

  const update = trpc.discount.update.useMutation({ onSuccess: onDone });

  function set<K extends keyof DiscountForm>(k: K, v: DiscountForm[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function handleSubmit() {
    if (!form.name.trim() || !form.value || !form.startsAt) {
      toast.error("Name, value, and start date are required");
      return;
    }
    update.mutate({
      id: existing.id,
      name: form.name.trim(),
      type: form.type,
      value: Number(form.value),
      startsAt: new Date(form.startsAt),
      endsAt: form.endsAt ? new Date(form.endsAt) : undefined,
      isActive: form.isActive,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Discount</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Name
            </Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Type
              </Label>
              <Select value={form.type} onValueChange={(v) => set("type", v as "percentage" | "flat")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="flat">Flat (₹)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Value
              </Label>
              <Input
                type="number" min="0" step="0.01" value={form.value}
                onChange={(e) => set("value", e.target.value)}
                placeholder={form.type === "percentage" ? "10" : "500"}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Starts
              </Label>
              <Input type="date" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Ends (optional)
              </Label>
              <Input type="date" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="isActive" checked={form.isActive} onCheckedChange={(v) => set("isActive", !!v)} />
            <Label htmlFor="isActive" className="text-body-sm cursor-pointer">Active</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={update.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={update.isPending}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Variant table ────────────────────────────────────────────────────────────

type LinkedEntry = {
  id: string;
  productId: string;
  variantId: string;
  product: { id: string; name: string; themeColor: string | null; concentration: string; status: string };
  variant: { id: string; sizeMl: number | null; isDefault: boolean; mrp?: string | number } | null;
};

interface VariantTableProps {
  discountId: string;
  discountProducts: LinkedEntry[];
  onDone: () => void;
}

type AllProduct = {
  id: string;
  name: string;
  themeColor: string | null;
  concentration: string;
  status: string;
  category: { name: string } | null;
  variants: Array<{ id: string; sizeMl: number | null; isDefault: boolean; mrp: string | number }>;
};

function VariantTable({ discountId, discountProducts, onDone }: VariantTableProps) {
  const allProducts = trpc.catalog.listProducts.useQuery({ limit: 100 });
  const linkedVariants = trpc.discount.listLinkedVariants.useQuery();

  // Optimistic overrides: variantId → true (pending add) | false (pending remove)
  const [optimistic, setOptimistic] = useState<Map<string, boolean>>(() => new Map());

  const addProduct = trpc.discount.addProduct.useMutation({
    onSuccess: () => { onDone(); linkedVariants.refetch(); },
    onError: (err, vars) => {
      setOptimistic((prev) => { const m = new Map(prev); m.delete(vars.variantId); return m; });
      toast.error(err.message);
    },
  });

  const removeProduct = trpc.discount.removeProduct.useMutation({
    onSuccess: () => { onDone(); linkedVariants.refetch(); },
    onError: (_err, vars) => {
      const variantId = discountProducts.find((dp) => dp.id === vars.id)?.variantId;
      if (variantId) {
        setOptimistic((prev) => { const m = new Map(prev); m.delete(variantId); return m; });
      }
    },
  });

  // variantId → discountProduct.id for the CURRENT discount (for removal)
  const linkedMap = new Map(discountProducts.map((dp) => [dp.variantId, dp.id]));

  // variantId → discount name for OTHER discounts (locked)
  const lockedByOther = new Map(
    (linkedVariants.data ?? [])
      .filter((lv) => lv.discountId !== discountId)
      .map((lv) => [lv.variantId, lv.discount.name]),
  );

  function isLinked(variantId: string): boolean {
    if (optimistic.has(variantId)) return optimistic.get(variantId)!;
    return linkedMap.has(variantId);
  }

  function handleToggle(
    productId: string,
    variantId: string,
    label: string,
    checked: boolean,
  ) {
    // Block if another discount already owns this variant
    if (checked && lockedByOther.has(variantId)) {
      toast.error(`"${label}" is already in discount "${lockedByOther.get(variantId)}"`);
      return;
    }
    if (checked) {
      if (linkedMap.has(variantId) || optimistic.get(variantId) === true) {
        toast.error(`"${label}" is already in this discount`);
        return;
      }
      setOptimistic((prev) => new Map(prev).set(variantId, true));
      addProduct.mutate({ discountId, productId, variantId });
    } else {
      if (!isLinked(variantId)) return;
      setOptimistic((prev) => new Map(prev).set(variantId, false));
      const dpId = linkedMap.get(variantId);
      if (dpId) removeProduct.mutate({ id: dpId });
    }
  }

  const products: AllProduct[] = (allProducts.data as AllProduct[] | undefined) ?? [];

  if (allProducts.isLoading || linkedVariants.isLoading) {
    return <p className="text-body-sm text-muted-foreground px-6 py-4">Loading products…</p>;
  }

  if (allProducts.isError) {
    return (
      <p className="text-body-sm text-destructive px-6 py-4">
        Failed to load products: {allProducts.error.message}
      </p>
    );
  }

  if (products.length === 0) {
    return (
      <p className="text-body-sm text-muted-foreground px-6 py-8 text-center">
        No products found. Add some products first.
      </p>
    );
  }

  return (
    <div className="rounded-md border border-border overflow-hidden mx-6 mb-6">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-12 pl-4" />
            <TableHead>Product · Variant</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Price</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((p) => {
            const variants = p.variants.length > 0 ? p.variants : [];
            if (variants.length === 0) return null;

            return variants.map((v, vi) => {
              const linked = isLinked(v.id);
              const locked = !linked && lockedByOther.has(v.id);
              const lockedByName = lockedByOther.get(v.id);
              const label = `${p.name} · ${variantLabel(v)}`;
              return (
                <TableRow
                  key={v.id}
                  className={`select-none ${locked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${linked ? "bg-primary/5 hover:bg-primary/10" : ""}`}
                  onClick={() => !locked && handleToggle(p.id, v.id, label, !linked)}
                >
                  <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={linked}
                      disabled={locked}
                      onCheckedChange={(val) => !locked && handleToggle(p.id, v.id, label, !!val)}
                      aria-label={`Toggle ${label}`}
                    />
                  </TableCell>
                  <TableCell>
                    {vi === 0 ? (
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full shrink-0 ring-1 ring-foreground/10"
                          style={{ backgroundColor: p.themeColor ?? "oklch(0.875 0.032 75)" }}
                        />
                        <span className={`font-medium ${linked ? "text-primary" : ""}`}>
                          {p.name}
                        </span>
                        <span className="text-muted-foreground/50">·</span>
                        <span className="text-body-sm text-muted-foreground">
                          {variantLabel(v)}
                        </span>
                        {locked && (
                          <Badge variant="outline" className="text-[10px] ml-1">
                            in {lockedByName}
                          </Badge>
                        )}
                      </span>
                    ) : (
                      <span className="pl-5 text-body-sm text-muted-foreground">
                        {variantLabel(v)}
                        {locked && (
                          <Badge variant="outline" className="text-[10px] ml-2">
                            in {lockedByName}
                          </Badge>
                        )}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-body-sm text-muted-foreground">
                    {v.sizeMl ? `${v.sizeMl} ml` : "—"}
                  </TableCell>
                  <TableCell className="text-body-sm text-muted-foreground">
                    {vi === 0 ? (p.category?.name ?? "—") : ""}
                  </TableCell>
                  <TableCell className="text-body-sm tabular-nums">
                    {formatInr(Number(v.mrp))}
                  </TableCell>
                </TableRow>
              );
            });
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Detail page ──────────────────────────────────────────────────────────────

export default function DiscountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();

  const discount = trpc.discount.get.useQuery({ id });
  const deleteDiscount = trpc.discount.delete.useMutation({
    onSuccess: () => {
      toast.success("Discount deleted");
      router.push("/discounts");
    },
    onError: (err) => toast.error(err.message),
  });

  const [editOpen, setEditOpen] = useState(false);

  function refresh() {
    utils.discount.get.invalidate({ id });
  }

  if (discount.isLoading) {
    return <p className="text-body-sm text-muted-foreground">Loading…</p>;
  }

  if (!discount.data) {
    return (
      <div className="space-y-4">
        <Link href="/discounts" className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" /> Back to discounts
        </Link>
        <p className="text-body-sm text-muted-foreground">Discount not found.</p>
      </div>
    );
  }

  const d = discount.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/discounts"
          className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="size-4" /> Back to discounts
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-title font-semibold">{d.name}</h1>
            <div className="mt-1.5 flex items-center gap-3 text-body-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3.5" />
                {fmt(d.startsAt)}
                {d.endsAt ? ` → ${fmt(d.endsAt)}` : " → ongoing"}
              </span>
              <span>·</span>
              <span className="capitalize">{d.type}</span>
              <span>·</span>
              <span className="font-semibold text-primary">{formatValue(d.type, d.value)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={d.isActive ? "default" : "secondary"}>
              {d.isActive ? "Active" : "Inactive"}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="size-3.5 mr-1.5" /> Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60"
              onClick={() => {
                if (confirm(`Delete "${d.name}"?`)) {
                  deleteDiscount.mutate({ id: d.id });
                }
              }}
            >
              <Trash2 className="size-3.5 mr-1.5" /> Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Discount type", value: d.type === "percentage" ? "Percentage" : "Flat amount" },
          { label: "Discount value", value: formatValue(d.type, d.value) },
          { label: "Variants linked", value: String(d.products.length) },
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

      {/* Variant table */}
      <Card>
        <CardHeader>
          <CardTitle>Product variants</CardTitle>
          <p className="text-body-sm text-muted-foreground mt-0.5">
            Check individual variants to include them in this discount. Changes save immediately.
          </p>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <VariantTable
            discountId={d.id}
            discountProducts={d.products as LinkedEntry[]}
            onDone={refresh}
          />
        </CardContent>
      </Card>

      {editOpen && (
        <EditDiscountDialog
          open
          onOpenChange={(v) => !v && setEditOpen(false)}
          existing={d}
          onDone={() => {
            setEditOpen(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}
