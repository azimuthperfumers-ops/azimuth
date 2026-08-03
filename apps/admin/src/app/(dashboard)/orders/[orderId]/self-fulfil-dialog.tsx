"use client";

/**
 * "Ship this myself" — the way out when Shiprocket won't move a parcel.
 *
 * The admin names the courier they're actually using, enters its consignment
 * number per package, and confirms. Behind it: the AWB is recalled at Shiprocket,
 * the package is unlinked so no webhook can touch it again, and the order status
 * is re-derived from its packages — which is what lifts an order a Shiprocket
 * cancellation wrongly killed back out of "Cancelled" and "Refund due".
 *
 * Deliberately explicit about consequences: this moves real goods and real money
 * indicators, and it is the kind of screen someone uses once a month under time
 * pressure, so nothing here is left to be inferred.
 */

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

/** Only what this dialog needs — keeps it independent of the page's Order type. */
export type SelfFulfilPackage = {
  id: string;
  packageNumber: number;
  productName: string;
  sizeMl: number;
  status: string;
  waybill: string | null;
  fulfillmentChannel: string;
  manualTrackingNumber: string | null;
};

/** Packages worth offering: anything not already delivered by someone. */
export function selfFulfilCandidates<T extends { status: string }>(packages: readonly T[]): T[] {
  return packages.filter((p) => p.status !== "delivered" && p.status !== "rto_delivered");
}

