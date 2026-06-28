"use client";

import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { trpc } from "@/lib/trpc";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const INGREDIENTS = [
  { name: "Indian Oud",        origin: "Assam, India",       note: "Base",   desc: "Deep, resinous heartwood aged 20+ years. The soul of eastern perfumery." },
  { name: "Rose Absolute",     origin: "Kannauj, India",     note: "Heart",  desc: "Steam-distilled from Damask petals at dawn, before the sun burns off the volatile molecules." },
  { name: "Mysore Sandalwood", origin: "Karnataka, India",   note: "Base",   desc: "Creamy, milky, meditative. No substitute exists — we use only certified sustainable stock." },
  { name: "Benzoin Resin",     origin: "Southeast Asia",     note: "Base",   desc: "A natural fixative and vanilla-sweet anchor that carries a fragrance through hours." },
  { name: "Vetiver",           origin: "Rajasthan, India",   note: "Base",   desc: "Earthy, smoky, rooted. Called 'the oil of tranquility' in traditional Ayurveda." },
  { name: "Jasmine Sambac",    origin: "Tamil Nadu, India",  note: "Heart",  desc: "Intoxicating and indolic. Harvested at night, when the blooms are most fragrant." },
];

const TIMELINE = [
  { year: "2019", title: "The first accord",    body: "A makeshift lab in a single room. Dozens of failed trials, a few that sang. The obsession was already irreversible." },
  { year: "2021", title: "The name",            body: "We named the house after the azimuth — the navigational angle that orients a traveller to true north. Every scent we make is a direction." },
  { year: "2023", title: "Small-batch launch",  body: "Twelve fragrances. Under 200 bottles each. Sold through quiet word of mouth. The first batch was gone in three weeks." },
  { year: "2025", title: "Nationwide reach",    body: "We now deliver across every Indian state, from the Himalayas to the Coromandel coast — one parcel at a time, never compromising the bottle." },
];

const CRAFT = [
  {
    num: "01",
    title: "Source",
    body: "We travel to the origin — Assam for oud, Kannauj for rose attar, Mysore for sandalwood. We buy only from farms and distillers we have met in person.",
  },
  {
    num: "02",
    title: "Compose",
    body: "An accord begins on paper — ratios, intuition, memory. Then it moves to glass. Most accords are abandoned. The ones that survive are revised for months.",
  },
  {
    num: "03",
    title: "Rest",
    body: "Every finished formula rests for a minimum of eight weeks in sealed vessels. Molecules marry. Off-notes round off. What remains is what we bottle.",
  },
];

const DEFAULT_HEADER_SUBTITLE = "We make perfume the slow way. No shortcuts, no synthetic proxies pretending to be naturals. Only raw materials with stories, blended until something true emerges.";
const DEFAULT_ORIGIN_BLOCKQUOTE = "An azimuth is a bearing — a precise angle from true north. We chose that name because every fragrance we build is a direction, not a decoration.";
const DEFAULT_ORIGIN_BODY = [
  "Azimuth Perfumers began in a single room in 2019 — a rented space, secondhand glassware, and a notebook filled with the kind of obsessive notes that either become something great or remain quietly embarrassing.",
  "The founding premise was simple and inconvenient: India has some of the world's finest raw perfumery materials — ouds from Assam, rose attar from Kannauj, sandalwood from Mysore, vetiver from Rajasthan — and most of them were being exported, processed abroad, and sold back to us as \"luxury imports.\" We wanted to close that loop.",
  "We make our accords entirely in India, from materials sourced directly from Indian farmers and distillers. Each batch is under two hundred units. Nothing is rushed. We have a saying in the lab: if the accord is not ready, the batch does not ship.",
  "The result is a house of slow perfumery — uncompromising, small, and stubbornly itself.",
].join("\n\n");
const DEFAULT_PULLQUOTE = "Most fragrance is built to please everyone and so pleases no one deeply. We build to please the one person who has been looking for exactly this.";
const DEFAULT_FOUNDER_BODY = [
  "I have been asked many times why we don't scale. Why we cap batches. Why we refuse to move to a larger facility and simply make more.",
  "The honest answer is that I don't know how to make perfume at scale without it becoming something else. The small batch is not a marketing decision — it is the only format in which I can personally smell every bottle before it leaves the lab. And that matters to me more than growth.",
  "When you wear an Azimuth fragrance, I want you to know that a human being paid close attention to it. Not a machine, not a process, not an algorithm. A person who cares enormously about the difference between good and correct.",
].join("\n\n");

