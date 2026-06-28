"use client";

import Link from "next/link";

import { BannerCarousel } from "@/components/banner-carousel";
import { CollectionCarousel } from "@/components/collection-carousel";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { trpc } from "@/lib/trpc";

const HERO_GRAIN =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export default function HomePage() {
  const products = trpc.catalog.listProducts.useQuery({ status: "active", limit: 12 });
  const homeBanners = trpc.content.listBanners.useQuery({ page: "home" });
  const heroContent = trpc.content.getSection.useQuery({ section: "home_hero" });

  const hero = {
    line1: (heroContent.data?.line1 as string | undefined) ?? "Scent,",
    line2: (heroContent.data?.line2 as string | undefined) ?? "composed",
    italic: (heroContent.data?.italic as string | undefined) ?? "like memory.",
    subtitle: (heroContent.data?.subtitle as string | undefined) ?? "Eaux de parfum blended in small batches — naturals, resins and time, until an accord becomes unmistakably yours.",
  };

  const hasBanners = (homeBanners.data ?? []).filter((b) => b.active).length > 0;

  return (
    <>
      <SiteHeader />
      <main>
        {/* ─── Hero ─── */}
        <section className="relative overflow-hidden bg-[#faf8f5] min-h-[92vh] flex flex-col justify-center px-6 py-16 md:px-16 md:py-24">
          <BannerCarousel banners={homeBanners.data ?? []} />

          {/* Grain */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.055]"
            style={{ backgroundImage: HERO_GRAIN, backgroundSize: "200px 200px" }}
          />

          {/* Ghost wordmark — above content */}
          <span
            aria-hidden
            className={`pointer-events-none select-none absolute right-0 top-1/2 -translate-y-1/2 z-20 text-[clamp(5rem,22vw,18rem)] font-extrabold tracking-tighter leading-none uppercase whitespace-nowrap ${hasBanners ? "text-white/[0.06]" : "text-foreground/[0.045]"}`}
          >
            AZIMUTH
          </span>

          {/* Content */}
          <div className="relative z-10 max-w-2xl">
            <p className={`mb-8 text-[9.5px] font-semibold tracking-[0.36em] uppercase ${hasBanners ? "text-white/50" : "text-foreground/40"}`}>
              Azimuth Perfumers · Est. 2019
            </p>

            <div className={`mb-6 h-px w-10 ${hasBanners ? "bg-white/60" : "bg-primary"}`} />

            <h1 className="leading-none">
              <span className={`block text-[clamp(3rem,9vw,7rem)] font-semibold tracking-tight ${hasBanners ? "text-white" : "text-foreground"}`}>
                {hero.line1}
              </span>
              <span className={`block text-[clamp(3rem,9vw,7rem)] font-semibold tracking-tight ${hasBanners ? "text-white" : "text-foreground"}`}>
                {hero.line2}
              </span>
              <span className={`font-heading block text-[clamp(3.6rem,11vw,9.5rem)] font-medium italic leading-[0.88] -ml-1 ${hasBanners ? "text-white/90" : "text-primary"}`}>
                {hero.italic}
              </span>
            </h1>

            <p className={`mt-8 max-w-xs text-[14px] leading-[1.8] ${hasBanners ? "text-white/70" : "text-muted-foreground"}`}>
              {hero.subtitle}
            </p>

            <div className="mt-8 flex items-center gap-5">
              <Link
                href="/shop"
                className={`inline-flex h-11 items-center px-8 text-[10px] font-semibold tracking-[0.22em] uppercase transition-opacity hover:opacity-80 ${hasBanners ? "bg-white text-black" : "bg-foreground text-background"}`}
              >
                Shop now
              </Link>
              <Link
                href="/our-story"
                className={`text-[10.5px] font-semibold tracking-[0.18em] uppercase underline-offset-4 hover:underline ${hasBanners ? "text-white/70" : "text-muted-foreground"}`}
              >
                Our story →
              </Link>
            </div>
          </div>

          {/* Scroll indicator */}
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-8 left-1/2 z-20"
            style={{ animation: "chevron-float 2s ease-in-out infinite" }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 22 22"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={hasBanners ? "text-white/50" : "text-foreground/35"}
            >
              <path
                d="M5 8L11 14L17 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M5 13L11 19L17 13"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.4"
              />
            </svg>
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
