"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { primaryImage, type LandingProduct } from "./types";

type HeroCopy = {
  line1: string;
  italic: string;
  subtitle: string;
};

const NOTES_STRIP = [
  { label: "Opens with", value: "Saffron & bergamot" },
  { label: "Settles into", value: "Amber & sandalwood" },
  { label: "Lasts", value: "8+ hours on skin" },
];

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

// Slow-rotating apothecary stamp riding the hero arch
function HeroStamp() {
  return (
    <div className="absolute -top-2 right-4 z-10 hidden size-[108px] items-center justify-center rounded-full border border-foreground/15 bg-background/85 shadow-[0_10px_30px_rgba(27,22,17,0.12)] backdrop-blur-sm sm:flex lg:-right-8 lg:top-14">
      <svg viewBox="0 0 120 120" className="stamp-rotate size-[92px] text-foreground">
        <defs>
          <path
            id="hero-stamp-arc"
            d="M60,60 m-45,0 a45,45 0 1,1 90,0 a45,45 0 1,1 -90,0"
          />
        </defs>
        <text className="fill-current" style={{ fontSize: "11px", letterSpacing: "3.2px" }}>
          <textPath href="#hero-stamp-arc">
            SMALL BATCH · HAND BLENDED · AZIMUTH ·
          </textPath>
        </text>
      </svg>
      <span className="absolute font-heading text-[22px] leading-none text-primary italic">Az</span>
    </div>
  );
}

export function LandingHero({
  copy,
  products,
  isLoading,
}: {
  copy: HeroCopy;
  products: LandingProduct[];
  isLoading: boolean;
}) {
  const [index, setIndex] = useState(0);

  // Auto-advance the hero carousel when more than one product is chosen.
  useEffect(() => {
    if (products.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % products.length), 4500);
    return () => clearInterval(id);
  }, [products.length]);

  const active = products[Math.min(index, products.length - 1)];
  const slug = active ? (active.slug ?? active.id) : undefined;

  return (
    <section className="grid min-h-[calc(100vh-140px)] grid-cols-1 lg:grid-cols-2">
      {/* Copy */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-10 md:px-16 md:py-20">
        <div className="flex items-center gap-3.5 text-[11px] font-semibold tracking-[0.3em] text-primary uppercase">
          <span className="inline-block h-px w-9 bg-primary" />
          Eau de parfum · Small batch
        </div>

        <h1 className="font-heading mt-7 text-[clamp(2.8rem,5.6vw,5.5rem)] leading-[1.04] font-medium tracking-tight text-foreground">
          {copy.line1}
          <br />
          <em className="font-normal text-primary italic">{copy.italic}</em>
        </h1>

        <p className="mt-7 max-w-[42ch] text-[16px] leading-[1.7] text-muted-foreground">
          {copy.subtitle}
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4.5">
          <a
            href="#quiz"
            className="bg-foreground px-8 py-4.5 text-[12px] font-semibold tracking-[0.2em] text-background uppercase transition-colors hover:bg-primary"
          >
            Find your scent
          </a>
          <Link
            href="/shop"
            className="border-b border-foreground/35 py-4.5 text-[12px] font-semibold tracking-[0.2em] text-foreground uppercase transition-colors hover:border-primary hover:text-primary"
          >
            Shop the collection →
          </Link>
        </div>

        {/* Notes strip */}
        <div className="mt-16 flex flex-wrap gap-x-10 gap-y-7 border-t border-foreground/12 pt-6">
          {NOTES_STRIP.map((n) => (
            <div key={n.label}>
              <div className="text-[10px] tracking-[0.26em] text-muted-foreground uppercase">{n.label}</div>
              <div className="font-heading mt-1.5 text-[20px] text-foreground italic">{n.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Photo carousel — arched portrait, the shoulder of a perfume bottle */}
      <div className="flex items-center justify-center px-6 py-8 sm:px-10 md:px-12 lg:pr-12 lg:pl-0">
        <div className="relative w-full max-w-[540px]">
        <HeroStamp />
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-b-[28px] rounded-t-[999px] bg-muted">
        {isLoading ? (
          <div className="absolute inset-0 animate-pulse bg-muted" />
        ) : products.length === 0 ? (
          <div className="absolute inset-0 bg-muted" />
        ) : (
          products.map((p, i) => {
            const url = primaryImage(p)?.url;
            const show = i === Math.min(index, products.length - 1);
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p.id}
                src={url}
                alt={p.name}
                aria-hidden={!show}
                className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-1000 ease-out ${show ? "kenburns" : ""}`}
                style={{ opacity: show ? 1 : 0 }}
              />
            );
          })
        )}

        {active && !isLoading && (
          <Link
            href={slug ? `/shop/${slug}` : "/shop"}
            className="absolute bottom-6 left-6 max-w-[260px] rounded-2xl bg-background/94 px-6 py-5 backdrop-blur-sm transition-opacity hover:opacity-90"
          >
            <div className="text-[10px] font-semibold tracking-[0.28em] text-primary uppercase">
              {active.isFeatured ? "Signature" : (active.category?.name ?? "Fragrance")}
            </div>
            <div className="font-heading mt-1.5 text-[30px] text-foreground">{active.name}</div>
            {active.description && (
              <div className="mt-1 text-[12px] text-muted-foreground">
                {truncate(active.description, 48)}
              </div>
            )}
          </Link>
        )}

        {/* Carousel dots */}
        {products.length > 1 && !isLoading && (
          <div className="absolute bottom-6 right-6 flex gap-2">
            {products.map((p, i) => (
              <button
                key={p.id}
                aria-label={`Show ${p.name}`}
                onClick={() => setIndex(i)}
                className="h-1.5 rounded-full bg-background/70 transition-all"
                style={{ width: i === index ? 22 : 8, opacity: i === index ? 1 : 0.6 }}
              />
            ))}
          </div>
        )}
        </div>
        </div>
      </div>
    </section>
  );
}
