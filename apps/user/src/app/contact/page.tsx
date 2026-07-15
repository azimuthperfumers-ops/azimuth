import Link from "next/link";
import { Phone, Mail, MessageCircle, MapPin } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata = {
  title: "Contact · Azimuth Perfumers",
  description: "Reach the Azimuth Perfumers team.",
};

const PHONE_DISPLAY = "+91 91160 62700";
const PHONE_TEL = "+919116062700";
const EMAIL = "care@azimuth.net.in";

export default function ContactPage() {
  return (
    <>
      <SiteHeader />

      <main>
        {/* Header */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-[1400px] px-4 pt-20 pb-14 md:px-8 md:pt-28 md:pb-20">
            <p className="mb-3 text-[12px] font-semibold tracking-[0.2em] text-muted-foreground/50 uppercase">
              Home / Contact
            </p>
            <h1 className="font-heading text-[clamp(3rem,7vw,6rem)] font-medium leading-[0.95] tracking-tight text-foreground">
              Talk to <em className="text-primary italic">us.</em>
            </h1>
            <p className="mt-6 max-w-xl text-[16px] leading-[1.75] text-muted-foreground">
              Questions about a fragrance, an order, or a bespoke composition? A person — not a bot — reads
              every message. We reply within one working day.
            </p>
          </div>
        </section>

        {/* Contact methods */}
        <section className="mx-auto max-w-[1400px] px-4 py-16 md:px-8 md:py-24">
          <div className="grid grid-cols-1 gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {/* Phone */}
            <a href={`tel:${PHONE_TEL}`} className="group flex flex-col gap-4 bg-background p-8 transition-colors hover:bg-secondary/40 md:p-10">
              <Phone className="size-6 text-primary" strokeWidth={1.5} />
              <div>
                <div className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground/60 uppercase">Call us</div>
                <div className="font-heading mt-2 text-[26px] text-foreground group-hover:text-primary">{PHONE_DISPLAY}</div>
                <div className="mt-1 text-[13px] text-muted-foreground">Mon–Sat · 10am – 7pm IST</div>
              </div>
            </a>

            {/* Email */}
            <a href={`mailto:${EMAIL}`} className="group flex flex-col gap-4 bg-background p-8 transition-colors hover:bg-secondary/40 md:p-10">
              <Mail className="size-6 text-primary" strokeWidth={1.5} />
              <div>
                <div className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground/60 uppercase">Email</div>
                <div className="font-heading mt-2 text-[26px] text-foreground group-hover:text-primary">{EMAIL}</div>
                <div className="mt-1 text-[13px] text-muted-foreground">For orders, refunds & wholesale</div>
              </div>
            </a>

            {/* Support */}
            <Link href="/support" className="group flex flex-col gap-4 bg-background p-8 transition-colors hover:bg-secondary/40 md:p-10">
              <MessageCircle className="size-6 text-primary" strokeWidth={1.5} />
              <div>
                <div className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground/60 uppercase">Support tickets</div>
                <div className="font-heading mt-2 text-[26px] text-foreground group-hover:text-primary">Raise a ticket →</div>
                <div className="mt-1 text-[13px] text-muted-foreground">Track an order or open a request</div>
              </div>
            </Link>
          </div>

          {/* Address */}
          <div className="mt-12 flex items-start gap-4 text-muted-foreground">
            <MapPin className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.5} />
            <div>
              <div className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground/60 uppercase">Studio</div>
              <p className="mt-1.5 max-w-md text-[15px] leading-relaxed text-foreground">
                14, Shitla Vihar Colony, Opp. Shree Mangal Garden, Chamunda Chauraha, Varun Sagar Road,
                Ajmer, Rajasthan
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">Handcrafted here · shipped pan-India</p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
