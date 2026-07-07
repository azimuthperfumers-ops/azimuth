import Link from "next/link";

export function MiniaturesCta() {
  return (
    <section className="px-6 pb-28 sm:px-10 md:px-16">
      <div className="grid grid-cols-1 overflow-hidden bg-secondary lg:grid-cols-2">
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
        <div className="relative min-h-[300px] lg:min-h-[420px]">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(27,22,17,0.14) 1.5px, transparent 1.5px)",
              backgroundSize: "22px 22px",
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center gap-3">
            {[52, 30, 22, 30, 52].map((h, i) => (
              <div
                key={i}
                className="w-8 rounded-sm bg-foreground/10"
                style={{ height: `${h * 2}px` }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
