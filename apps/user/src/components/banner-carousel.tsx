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
    const id = setInterval(() => setIdx((i) => (i + 1) % active.length), 5000);
    return () => clearInterval(id);
  }, [active.length]);

  if (active.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {active.map((b, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={b.id}
          src={b.imageUrl}
          alt={b.alt || ""}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000"
          style={{ opacity: i === idx ? 1 : 0 }}
        />
      ))}
      <div className="absolute inset-0 bg-black/40" />
    </div>
  );
}
