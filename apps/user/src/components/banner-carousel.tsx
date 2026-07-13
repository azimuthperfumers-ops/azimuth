"use client";

import { useEffect, useState } from "react";

type Banner = {
  id: string;
  imageUrl: string;
  alt: string;
  active: boolean;
};

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const active = banners.filter((b) => b.active);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (active.length <= 1) return;
    // Slow, unhurried crossfade — a new banner every 8s.
    const id = setInterval(() => setIdx((i) => (i + 1) % active.length), 8000);
    return () => clearInterval(id);
  }, [active.length]);

  if (active.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {active.map((b, i) => (
        <div
          key={b.id}
          className="absolute inset-0 transition-opacity duration-[1600ms] ease-in-out"
          style={{ opacity: i === idx ? 1 : 0 }}
        >
          {/* Blurred fill so the whole designed banner shows (contain) without
              ugly letterbox bars — the fill is the same image, cover + blur. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={b.imageUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"
          />
          {/* The complete banner, never cropped. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={b.imageUrl}
            alt={b.alt || ""}
            className="absolute inset-0 h-full w-full object-contain"
          />
        </div>
      ))}
      {/* Feather the bottom into the page rather than a flat dark wash. */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/25 to-transparent" />
    </div>
  );
}
