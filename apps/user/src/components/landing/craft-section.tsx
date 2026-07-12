import Link from "next/link";
import type { SVGProps } from "react";

import { Reveal } from "@/components/reveal";

// Engraved apothecary tools — same stroke weight as the ingredient plates.

function MortarPestle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 30 L50 30 C50 42, 43 50, 32 50 C21 50, 14 42, 14 30 Z" />
      <path d="M18 30 C18 40, 24 46, 32 46" opacity="0.45" />
      <path d="M38 26 L52 10 C54 8, 57 10, 55 13 L43 28" />
      <path d="M24 54 L40 54" opacity="0.6" />
    </svg>
  );
}

function MacerationJar(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M25 8 L39 8 M27 8 L27 16 M37 8 L37 16" />
      <path d="M27 16 C18 22, 16 30, 16 38 C16 48, 23 54, 32 54 C41 54, 48 48, 48 38 C48 30, 46 22, 37 16 Z" />
      <path d="M19 34 L45 34" opacity="0.6" />
      <circle cx="27" cy="42" r="1.6" opacity="0.55" />
      <circle cx="35" cy="46" r="1.2" opacity="0.55" />
      <circle cx="38" cy="40" r="1.4" opacity="0.55" />
    </svg>
  );
}

function WaxSeal(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M32 12 C44 10, 52 18, 52 30 C52 43, 43 52, 31 52 C20 52, 12 45, 12 34 C12 24, 19 14, 32 12 Z" />
      <circle cx="32" cy="32" r="11" opacity="0.7" />
      <path d="M32 25 L34 30 L39 30 L35 33 L36 38 L32 35 L28 38 L29 33 L25 30 L30 30 Z" opacity="0.8" />
      <path d="M50 24 C55 26, 57 30, 56 33" opacity="0.4" />
    </svg>
  );
}

const STEPS = [
  {
    num: "01",
    title: "Sourced whole",
    desc: "Resins, ouds and florals from growers we know.",
    Icon: MortarPestle,
    wash: "#6E5B33",
  },
  {
    num: "02",
    title: "Rested for weeks",
    desc: "Time rounds the edges until the accord settles.",
    Icon: MacerationJar,
    wash: "#A5675D",
  },
  {
    num: "03",
    title: "Sealed by hand",
    desc: "Runs under 200 units — your batch number is on the box.",
    Icon: WaxSeal,
    wash: "#262338",
  },
];

export function CraftSection() {
  return (
    <section id="craft" className="border-t border-foreground/8 bg-card px-6 py-24 text-center sm:px-10 md:px-16">
      <div className="text-[11px] font-semibold tracking-[0.3em] text-primary uppercase">
        The Craft
      </div>
      <h2 className="font-heading mx-auto mt-4 max-w-[24ch] text-[clamp(2rem,3.4vw,3.2rem)] leading-[1.12] font-medium text-foreground">
        From raw naturals to your batch number, <em className="text-primary">one pair of hands.</em>
      </h2>

      <div className="relative mx-auto mt-16 max-w-[1080px]">
        {/* Dotted route running through the three stations */}
        <div
          aria-hidden
          className="absolute top-[104px] right-[12%] left-[12%] hidden border-t-2 border-dotted border-foreground/20 lg:block"
        />

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((step, i) => (
            <Reveal key={step.num} delay={i * 110}>
              <div className="group relative h-full rounded-[26px] border border-foreground/10 bg-background px-8 pt-8 pb-9 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_18px_40px_rgba(27,22,17,0.12)]">
                {/* Arched apothecary window */}
                <div
                  className="relative mx-auto flex aspect-[5/6] w-full max-w-[210px] items-center justify-center overflow-hidden rounded-t-[999px] rounded-b-2xl"
                  style={{
                    background: `linear-gradient(165deg, ${step.wash} 0%, ${step.wash}D9 100%)`,
                  }}
                >
                  <step.Icon className="size-20 text-[#FAF6EE] transition-transform duration-500 group-hover:scale-110" />
                  <div className="absolute inset-x-6 bottom-4 border-t border-[#FAF6EE]/25" />
                </div>

                {/* Station number riding the window like a wax tag */}
                <div className="font-heading absolute top-6 left-6 text-[40px] leading-none text-primary italic">
                  {step.num}
                </div>

                <div className="mt-7 text-[12px] font-semibold tracking-[0.24em] text-foreground uppercase">
                  {step.title}
                </div>
                <p className="mx-auto mt-2.5 max-w-[30ch] text-[14px] leading-[1.65] text-muted-foreground">
                  {step.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      <Link
        href="/our-story"
        className="mt-14 inline-block border-b border-foreground/35 pb-1 text-[11px] font-semibold tracking-[0.22em] text-foreground uppercase transition-colors hover:border-primary hover:text-primary"
      >
        Read our story →
      </Link>
    </section>
  );
}
