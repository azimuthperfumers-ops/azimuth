"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ShoppingBag, Check } from "lucide-react";
import { toast } from "sonner";

import { useCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";

type Variant = {
  id: string;
  sku: string;
  sizeMl: number;
  mrp: string;
  effectivePrice: number | string;
  status: string;
  isDefault: boolean;
  concentration: string;
};

type Product = {
  id: string;
  name: string;
  slug: string | null;
  themeColor: string | null;
  gender: string;
  category: { name: string } | null;
  images: { url: string; isPrimary: boolean }[];
  variants: Variant[];
};

const CONCENTRATION_SHORT: Record<string, string> = {
  edp: "EDP",
  edt: "EDT",
  parfum: "Parfum",
  cologne: "Cologne",
  attar: "Attar",
};

function CarouselCard({ product }: { product: Product }) {
  const cart = useCart();
  const [added, setAdded] = useState(false);
  const [hovered, setHovered] = useState(false);

  const image = product.images.find((i) => i.isPrimary) ?? product.images[0];
  const activeVariants = product.variants.filter((v) => v.status === "active");
  const defaultVariant =
    activeVariants.find((v) => v.isDefault) ?? activeVariants[0];

  const prices = activeVariants.map((v) => Number(v.effectivePrice));
  const mrps = activeVariants.map((v) => Number(v.mrp));
  const fromPrice = prices.length > 0 ? Math.min(...prices) : null;
  const fromMrp = mrps.length > 0 ? Math.min(...mrps) : null;
  const hasDiscount =
    fromPrice !== null && fromMrp !== null && fromMrp > fromPrice;
  const discountPct = hasDiscount
    ? Math.round(((fromMrp! - fromPrice!) / fromMrp!) * 100)
    : 0;

  const bg = product.themeColor ?? "#e8e0d5";
  const slug = product.slug ?? product.id;
  const isSingleVariant = activeVariants.length === 1 && !!defaultVariant;

  const handleAddToCart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isSingleVariant || !defaultVariant) return;

      cart.add({
        productId: product.id,
        variantId: defaultVariant.id,
        productName: product.name,
        variantSku: defaultVariant.sku,
        sizeMl: defaultVariant.sizeMl,
        effectivePrice: Number(defaultVariant.effectivePrice),
        mrp: Number(defaultVariant.mrp),
        imageUrl: image?.url,
        themeColor: product.themeColor ?? undefined,
        slug,
      });

      setAdded(true);
      toast.success(`${product.name} added to cart`);
      setTimeout(() => setAdded(false), 2000);
    },
    [cart, product, defaultVariant, image, slug, isSingleVariant],
  );

  return (
    <div
      className="group flex w-[78vw] shrink-0 flex-col sm:w-[320px] lg:w-[360px]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Image */}
      <Link href={`/shop/${slug}`} className="block">
        <div
          className="relative aspect-[3/4] w-full overflow-hidden"
          style={{ backgroundColor: bg }}
        >
          {image?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.url}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-end justify-start p-8">
              <span
                className="font-heading text-4xl font-medium leading-tight text-white/60"
                style={{ mixBlendMode: "overlay" }}
              >
                {product.name}
              </span>
            </div>
          )}

          {hasDiscount && discountPct >= 5 && (
            <div className="absolute right-3 top-3 bg-background/90 px-2.5 py-1 backdrop-blur-sm">
              <span className="text-[9px] font-bold tracking-[0.18em] text-foreground uppercase">
                {discountPct}% off
              </span>
            </div>
          )}

          {activeVariants.length > 1 && (
            <div className="absolute bottom-3 left-3 bg-background/80 px-2.5 py-1 backdrop-blur-sm">
              <span className="text-[9px] font-semibold tracking-[0.14em] text-foreground uppercase">
                {activeVariants.length} sizes
              </span>
            </div>
          )}
        </div>

        {/* Colored rule — expands from center on hover */}
        <div className="relative h-[2px] w-full overflow-hidden">
          <div className="absolute inset-0 bg-border" />
          <div
            className="absolute top-0 left-0 h-[2px] transition-all duration-500 ease-out"
            style={{
              backgroundColor: bg,
              width: hovered ? "100%" : "0%",
            }}
          />
        </div>

        {/* Info */}
        <div className="pt-4 pb-3">
          <h3 className="font-heading text-[1.1rem] font-medium leading-snug tracking-tight text-foreground">
            {product.name}
          </h3>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <p className="text-[10.5px] tracking-[0.1em] text-muted-foreground/60 uppercase">
              {defaultVariant &&
                (CONCENTRATION_SHORT[defaultVariant.concentration] ?? defaultVariant.concentration)}
              {product.category && ` · ${product.category.name}`}
            </p>
            {fromPrice !== null && (
              <div className="flex items-baseline gap-1.5 shrink-0">
                <span className="text-[14px] font-semibold tabular-nums text-foreground">
                  ₹{fromPrice.toLocaleString("en-IN")}
                </span>
                {hasDiscount && (
                  <span className="text-[11px] tabular-nums text-muted-foreground/45 line-through">
                    ₹{fromMrp!.toLocaleString("en-IN")}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* CTA */}
      {isSingleVariant ? (
        <button
          onClick={handleAddToCart}
          className={cn(
            "mt-auto flex h-11 w-full items-center justify-center gap-2 border text-[11px] font-semibold tracking-[0.18em] uppercase transition-all duration-200",
            added
              ? "border-foreground bg-foreground text-background"
              : "border-border text-foreground hover:border-foreground hover:bg-foreground hover:text-background",
          )}
        >
          {added ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Added
            </>
          ) : (
            <>
              <ShoppingBag className="h-3.5 w-3.5" />
              Add to Cart
            </>
          )}
        </button>
      ) : (
        <Link
          href={`/shop/${slug}`}
          className="mt-auto flex h-11 w-full items-center justify-center border border-border text-[11px] font-semibold tracking-[0.18em] text-foreground uppercase transition-all hover:border-foreground hover:bg-foreground hover:text-background"
        >
          Choose Size
        </Link>
      )}
    </div>
  );
}

