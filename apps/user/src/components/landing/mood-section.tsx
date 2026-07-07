import Link from "next/link";

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
    <section id="quiz" className="border-t border-[#1B1611]/8 px-6 pt-24 pb-20 sm:px-10 md:px-16">
      <div className="flex flex-wrap items-end justify-between gap-8">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.3em] text-[#9A5B2B] uppercase">
            Where do we start
          </div>
          <h2 className="font-heading mt-4 text-[clamp(2.2rem,3.6vw,3.5rem)] leading-[1.1] font-medium text-[#1B1611]">
            Choose the way you want <em className="text-[#9A5B2B]">to be remembered.</em>
          </h2>
        </div>
        <p className="max-w-[36ch] text-[14px] leading-[1.7] text-[#57493A]">
          Not sure which bottle is yours? Start from a feeling — each one leads to a composition.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {MOODS.map((mood) => {
          const category = categories.find((c) => c.name.toLowerCase() === mood.categoryMatch);
          const href = category ? `/shop?category=${category.id}` : "/shop";
          return (
            <Link
              key={mood.numeral}
              href={href}
              className="block border border-[#1B1611]/12 bg-[#FAF6EE] px-8 pt-9 pb-8 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_18px_40px_rgba(27,22,17,0.1)]"
            >
              <div className="flex items-center justify-between">
                <div className="font-heading text-[44px] leading-none text-[#9A5B2B] italic">
                  {mood.numeral}
                </div>
                <span
                  className="inline-block size-3.5 rounded-full"
                  style={{ backgroundColor: mood.bg }}
                />
              </div>
              <div className="font-heading mt-5.5 text-[30px] text-[#1B1611]">{mood.title}</div>
              <p className="mt-3 min-h-[68px] text-[14px] leading-[1.65] text-[#57493A]">
                {mood.desc}
              </p>
              <div className="mt-5 text-[11px] font-semibold tracking-[0.22em] text-[#1B1611] uppercase">
                {mood.leads} →
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
