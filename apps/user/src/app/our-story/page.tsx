import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

// A short, deliberately spare narrative — the whole page is this single statement.
const STORY = [
  "We founded this house to capture moments too fleeting for photographs. The trace of someone’s hair as they turn. The warmth of sand after sunset. The way rain smells different at 3am.",
  "Each composition begins as a feeling, then becomes a formula. We source rare absolutes, age our blends like fine wine, and hand-finish every bottle. Because true luxury isn’t logo or price. It’s the quiet confidence of being unforgettable.",
];

export default function OurStoryPage() {
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
            <h1 className="text-[clamp(4.5rem,11vw,10rem)] font-semibold tracking-tight leading-[0.88] text-foreground">
              Our
              <br />
              <span className="font-heading italic font-medium text-primary">Story.</span>
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
              A perfume is not what you wear.
              <br />
              It&rsquo;s what you leave behind.
            </blockquote>

            <div className="mx-auto mt-12 h-px w-12 bg-primary" />

            <div className="mt-14 space-y-7 text-[15px] md:text-[16px] leading-[1.9] text-muted-foreground text-left">
              {STORY.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>

            <p className="mt-16 font-heading text-[clamp(1.4rem,3.2vw,2.1rem)] font-medium italic text-foreground/80">
              This is our craft. Your signature awaits.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
