"use client";

import { useState } from "react";
import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

// Ratings are half-star: 1, 1.5, 2 … 5.
//
// A partial star is drawn by stacking a clipped filled star over a hollow one,
// rather than by swapping in a "half star" glyph — that way any fraction renders
// correctly, so RatingDisplay can show a true average like 4.3 instead of
// rounding it to the nearest half.

const STARS = [1, 2, 3, 4, 5];

/** How much of star `index` (1-based) is filled, 0–1. */
function fillFor(rating: number, index: number): number {
  return Math.max(0, Math.min(1, rating - (index - 1)));
}

function StarIcon({ fill, className }: { fill: number; className?: string }) {
  return (
    <span className={cn("relative inline-block shrink-0", className)}>
      {/* Hollow base */}
      <Star className="size-full fill-transparent text-muted-foreground/30" />
      {/* Filled overlay, clipped to the fraction */}
      {fill > 0 && (
        <span
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${fill * 100}%` }}
          aria-hidden="true"
        >
          <Star
            className="size-full fill-foreground text-foreground"
            // The clip narrows the box, so pin the glyph to its full width
            style={{ width: `${100 / Math.max(fill, 0.0001)}%`, maxWidth: "none" }}
          />
        </span>
      )}
    </span>
  );
}

// Static display — product page, shop cards. Omit `count` where there is no
// aggregate to speak of (a single person's own score).
export function RatingDisplay({
  rating,
  count,
  className,
}: {
  rating: number;
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="flex items-center gap-0.5">
        {STARS.map((i) => (
          <StarIcon key={i} fill={fillFor(rating, i)} className="size-3.5" />
        ))}
      </div>
      <span className="text-[12px] font-medium tabular-nums">{rating.toFixed(1)}</span>
      {count != null && <span className="text-[11px] text-muted-foreground/50">({count})</span>}
    </div>
  );
}

/**
 * Interactive picker with half-star precision.
 *
 * Each star is one button split down the middle: the left half sets x.5, the
 * right half sets x. Keyboard users get the same range via arrow keys on the
 * radiogroup, stepping 0.5 at a time.
 */
export function RatingPicker({
  value,
  onRate,
  disabled,
  size = "md",
}: {
  value: number | null;
  onRate: (rating: number) => void;
  disabled?: boolean;
  size?: "md" | "lg";
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  const starSize = size === "lg" ? "size-7" : "size-5";

  function step(delta: number) {
    if (disabled) return;
    const next = Math.min(5, Math.max(1, (value ?? 0) + delta));
    onRate(next);
  }

  return (
    <div
      className="flex items-center gap-1"
      onMouseLeave={() => setHover(null)}
      role="radiogroup"
      aria-label="Rating out of 5"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault();
          step(-0.5);
        } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault();
          step(0.5);
        }
      }}
    >
      {STARS.map((i) => (
        <span key={i} className="relative inline-flex">
          <StarIcon
            fill={fillFor(shown, i)}
            className={cn(starSize, "transition-transform", !disabled && hover === i && "scale-110")}
          />
          {/* Two invisible hit targets over each star: left → half, right → whole */}
          {([
            { half: true, value: i - 0.5, side: "left-0" },
            { half: false, value: i, side: "right-0" },
          ] as const).map((zone) => (
            <button
              key={zone.value}
              type="button"
              role="radio"
              aria-checked={value === zone.value}
              disabled={disabled}
              onClick={() => onRate(zone.value)}
              onMouseEnter={() => setHover(zone.value)}
              className={cn(
                "absolute inset-y-0 w-1/2 cursor-pointer disabled:cursor-default",
                zone.side,
              )}
              aria-label={`Rate ${zone.value} out of 5`}
              tabIndex={-1}
            />
          ))}
        </span>
      ))}
      <span className="ml-1.5 text-[11px] font-medium tabular-nums text-muted-foreground/60">
        {shown > 0 ? shown.toFixed(1) : "—"}
      </span>
    </div>
  );
}
