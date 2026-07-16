import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "Wallet Policy · Azimuth Perfumers",
  description: "How the Azimuth Wallet, top-ups and refunds work.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-7">
      <h2 className="font-heading text-xl font-medium">{title}</h2>
      <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function WalletPolicyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[760px] px-4 md:px-6 py-8 md:py-14 pb-24">
        <Link
          href="/wallet"
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] uppercase text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="size-3.5" /> Back to wallet
        </Link>

        <p className="mb-1 text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">Azimuth</p>
        <h1 className="font-heading text-4xl font-medium leading-tight md:text-5xl">Wallet Policy</h1>
        <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">
          The Azimuth Wallet is prepaid store credit for use on Azimuth Perfumers. Please read how top-ups
          and refunds work before adding money.
        </p>

        <div className="mt-10 space-y-8">
          <Section title="What the wallet is">
            <p>
              Your wallet holds store credit measured in Indian Rupees. It can be topped up in advance and
              spent at checkout on any order. The balance belongs to your account and is shown in full,
              along with every transaction, on your wallet page.
            </p>
          </Section>

          <Section title="Refunds are issued to the wallet">
            <p>
              Where a refund is due — for example an eligible cancellation, a damaged item, or an approved
              request — <span className="font-medium text-foreground">the refund is credited to your Azimuth
              Wallet as store credit, not to your bank account or card.</span> This is our standard refund
              method for returns and all related purposes.
            </p>
            <p>
              A wallet refund is applied instantly and appears in your transaction history as a credit, with
              the order it relates to and a running balance — so you always have a clear record of what was
              refunded and when.
            </p>
          </Section>

          <Section title="Store credit only — no cash-out">
            <p>
              Wallet balance is one-way. It <span className="font-medium text-foreground">cannot be
              withdrawn, transferred, or converted back to cash</span>, and it cannot be redeemed anywhere
              outside Azimuth Perfumers. Money can be added to the wallet; it does not travel back to a bank.
            </p>
          </Section>

          <Section title="Top-ups">
            <p>
              Top-ups start at a minimum of ₹500 and are paid through our secure payment gateway. Once added,
              a top-up becomes store credit under this policy and is spendable at checkout. Your wallet
              balance does not expire.
            </p>
          </Section>

          <Section title="Using your balance">
            <p>
              At checkout you may choose to pay with your wallet when the balance covers the order total.
              Coupons may be restricted to a specific payment method; any such restriction is shown when you
              apply the coupon.
            </p>
          </Section>

          <Section title="Questions">
            <p>
              For anything about your wallet or a specific refund, reach us at{" "}
              <a href="mailto:azimuthperfumers@gmail.com" className="text-primary hover:underline">
                azimuthperfumers@gmail.com
              </a>{" "}
              with your order number.
            </p>
          </Section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
