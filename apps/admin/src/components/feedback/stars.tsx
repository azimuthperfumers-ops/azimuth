"use client";

import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

// Half-star aware star row for the admin side. A partial star is a filled star
// clipped to the fraction, stacked over a hollow one — so 4.5 reads as four and
// a half, and an average like 4.3 renders honestly instead of being rounded.

const STARS = [1, 2, 3, 4, 5];

function fillFor(rating: number, index: number): number {
  return Math.max(0, Math.min(1, rating - (index - 1)));
}

export function Stars({
  rating,
  className,
  showValue = true,
}: {
  rating: number;
  className?: string;
  showValue?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="flex items-center gap-0.5">
        {STARS.map((i) => {
          const fill = fillFor(rating, i);
          return (
            <span key={i} className="relative inline-block size-3.5 shrink-0">
              <Star className="size-full fill-transparent text-muted-foreground/30" />
              {fill > 0 && (
                <span
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${fill * 100}%` }}
                  aria-hidden="true"
                >
                  <Star
                    className="size-full fill-amber-500 text-amber-500"
                    style={{ width: `${100 / Math.max(fill, 0.0001)}%`, maxWidth: "none" }}
                  />
                </span>
              )}
            </span>
          );
        })}
      </div>
      {showValue && <span className="text-xs font-medium tabular-nums">{rating.toFixed(1)}</span>}
    </div>
  );
}

/**
 * Half-star picker for the "log feedback" dialog. Each star is split in two hit
 * zones: left → x.5, right → x.
 */
export function StarPicker({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (rating: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating out of 5">
      {STARS.map((i) => {
        const fill = fillFor(value ?? 0, i);
        return (
          <span key={i} className="relative inline-flex size-6">
            <Star className="size-full fill-transparent text-muted-foreground/30" />
            {fill > 0 && (
              <span
                className="pointer-events-none absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
                aria-hidden="true"
              >
                <Star
                  className="size-full fill-amber-500 text-amber-500"
                  style={{ width: `${100 / Math.max(fill, 0.0001)}%`, maxWidth: "none" }}
                />
              </span>
            )}
            {([
              { value: i - 0.5, side: "left-0" },
              { value: i, side: "right-0" },
            ] as const).map((zone) => (
              <button
                key={zone.value}
                type="button"
                role="radio"
                aria-checked={value === zone.value}
                aria-label={`Rate ${zone.value} out of 5`}
                disabled={disabled}
                onClick={() => onChange(zone.value)}
                className={cn("absolute inset-y-0 w-1/2 cursor-pointer", zone.side)}
              />
            ))}
          </span>
        );
      })}
      <span className="ml-1.5 text-xs font-medium tabular-nums text-muted-foreground">
        {value != null ? value.toFixed(1) : "—"}
      </span>
    </div>
  );
}
