import { Reveal } from "@/components/reveal";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

// Engraved compass rose — the azimuth itself — turning imperceptibly behind the quote.
function CompassRose() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-1/2 left-1/2 size-[min(150vw,660px)] -translate-x-1/2 -translate-y-1/2"
    >
    <svg
      viewBox="0 0 400 400"
      className="compass-spin size-full text-background"
      style={{ opacity: 0.1 }}
      fill="none"
      stroke="currentColor"
    >
      <circle cx="200" cy="200" r="188" strokeWidth="1" />
      <circle cx="200" cy="200" r="164" strokeWidth="0.75" />
      <circle cx="200" cy="200" r="70" strokeWidth="0.75" />
      {/* degree ticks */}
      {Array.from({ length: 72 }).map((_, i) => (
        <line
          key={i}
          x1="200"
          y1="12"
          x2="200"
          y2={i % 6 === 0 ? "26" : "19"}
          strokeWidth={i % 6 === 0 ? 1.2 : 0.6}
          transform={`rotate(${i * 5} 200 200)`}
        />
      ))}
      {/* cardinal points — long needles */}
      {[0, 90, 180, 270].map((deg) => (
        <path
          key={deg}
          d="M200 34 L212 200 L200 214 L188 200 Z"
          strokeWidth="1.2"
          transform={`rotate(${deg} 200 200)`}
        />
      ))}
      {/* intercardinal — short needles */}
      {[45, 135, 225, 315].map((deg) => (
        <path
          key={deg}
          d="M200 96 L208 200 L200 208 L192 200 Z"
          strokeWidth="0.8"
          transform={`rotate(${deg} 200 200)`}
        />
      ))}
      <circle cx="200" cy="200" r="5" strokeWidth="1.2" />
    </svg>
    </div>
  );
}

export function QuoteBand() {
  return (
    <section className="relative overflow-hidden bg-foreground px-6 py-36 text-center sm:px-10 md:px-16">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{ backgroundImage: GRAIN, backgroundSize: "200px 200px" }}
      />
      <CompassRose />
      <Reveal className="relative">
        <div className="font-heading text-[26px] leading-none text-primary italic">✳</div>
        <div className="mt-5 text-[11px] font-semibold tracking-[0.34em] text-primary/80 uppercase">
          The Azimuth Way
        </div>
        <blockquote className="font-heading mx-auto mt-7 max-w-[22ch] text-[clamp(2.2rem,4vw,3.9rem)] leading-[1.25] font-normal text-background italic">
          &ldquo;An accord becomes unmistakably yours.&rdquo;
        </blockquote>
        <div className="mx-auto mt-9 flex items-center justify-center gap-4 text-background/40">
          <span className="h-px w-14 bg-current" />
          <span className="text-[10px] font-semibold tracking-[0.3em] uppercase">
            Bearing set · Batch sealed
          </span>
          <span className="h-px w-14 bg-current" />
        </div>
      </Reveal>
    </section>
  );
}
