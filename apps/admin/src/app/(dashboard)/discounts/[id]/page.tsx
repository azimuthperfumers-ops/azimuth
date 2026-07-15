"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Calendar, Check, Lock, Pencil, Search, Trash2 } from "lucide-react";
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
import { formatInr } from "@/lib/format";
import { cn } from "@/lib/utils";
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
  product: { id: string; name: string; themeColor: string | null; status: string };
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

  // Select / clear every selectable (non-locked, not-already-in-state) variant of a product
  function toggleProduct(p: AllProduct, select: boolean) {
    for (const v of p.variants) {
      if (lockedByOther.has(v.id)) continue; // owned by another discount — skip
      const linked = isLinked(v.id);
      if (select && !linked) handleToggle(p.id, v.id, `${p.name} · ${variantLabel(v)}`, true);
      else if (!select && linked) handleToggle(p.id, v.id, `${p.name} · ${variantLabel(v)}`, false);
    }
  }

  const products: AllProduct[] = (allProducts.data as AllProduct[] | undefined) ?? [];

  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const withVariants = products.filter((p) => p.variants.length > 0);
    if (!q) return withVariants;
    return withVariants.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.category?.name ?? "").toLowerCase().includes(q),
    );
  }, [products, query]);

  const selectedCount = useMemo(
    () => products.reduce((n, p) => n + p.variants.filter((v) => isLinked(v.id)).length, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, optimistic, linkedVariants.data, discountProducts],
  );

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
    <div className="px-6 pb-6 space-y-4">
      {/* Search + selected count */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products or categories…"
            className="pl-9"
          />
        </div>
        <Badge variant={selectedCount > 0 ? "default" : "secondary"} className="ml-auto tabular-nums">
          {selectedCount} variant{selectedCount === 1 ? "" : "s"} selected
        </Badge>
      </div>

      {filtered.length === 0 ? (
        <p className="text-body-sm text-muted-foreground py-10 text-center">
          No products match “{query}”.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const selectable = p.variants.filter((v) => !lockedByOther.has(v.id));
            const linkedCount = p.variants.filter((v) => isLinked(v.id)).length;
            const allSelected = selectable.length > 0 && selectable.every((v) => isLinked(v.id));
            const someSelected = linkedCount > 0 && !allSelected;

            return (
              <div
                key={p.id}
                className={cn(
                  "rounded-lg border transition-colors",
                  linkedCount > 0 ? "border-primary/30 bg-primary/[0.03]" : "border-border",
                )}
              >
                {/* Product header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    disabled={selectable.length === 0}
                    onCheckedChange={(val) => toggleProduct(p, !!val && !allSelected)}
                    aria-label={`Toggle all variants of ${p.name}`}
                  />
                  <span
                    className="size-2.5 rounded-full shrink-0 ring-1 ring-foreground/10"
                    style={{ backgroundColor: p.themeColor ?? "oklch(0.875 0.032 75)" }}
                  />
                  <span className="font-medium">{p.name}</span>
                  {p.category?.name && (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {p.category.name}
                    </Badge>
                  )}
                  <span className="ml-auto text-body-sm text-muted-foreground tabular-nums">
                    {linkedCount}/{p.variants.length}
                  </span>
                </div>

                {/* Variant chips */}
                <div className="flex flex-wrap gap-2 p-3">
                  {p.variants.map((v) => {
                    const linked = isLinked(v.id);
                    const locked = !linked && lockedByOther.has(v.id);
                    const lockedByName = lockedByOther.get(v.id);
                    const label = `${p.name} · ${variantLabel(v)}`;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={locked}
                        title={locked ? `Already in “${lockedByName}”` : undefined}
                        onClick={() => handleToggle(p.id, v.id, label, !linked)}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-body-sm transition-all select-none",
                          linked
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : locked
                              ? "border-border bg-muted/50 text-muted-foreground/50 cursor-not-allowed"
                              : "border-border hover:border-foreground/40 hover:bg-muted/40 cursor-pointer",
                        )}
                      >
                        {linked ? (
                          <Check className="size-3.5 shrink-0" />
                        ) : locked ? (
                          <Lock className="size-3 shrink-0" />
                        ) : null}
                        <span className="font-medium">{variantLabel(v)}</span>
                        <span className={cn("tabular-nums", linked ? "opacity-80" : "text-muted-foreground")}>
                          {formatInr(Number(v.mrp))}
                        </span>
                        {locked && (
                          <span className="text-[10px] opacity-70 max-w-24 truncate">in {lockedByName}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
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
