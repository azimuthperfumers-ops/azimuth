"use client";

import { cn } from "@/lib/utils";
import { FONT_PREVIEW_CLASS, FONT_VAR } from "./fonts";
import type { HomeHero, OurStory, ShopCover, Surface, ThemeTokens } from "./types";

export type ProductLite = {
  id: string;
  name: string;
  images: { url?: string; isPrimary: boolean }[];
  variants?: { effectivePrice?: number | string; mrp?: string; isDefault?: boolean; status?: string }[];
};

type Props = {
  surface: Surface;
  theme: ThemeTokens;
  home: HomeHero;
  shopCover: ShopCover;
  story: OurStory;
  featured: ProductLite[];
  heroProducts: ProductLite[];
};

function priceOf(p: ProductLite): string | null {
  const active = (p.variants ?? []).filter((v) => v.status !== "discontinued");
  const prices = active.map((v) => Number(v.effectivePrice ?? v.mrp ?? 0)).filter((n) => n > 0);
  if (prices.length === 0) return null;
  return `₹${Math.min(...prices).toLocaleString("en-IN")}`;
}

function imgOf(p?: ProductLite): string | undefined {
  const images = p?.images ?? [];
  return (images.find((i) => i.isPrimary) ?? images[0])?.url;
}

export function LivePreview({ surface, theme: t, home, shopCover, story, featured, heroProducts }: Props) {
  const serif = FONT_VAR[t.fontHeading] ?? "Georgia, serif";
  const sans = FONT_VAR[t.fontBody] ?? "system-ui, sans-serif";
  const cards = featured.slice(0, 3);
  const heroImg = imgOf(heroProducts[0] ?? cards[0]);

  const Card = ({ p }: { p: ProductLite }) => {
    const url = imgOf(p);
    const price = priceOf(p);
    return (
      <div className="flex flex-col">
        <div className="aspect-[3/4] w-full overflow-hidden" style={{ background: t.surface }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {url ? <img src={url} alt={p.name} className="h-full w-full object-cover" /> : null}
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <span style={{ fontFamily: serif, color: t.ink }} className="text-[13px]">
            {p.name}
          </span>
          {price && (
            <span style={{ color: t.accent }} className="text-[11px] font-semibold">
              {price}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn("overflow-hidden rounded-xl border shadow-sm", FONT_PREVIEW_CLASS)}
      style={{ background: t.background, color: t.ink, fontFamily: sans, borderColor: t.border }}
    >
      {/* Faux storefront header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: `1px solid ${t.border}` }}
      >
        <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: t.inkMuted }}>
          Shop · Our Story
        </span>
        <span style={{ fontFamily: serif, color: t.ink }} className="text-[17px] tracking-[0.28em]">
          AZIMUTH
        </span>
        <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: t.inkMuted }}>
          Account · Cart
        </span>
      </div>

      <div className="p-6">
        {(surface === "home" || surface === "theme" || surface === "banners") && (
          <>
            <div className="grid grid-cols-2 gap-5">
              <div className="flex flex-col justify-center">
                <p className="mb-3 text-[9px] font-semibold uppercase tracking-[0.28em]" style={{ color: t.accent }}>
                  Eau de Parfum · Small Batch
                </p>
                <h2 style={{ fontFamily: serif, color: t.ink }} className="text-[30px] leading-[1.05]">
                  {home.line1}
                  <br />
                  <span style={{ fontStyle: "italic", color: t.accent }}>{home.italic}</span>
                </h2>
                <p className="mt-3 text-[11px] leading-relaxed" style={{ color: t.inkMuted }}>
                  {home.subtitle}
                </p>
                <span
                  className="mt-4 inline-block w-fit px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.2em]"
                  style={{ background: t.accent, color: t.accentInk }}
                >
                  Find your scent
                </span>
              </div>
              <div className="aspect-[3/4] w-full" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                {heroImg && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={heroImg} alt="" className="h-full w-full object-cover" />
                )}
              </div>
            </div>

            {surface === "theme" && (
              <div className="mt-6 flex gap-2">
                {[t.background, t.surface, t.ink, t.inkMuted, t.border, t.accent, t.accentInk].map((c, i) => (
                  <div
                    key={i}
                    className="h-8 flex-1 rounded"
                    style={{ background: c, border: `1px solid ${t.border}` }}
                    title={c}
                  />
                ))}
              </div>
            )}

            {cards.length > 0 && (
              <div className="mt-7 grid grid-cols-3 gap-4">
                {cards.map((p) => (
                  <Card key={p.id} p={p} />
                ))}
              </div>
            )}
          </>
        )}

        {surface === "shop" && (
          <>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: t.inkMuted }}>
              Home / Shop
            </p>
            <h2 style={{ fontFamily: serif, color: t.ink }} className="text-[34px] leading-none">
              {shopCover.heading}
            </h2>
            <p className="mt-2 text-[12px]" style={{ color: t.inkMuted }}>
              {shopCover.subheading}
            </p>
            <div className="mt-6 grid grid-cols-3 gap-4" style={{ borderTop: `1px solid ${t.border}`, paddingTop: 20 }}>
              {(featured.length > 0 ? featured : cards).slice(0, 6).map((p) => (
                <Card key={p.id} p={p} />
              ))}
            </div>
          </>
        )}

        {surface === "story" && (
          <>
            <p className="mb-4 text-[9px] font-semibold uppercase tracking-[0.32em]" style={{ color: t.inkMuted }}>
              Azimuth Perfumers — Est. 2019
            </p>
            <h2 style={{ color: t.ink }} className="text-[46px] font-semibold leading-[0.9]">
              Our
              <br />
              <span style={{ fontFamily: serif, fontStyle: "italic", color: t.accent }}>Story.</span>
            </h2>
            <p className="mt-5 text-[12px] leading-relaxed" style={{ color: t.inkMuted }}>
              {story.headerSubtitle}
            </p>
            <blockquote
              style={{ fontFamily: serif, color: t.ink, borderLeft: `2px solid ${t.accent}` }}
              className="mt-6 pl-4 text-[18px] italic leading-snug"
            >
              “{story.originBlockquote}”
            </blockquote>
          </>
        )}

        {surface === "featured" && (
          <>
            <p className="mb-4 text-[11px] uppercase tracking-[0.2em]" style={{ color: t.inkMuted }}>
              Featured on the landing page
            </p>
            {featured.length === 0 ? (
              <p className="text-[12px]" style={{ color: t.inkMuted }}>
                No featured products yet — star some in the controls.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {featured.slice(0, 6).map((p) => (
                  <Card key={p.id} p={p} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
