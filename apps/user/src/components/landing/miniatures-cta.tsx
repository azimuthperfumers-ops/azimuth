import Link from "next/link";

import { Reveal } from "@/components/reveal";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

// Miniature bottles as little arches — echoes the hero's arched portrait.
const BOTTLES = [104, 60, 44, 60, 104];

export function MiniaturesCta() {
  return (
    <section className="px-6 pb-28 sm:px-10 md:px-16">
      <Reveal>
        <div className="grid grid-cols-1 overflow-hidden rounded-[28px] bg-secondary lg:grid-cols-2">
          <div className="flex flex-col justify-center px-6 py-11 sm:px-10 md:px-16 md:py-18">
            <div className="text-[11px] font-semibold tracking-[0.3em] text-primary uppercase">
              Try before you commit
            </div>
            <h2 className="font-heading mt-4.5 text-[clamp(1.9rem,3.2vw,3rem)] leading-[1.15] font-medium text-foreground">
              Every order ships with <em className="text-primary">miniatures.</em>
            </h2>
            <p className="mt-5 max-w-[44ch] text-[15px] leading-[1.75] text-muted-foreground">
              Wear the rest of the collection on your skin before your next bottle. Because a
              fragrance is only yours once you&apos;ve lived a day in it.
            </p>
            <Link
              href="/shop"
              className="mt-8.5 inline-block self-start bg-foreground px-8 py-4.5 text-[12px] font-semibold tracking-[0.2em] text-background uppercase transition-colors hover:bg-primary"
            >
              Shop the collection
            </Link>
          </div>
          <div className="relative min-h-[300px] bg-foreground lg:min-h-[420px]">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.07]"
              style={{ backgroundImage: GRAIN, backgroundSize: "200px 200px" }}
            />
            <div className="absolute inset-0 flex items-end justify-center gap-3 pb-16">
              {BOTTLES.map((h, i) => (
                <div
                  key={i}
                  className="w-9 rounded-t-full bg-primary/30"
                  style={{ height: `${h}px` }}
                />
              ))}
            </div>
            <div className="absolute inset-x-0 bottom-6 text-center text-[10px] font-semibold tracking-[0.3em] text-background/50 uppercase">
              Five scents · One box
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