export function SelfFulfilDialog({
  orderId,
  orderNumber,
  orderStatus,
  packages,
  open,
  onOpenChange,
}: {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  packages: SelfFulfilPackage[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const utils = trpc.useUtils();

  const [courierName, setCourierName] = useState("India Post — Speed Post");
  const [reason, setReason] = useState("");
  const [tracking, setTracking] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [cancelAtCourier, setCancelAtCourier] = useState(true);
  const [markShipped, setMarkShipped] = useState(true);

  // Every candidate package starts selected — the common case is the whole order
  // coming off Shiprocket at once.
  //
  // Seeded once per opening, guarded by a ref: `packages` is rebuilt by the parent
  // on every render, so keying the reset on its identity alone would re-seed state
  // on each render and spin — and it would also wipe what the admin had typed the
  // moment anything else on the page re-rendered.
  const seeded = useRef(false);
  useEffect(() => {
    if (!open) {
      seeded.current = false;
      return;
    }
    if (seeded.current) return;
    seeded.current = true;
    setSelected(Object.fromEntries(packages.map((p) => [p.id, true])));
    setTracking(Object.fromEntries(packages.map((p) => [p.id, p.manualTrackingNumber ?? ""])));
  }, [open, packages]);

  const selfFulfil = trpc.order.selfFulfil.useMutation({
    onSuccess: async (res) => {
      await utils.order.adminGet.invalidate({ orderId });
      toast.success(
        res.revivedFromCancelled
          ? `${res.orderNumber} is back to ${res.orderStatus.replace(/_/g, " ")} — no longer cancelled or refund-due`
          : `${res.detached} package(s) now shipping via ${courierName}`,
        {
          description:
            res.recallQueued > 0
              ? `Recall of ${res.recallQueued} Shiprocket AWB(s) queued — watch the Job Queue for the result.`
              : undefined,
        },
      );
      onOpenChange(false);
      setReason("");
    },
    onError: (err) => toast.error(err.message),
  });

  const chosen = packages.filter((p) => selected[p.id]);
  const anyLiveAwb = chosen.some((p) => p.waybill);
  const canSubmit = chosen.length > 0 && courierName.trim().length >= 2 && reason.trim().length >= 3;

  function onConfirm() {
    selfFulfil.mutate({
      orderId,
      courierName: courierName.trim(),
      reason: reason.trim(),
      cancelAtCourier: cancelAtCourier && anyLiveAwb,
      markShipped,
      parcels: chosen.map((p) => ({
        shipmentId: p.id,
        trackingNumber: tracking[p.id]?.trim() || undefined,
      })),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ship {orderNumber} yourself</DialogTitle>
          <DialogDescription>
            Takes the selected packages off Shiprocket and records the courier you are actually
            using. Shiprocket stops driving this order — its webhooks for the old AWBs are ignored
            from now on.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {orderStatus === "cancelled" && (
            <div className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-[12px] text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300">
              This order is currently <strong>cancelled</strong> — Shiprocket&apos;s cancellation did
              that. Confirming will bring it back into fulfilment, clear it from the{" "}
              <strong>Refund due</strong> queue, and the customer will see it as on its way again.
            </div>
          )}

          {/* Packages */}
          <div className="space-y-2">
            <Label>Packages to ship yourself</Label>
            <div className="border border-border divide-y divide-border">
              {packages.map((pkg) => (
                <div key={pkg.id} className="p-3 space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <Checkbox
                      className="mt-0.5"
                      checked={!!selected[pkg.id]}
                      onCheckedChange={(v) =>
                        setSelected((s) => ({ ...s, [pkg.id]: v === true }))
                      }
                    />
                    <span className="text-[12px] leading-snug">
                      <span className="font-semibold">Package {pkg.packageNumber}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {pkg.productName} · {pkg.sizeMl}ml
                      </span>
                      <span className="block text-[11px] text-muted-foreground/70 mt-0.5">
                        {pkg.fulfillmentChannel === "manual"
                          ? "Already self-shipped — confirming updates its details"
                          : pkg.waybill
                            ? `Shiprocket AWB ${pkg.waybill}`
                            : "No live Shiprocket AWB"}
                      </span>
                    </span>
                  </label>

                  {selected[pkg.id] && (
                    <Input
                      value={tracking[pkg.id] ?? ""}
                      onChange={(e) =>
                        setTracking((t) => ({ ...t, [pkg.id]: e.target.value }))
                      }
                      placeholder="Tracking / consignment number (optional)"
                      className="h-8 text-[12px]"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Courier */}
          <div className="space-y-1.5">
            <Label htmlFor="self-courier">Courier</Label>
            <Input
              id="self-courier"
              value={courierName}
              onChange={(e) => setCourierName(e.target.value)}
              placeholder="e.g. India Post — Speed Post"
            />
            <p className="text-[11px] text-muted-foreground">
              The customer sees this name and the tracking number on their order.
            </p>
          </div>

          {/* Reason — goes into the audit trail */}
          <div className="space-y-1.5">
            <Label htmlFor="self-reason">Reason</Label>
            <Textarea
              id="self-reason"
              rows={2}
              value={reason}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
              placeholder="e.g. Shiprocket pickup pending 3 days — posted from the shop instead"
            />
            <p className="text-[11px] text-muted-foreground">
              Recorded in the order&apos;s audit trail with your name. Internal only.
            </p>
          </div>

          {/* Switches */}
          <div className="space-y-2.5">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <Checkbox
                className="mt-0.5"
                checked={cancelAtCourier}
                disabled={!anyLiveAwb}
                onCheckedChange={(v) => setCancelAtCourier(v === true)}
              />
              <span className="text-[12px] leading-snug">
                <span className="font-medium">Cancel the shipment at Shiprocket</span>
                <span className="block text-[11px] text-muted-foreground">
                  {anyLiveAwb
                    ? "Queued and retried, so it still works while Shiprocket is down. Leave on unless you already cancelled it there."
                    : "Nothing live to cancel — these packages have no Shiprocket AWB."}
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <Checkbox
                className="mt-0.5"
                checked={markShipped}
                onCheckedChange={(v) => setMarkShipped(v === true)}
              />
              <span className="text-[12px] leading-snug">
                <span className="font-medium">Already handed to the courier</span>
                <span className="block text-[11px] text-muted-foreground">
                  On: packages go to <em>In transit</em>. Off: they stay <em>Booked</em> until you
                  post them.
                </span>
              </span>
            </label>
          </div>

          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300">
            You are now responsible for these packages — no courier will update their status. Move
            them along from the Packages panel.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={selfFulfil.isPending}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={!canSubmit || selfFulfil.isPending}>
            {selfFulfil.isPending ? "Switching…" : "Confirm — ship it myself"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
