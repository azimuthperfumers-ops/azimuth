"use client";

import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";

export function AddVariantDialog({ productId }: { productId: string }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [sku, setSku] = useState("");
  const [sizeMl, setSizeMl] = useState("50");
  const [mrp, setMrp] = useState("");
  const [weightGrams, setWeightGrams] = useState("");
  const [boxLengthCm, setBoxLengthCm] = useState("");
  const [boxWidthCm, setBoxWidthCm] = useState("");
  const [boxHeightCm, setBoxHeightCm] = useState("");
  const [barcode, setBarcode] = useState("");

  const createVariant = trpc.catalog.createVariant.useMutation({
    onSuccess: async () => {
      await utils.catalog.getProduct.invalidate({ id: productId });
      toast.success("Variant added");
      setOpen(false);
      setSku("");
      setMrp("");
      setWeightGrams("");
      setBoxLengthCm("");
      setBoxWidthCm("");
      setBoxHeightCm("");
      setBarcode("");
    },
    onError: (err) => toast.error(err.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    createVariant.mutate({
      productId,
      sku,
      sizeMl: Number(sizeMl),
      mrp: Number(mrp),
      weightGrams: Number(weightGrams),
      boxLengthCm: Number(boxLengthCm),
      boxWidthCm: Number(boxWidthCm),
      boxHeightCm: Number(boxHeightCm),
      barcode: barcode || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Add variant</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New variant</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="size-ml">Size (ml)</Label>
              <Input
                id="size-ml"
                type="number"
                min={1}
                value={sizeMl}
                onChange={(e) => setSizeMl(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mrp">MRP (₹)</Label>
            <Input
              id="mrp"
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
              <Label htmlFor="weight">Packed weight (g)</Label>
              <Input
                id="weight"
                type="number"
                min={1}
                value={weightGrams}
                onChange={(e) => setWeightGrams(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode</Label>
              <Input id="barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Shipping box dimensions (cm) — outer corrugated box, not bottle</Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="box-l" className="text-xs text-muted-foreground">Length</Label>
                <Input
                  id="box-l"
                  type="number"
                  min={1}
                  placeholder="cm"
                  value={boxLengthCm}
                  onChange={(e) => setBoxLengthCm(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="box-w" className="text-xs text-muted-foreground">Width</Label>
                <Input
                  id="box-w"
                  type="number"
                  min={1}
                  placeholder="cm"
                  value={boxWidthCm}
                  onChange={(e) => setBoxWidthCm(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="box-h" className="text-xs text-muted-foreground">Height</Label>
                <Input
                  id="box-h"
                  type="number"
                  min={1}
                  placeholder="cm"
                  value={boxHeightCm}
                  onChange={(e) => setBoxHeightCm(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createVariant.isPending}>
              {createVariant.isPending ? "Adding..." : "Add variant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
