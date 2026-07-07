import Link from "next/link";

const STEPS = [
  { num: "01", title: "Sourced whole", desc: "Resins, ouds and florals from growers we know." },
  { num: "02", title: "Rested for weeks", desc: "Time rounds the edges until the accord settles." },
  { num: "03", title: "Sealed by hand", desc: "Runs under 200 units — your batch number is on the box." },
];

export function CraftSection() {
  return (
    <section id="craft" className="border-t border-[#1B1611]/8 px-6 py-24 text-center sm:px-10 md:px-16">
      <div className="text-[11px] font-semibold tracking-[0.3em] text-[#9A5B2B] uppercase">
        The Craft
      </div>
      <h2 className="font-heading mx-auto mt-4 max-w-[24ch] text-[clamp(2rem,3.4vw,3.2rem)] leading-[1.12] font-medium text-[#1B1611]">
        From raw naturals to your batch number, <em className="text-[#9A5B2B]">one pair of hands.</em>
      </h2>

      <div className="mx-auto mt-14 grid max-w-[1080px] grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((step) => (
          <div key={step.num} className="border-l border-[#1B1611]/14 px-9 py-2">
            <div className="font-heading text-[56px] leading-none text-[#9A5B2B] italic">
              {step.num}
            </div>
            <div className="mt-4.5 text-[12px] font-semibold tracking-[0.24em] text-[#1B1611] uppercase">
              {step.title}
            </div>
            <p className="mx-auto mt-2.5 max-w-[30ch] text-[14px] leading-[1.6] text-[#57493A]">
              {step.desc}
            </p>
          </div>
        ))}
      </div>

      <Link
        href="/our-story"
        className="mt-12 inline-block border-b border-[#1B1611]/35 pb-1 text-[11px] font-semibold tracking-[0.22em] text-[#1B1611] uppercase transition-colors hover:border-[#9A5B2B] hover:text-[#9A5B2B]"
      >
        Read our story →
      </Link>
    </section>
  );
}
