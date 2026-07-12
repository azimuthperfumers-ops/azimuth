import Link from "next/link";

import { Reveal } from "@/components/reveal";
import { IngredientCarousel, type IngredientName } from "./ingredient-carousel";

type Category = { id: string; name: string };

const CREAM = "#FAF6EE";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const MOODS: {
  numeral: string;
  title: string;
  notes: string;
  desc: string;
  leads: string;
  card: string;
  fieldFrom: string;
  fieldTo: string;
  ingredients: IngredientName[];
  categoryMatch: string;
}[] = [
  {
    numeral: "i",
    title: "Warm & magnetic",
    notes: "Amber · Cedar · Citrus",
    desc: "Amber, woods and a trace of smoke. For evenings that run long and rooms that turn when you enter.",
    leads: "Shop For Him",
    card: "#6E5B33",
    fieldFrom: "#8B7443",
    fieldTo: "#55431F",
    ingredients: ["Amber", "Cedarwood", "Citrus"],
    categoryMatch: "for him",
  },
  {
    numeral: "ii",
    title: "Soft & lingering",
    notes: "Rose · Vanilla · Chamomile",
    desc: "Rose, ylang ylang and sandalwood that settle like skin. Presence that speaks before you do.",
    leads: "Shop For Her",
    card: "#A5675D",
    fieldFrom: "#C58E85",
    fieldTo: "#7E463D",
    ingredients: ["Rose", "Vanilla", "Chamomile"],
    categoryMatch: "for her",
  },
  {
    numeral: "iii",
    title: "Dark & unhurried",
    notes: "Oud · Patchouli · Incense",
    desc: "Oud, incense and night air. A slow burn for the ones who never explain themselves.",
    leads: "Shop Unisex",
    card: "#262338",
    fieldFrom: "#3A3654",
    fieldTo: "#17152A",
    ingredients: ["Oud", "Patchouli", "Incense"],
    categoryMatch: "unisex",
  },
];

// Rubber postmark riding the stamp's corner
function Postmark({ color }: { color: string }) {
  return (
    <div
      className="pointer-events-none absolute -top-4 -right-3 z-10 size-[84px] -rotate-12"
      style={{ color }}
    >
      <svg viewBox="0 0 100 100" className="size-full opacity-60">
        <defs>
          <path id="postmark-arc" d="M50,50 m-36,0 a36,36 0 1,1 72,0 a36,36 0 1,1 -72,0" />
        </defs>
        <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.7" />
        <text className="fill-current" style={{ fontSize: "10.5px", letterSpacing: "2.6px" }}>
          <textPath href="#postmark-arc">AZIMUTH · PERFUMERS · POST ·</textPath>
        </text>
        <path d="M20 86 q10 -6 20 0 t20 0 t20 0" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.7" />
      </svg>
    </div>
  );
}

export function MoodSection({ categories }: { categories: Category[] }) {
  return (
    <section id="quiz" className="border-t border-foreground/8 px-6 pt-24 pb-20 sm:px-10 md:px-16">
      <div className="flex flex-wrap items-end justify-between gap-8">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.3em] text-primary uppercase">
            Where do we start
          </div>
          <h2 className="font-heading mt-4 text-[clamp(2.2rem,3.6vw,3.5rem)] leading-[1.1] font-medium text-foreground">
            Choose the way you want <em className="text-primary">to be remembered.</em>
          </h2>
        </div>
        <p className="max-w-[36ch] text-[14px] leading-[1.7] text-muted-foreground">
          Not sure which bottle is yours? Start from a feeling — each one leads to a composition.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {MOODS.map((mood, i) => {
          const category = categories.find((c) => c.name.toLowerCase() === mood.categoryMatch);
          const href = category ? `/shop?category=${category.id}` : "/shop";
          return (
            <Reveal key={mood.numeral} delay={i * 110}>
              <Link
                href={href}
                className="group relative block h-full overflow-hidden rounded-[28px] px-7 pt-8 pb-8 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_22px_48px_rgba(27,22,17,0.28)]"
                style={{ backgroundColor: mood.card, color: CREAM }}
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.06]"
                  style={{ backgroundImage: GRAIN, backgroundSize: "200px 200px" }}
                />

                {/* Ghost numeral bleeding off the top corner */}
                <div
                  aria-hidden
                  className="font-heading pointer-events-none absolute -top-7 right-3 text-[130px] leading-none italic"
                  style={{ color: CREAM, opacity: 0.1 }}
                >
                  {mood.numeral}.
                </div>

                {/* Cream stamp tilts anticlockwise; ingredient plate tilts clockwise */}
                <div className="relative mt-2">
                  <Postmark color={CREAM} />
                  <div
                    className="stamp-frame -rotate-2 transition-transform duration-500 group-hover:rotate-0"
                    style={{ backgroundColor: CREAM, "--stamp-hole": "9px" } as React.CSSProperties}
                  >
                    <div className="overflow-hidden">
                      <div className="rotate-[3.5deg] scale-110 transition-transform duration-500 group-hover:rotate-0 group-hover:scale-105">
                        <IngredientCarousel
                          items={mood.ingredients}
                          from={mood.fieldFrom}
                          to={mood.fieldTo}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className="mt-7 text-[10px] font-semibold tracking-[0.3em] uppercase"
                  style={{ color: CREAM, opacity: 0.65 }}
                >
                  {mood.notes}
                </div>
                <div className="font-heading mt-2.5 text-[32px] leading-tight italic">
                  {mood.title}
                </div>
                <p className="mt-3 min-h-[68px] text-[14px] leading-[1.7]" style={{ opacity: 0.78 }}>
                  {mood.desc}
                </p>
                <div className="mt-5 inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.22em] uppercase">
                  <span className="border-b pb-0.5" style={{ borderColor: `${CREAM}66` }}>
                    {mood.leads}
                  </span>
                  <span className="transition-transform duration-300 group-hover:translate-x-1.5">→</span>
                </div>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
