"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquareQuote } from "lucide-react";

import { FeedbackNudge } from "@/components/feedback/feedback-nudge";
import { RatingDisplay } from "@/components/rating-stars";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";

// The customer's feedback home: deliveries still waiting on a word, and
// everything they have already told us.

function AwaitingSection() {
  const { data: pending, isLoading } = trpc.feedback.pending.useQuery();

  if (isLoading) return <div className="h-28 animate-pulse bg-muted" />;
  if (!pending || pending.length === 0) return null;

  return (
    <section>
      <p className="mb-4 text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground/50">
        Awaiting your review
      </p>
      {/* limit high enough that the hub shows the full list, unlike the nudge */}
      <FeedbackNudge limit={20} variant="panel" heading={false} />
    </section>
  );
}

function HistorySection() {
  const { data: mine, isLoading } = trpc.feedback.mine.useQuery();

  if (isLoading) return <div className="h-28 animate-pulse bg-muted" />;

  if (!mine || mine.length === 0) {
    return (
      <section>
        <div className="border border-border px-6 py-14 text-center">
          <MessageSquareQuote className="mx-auto mb-4 size-6 text-muted-foreground/30" />
          <p className="text-[13px] font-medium">No feedback yet</p>
          <p className="mx-auto mt-1.5 max-w-sm text-[12px] leading-relaxed text-muted-foreground/60">
            Once an order reaches you, we&apos;ll ask how it went. Your notes stay
            between you and the studio.
          </p>
          <Link
            href="/shop"
            className="mt-6 inline-flex border border-foreground px-8 py-3 text-[11px] font-semibold tracking-[0.18em] uppercase transition-all hover:bg-foreground hover:text-background"
          >
            Shop the collection
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section>
      <p className="mb-4 text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground/50">
        What you&apos;ve told us
      </p>
      <div className="border border-border divide-y divide-border/50">
        {mine.map((f) => (
          <div key={f.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="font-mono text-[12px] font-semibold">{f.orderNumber}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/50">
                {new Date(f.submittedAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
              {f.comment && (
                <p className="mt-2.5 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
                  &ldquo;{f.comment}&rdquo;
                </p>
              )}
              <Link
                href={`/feedback/${f.orderId}`}
                className="mt-3 inline-block text-[11px] font-semibold tracking-[0.14em] uppercase text-muted-foreground/60 underline-offset-4 hover:text-foreground hover:underline"
              >
                Edit
              </Link>
            </div>
            <div className="shrink-0 sm:pt-0.5">
              {f.rating != null && <RatingDisplay rating={f.rating} />}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function FeedbackPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return null;

  if (!session) {
    router.replace(`/account?next=${encodeURIComponent("/feedback")}`);
    return null;
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[780px] px-4 py-8 pb-24 md:px-8 md:py-12">
        <header className="mb-10 border-b border-border pb-8">
          <p className="mb-1 text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
            Feedback
          </p>
          <h1 className="font-heading text-4xl font-medium leading-tight">
            Tell us how it went
          </h1>
          <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
            We read every word. What you write here goes to the studio and stays
            private — it is never published to other customers.
          </p>
        </header>

        <div className="space-y-12">
          <AwaitingSection />
          <HistorySection />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
