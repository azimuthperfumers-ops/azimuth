"use client";

import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

export function AddStockDialog({
  productId,
  variantId,
  sku,
  open,
  onOpenChange,
}: {
  productId: string;
  variantId: string;
  sku: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");

  const ledger = trpc.inventory.ledgerHistory.useQuery({ variantId, limit: 10 }, { enabled: open });

  const addStock = trpc.inventory.addStock.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.catalog.getProduct.invalidate({ id: productId }),
        utils.inventory.ledgerHistory.invalidate({ variantId }),
      ]);
      toast.success("Stock added");
      setQuantity("");
      setNote("");
    },
    onError: (err) => toast.error(err.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    addStock.mutate({ variantId, quantity: Number(quantity), note: note || undefined });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add stock — {sku}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity received</Label>
            <Input
              id="quantity"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. PO #1042 from supplier"
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={addStock.isPending}>
              {addStock.isPending ? "Saving..." : "Add stock"}
            </Button>
          </DialogFooter>
        </form>

        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-medium">Recent ledger entries</p>
          {ledger.isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {ledger.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">No stock movements yet.</p>
          )}
          <ul className="space-y-1 text-sm">
            {ledger.data?.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between text-muted-foreground">
                <span>
                  {entry.reason} · {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                </span>
                <span>{new Date(entry.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
