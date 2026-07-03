"use client";

import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";

const CONCENTRATIONS = [
  { value: "edp", label: "EDP" },
  { value: "edt", label: "EDT" },
  { value: "parfum", label: "Parfum" },
  { value: "cologne", label: "Cologne" },
  { value: "attar", label: "Attar" },
] as const;

type Variant = {
  id: string;
  sku: string;
  concentration: "edp" | "edt" | "parfum" | "cologne" | "attar";
  sizeMl: number;
  mrp: string;
  weightGrams: number;
  boxLengthCm: number | null;
  boxWidthCm: number | null;
  boxHeightCm: number | null;
  barcode: string | null;
  isDefault: boolean;
  status: "active" | "discontinued";
};

function EditVariantForm({
  productId,
  variant,
  onDone,
}: {
  productId: string;
  variant: Variant;
  onDone: () => void;
}) {
  const utils = trpc.useUtils();
  const [sku, setSku] = useState(variant.sku);
  const [concentration, setConcentration] = useState(variant.concentration);
  const [sizeMl, setSizeMl] = useState(String(variant.sizeMl));
  const [mrp, setMrp] = useState(variant.mrp);
  const [weightGrams, setWeightGrams] = useState(String(variant.weightGrams));
  const [boxLengthCm, setBoxLengthCm] = useState(variant.boxLengthCm ? String(variant.boxLengthCm) : "");
  const [boxWidthCm, setBoxWidthCm] = useState(variant.boxWidthCm ? String(variant.boxWidthCm) : "");
  const [boxHeightCm, setBoxHeightCm] = useState(variant.boxHeightCm ? String(variant.boxHeightCm) : "");
  const [barcode, setBarcode] = useState(variant.barcode ?? "");
  const [status, setStatus] = useState(variant.status);
  const [isDefault, setIsDefault] = useState(variant.isDefault);

  const updateVariant = trpc.catalog.updateVariant.useMutation({
    onSuccess: async () => {
      await utils.catalog.getProduct.invalidate({ id: productId });
      toast.success("Variant updated");
      onDone();
    },
    onError: (err) => toast.error(err.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    updateVariant.mutate({
      id: variant.id,
      sku,
      concentration,
      sizeMl: Number(sizeMl),
      mrp: Number(mrp),
      weightGrams: Number(weightGrams),
      boxLengthCm: boxLengthCm ? Number(boxLengthCm) : undefined,
      boxWidthCm: boxWidthCm ? Number(boxWidthCm) : undefined,
      boxHeightCm: boxHeightCm ? Number(boxHeightCm) : undefined,
      barcode: barcode || undefined,
      status,
      isDefault,
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-sku">SKU</Label>
          <Input id="edit-sku" value={sku} onChange={(e) => setSku(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-size-ml">Size (ml)</Label>
          <Input
            id="edit-size-ml"
            type="number"
            min={1}
            value={sizeMl}
            onChange={(e) => setSizeMl(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Concentration</Label>
        <Select value={concentration} onValueChange={(v) => setConcentration(v as typeof concentration)}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CONCENTRATIONS.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-mrp">MRP (₹)</Label>
        <Input
          id="edit-mrp"
          type="number"
          min={0}
          step="0.01"
          value={mrp}
          onChange={(e) => setMrp(e.target.value)}
          required
        />
        <p className="text-[11px] text-muted-foreground">Discounts are applied via the Discounts section.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-weight">Packed weight (g)</Label>
          <Input
            id="edit-weight"
            type="number"
            min={1}
            value={weightGrams}
            onChange={(e) => setWeightGrams(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-barcode">Barcode</Label>
          <Input id="edit-barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Shipping box dimensions (cm) — outer corrugated box, not bottle</Label>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label htmlFor="edit-box-l" className="text-xs text-muted-foreground">Length</Label>
            <Input
              id="edit-box-l"
              type="number"
              min={1}
              placeholder="cm"
              value={boxLengthCm}
              onChange={(e) => setBoxLengthCm(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-box-w" className="text-xs text-muted-foreground">Width</Label>
            <Input
              id="edit-box-w"
              type="number"
              min={1}
              placeholder="cm"
              value={boxWidthCm}
              onChange={(e) => setBoxWidthCm(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-box-h" className="text-xs text-muted-foreground">Height</Label>
            <Input
              id="edit-box-h"
              type="number"
              min={1}
              placeholder="cm"
              value={boxHeightCm}
              onChange={(e) => setBoxHeightCm(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="discontinued">Discontinued</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="size-4"
          />
          Default variant
        </label>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={updateVariant.isPending}>
          {updateVariant.isPending ? "Saving..." : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EditVariantDialog({
  productId,
  variant,
  open,
  onOpenChange,
}: {
  productId: string;
  variant: Variant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit variant — {variant.sku}</DialogTitle>
        </DialogHeader>
        {open && (
          <EditVariantForm productId={productId} variant={variant} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
