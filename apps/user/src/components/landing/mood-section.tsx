import Link from "next/link";

import { Reveal } from "@/components/reveal";

type Category = { id: string; name: string };

const MOODS = [
  {
    numeral: "i.",
    title: "Warm & magnetic",
    desc: "Amber, woods and a trace of smoke. For evenings that run long and rooms that turn when you enter.",
    leads: "Shop For Him",
    bg: "#8B7443",
    categoryMatch: "for him",
  },
  {
    numeral: "ii.",
    title: "Soft & lingering",
    desc: "Rose, ylang ylang and sandalwood that settle like skin. Presence that speaks before you do.",
    leads: "Shop For Her",
    bg: "#C58E85",
    categoryMatch: "for her",
  },
  {
    numeral: "iii.",
    title: "Dark & unhurried",
    desc: "Oud, incense and night air. A slow burn for the ones who never explain themselves.",
    leads: "Shop Unisex",
    bg: "#2E2C42",
    categoryMatch: "unisex",
  },
] as const;

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
                className="group block h-full rounded-3xl border border-foreground/12 bg-card px-8 pt-9 pb-8 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_18px_40px_rgba(27,22,17,0.1)]"
              >
                <div className="flex items-center justify-between">
                  <div className="font-heading text-[44px] leading-none text-primary italic">
                    {mood.numeral}
                  </div>
                  {/* Mood swatch stretches into a pill on hover */}
                  <span
                    className="inline-block h-3.5 w-3.5 rounded-full transition-all duration-300 group-hover:w-10"
                    style={{ backgroundColor: mood.bg }}
                  />
                </div>
                <div className="font-heading mt-5.5 text-[30px] text-foreground">{mood.title}</div>
                <p className="mt-3 min-h-[68px] text-[14px] leading-[1.65] text-muted-foreground">
                  {mood.desc}
                </p>
                <div className="mt-5 text-[11px] font-semibold tracking-[0.22em] text-foreground uppercase transition-colors group-hover:text-primary">
                  {mood.leads} →
                </div>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
