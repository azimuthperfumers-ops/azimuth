"use client";

import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

// The nudge that asks a customer to rate a recently delivered order.
//
// Deliberately quiet: one line of type, a thumbnail, a link. It is not a promo
// banner — it appears only when there is a genuinely un-rated recent delivery,
// and "Not now" removes it for good (server-side, so it stays gone on the
// customer's phone too).

function formatDelivered(date: Date | string | null): string | null {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/**
 * @param variant  "panel" is the standalone card for the account/orders view;
 *                 "inline" is the slimmer strip used inside an order page.
 * @param limit    how many pending orders to show at once.
 * @param heading  show the little "How did we do?" label. Off where the
 *                 surrounding page already provides a section heading.
 */
export function FeedbackNudge({
  variant = "panel",
  limit = 2,
  heading = true,
  className,
}: {
  variant?: "panel" | "inline";
  limit?: number;
  heading?: boolean;
  className?: string;
}) {
  const utils = trpc.useUtils();
  const { data: pending } = trpc.feedback.pending.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });

  const dismiss = trpc.feedback.dismiss.useMutation({
    onSuccess: () => {
      void utils.feedback.pending.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!pending || pending.length === 0) return null;

  const shown = pending.slice(0, limit);

  return (
    <div className={cn("space-y-3", className)}>
      {heading && variant === "panel" && (
        <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground/50">
          How did we do?
        </p>
      )}

      {shown.map((order) => {
        const delivered = formatDelivered(order.deliveredAt);

        return (
          <div
            key={order.orderId}
            className={cn(
              "group relative flex items-center gap-4 border border-border transition-colors hover:border-foreground/40",
              variant === "panel" ? "p-4 sm:p-5" : "p-3.5",
            )}
          >
            {/* Thumbnail — the bottle they actually received */}
            {order.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={order.imageUrl}
                alt=""
                className={cn(
                  "shrink-0 object-cover bg-muted",
                  variant === "panel" ? "size-14 sm:size-16" : "size-11",
                )}
              />
            ) : (
              <div
                className={cn(
                  "shrink-0 bg-muted",
                  variant === "panel" ? "size-14 sm:size-16" : "size-11",
                )}
              />
            )}

            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium leading-snug">
                {order.productName
                  ? `How was your ${order.productName}?`
                  : "How was your order?"}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground/60">
                {delivered ? `Delivered ${delivered}` : "Recently delivered"}
                {order.itemCount > 1 && ` · ${order.itemCount} items`}
                {" · "}
                <span className="font-mono">{order.orderNumber}</span>
              </p>

              <Link
                href={`/feedback/${order.orderId}`}
                className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] uppercase text-foreground underline-offset-4 hover:underline"
              >
                Leave feedback
                <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            {/* Not now — never a hard-to-find dismissal */}
            <button
              type="button"
              onClick={() => dismiss.mutate({ orderId: order.orderId })}
              disabled={dismiss.isPending}
              title="Not now"
              aria-label={`Dismiss feedback request for order ${order.orderNumber}`}
              className="absolute right-2 top-2 p-1.5 text-muted-foreground/30 transition-colors hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}

      {pending.length > limit && (
        <Link
          href="/feedback"
          className="inline-block text-[11px] font-semibold tracking-[0.14em] uppercase text-muted-foreground/60 underline-offset-4 hover:text-foreground hover:underline"
        >
          {pending.length - limit} more awaiting your review
        </Link>
      )}
    </div>
  );
}
