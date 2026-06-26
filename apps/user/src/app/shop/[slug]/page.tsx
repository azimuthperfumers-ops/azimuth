"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Heart, Share2 } from "lucide-react";
import { toast } from "sonner";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { authClient } from "@/lib/auth-client";
import { useCart } from "@/hooks/use-cart";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const CONCENTRATION_LABEL: Record<string, string> = {
  edp: "Eau de Parfum",
  edt: "Eau de Toilette",
  parfum: "Parfum",
  cologne: "Cologne",
  attar: "Attar",
};

const GENDER_LABEL: Record<string, string> = {
  unisex: "Unisex",
  men: "For Him",
  women: "For Her",
};

function DotRating({ value, max = 5, label }: { value: number; max?: number; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">
        {label}
      </span>
      <div className="flex gap-1.5">
        {Array.from({ length: max }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "inline-block size-2 rounded-full",
              i < value ? "bg-foreground" : "bg-foreground/12",
            )}
          />
        ))}
      </div>
    </div>
  );
}

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();

  const { data: session } = authClient.useSession();
  const isLoggedIn = !!session?.user;

  const productQuery = trpc.catalog.getProductBySlug.useQuery({ slug });
  const product = productQuery.data ?? null;

  const wishlistQuery = (trpc as any).userData.listWishlist.useQuery(undefined, {
    enabled: isLoggedIn,
  });
  const wishlistItem = wishlistQuery.data?.find((w: any) => w.productId === product?.id);
  const isWishlisted = !!wishlistItem;

  const addToWishlist = (trpc as any).userData.addToWishlist.useMutation({
    onSuccess: () => { wishlistQuery.refetch(); toast.success("Added to wishlist"); },
    onError: () => toast.error("Could not save to wishlist"),
  });
  const removeFromWishlist = (trpc as any).userData.removeFromWishlist.useMutation({
    onSuccess: () => { wishlistQuery.refetch(); toast.success("Removed from wishlist"); },
    onError: () => toast.error("Could not remove from wishlist"),
  });

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [activeImg, setActiveImg] = useState(0);
  const [addedVariantId, setAddedVariantId] = useState<string | null>(null);
  const cart = useCart();

  const isLoading = productQuery.isLoading;

  if (isLoading) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-[1300px] px-4 md:px-8 py-8 md:py-14">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-14 animate-pulse">
            <div className="aspect-[3/4] bg-muted" />
            <div className="space-y-4 pt-4">
              <div className="h-3 w-24 bg-muted" />
              <div className="h-10 w-64 bg-muted" />
              <div className="h-3 w-32 bg-muted" />
            </div>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  if (!product) {
    return (
      <>
        <SiteHeader />
        <main className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
          <p className="text-sm text-muted-foreground">This fragrance could not be found.</p>
          <button
            onClick={() => router.push("/shop")}
            className="text-[11px] font-semibold tracking-[0.14em] text-foreground underline underline-offset-2 uppercase"
          >
            Back to shop
          </button>
        </main>
        <SiteFooter />
      </>
    );
  }

  const images = (product.images ?? []) as { url?: string; isPrimary: boolean }[];
  const primaryIdx = images.findIndex((i) => i.isPrimary);
  const orderedImages = primaryIdx > 0
    ? [images[primaryIdx]!, ...images.filter((_, i) => i !== primaryIdx)]
    : images;

  const activeVariant =
    (product.variants ?? []).find((v: any) => v.id === selectedVariantId) ??
    (product.variants ?? []).find((v: any) => v.isDefault) ??
    (product.variants ?? [])[0] ??
    null;

  const activeVariants = (product.variants ?? []).filter((v: any) => v.status === "active");

  const topNotes = (product.notes ?? []).filter((n: any) => n.notePosition === "top");
  const midNotes = (product.notes ?? []).filter((n: any) => n.notePosition === "mid");
  const baseNotes = (product.notes ?? []).filter((n: any) => n.notePosition === "base");
  const hasNotes = topNotes.length + midNotes.length + baseNotes.length > 0;

  const bg = product.themeColor ?? "#e8e0d5";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1300px] px-4 md:px-8 py-6 md:py-10 pb-24">
        {/* Breadcrumb */}
        <div className="mb-8 flex items-center gap-2 text-[11px] tracking-[0.06em] text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <span>/</span>
          <Link href="/shop" className="hover:text-foreground transition-colors">Shop</Link>
          {product.category && (
            <>
              <span>/</span>
              <span>{product.category.name}</span>
            </>
          )}
          <span>/</span>
          <span className="text-foreground">{product.name}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 lg:gap-20">
          {/* ── Left: images ── */}
          <div className="space-y-3">
            {/* Main image */}
            <div
              className="aspect-[3/4] w-full overflow-hidden"
              style={{ backgroundColor: bg }}
            >
              {orderedImages[activeImg]?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={orderedImages[activeImg]!.url!}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-end justify-start p-10">
                  <span
                    className="font-heading text-4xl font-medium leading-tight text-white/60"
                    style={{ mixBlendMode: "overlay" }}
                  >
                    {product.name}
                  </span>
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {orderedImages.length > 1 && (
              <div className="flex gap-2">
                {orderedImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    className={cn(
                      "size-16 shrink-0 overflow-hidden border transition-colors",
                      i === activeImg ? "border-foreground" : "border-border hover:border-foreground/40",
                    )}
                    style={{ backgroundColor: bg }}
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

          {/* ── Right: info ── */}
          <div className="flex flex-col gap-7 pt-2">
            {/* Header */}
            <div>
              <p className="mb-3 text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                {CONCENTRATION_LABEL[product.concentration] ?? product.concentration}
                {" · "}
                {GENDER_LABEL[product.gender] ?? product.gender}
                {product.category && ` · ${product.category.name}`}
              </p>
              <h1 className="font-heading text-[2.2rem] md:text-[3rem] font-medium leading-[1.05] tracking-tight text-foreground">
                {product.name}
              </h1>
              {product.description && (
                <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
                  {product.description}
                </p>
              )}
            </div>

            {/* Price */}
            {activeVariant && (
              <div className="border-t border-border pt-6">
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl font-semibold text-foreground tabular-nums">
                    ₹{Number(activeVariant.sellingPrice).toFixed(0)}
                  </span>
                  {Number(activeVariant.mrp) > Number(activeVariant.sellingPrice) && (
                    <span className="text-sm text-muted-foreground line-through tabular-nums">
                      ₹{Number(activeVariant.mrp).toFixed(0)}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Incl. of all taxes</p>
              </div>
            )}

            {/* Variant selector */}
            {activeVariants.length > 0 && (
              <div>
                <p className="mb-3 text-[11px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">
                  Size
                  {activeVariant && (
                    <span className="ml-2 font-normal normal-case tracking-normal text-foreground">
                      — {activeVariant.sizeMl}ml
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  {activeVariants.map((v: any) => {
                    const isSelected = (selectedVariantId ?? activeVariant?.id) === v.id;
                    const outOfStock = v.stockCached === 0;
                    return (
                      <button
                        key={v.id}
                        disabled={outOfStock}
                        onClick={() => setSelectedVariantId(v.id)}
                        className={cn(
                          "relative border px-4 py-2 text-sm font-medium transition-colors",
                          isSelected
                            ? "border-foreground bg-foreground text-background"
                            : outOfStock
                              ? "border-border text-muted-foreground/40 cursor-not-allowed"
                              : "border-border text-foreground hover:border-foreground",
                        )}
                      >
                        {v.sizeMl}ml
                        {outOfStock && (
                          <span className="absolute inset-0 flex items-center justify-center">
                            <span className="h-px w-full rotate-[-20deg] bg-muted-foreground/30" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stock notice */}
            {activeVariant && activeVariant.stockCached > 0 && activeVariant.stockCached <= 5 && (
              <p className="text-[11px] font-semibold tracking-[0.1em] text-primary uppercase">
                Only {activeVariant.stockCached} left in stock
              </p>
            )}

            {/* CTA */}
            <div className="flex gap-3">
              <button
                disabled={!activeVariant || activeVariant.stockCached === 0}
                onClick={() => {
                  if (!activeVariant || activeVariant.stockCached === 0) return;
                  const primaryImg = orderedImages[0];
                  cart.add({
                    productId: product.id,
                    variantId: activeVariant.id,
                    productName: product.name,
                    variantSku: activeVariant.sku,
                    sizeMl: activeVariant.sizeMl,
                    sellingPrice: Number(activeVariant.sellingPrice),
                    mrp: Number(activeVariant.mrp),
                    imageUrl: primaryImg?.url ?? undefined,
                    themeColor: product.themeColor ?? undefined,
                    slug: product.slug,
                  });
                  setAddedVariantId(activeVariant.id);
                  setTimeout(() => setAddedVariantId(null), 1800);
                }}
                className={cn(
                  "flex-1 border py-3.5 text-[11px] font-semibold tracking-[0.22em] uppercase transition-all",
                  activeVariant && activeVariant.stockCached > 0
                    ? addedVariantId === activeVariant.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-foreground bg-foreground text-background hover:bg-transparent hover:text-foreground"
                    : "border-border text-muted-foreground cursor-not-allowed",
                )}
              >
                {!activeVariant
                  ? "Select a size"
                  : activeVariant.stockCached === 0
                    ? "Out of stock"
                    : addedVariantId === activeVariant.id
                      ? "Added to cart ✓"
                      : "Add to cart"}
              </button>
              <button
                onClick={() => {
                  if (!isLoggedIn) {
                    toast.error("Sign in to save to wishlist");
                    return;
                  }
                  if (isWishlisted && wishlistItem) {
                    removeFromWishlist.mutate({ id: wishlistItem.id });
                  } else if (product) {
                    addToWishlist.mutate({ productId: product.id });
                  }
                }}
                disabled={addToWishlist.isPending || removeFromWishlist.isPending}
                className={cn(
                  "border p-3.5 transition-colors disabled:opacity-50",
                  isWishlisted
                    ? "border-primary bg-primary/8 text-primary hover:bg-primary/15"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
                )}
                title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
              >
                <Heart className={cn("size-4", isWishlisted && "fill-current")} />
              </button>
              <button
                className="border border-border p-3.5 text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                title="Share"
              >
                <Share2 className="size-4" />
              </button>
            </div>

            {/* Performance ratings */}
            {(product.longevityRating || product.sillageRating) && (
              <div className="border-t border-border pt-6 space-y-3">
                <p className="text-[11px] font-semibold tracking-[0.16em] uppercase text-muted-foreground mb-4">
                  Performance
                </p>
                {product.longevityRating && (
                  <DotRating value={product.longevityRating} label="Longevity" />
                )}
                {product.sillageRating && (
                  <DotRating value={product.sillageRating} label="Sillage" />
                )}
              </div>
            )}

            {/* Fragrance notes */}
            {hasNotes && (
              <div className="border-t border-border pt-6 space-y-4">
                <p className="text-[11px] font-semibold tracking-[0.16em] uppercase text-muted-foreground">
                  Fragrance notes
                </p>
                <div className="space-y-3">
                  {[
                    { label: "Top", entries: topNotes },
                    { label: "Heart", entries: midNotes },
                    { label: "Base", entries: baseNotes },
                  ]
                    .filter(({ entries }) => entries.length > 0)
                    .map(({ label, entries }) => (
                      <div key={label} className="flex items-start gap-4">
                        <span className="w-10 shrink-0 text-[11px] font-semibold tracking-[0.14em] uppercase text-muted-foreground/50 pt-0.5">
                          {label}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {entries.map((n: any) => (
                            <span
                              key={n.noteId ?? n.id}
                              className="rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-medium text-foreground/80"
                            >
                              {n.note?.name ?? n.name ?? "—"}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Back link */}
            <div className="border-t border-border pt-6">
              <Link
                href="/shop"
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase hover:text-foreground transition-colors"
              >
                <ChevronLeft className="size-3.5" />
                Back to shop
              </Link>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