export function CollectionCarousel({ products }: { products: Product[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener("scroll", updateArrows, { passive: true });
    return () => el.removeEventListener("scroll", updateArrows);
  }, [updateArrows, products]);

  // Smooth inertia for wheel / trackpad horizontal scroll
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    let velocity = 0;
    let current = el.scrollLeft;
    let rafId: number;
    let ticking = false;

    const tick = () => {
      velocity *= 0.86;
      current += velocity;
      current = Math.max(0, Math.min(current, el.scrollWidth - el.clientWidth));
      el.scrollLeft = current;
      if (Math.abs(velocity) > 0.5) {
        rafId = requestAnimationFrame(tick);
      } else {
        ticking = false;
      }
    };

    const onWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta === 0) return;
      e.preventDefault();
      current = el.scrollLeft;
      velocity += delta * 1.1;
      if (!ticking) {
        ticking = true;
        rafId = requestAnimationFrame(tick);
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      cancelAnimationFrame(rafId);
    };
  }, []);

  const scroll = (dir: "prev" | "next") => {
    const el = trackRef.current;
    if (!el) return;
    const cardW = (el.firstElementChild as HTMLElement)?.clientWidth ?? 340;
    el.scrollBy({ left: dir === "next" ? cardW + 16 : -(cardW + 16), behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto px-4 pb-2 md:px-8"
        style={{ scrollSnapType: "x mandatory", scrollbarWidth: "none" }}
      >
        {products.map((p) => (
          <div key={p.id} style={{ scrollSnapAlign: "start" }}>
            <CarouselCard product={p} />
          </div>
        ))}
        {/* trailing spacer so last card doesn't sit flush at edge */}
        <div className="w-4 shrink-0 md:w-8" aria-hidden />
      </div>

      <button
        onClick={() => scroll("prev")}
        aria-label="Previous"
        className={cn(
          "absolute -left-3 top-[36%] -translate-y-1/2 z-10 hidden h-10 w-10 items-center justify-center border border-border bg-background/95 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-foreground hover:text-background md:flex",
          !canPrev && "pointer-events-none opacity-0",
        )}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <button
        onClick={() => scroll("next")}
        aria-label="Next"
        className={cn(
          "absolute -right-3 top-[36%] -translate-y-1/2 z-10 hidden h-10 w-10 items-center justify-center border border-border bg-background/95 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-foreground hover:text-background md:flex",
          !canNext && "pointer-events-none opacity-0",
        )}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
