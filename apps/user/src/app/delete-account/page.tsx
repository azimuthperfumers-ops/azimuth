import Link from "next/link";

import { DeleteAccountPanel } from "@/components/delete-account-panel";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { COMPANY } from "@/content/legal";

export const metadata = {
  title: "Delete Your Account · Azimuth Perfumers",
  description:
    "Permanently delete your Azimuth Perfumers account and the personal data attached to it, and see exactly what we are required to keep.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-7">
      <h2 className="font-heading text-xl font-medium">{title}</h2>
      <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function DataList({ items }: { items: string[] }) {
  return (
    <ul className="mt-1 space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5">
          <span aria-hidden className="mt-[9px] size-1 shrink-0 bg-muted-foreground/40" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function DeleteAccountPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[760px] px-4 py-8 pb-24 md:px-6 md:py-14">
        <p className="mb-1 text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
          Azimuth
        </p>
        <h1 className="font-heading text-4xl font-medium leading-tight md:text-5xl">Delete your account</h1>
        <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">
          You can close your Azimuth Perfumers account — on the website or in the Azimuth app — at any time,
          from this page. Deletion is immediate and permanent: there is no waiting period and no way to undo
          it afterwards.
        </p>

        {/* The flow itself sits up top: anyone who arrived here to act shouldn't
            have to read the policy first to find the button. */}
        <div className="mt-10">
          <DeleteAccountPanel />
        </div>

        <div className="mt-14 space-y-8">
          <Section title="What gets deleted">
            <p>The moment you confirm, we erase:</p>
            <DataList
              items={[
                "Your name, email address and phone number",
                "Your password and any linked Google sign-in",
                "Every saved delivery address",
                "Your cart and your wishlist",
                "Every active session — you are signed out on every device",
              ]}
            />
            <p>
              Your email address is released, so you can sign up again later with the same address. It will be
              a brand-new account with none of the history below.
            </p>
          </Section>

          <Section title="What we have to keep">
            <p>
              Indian tax law requires a seller to retain invoices and the transaction records behind them, so
              deleting your account does not erase your past purchases. What stays is:
            </p>
            <DataList
              items={[
                "Completed orders, their line items, and the GST invoice issued for each one",
                "The delivery address printed on those invoices, as part of the invoice record",
                "Any support conversations tied to those orders",
              ]}
            />
            <p>
              These records stop being connected to a named customer — the account they point at no longer
              holds your name, email or phone number.
            </p>
          </Section>

          <Section title="Before you can delete">
            <p>
              We will ask you to wrap up anything still in motion, because settling it needs a working address
              and a way to reach you. You cannot delete your account while:
            </p>
            <DataList
              items={[
                "An order is awaiting dispatch, in transit, or out for delivery",
                "A refund, return or exchange is still being processed",
                "A support request is still open",
              ]}
            />
            <p>
              Once those are delivered, cancelled, refunded or closed, deletion goes through immediately.
            </p>
          </Section>

          <Section title="Wallet credit is not refunded">
            <p>
              Azimuth Wallet credit is store credit — as set out in the{" "}
              <Link href="/wallet/policy" className="text-primary hover:underline">
                Wallet Policy
              </Link>
              , it can never be withdrawn, transferred or converted back to cash. If you delete your account
              while credit remains, that credit is lost. We show you the balance and ask you to confirm before
              going ahead, so spend it first if you would rather not lose it.
            </p>
          </Section>

          <Section title="Need help instead?">
            <p>
              If you cannot sign in, or you would rather we handled this for you, write to{" "}
              <a href={`mailto:${COMPANY.email}`} className="text-primary hover:underline">
                {COMPANY.email}
              </a>{" "}
              from the email address on the account and we will action it for you. See our{" "}
              <Link href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>{" "}
              for how we handle your data more broadly.
            </p>
          </Section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
