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
          className="absolute inset-0 bg-secondary transition-opacity duration-[1600ms] ease-in-out"
          style={{ opacity: i === idx ? 1 : 0 }}
        >
          {/* The complete banner on a clean brand-cream field — never cropped,
              never smeared. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={b.imageUrl}
            alt={b.alt || ""}
            className="absolute inset-0 h-full w-full object-contain"
          />
        </div>
      ))}
    </div>
  );
}
