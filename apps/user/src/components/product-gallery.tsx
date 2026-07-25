"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

type GalleryImage = { url?: string; isPrimary: boolean; isSecondary: boolean };

const MIN_SCALE = 1;
const MAX_SCALE = 3;
const SCALE_STEP = 0.5;

export function ProductGallery({
  images,
  name,
  bg,
}: {
  images: GalleryImage[];
  name: string;
  bg: string;
}) {
  const [active, setActive] = useState(0);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const count = images.length;
  const zoomed = scale > 1;

  const resetZoom = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  // Reset zoom whenever the active image changes.
  useEffect(() => {
    resetZoom();
  }, [active, resetZoom]);

  const go = useCallback(
    (dir: number) => setActive((i) => (i + dir + count) % count),
    [count],
  );

  // Arrow-key navigation (only meaningful with more than one image).
  useEffect(() => {
    if (count <= 1) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, go]);

  // Clamp pan so the scaled image can't be dragged off its frame.
  const clampOffset = useCallback(
    (x: number, y: number, s: number) => {
      const el = frameRef.current;
      if (!el) return { x, y };
      const max = ((s - 1) * el.clientWidth) / 2;
      const maxY = ((s - 1) * el.clientHeight) / 2;
      return {
        x: Math.max(-max, Math.min(max, x)),
        y: Math.max(-maxY, Math.min(maxY, y)),
      };
    },
    [],
  );

  const zoomIn = () =>
    setScale((s) => Math.min(MAX_SCALE, +(s + SCALE_STEP).toFixed(2)));
  const zoomOut = () =>
    setScale((s) => {
      const next = Math.max(MIN_SCALE, +(s - SCALE_STEP).toFixed(2));
      if (next === 1) setOffset({ x: 0, y: 0 });
      else setOffset((o) => clampOffset(o.x, o.y, next));
      return next;
    });

  const onPointerDown = (e: React.PointerEvent) => {
    if (!zoomed) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const nx = drag.current.ox + (e.clientX - drag.current.x);
    const ny = drag.current.oy + (e.clientY - drag.current.y);
    setOffset(clampOffset(nx, ny, scale));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <div className="space-y-3">
      {/* Main frame */}
      <div
        ref={frameRef}
        className="relative aspect-square w-full overflow-hidden select-none"
        style={{ backgroundColor: bg }}
      >
        {/* Sliding track */}
        <div
          className={cn(
            "flex h-full w-full",
            !zoomed && "transition-transform duration-500 ease-out",
          )}
          style={{ transform: `translateX(-${active * 100}%)` }}
        >
          {images.map((img, i) => (
            <div
              key={i}
              className="h-full w-full shrink-0"
              style={{ backgroundColor: bg }}
            >
              {img.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img.url}
                  alt={name}
                  draggable={false}
                  onPointerDown={i === active ? onPointerDown : undefined}
                  onPointerMove={i === active ? onPointerMove : undefined}
                  onPointerUp={i === active ? onPointerUp : undefined}
                  onPointerCancel={i === active ? onPointerUp : undefined}
                  className={cn(
                    "h-full w-full object-contain touch-none",
                    i === active && zoomed
                      ? drag.current
                        ? "cursor-grabbing"
                        : "cursor-grab"
                      : "cursor-default",
                    i === active && !drag.current && "transition-transform duration-200 ease-out",
                  )}
                  style={
                    i === active
                      ? {
                          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                        }
                      : undefined
                  }
                />
              ) : (
                <div className="flex h-full w-full items-end justify-start p-10">
                  <span
                    className="font-heading text-4xl font-medium leading-tight text-white/60"
                    style={{ mixBlendMode: "overlay" }}
                  >
                    {name}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Zoom controls — overlay, top-right */}
        {images[active]?.url && (
          <div className="absolute right-3 top-3 flex flex-col gap-1.5">
            <GlassButton onClick={zoomIn} disabled={scale >= MAX_SCALE} label="Zoom in">
              <Plus className="size-4" />
            </GlassButton>
            <GlassButton onClick={zoomOut} disabled={scale <= MIN_SCALE} label="Zoom out">
              <Minus className="size-4" />
            </GlassButton>
          </div>
        )}

        {/* Arrows — overlay, vertically centered */}
        {count > 1 && (
          <>
            <GlassButton
              onClick={() => go(-1)}
              label="Previous image"
              className="absolute left-3 top-1/2 -translate-y-1/2"
            >
              <ChevronLeft className="size-4" />
            </GlassButton>
            <GlassButton
              onClick={() => go(1)}
              label="Next image"
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <ChevronRight className="size-4" />
            </GlassButton>
          </>
        )}

        {/* Counter chip */}
        {count > 1 && (
          <div className="absolute bottom-3 right-3 rounded-full bg-background/70 px-2.5 py-1 text-[11px] font-medium tabular-nums text-foreground backdrop-blur-sm">
            {active + 1} / {count}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {count > 1 && (
        <div className="flex gap-2">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={cn(
                "size-16 shrink-0 overflow-hidden border transition-colors",
                i === active
                  ? "border-foreground"
                  : "border-border hover:border-foreground/40",
              )}
              style={{ backgroundColor: bg }}
              aria-label={`View image ${i + 1}`}
            >
              {img.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.url} alt="" className="h-full w-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GlassButton({
  children,
  onClick,
  disabled,
  label,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-9 items-center justify-center rounded-full border border-border/60 bg-background/70 text-foreground backdrop-blur-sm transition-all hover:bg-background disabled:pointer-events-none disabled:opacity-30",
        className,
      )}
    >
      {children}
    </button>
  );
}
