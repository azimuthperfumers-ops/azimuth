"use client";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { trpc } from "@/lib/trpc";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

// Fallbacks for an un-customised site. These are the same strings the admin's
// content playground seeds its draft with (OUR_STORY_DEFAULTS in
// apps/admin/src/components/content/types.ts) — keep the two in step.
const DEFAULTS = {
  eyebrow: "Azimuth Perfumers — Est. 2019",
  titleLine1: "Our",
  titleItalic: "Story.",
  statement: ["A perfume is not what you wear.", "It’s what you leave behind."].join("\n"),
  // A short, deliberately spare narrative — the whole page is this single statement.
  body: [
    "We founded this house to capture moments too fleeting for photographs. The trace of someone’s hair as they turn. The warmth of sand after sunset. The way rain smells different at 3am.",
    "Each composition begins as a feeling, then becomes a formula. We source rare absolutes, age our blends like fine wine, and hand-finish every bottle. Because true luxury isn’t logo or price. It’s the quiet confidence of being unforgettable.",
  ].join("\n\n"),
  closingLine: "This is our craft. Your signature awaits.",
};

const splitParagraphs = (body: string) =>
  body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

const splitLines = (text: string) =>
  text.split("\n").map((l) => l.trim()).filter(Boolean);

export default function OurStoryPage() {
  const content = trpc.content.getSection.useQuery({ section: "our_story" });

  // An empty string saved from the admin is treated as "not set" — a blank
  // eyebrow or title would leave a hole in the layout, not a cleaner page.
  const copy = (key: keyof typeof DEFAULTS) =>
    ((content.data?.[key] as string | undefined)?.trim() || DEFAULTS[key]);

  return (
    <>
      <SiteHeader />

      <main>
        {/* ── Editorial page header ─────────────────────────────────────────── */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-[1400px] px-4 md:px-8 pt-20 pb-16 md:pt-28 md:pb-24">
            <p className="text-[10px] font-semibold tracking-[0.38em] uppercase text-muted-foreground/40 mb-8">
              {copy("eyebrow")}
            </p>
            <h1 className="text-[clamp(4.5rem,11vw,10rem)] font-semibold tracking-tight leading-[0.88] text-foreground">
              {copy("titleLine1")}
              <br />
              <span className="font-heading italic font-medium text-primary">
                {copy("titleItalic")}
              </span>
            </h1>
          </div>
        </section>

        {/* ── The statement ─────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.035]"
            style={{ backgroundImage: GRAIN, backgroundSize: "200px 200px" }}
          />

          <div className="relative z-10 mx-auto max-w-2xl px-6 md:px-8 py-24 md:py-40 text-center">
            <blockquote className="font-heading text-[clamp(2rem,5.5vw,3.6rem)] font-medium italic leading-[1.18] text-foreground">
              {splitLines(copy("statement")).map((line, i) => (
                <span key={i} className="block">
                  {line}
                </span>
              ))}
            </blockquote>

            <div className="mx-auto mt-12 h-px w-12 bg-primary" />

            <div className="mt-14 space-y-7 text-[15px] md:text-[16px] leading-[1.9] text-muted-foreground text-left">
              {splitParagraphs(copy("body")).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>

            <p className="mt-16 font-heading text-[clamp(1.4rem,3.2vw,2.1rem)] font-medium italic text-foreground/80">
              {copy("closingLine")}
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
