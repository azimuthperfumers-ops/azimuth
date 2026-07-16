import Link from "next/link";

type Product = {
  id: string;
  name: string;
  slug: string;
  themeColor: string | null;
  category: { name: string } | null;
  images: { url: string; isPrimary: boolean; isSecondary: boolean }[];
  variants: {
    effectivePrice: number | string;
    mrp: string;
    status: string;
    concentration: string;
    isDefault: boolean;
  }[];
};

const CONCENTRATION_LABEL: Record<string, string> = {
  edp: "Eau de Parfum",
  edt: "Eau de Toilette",
  parfum: "Parfum",
  cologne: "Cologne",
  attar: "Attar",
};

export function ProductCard({ product }: { product: Product }) {
  const image = product.images.find((i) => i.isPrimary) ?? product.images[0];
  const secondary = product.images.find((i) => i.isSecondary && i.url !== image?.url);
  const activeVariants = product.variants.filter((v) => v.status === "active");
  const prices = activeVariants.map((v) => Number(v.effectivePrice));
  const mrps = activeVariants.map((v) => Number(v.mrp));
  const fromPrice = prices.length > 0 ? Math.min(...prices) : null;
  const fromMrp = mrps.length > 0 ? Math.min(...mrps) : null;
  const hasDiscount = fromPrice !== null && fromMrp !== null && fromMrp > fromPrice;
  const discountPct = hasDiscount ? Math.round(((fromMrp! - fromPrice!) / fromMrp!) * 100) : 0;
  const displayVariant = activeVariants.find((v) => v.isDefault) ?? activeVariants[0];
  const bg = product.themeColor ?? "#e8e0d5";

  return (
    <Link href={`/shop/${product.slug ?? product.id}`} className="group block">
      {/* Image */}
      <div
        className="relative aspect-[3/4] w-full overflow-hidden"
        style={{ backgroundColor: bg }}
      >
        {image?.url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              alt={product.name}
              className={`h-full w-full object-cover ${
                secondary
                  ? "group-hover:invisible"
                  : "transition-transform duration-500 ease-out group-hover:scale-[1.05]"
              }`}
            />
            {secondary && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={secondary.url}
                alt={product.name}
                aria-hidden
                className="invisible absolute inset-0 h-full w-full object-cover group-hover:visible"
              />
            )}
          </>
        ) : (
          <div className="flex h-full w-full items-end justify-start p-6">
            <span
              className="font-heading text-3xl font-medium leading-tight text-white/60"
              style={{ mixBlendMode: "overlay" }}
            >
              {product.name}
            </span>
          </div>
        )}

        {/* Discount badge — top right, minimal */}
        {hasDiscount && discountPct >= 5 && (
          <div className="absolute right-3 top-3 bg-background/90 px-2.5 py-1 backdrop-blur-sm">
            <span className="text-[9px] font-bold tracking-[0.18em] text-foreground uppercase">
              {discountPct}% off
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="pt-4 pb-1">
        <h3 className="font-heading text-[1.45rem] font-medium leading-snug tracking-tight text-foreground">
          {product.name}
        </h3>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[13px] tracking-[0.1em] text-muted-foreground/70 uppercase">
            {displayVariant
              ? (CONCENTRATION_LABEL[displayVariant.concentration] ?? displayVariant.concentration)
              : null}
          </p>
          {fromPrice !== null && (
            <div className="flex items-baseline gap-1.5 shrink-0">
              <span className="text-[17px] font-semibold tabular-nums text-foreground">
                ₹{fromPrice.toLocaleString("en-IN")}
              </span>
              {hasDiscount && (
                <span className="text-[13px] tabular-nums text-muted-foreground/50 line-through">
                  ₹{fromMrp!.toLocaleString("en-IN")}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Color accent line — slides in at bottom of text on hover */}
        <div
          className="mt-3 h-[2px] w-0 transition-all duration-500 ease-out group-hover:w-full"
          style={{ backgroundColor: bg }}
        />
      </div>
    </Link>
  );
}
