"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";

/**
 * Permanent, non-recoverable delete of a product and everything under it
 * (variants, images, notes, ratings, inventory ledger). Order history is kept —
 * line items snapshot their own data — so past orders still render.
 *
 * Gated two ways: the impact preview shows how many orders reference the product,
 * and the admin must retype the product name before the button unlocks.
 */
export function DeleteProductDialog({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  // Only hit the count query while the dialog is actually open.
  const impact = trpc.catalog.productDeletionImpact.useQuery(
    { id: productId },
    { enabled: open },
  );

  const deleteProduct = trpc.catalog.deleteProduct.useMutation({
    onSuccess: async () => {
      toast.success(`"${productName}" deleted`);
      await utils.catalog.listProducts.invalidate();
      router.push("/products");
    },
    onError: (err) => toast.error(err.message),
  });

  const confirmed = confirmText.trim() === productName.trim();

  function reset(next: boolean) {
    setOpen(next);
    if (!next) setConfirmText("");
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <AlertTriangle className="size-3.5 mr-1.5" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{productName}”?</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm space-y-2">
            <p className="flex items-center gap-2 font-semibold text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              This permanently deletes the product and cannot be undone.
            </p>
            <p className="text-muted-foreground">
              All variants, images, fragrance notes, ratings and inventory history
              for this product are erased. Past customer orders are kept, but they
              will no longer link back to this product.
            </p>

            {impact.isLoading ? (
              <p className="text-[12px] text-muted-foreground/70">Checking impact…</p>
            ) : impact.data ? (
              <ul className="text-[12px] text-muted-foreground space-y-0.5 pt-1">
                <li>
                  · <span className="font-semibold text-foreground tabular-nums">{impact.data.variantCount}</span> variant(s) and{" "}
                  <span className="font-semibold text-foreground tabular-nums">{impact.data.imageCount}</span> image(s) will be removed
                </li>
                <li>
                  ·{" "}
                  <span
                    className={
                      impact.data.orderCount > 0
                        ? "font-semibold text-destructive tabular-nums"
                        : "font-semibold text-foreground tabular-nums"
                    }
                  >
                    {impact.data.orderCount}
                  </span>{" "}
                  order(s) reference this product
                  {impact.data.orderCount > 0 && " — their records stay intact but unlinked"}
                </li>
              </ul>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="delete-confirm">
              Type <span className="font-semibold text-foreground">{productName}</span> to confirm
            </Label>
            <Input
              id="delete-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={productName}
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => reset(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!confirmed || deleteProduct.isPending}
            onClick={() => deleteProduct.mutate({ id: productId })}
          >
            {deleteProduct.isPending ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
