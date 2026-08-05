"use client";

import { useState } from "react";
import { Check, PhoneCall, Search } from "lucide-react";
import { toast } from "sonner";

import { StarPicker } from "@/components/feedback/stars";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

/**
 * Record feedback a customer gave off-app — over a phone call, WhatsApp, a reply
 * to an email. Attributed to the customer, because it is their opinion, but
 * stamped source="staff" with the operator's id so the inbox never presents it
 * as something the customer typed themselves.
 */
export function LogFeedbackDialog() {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [productRatings, setProductRatings] = useState<Record<string, number>>({});

  const orders = trpc.feedback.adminSearchOrders.useQuery(
    { search: search.trim() || undefined },
    { enabled: open },
  );

  const products = trpc.feedback.adminOrderProducts.useQuery(
    { orderId: orderId ?? "" },
    { enabled: open && !!orderId },
  );

  const log = trpc.feedback.adminLogForCustomer.useMutation({
    onSuccess: async () => {
      toast.success("Feedback logged");
      await Promise.all([
        utils.feedback.adminList.invalidate(),
        utils.feedback.adminStats.invalidate(),
      ]);
      reset(false);
    },
    onError: (e) => toast.error(e.message),
  });

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setSearch("");
      setOrderId(null);
      setRating(null);
      setComment("");
      setProductRatings({});
    }
  }

  const selected = orders.data?.find((o) => o.orderId === orderId);

  function handleSubmit() {
    if (!orderId || rating == null) return;
    log.mutate({
      orderId,
      rating,
      comment: comment.trim() || undefined,
      products: Object.entries(productRatings).map(([productId, r]) => ({
        productId,
        rating: r,
      })),
    });
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <PhoneCall className="size-3.5" />
          Log feedback
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log customer feedback</DialogTitle>
          <DialogDescription>
            For feedback received over a call or message. It is saved against the
            customer and marked as staff-entered.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* ── Pick the delivered order ─────────────────────────────────── */}
          <div className="space-y-2">
            <Label>Delivered order</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Order number, customer name or email"
                className="pl-8"
              />
            </div>

            <div className="max-h-48 divide-y overflow-y-auto rounded-lg border">
              {orders.isLoading && (
                <p className="p-3 text-xs text-muted-foreground">Loading…</p>
              )}
              {!orders.isLoading && orders.data?.length === 0 && (
                <p className="p-3 text-xs text-muted-foreground">
                  No delivered orders match.
                </p>
              )}
              {orders.data?.map((o) => (
                <button
                  key={o.orderId}
                  type="button"
                  onClick={() => {
                    setOrderId(o.orderId);
                    setProductRatings({});
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 p-2.5 text-left text-xs transition-colors hover:bg-muted/50",
                    orderId === o.orderId && "bg-muted",
                  )}
                >
                  {orderId === o.orderId ? (
                    <Check className="size-3.5 shrink-0 text-primary" />
                  ) : (
                    <span className="size-3.5 shrink-0" />
                  )}
                  <span className="font-mono font-medium">{o.orderNumber}</span>
                  <span className="truncate text-muted-foreground">{o.customerName}</span>
                  {o.hasFeedback && (
                    <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-amber-600">
                      Has feedback
                    </span>
                  )}
                </button>
              ))}
            </div>

            {selected?.hasFeedback && (
              <p className="text-[11px] text-amber-600">
                This order already has feedback — saving will overwrite it.
              </p>
            )}
          </div>

          {/* ── The experience score ─────────────────────────────────────── */}
          <div className="space-y-2">
            <Label>Experience rating</Label>
            <StarPicker value={rating} onChange={setRating} disabled={log.isPending} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-comment">What they said</Label>
            <Textarea
              id="feedback-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Summarise the customer's words as closely as you can."
            />
          </div>

          {/* ── Optional per-fragrance scores ────────────────────────────── */}
          {orderId && products.data && products.data.length > 0 && (
            <div className="space-y-2">
              <Label>Fragrance ratings (optional)</Label>
              <div className="divide-y rounded-lg border">
                {products.data.map((p) => (
                  <div key={p.productId} className="flex items-center justify-between gap-3 p-2.5">
                    <span className="truncate text-xs">{p.productName}</span>
                    <StarPicker
                      value={productRatings[p.productId] ?? null}
                      onChange={(r) =>
                        setProductRatings((prev) => ({ ...prev, [p.productId]: r }))
                      }
                      disabled={log.isPending}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => reset(false)} disabled={log.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!orderId || rating == null || log.isPending}>
            {log.isPending ? "Saving…" : "Save feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
