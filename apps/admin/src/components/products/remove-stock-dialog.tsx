"use client";

import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

const REMOVAL_REASONS = [
  { value: "adjustment", label: "Manual adjustment" },
  { value: "damage", label: "Damaged / expired" },
  { value: "return", label: "Customer return (defective)" },
] as const;

type RemovalReason = (typeof REMOVAL_REASONS)[number]["value"];

export function RemoveStockDialog({
  productId,
  variantId,
  sku,
  currentStock,
  open,
  onOpenChange,
}: {
  productId: string;
  variantId: string;
  sku: string;
  currentStock: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState<RemovalReason>("adjustment");
  const [note, setNote] = useState("");

  const adjustStock = trpc.inventory.adjustStock.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.catalog.getProduct.invalidate({ id: productId }),
        utils.inventory.ledgerHistory.invalidate({ variantId }),
        utils.inventory.productLedger.invalidate(),
      ]);
      toast.success("Stock removed");
      setQuantity("");
      setNote("");
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      toast.error("Enter a positive quantity to remove");
      return;
    }
    if (qty > currentStock) {
      toast.error(`Cannot remove more than current stock (${currentStock})`);
      return;
    }
    // Negative delta = debit entry in the ledger
    adjustStock.mutate({ variantId, delta: -qty, reason, note: note || undefined });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove stock — {sku}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
            <p className="text-muted-foreground">
              Current stock: <span className="font-semibold text-foreground tabular-nums">{currentStock}</span>
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground/70">
              This creates an append-only debit entry in the ledger.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="remove-qty">Quantity to remove</Label>
            <Input
              id="remove-qty"
              type="number"
              min={1}
              max={currentStock}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="remove-reason">Reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as RemovalReason)}>
              <SelectTrigger id="remove-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REMOVAL_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="remove-note">Note</Label>
            <Textarea
              id="remove-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Bottle broken during warehouse audit"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={adjustStock.isPending}>
              {adjustStock.isPending ? "Removing…" : "Remove stock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