export default function OurStoryPage() {
  const { data } = trpc.content.getSection.useQuery({ section: "our_story" });

  const content = {
    headerSubtitle: (data?.headerSubtitle as string | undefined) ?? DEFAULT_HEADER_SUBTITLE,
    originBlockquote: (data?.originBlockquote as string | undefined) ?? DEFAULT_ORIGIN_BLOCKQUOTE,
    originBody: (data?.originBody as string | undefined) ?? DEFAULT_ORIGIN_BODY,
    pullquote: (data?.pullquote as string | undefined) ?? DEFAULT_PULLQUOTE,
    founderBody: (data?.founderBody as string | undefined) ?? DEFAULT_FOUNDER_BODY,
  };

  return (
    <>
      <SiteHeader />

      <main>
        {/* ── Editorial page header ─────────────────────────────────────────── */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-[1400px] px-4 md:px-8 pt-20 pb-16 md:pt-28 md:pb-24">
            <p className="text-[10px] font-semibold tracking-[0.38em] uppercase text-muted-foreground/40 mb-8">
              Azimuth Perfumers — Est. 2019
            </p>

            <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
              <h1 className="text-[clamp(4.5rem,11vw,10rem)] font-semibold tracking-tight leading-[0.88] text-foreground">
                Our
                <br />
                <span className="font-heading italic font-medium text-primary">
                  Story.
                </span>
              </h1>

              <div className="md:max-w-xs md:pb-2 space-y-4">
                <p className="text-[15px] leading-[1.85] text-muted-foreground">
                  {content.headerSubtitle}
                </p>
                <div className="h-px w-8 bg-primary/50" />
              </div>
            </div>
          </div>
        </section>

        {/* ── Opening — two-column ──────────────────────────────────────────── */}
        <section id="origin" className="mx-auto max-w-[1400px] px-4 md:px-8 py-24 md:py-36">
          <div className="grid gap-16 md:grid-cols-2 md:gap-24 items-start">
            <div className="md:sticky md:top-28">
              <p className="text-[10px] font-semibold tracking-[0.3em] uppercase text-muted-foreground/50 mb-6">
                The origin
              </p>
              <blockquote className="font-heading text-[clamp(1.9rem,3.5vw,3rem)] font-medium italic leading-[1.18] text-foreground">
                &ldquo;{content.originBlockquote}&rdquo;
              </blockquote>
              <div className="mt-8 h-px w-12 bg-primary" />
            </div>

            <div className="space-y-6 text-[15px] leading-[1.85] text-muted-foreground">
              {content.originBody.split("\n\n").map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
        </section>

        {/* ── Craft — three steps ───────────────────────────────────────────── */}
        <section className="border-t border-border bg-muted/30">
          <div className="mx-auto max-w-[1400px] px-4 md:px-8 py-20 md:py-28">
            <div className="mb-16 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.3em] uppercase text-muted-foreground/50 mb-3">
                  How we work
                </p>
                <h2 className="text-[clamp(2.4rem,5.5vw,4rem)] font-semibold tracking-tight text-foreground leading-none">
                  The craft
                </h2>
              </div>
              <p className="max-w-xs text-[13px] leading-relaxed text-muted-foreground md:pb-1">
                Three steps. Repeated, refined, and never abbreviated.
              </p>
            </div>

            <div className="grid gap-0 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
              {CRAFT.map(({ num, title, body }) => (
                <div key={num} className="px-8 py-10 md:py-0 md:px-12 first:pl-0 last:pr-0 space-y-5">
                  <span className="font-heading text-[4.5rem] font-medium italic leading-none text-primary/15 select-none">
                    {num}
                  </span>
                  <h3 className="text-[12px] font-semibold tracking-[0.22em] uppercase text-foreground">
                    {title}
                  </h3>
                  <p className="text-[14px] leading-[1.8] text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Dark pullquote ────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-foreground py-28 md:py-44 text-center px-6">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: GRAIN, backgroundSize: "200px 200px" }}
          />
          <div className="relative z-10 mx-auto max-w-3xl">
            <p className="mb-10 text-[10px] font-semibold tracking-[0.3em] uppercase text-background/25">
              Our philosophy
            </p>
            <p className="font-heading text-[clamp(1.9rem,4.5vw,3.8rem)] font-medium italic leading-[1.18] text-background">
              &ldquo;{content.pullquote}&rdquo;
            </p>
            <div className="mx-auto mt-12 h-px w-10 bg-background/20" />
          </div>
        </section>

        {/* ── Timeline ─────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-[1400px] px-4 md:px-8 py-24 md:py-36">
          <div className="mb-16">
            <p className="text-[10px] font-semibold tracking-[0.3em] uppercase text-muted-foreground/50 mb-3">
              The journey
            </p>
            <h2 className="text-[clamp(2.4rem,5.5vw,4rem)] font-semibold tracking-tight text-foreground leading-none">
              Milestones
            </h2>
          </div>

          <div className="relative">
            <div className="hidden md:block absolute left-[7.5rem] top-0 bottom-0 w-px bg-border" />

            <div className="space-y-0 divide-y divide-border md:divide-y-0">
              {TIMELINE.map(({ year, title, body }) => (
                <div
                  key={year}
                  className="grid grid-cols-1 md:grid-cols-[7.5rem_1fr] gap-4 md:gap-16 py-10 md:py-14 items-start"
                >
                  <div className="flex items-center gap-4 md:justify-end md:flex-col md:items-end md:gap-2 md:pt-1">
                    <span className="font-heading text-[2.2rem] md:text-[2.8rem] font-medium italic leading-none text-primary/25">
                      {year}
                    </span>
                  </div>
                  <div className="md:pl-16 space-y-2">
                    <h3 className="text-[12px] font-semibold tracking-[0.16em] uppercase text-foreground">
                      {title}
                    </h3>
                    <p className="text-[14px] leading-[1.8] text-muted-foreground max-w-xl">
                      {body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Ingredients ──────────────────────────────────────────────────── */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-[1400px] px-4 md:px-8 py-20 md:py-28">
            <div className="mb-16 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.3em] uppercase text-muted-foreground/50 mb-3">
                  What goes inside
                </p>
                <h2 className="text-[clamp(2.4rem,5.5vw,4rem)] font-semibold tracking-tight text-foreground leading-none">
                  Our ingredients
                </h2>
              </div>
              <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground md:pb-1">
                Every material is traceable to a specific region and harvest. We keep records so you can ask us where anything came from.
              </p>
            </div>

            <div className="grid gap-px bg-border grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {INGREDIENTS.map(({ name, origin, note, desc }) => (
                <div
                  key={name}
                  className="group bg-background px-7 py-8 space-y-3 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-[13px] font-semibold tracking-[0.08em] text-foreground">
                      {name}
                    </h3>
                    <span className="shrink-0 text-[9px] font-semibold tracking-[0.14em] uppercase text-primary/70 border border-primary/20 px-2 py-0.5">
                      {note}
                    </span>
                  </div>
                  <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground/50">
                    {origin}
                  </p>
                  <p className="text-[13px] leading-[1.75] text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Founder's note ────────────────────────────────────────────────── */}
        <section
          className="relative overflow-hidden py-24 md:py-40 px-6 border-t border-border"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.035]"
            style={{ backgroundImage: GRAIN, backgroundSize: "200px 200px" }}
          />

          <span
            aria-hidden
            className="pointer-events-none select-none absolute right-0 top-1/2 -translate-y-1/2 text-[clamp(8rem,22vw,20rem)] font-semibold tracking-tighter leading-none text-foreground/[0.03] hidden md:block pr-4"
          >
            AZIMUTH
          </span>

          <div className="relative z-10 mx-auto max-w-2xl">
            <p className="text-[10px] font-semibold tracking-[0.3em] uppercase text-muted-foreground/50 mb-10">
              A note from the founder
            </p>
            <div className="space-y-5 text-[15px] leading-[1.85] text-muted-foreground">
              {content.founderBody.split("\n\n").map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <div className="mt-10">
              <p className="font-heading text-[1.6rem] italic text-foreground/70">— The Azimuth Lab</p>
            </div>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────────────── */}
        <section className="border-t border-border bg-foreground">
          <div className="mx-auto max-w-[1400px] px-4 md:px-8 py-20 md:py-24 flex flex-col md:flex-row items-center justify-between gap-10">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.3em] uppercase text-background/30 mb-4">
                Find your direction
              </p>
              <h2 className="font-heading text-[clamp(2.2rem,5vw,4rem)] font-medium italic leading-[1.1] text-background">
                Discover your accord.
              </h2>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 shrink-0">
              <Link
                href="/shop"
                className="inline-flex h-13 items-center bg-background px-10 text-[11px] font-semibold tracking-[0.2em] text-foreground uppercase transition-opacity hover:opacity-80"
              >
                Shop fragrances
              </Link>
              <Link
                href="/shop"
                className="inline-flex h-13 items-center border border-background/30 px-10 text-[11px] font-semibold tracking-[0.2em] text-background/70 uppercase transition-all hover:border-background/60 hover:text-background"
              >
                View all →
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
