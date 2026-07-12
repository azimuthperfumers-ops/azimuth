import { Reveal } from "@/components/reveal";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

// Hand-tilted cards in three different inks — breaks the cream monotony
// right before the footer.
const REVIEWS = [
  {
    quote:
      "Wore it on my wedding day. One spray since and I'm right back in that morning — it's not perfume anymore, it's memory.",
    name: "Megha R.",
    city: "Delhi",
    bg: "#2E2C42",
    tilt: "-rotate-[1.6deg]",
  },
  {
    quote:
      "Lasts from morning chai to the last local home. Three strangers asked what I was wearing. Three.",
    name: "Arjun S.",
    city: "Mumbai",
    bg: "#1B1611",
    tilt: "rotate-[1.2deg]",
  },
  {
    quote:
      "There's a batch number on my box, which means an actual person made this. You can smell that somehow.",
    name: "Ishita K.",
    city: "Bengaluru",
    bg: "#9A5B2B",
    tilt: "-rotate-[0.8deg]",
  },
];

function VerifiedTick() {
  return (
    <svg viewBox="0 0 20 20" className="size-4 shrink-0" aria-hidden>
      <circle cx="10" cy="10" r="9" fill="currentColor" opacity="0.25" />
      <path
        d="M6 10.2l2.6 2.6L14 7.4"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ReviewsSection() {
  return (
    <section className="overflow-hidden border-t border-foreground/8 px-6 pt-24 pb-28 sm:px-10 md:px-16">
      <div className="text-center">
        <div className="text-[11px] font-semibold tracking-[0.3em] text-primary uppercase">
          Word of mouth
        </div>
        <h2 className="font-heading mt-3.5 text-[clamp(2.2rem,3.8vw,3.6rem)] font-medium text-foreground">
          Worn. Remembered. <em className="text-primary">Written in.</em>
        </h2>
      </div>

      <div className="mx-auto mt-16 grid max-w-[1180px] grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3">
        {REVIEWS.map((review, i) => (
          <Reveal key={review.name} delay={i * 110}>
            <figure
              className={`relative flex h-full flex-col overflow-hidden rounded-[26px] px-8 pt-9 pb-8 text-background transition-transform duration-500 hover:rotate-0 ${review.tilt}`}
              style={{ backgroundColor: review.bg }}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.07]"
                style={{ backgroundImage: GRAIN, backgroundSize: "200px 200px" }}
              />
              <div className="font-heading relative text-[64px] leading-[0.6] text-background/40">
                &ldquo;
              </div>
              <blockquote className="relative mt-5 flex-1 text-[15.5px] leading-[1.75] text-background/92">
                {review.quote}
              </blockquote>
              <figcaption className="relative mt-8 flex items-center gap-2.5">
                <span className="font-heading text-[19px] italic">
                  — {review.name}, {review.city}
                </span>
                <VerifiedTick />
              </figcaption>
              <div className="relative mt-1.5 text-[9px] font-semibold tracking-[0.26em] text-background/50 uppercase">
                Verified buyer
              </div>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
