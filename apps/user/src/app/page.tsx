"use client";

import Link from "next/link";

import { CollectionCarousel } from "@/components/collection-carousel";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { trpc } from "@/lib/trpc";

const HERO_BG = [
  "radial-gradient(ellipse 48% 32% at 18% 75%, rgba(170,150,128,0.18) 0%, transparent 65%)",
  "radial-gradient(ellipse 38% 28% at 82% 16%, rgba(252,246,236,0.55) 0%, transparent 52%)",
  "radial-gradient(ellipse 34% 22% at 60% 88%, rgba(148,128,108,0.14) 0%, transparent 48%)",
  "radial-gradient(ellipse 150% 115% at 50% 40%, #fdfbf8 0%, #f7f2e8 15%, #f0e8da 28%, #e4d8c8 42%, #d4c4b0 56%, #c0aa96 68%, #a8927e 80%, #908070 90%, #7a6c5e 100%)",
].join(", ");

export default function HomePage() {
  const products = trpc.catalog.listProducts.useQuery({ status: "active", limit: 12 });

  return (
    <>
      <SiteHeader />
      <main>
        {/* ─── Hero ─── */}
        <section
          className="relative flex min-h-[88vh] items-center justify-center overflow-hidden"
          style={{ background: HERO_BG }}
        >
          {/* grain overlay */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              opacity: 0.08,
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
              backgroundSize: "200px 200px",
            }}
          />

          <div className="relative z-10 px-6 text-center">
            <p className="mb-7 text-[10.5px] font-semibold tracking-[0.32em] text-muted-foreground/60 uppercase">
              Azimuth Perfumers
            </p>

            <h1 className="mx-auto max-w-4xl leading-[1.0]">
              <span className="block text-[clamp(3.5rem,8vw,7rem)] font-semibold tracking-tight text-foreground">
                Scent, composed
              </span>
              <span className="font-heading block text-[clamp(4rem,10vw,9rem)] font-medium italic leading-[0.9] text-primary">
                like memory.
              </span>
            </h1>

            <p className="mx-auto mt-9 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              Eaux de parfum blended in small batches — naturals, resins and time,
              until an accord becomes unmistakably yours.
            </p>

            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/shop"
                className="inline-flex h-12 items-center bg-foreground px-10 text-[11px] font-semibold tracking-[0.2em] text-background uppercase transition-opacity hover:opacity-80"
              >
                Shop the collection
              </Link>
              <Link
                href="/shop"
                className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase underline-offset-4 hover:underline"
              >
                Our story →
              </Link>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-px bg-border" />
        </section>

        {/* ─── Collection ─── */}
        <section className="py-20 overflow-hidden">
          {/* Heading */}
          <div className="mx-auto mb-12 px-4 md:px-8 text-center">
            <p className="mb-3 text-[10px] font-semibold tracking-[0.36em] text-muted-foreground/50 uppercase">
              Azimuth Perfumers
            </p>
            <h2 className="leading-none">
              <span className="block text-[clamp(2rem,5vw,3.5rem)] font-semibold tracking-[0.22em] text-foreground uppercase">
                The
              </span>
              <span className="font-heading block text-[clamp(3rem,9vw,7rem)] font-extrabold italic leading-[0.9] text-primary uppercase tracking-tight">
                Collection
              </span>
            </h2>
          </div>

          {/* Skeleton */}
          {products.isLoading && (
            <div className="flex gap-4 px-4 md:px-8 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-[78vw] sm:w-[320px] lg:w-[360px] shrink-0 animate-pulse">
                  <div className="aspect-[3/4] bg-muted" />
                  <div className="mt-4 h-4 w-32 bg-muted" />
                  <div className="mt-2 h-3 w-20 bg-muted" />
                  <div className="mt-4 h-11 bg-muted" />
                </div>
              ))}
            </div>
          )}

          {/* Empty */}
          {!products.isLoading && (products.data?.length ?? 0) === 0 && (
            <p className="py-20 text-center text-sm text-muted-foreground">
              Nothing&apos;s live in the catalog yet — check back soon.
            </p>
          )}

          {/* Carousel */}
          {(products.data?.length ?? 0) > 0 && (
            <div className="relative mx-auto max-w-[1500px] px-0 md:px-6">
              <CollectionCarousel products={products.data ?? []} />

              <div className="mt-12 text-center">
                <Link
                  href="/shop"
                  className="inline-flex h-11 items-center border border-foreground px-10 text-[10.5px] font-semibold tracking-[0.2em] text-foreground uppercase transition-all hover:bg-foreground hover:text-background"
                >
                  View all fragrances
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* ─── Brand statement ─── */}
        <section className="border-t border-border bg-foreground py-24 text-center text-background">
          <p className="mx-auto max-w-2xl px-4 md:px-8">
            <span className="block text-[11px] font-semibold tracking-[0.32em] uppercase opacity-50 mb-6">
              The Azimuth way
            </span>
            <span className="font-heading block text-[clamp(2rem,5vw,4rem)] font-medium italic leading-[1.1]">
              &quot;An accord becomes unmistakably yours.&quot;
            </span>
          </p>
        </section>

        {/* ─── Values strip ─── */}
        <section className="border-b border-t border-border">
          <div className="mx-auto grid max-w-[1400px] divide-x divide-border grid-cols-2 sm:grid-cols-4">
            {[
              { label: "Small Batches", sub: "Each run under 200 units" },
              { label: "Natural Bases", sub: "Resins, ouds & florals" },
              { label: "Pan-India", sub: "Delivered to your door" },
              { label: "No Middlemen", sub: "Direct from our lab" },
            ].map(({ label, sub }) => (
              <div key={label} className="flex flex-col items-center px-4 md:px-6 py-10 text-center">
                <p className="text-[11px] font-semibold tracking-[0.18em] text-foreground uppercase">
                  {label}
                </p>
                <p className="mt-1.5 text-[12px] text-muted-foreground">{sub}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
