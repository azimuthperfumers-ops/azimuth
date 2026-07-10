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
    <section className="grid min-h-[calc(100vh-116px)] grid-cols-1 lg:grid-cols-2">
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

      {/* Photo carousel */}
      <div
        className="relative m-4 min-h-[420px] overflow-hidden sm:m-8 md:m-10 lg:mr-12 lg:ml-0"
        style={{ backgroundColor: active?.themeColor ?? "#e8e0d5" }}
      >
        {isLoading ? (
          <div className="h-full min-h-[420px] w-full animate-pulse bg-muted" />
        ) : products.length === 0 ? (
          <div className="h-full min-h-[420px] w-full bg-muted" />
        ) : (
          products.map((p, i) => {
            const url = primaryImage(p)?.url;
            const show = i === Math.min(index, products.length - 1);
            return (
              <div
                key={p.id}
                aria-hidden={!show}
                className="absolute inset-0 transition-opacity duration-1000 ease-out"
                style={{ opacity: show ? 1 : 0 }}
              >
                {/* Blurred fill so any aspect covers the panel without dead bars */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl opacity-70" />
                {/* Sharp, whole product — never cropped */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={p.name} className="absolute inset-0 h-full w-full object-contain" />
              </div>
            );
          })
        )}

        {active && !isLoading && (
          <Link
            href={slug ? `/shop/${slug}` : "/shop"}
            className="absolute bottom-6 left-6 max-w-[260px] bg-background/94 px-6 py-5 backdrop-blur-sm transition-opacity hover:opacity-90"
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
    </section>
  );
}
