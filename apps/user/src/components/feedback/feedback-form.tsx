"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { RatingPicker } from "@/components/rating-stars";
import { trpc } from "@/lib/trpc";

// The feedback form for one delivered order.
//
// Two things are asked, in this order:
//   1. the experience  — delivery, packaging, the unboxing (required)
//   2. each fragrance  — a half-star score and an optional note (optional)
//
// Written notes are private to the studio; the copy says so plainly rather than
// letting anyone assume they are posting a public review.

const EXPERIENCE_WORDS: Record<number, string> = {
  1: "Let us make it right",
  1.5: "Below par",
  2: "Disappointing",
  2.5: "Not quite there",
  3: "Fine",
  3.5: "Good",
  4: "Really good",
  4.5: "Excellent",
  5: "Perfect",
};

type ProductState = { rating: number | null; review: string };

export function FeedbackForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.feedback.forOrder.useQuery({ orderId });

  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [products, setProducts] = useState<Record<string, ProductState>>({});
  // Seed the form from whatever was submitted before, once, when the data lands.
  const [seeded, setSeeded] = useState(false);

  if (data && !seeded) {
    setSeeded(true);
    setRating(data.feedback?.rating ?? null);
    setComment(data.feedback?.comment ?? "");
    setProducts(
      Object.fromEntries(
        data.products.map((p) => [p.productId, { rating: p.myRating, review: p.myReview ?? "" }]),
      ),
    );
  }

  const submit = trpc.feedback.submit.useMutation({
    onSuccess: () => {
      void utils.feedback.pending.invalidate();
      void utils.feedback.mine.invalidate();
      void utils.feedback.forOrder.invalidate({ orderId });
      void utils.rating.orderRatings.invalidate({ orderId });
      toast.success("Thank you — your feedback is with the studio.");
      router.push("/feedback");
    },
    onError: (e) => toast.error(e.message),
  });

  function setProduct(productId: string, patch: Partial<ProductState>) {
    setProducts((prev) => {
      const current = prev[productId] ?? { rating: null, review: "" };
      return { ...prev, [productId]: { ...current, ...patch } };
    });
  }

  function handleSubmit() {
    if (rating == null) {
      toast.error("Please rate your experience first");
      return;
    }
    submit.mutate({
      orderId,
      rating,
      comment: comment.trim() || undefined,
      // Only products the customer actually scored are sent.
      products: Object.entries(products)
        .filter(([, v]) => v.rating != null)
        .map(([productId, v]) => ({
          productId,
          rating: v.rating as number,
          review: v.review.trim() || undefined,
        })),
    });
  }

  if (isLoading) {
    return <div className="h-64 animate-pulse bg-muted" />;
  }

  if (error || !data) {
    return (
      <div className="border border-border p-6">
        <p className="text-sm text-muted-foreground">
          {error?.message ?? "We couldn't load this order."}
        </p>
      </div>
    );
  }

  const isRevision = data.feedback?.rating != null;

  return (
    <div className="space-y-10">
      {/* ── The experience ─────────────────────────────────────────────────── */}
      <section>
        <p className="mb-4 text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground/50">
          Your experience
        </p>
        <div className="border border-border p-5 sm:p-6">
          <p className="text-[14px] font-medium">
            How was the delivery and the unboxing?
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground/60">
            The parcel, the packaging, how quickly it reached you.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <RatingPicker value={rating} onRate={setRating} size="lg" disabled={submit.isPending} />
            {rating != null && (
              <span className="text-[12px] font-medium text-muted-foreground">
                {EXPERIENCE_WORDS[rating]}
              </span>
            )}
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={2000}
            rows={4}
            disabled={submit.isPending}
            placeholder="Anything you'd like us to know? (optional)"
            className="mt-5 w-full resize-y border border-border bg-transparent p-3 text-[13px] placeholder:text-muted-foreground/40 focus:border-foreground focus:outline-none"
          />
        </div>
      </section>

      {/* ── The fragrances ─────────────────────────────────────────────────── */}
      {data.products.length > 0 && (
        <section>
          <p className="mb-4 text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground/50">
            The fragrances
          </p>
          <div className="border border-border divide-y divide-border/50">
            {data.products.map((p) => {
              const state = products[p.productId] ?? { rating: p.myRating, review: p.myReview ?? "" };
              return (
                <div key={p.productId} className="p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt="" className="size-12 shrink-0 bg-muted object-cover" />
                      ) : (
                        <div className="size-12 shrink-0 bg-muted" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium">{p.productName}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground/50">
                          {state.rating != null ? "You rated this fragrance" : "How was this fragrance?"}
                        </p>
                      </div>
                    </div>
                    <div className="sm:pt-1">
                      <RatingPicker
                        value={state.rating}
                        disabled={submit.isPending}
                        onRate={(value) => setProduct(p.productId, { rating: value })}
                      />
                    </div>
                  </div>

                  {/* The note only matters once there's a score to explain */}
                  {state.rating != null && (
                    <textarea
                      value={state.review}
                      onChange={(e) => setProduct(p.productId, { review: e.target.value })}
                      maxLength={2000}
                      rows={3}
                      disabled={submit.isPending}
                      placeholder="How does it wear? Longevity, sillage, the opening… (optional)"
                      className="mt-4 w-full resize-y border border-border bg-transparent p-3 text-[13px] placeholder:text-muted-foreground/40 focus:border-foreground focus:outline-none"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Submit ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-md text-[11px] leading-relaxed text-muted-foreground/60">
          Your notes are read by the studio only — they are never shown to other
          customers. Star ratings feed the average score on the product page.
        </p>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submit.isPending || rating == null}
          className="shrink-0 border border-foreground bg-foreground px-8 py-3 text-[11px] font-semibold tracking-[0.18em] uppercase text-background transition-all hover:bg-transparent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-foreground disabled:hover:text-background"
        >
          {submit.isPending ? "Sending…" : isRevision ? "Update feedback" : "Send feedback"}
        </button>
      </div>
    </div>
  );
}
