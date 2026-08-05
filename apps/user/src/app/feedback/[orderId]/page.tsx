"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { FeedbackForm } from "@/components/feedback/feedback-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";

export default function OrderFeedbackPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  // Header copy only — the form fetches (and caches) the same query itself.
  const { data } = trpc.feedback.forOrder.useQuery({ orderId }, { enabled: !!session });

  if (isPending) return null;

  if (!session) {
    router.replace(`/account?next=${encodeURIComponent(`/feedback/${orderId}`)}`);
    return null;
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[780px] px-4 py-8 pb-24 md:px-8 md:py-12">
        <Link
          href="/feedback"
          className="mb-8 inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] uppercase text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          All feedback
        </Link>

        <header className="mb-10 border-b border-border pb-8">
          <p className="mb-1 text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
            {data?.orderNumber ? (
              <span className="font-mono normal-case tracking-normal">{data.orderNumber}</span>
            ) : (
              "Feedback"
            )}
          </p>
          <h1 className="font-heading text-4xl font-medium leading-tight">
            How was your order?
          </h1>
          {data?.deliveredAt && (
            <p className="mt-2 text-[13px] text-muted-foreground">
              Delivered{" "}
              {new Date(data.deliveredAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}
        </header>

        <FeedbackForm orderId={orderId} />
      </main>
      <SiteFooter />
    </>
  );
}
