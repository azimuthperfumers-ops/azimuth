"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";

import { BannerCarousel } from "@/components/banner-carousel";
import { ProductCard } from "@/components/product-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const CONCENTRATIONS = [
  { value: "all", label: "All" },
  { value: "edp", label: "Eau de Parfum" },
  { value: "edt", label: "Eau de Toilette" },
  { value: "parfum", label: "Parfum" },
  { value: "cologne", label: "Cologne" },
  { value: "attar", label: "Attar" },
] as const;

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 text-left text-[13px] transition-colors group",
        active
          ? "text-foreground font-medium"
          : "text-muted-foreground/60 hover:text-foreground font-normal",
      )}
    >
      <span
        className={cn(
          "inline-block size-1 rounded-full transition-colors shrink-0",
          active ? "bg-foreground" : "bg-transparent group-hover:bg-muted-foreground/40",
        )}
      />
      {children}
    </button>
  );
}

function useFilter() {
  const router = useRouter();
  const params = useSearchParams();

  const category = params.get("category") ?? "all";
  const concentration = params.get("concentration") ?? "all";
  const search = params.get("q") ?? "";

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "all" || value === "") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    router.replace(`/shop?${next.toString()}`, { scroll: false });
  }

  function clear() {
    router.replace("/shop", { scroll: false });
  }

  const hasFilters = category !== "all" || concentration !== "all" || search !== "";

  return { category, concentration, search, set, clear, hasFilters };
}

function FilterContent({
  category,
  concentration,
  search,
  hasFilters,
  categories,
  set,
  clear,
}: ReturnType<typeof useFilter> & { categories: { id: string; name: string }[] | undefined }) {
  return (
    <div className="space-y-7">
      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/40" />
        <input
          type="text"
          value={search}
          onChange={(e) => set("q", e.target.value)}
          placeholder="Rose, oud, amber…"
          className="w-full border border-border bg-background py-2.5 pl-9 pr-8 text-[13px] placeholder:text-muted-foreground/35 focus:border-foreground/40 focus:outline-none transition-colors"
        />
        {search && (
          <button
            onClick={() => set("q", "")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Category */}
      <div>
        <p className="mb-3.5 text-[10px] font-bold tracking-[0.24em] text-foreground/40 uppercase">
          Category
        </p>
        <div className="flex flex-col gap-3">
          <FilterButton active={category === "all"} onClick={() => set("category", "all")}>
            All
          </FilterButton>
          {categories?.map((c) => (
            <FilterButton key={c.id} active={category === c.id} onClick={() => set("category", c.id)}>
              {c.name}
            </FilterButton>
          ))}
        </div>
      </div>

      {/* Type */}
      <div className="border-t border-border/60 pt-7">
        <p className="mb-3.5 text-[10px] font-bold tracking-[0.24em] text-foreground/40 uppercase">
          Type
        </p>
        <div className="flex flex-col gap-3">
          {CONCENTRATIONS.map((c) => (
            <FilterButton
              key={c.value}
              active={concentration === c.value}
              onClick={() => set("concentration", c.value)}
            >
              {c.label}
            </FilterButton>
          ))}
        </div>
      </div>

      {hasFilters && (
        <button
          onClick={clear}
          className="text-[10px] font-semibold tracking-[0.16em] text-primary uppercase underline underline-offset-3 hover:opacity-70 transition-opacity"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

function ShopPageInner() {
  const filter = useFilter();
  const { category, concentration, search, hasFilters } = filter;
  const [filtersOpen, setFiltersOpen] = useState(false);

  const shopBanners = trpc.content.listBanners.useQuery({ page: "shop" });
  const categories = trpc.catalog.listCategories.useQuery();
  const products = trpc.catalog.listProducts.useQuery({
    status: "active",
    categoryId: category === "all" ? undefined : category,
    limit: 100,
  });

  const filtered = useMemo(() => {
    return (products.data ?? []).filter((p) => {
      if (concentration !== "all" && !p.variants.some((v) => v.concentration === concentration))
        return false;
      if (search) {
        const q = search.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !(p.description ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [products.data, concentration, search]);

  return (
    <>
      <SiteHeader />

      {/* Cover photo — full bleed */}
      <div className="relative h-[33vh] md:h-[40vh] w-full overflow-hidden bg-muted">
        {(shopBanners.data ?? []).filter((b) => b.active).length > 0 ? (
          <BannerCarousel banners={shopBanners.data ?? []} />
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/shop-cover.jpg"
              alt="Azimuth collection"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-black/30" />
          </>
        )}
      </div>

      <main className="mx-auto max-w-[1400px] px-4 md:px-10 py-10 md:py-16 pb-32">
        {/* Page header */}
        <div className="mb-10 md:mb-14 border-b border-border pb-8 md:pb-10">
          <p className="mb-3 text-[10px] font-semibold tracking-[0.22em] text-muted-foreground/50 uppercase">
            Home / Shop
          </p>
          <div className="flex items-end justify-between">
            <div>
              <h1 className="font-heading text-[2.5rem] md:text-[3.5rem] font-medium leading-none tracking-tight">
                The Collection
              </h1>
              <p className="mt-3 text-sm text-muted-foreground/70 max-w-sm">
                Every Azimuth fragrance, currently live in the catalog.
              </p>
            </div>
            {!products.isLoading && (
              <p className="text-[12px] font-medium tracking-[0.06em] text-muted-foreground pb-1">
                {filtered.length} fragrance{filtered.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>

        {/* Mobile filter toggle */}
        <div className="mb-6 lg:hidden">
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={cn(
              "flex items-center gap-2 border px-4 py-2.5 text-[11px] font-semibold tracking-[0.16em] uppercase transition-colors",
              filtersOpen || hasFilters
                ? "border-foreground text-foreground"
                : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
            )}
          >
            <SlidersHorizontal className="size-3.5" />
            Filters
            {hasFilters && <span className="ml-1 text-primary">·</span>}
          </button>

          {filtersOpen && (
            <div className="mt-4 border border-border p-5">
              <FilterContent
                {...filter}
                categories={categories.data}
              />
            </div>
          )}
        </div>

        <div className="grid gap-10 lg:grid-cols-[200px_1fr] lg:gap-14">
          {/* Sidebar — desktop only */}
          <aside className="hidden lg:block sticky top-24 self-start">
            <FilterContent
              {...filter}
              categories={categories.data}
            />
          </aside>

          {/* Product grid */}
          <div>
            {products.isLoading && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="aspect-[3/4] bg-muted" />
                    <div className="mt-5 space-y-2">
                      <div className="h-2.5 w-16 bg-muted" />
                      <div className="h-5 w-32 bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!products.isLoading && filtered.length === 0 && (
              <div className="py-32 text-center">
                <p className="font-heading text-2xl font-medium text-muted-foreground/40">
                  No fragrances match
                </p>
                <p className="mt-2 text-sm text-muted-foreground/50">Try adjusting your filters.</p>
                <button
                  onClick={filter.clear}
                  className="mt-6 text-[11px] font-semibold tracking-[0.14em] text-foreground underline underline-offset-2 uppercase hover:opacity-70 transition-opacity"
                >
                  Clear all filters
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-3">
              {filtered.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

export default function ShopPage() {
  return (
    <Suspense>
      <ShopPageInner />
    </Suspense>
  );
}
