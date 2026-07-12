"use client";

import { useState } from "react";
import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

// Static display — product page, shop cards
export function RatingDisplay({
  rating,
  count,
  className,
}: {
  rating: number;
  count: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn(
              "size-3.5",
              i <= Math.round(rating)
                ? "fill-foreground text-foreground"
                : "fill-transparent text-muted-foreground/30",
            )}
          />
        ))}
      </div>
      <span className="text-[12px] font-medium tabular-nums">{rating.toFixed(1)}</span>
      <span className="text-[11px] text-muted-foreground/50">({count})</span>
    </div>
  );
}

// Interactive picker — orders page, delivered orders only
export function RatingPicker({
  value,
  onRate,
  disabled,
}: {
  value: number | null;
  onRate: (rating: number) => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;

  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          disabled={disabled}
          onClick={() => onRate(i)}
          onMouseEnter={() => setHover(i)}
          className={cn("p-0.5 transition-transform", !disabled && "hover:scale-110")}
          aria-label={`Rate ${i} star${i === 1 ? "" : "s"}`}
        >
          <Star
            className={cn(
              "size-5 transition-colors",
              i <= shown
                ? "fill-foreground text-foreground"
                : "fill-transparent text-muted-foreground/40",
            )}
          />
        </button>
      ))}
    </div>
  );
}
