"use client";

import { useEffect, useState, type SVGProps } from "react";

// Hand-drawn line-art botanicals — no stock photos, everything in one stroke
// weight so the set reads as a single engraving plate.

function Amber(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M32 8 L46 28 L40 52 L24 52 L18 28 Z" />
      <path d="M32 8 L32 52 M18 28 L46 28 M32 8 L24 52 M32 8 L40 52" opacity="0.55" />
    </svg>
  );
}

function Citrus(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="32" cy="36" r="19" />
      <circle cx="32" cy="36" r="14" opacity="0.55" />
      <path d="M32 36 L32 22 M32 36 L44 29 M32 36 L44 43 M32 36 L32 50 M32 36 L20 43 M32 36 L20 29" opacity="0.55" />
      <path d="M35 13 C40 8, 48 9, 50 12 C46 16, 39 16, 35 13 Z" />
    </svg>
  );
}

function Cedar(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="32" cy="34" r="6" />
      <circle cx="32" cy="34" r="12" opacity="0.7" />
      <circle cx="32" cy="34" r="18" opacity="0.45" />
      <path d="M32 16 L32 10 M36 30 L52 24" opacity="0.55" />
    </svg>
  );
}

function Rose(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M32 30 a3 3 0 1 1 -3 3 a6 6 0 1 1 6 -6 a10 10 0 1 1 -10 10 a14 14 0 1 1 14 -14" />
      <path d="M32 47 L32 58 M32 52 C26 50, 23 46, 22 43 M32 55 C38 53, 41 50, 42 47" opacity="0.6" />
    </svg>
  );
}

function Vanilla(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M24 8 C32 26, 28 42, 20 56" />
      <path d="M32 8 C40 26, 36 42, 28 56" opacity="0.6" />
      <path d="M44 16 l3 -6 l3 6 l6 2 l-6 3 l-3 6 l-3 -6 l-6 -3 Z" opacity="0.8" />
    </svg>
  );
}

function Chamomile(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="32" cy="26" r="5" />
      {Array.from({ length: 8 }).map((_, i) => (
        <ellipse key={i} cx="32" cy="13" rx="3.2" ry="8" opacity="0.7" transform={`rotate(${i * 45} 32 26)`} />
      ))}
      <path d="M32 31 L32 56 M32 44 C26 42, 23 38, 22 35" opacity="0.6" />
    </svg>
  );
}

function Oud(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M24 8 C19 22, 29 36, 23 56" />
      <path d="M33 8 C28 22, 38 36, 32 56" opacity="0.7" />
      <path d="M42 8 C37 22, 47 36, 41 56" opacity="0.45" />
      <circle cx="31" cy="30" r="2.5" opacity="0.7" />
    </svg>
  );
}

function Patchouli(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M32 8 C50 20, 50 42, 32 56 C14 42, 14 20, 32 8 Z" />
      <path d="M32 8 L32 56" opacity="0.55" />
      <path d="M32 20 C38 22, 42 26, 44 30 M32 20 C26 22, 22 26, 20 30 M32 34 C38 36, 41 39, 43 42 M32 34 C26 36, 23 39, 21 42" opacity="0.45" />
    </svg>
  );
}

function Incense(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M38 56 L43 28" />
      <path d="M43 24 C37 18, 48 13, 42 6" opacity="0.7" />
      <path d="M47 22 C43 18, 50 14, 46 9" opacity="0.4" />
      <path d="M26 56 L50 56" opacity="0.6" />
    </svg>
  );
}

const ICONS = {
  Amber,
  Citrus,
  Cedarwood: Cedar,
  Rose,
  Vanilla,
  Chamomile,
  Oud,
  Patchouli,
  Incense,
} as const;

export type IngredientName = keyof typeof ICONS;

export function IngredientCarousel({
  items,
  from,
  to,
}: {
  items: IngredientName[];
  from: string;
  to: string;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % items.length), 3200);
    return () => clearInterval(id);
  }, [items.length]);

  return (
    <div
      className="relative aspect-[4/3] w-full overflow-hidden"
      style={{ background: `linear-gradient(155deg, ${from} 0%, ${to} 100%)` }}
    >
      {items.map((name, i) => {
        const Icon = ICONS[name];
        const show = i === index;
        return (
          <div
            key={name}
            aria-hidden={!show}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 text-[#FAF6EE] transition-opacity duration-700"
            style={{ opacity: show ? 1 : 0 }}
          >
            <Icon className="size-16" />
            <div className="font-heading text-[21px] leading-none italic">{name}</div>
          </div>
        );
      })}

      {items.length > 1 && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
          {items.map((name, i) => (
            <span
              key={name}
              className="h-1 rounded-full bg-[#FAF6EE] transition-all duration-300"
              style={{ width: i === index ? 14 : 4, opacity: i === index ? 0.9 : 0.4 }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
