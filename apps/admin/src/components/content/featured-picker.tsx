"use client";

import { Star } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

/** Star-toggle grid to choose which products are featured on the landing page. */
export function FeaturedPicker() {
  const utils = trpc.useUtils();
  const products = trpc.catalog.listProducts.useQuery({ limit: 100 });
  const update = trpc.catalog.updateProduct.useMutation({
    onSuccess: () => utils.catalog.listProducts.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const list = products.data ?? [];
  const featuredCount = list.filter((p) => p.isFeatured).length;

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-muted-foreground">
        {featuredCount} featured — these float to the front of the landing collection. Tap to toggle.
      </p>
      {products.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {list.map((p) => {
          const img = (p.images.find((i) => i.isPrimary) ?? p.images[0]) as { url?: string } | undefined;
          const featured = p.isFeatured;
          return (
            <button
              key={p.id}
              type="button"
              disabled={update.isPending}
              onClick={() => update.mutate({ id: p.id, isFeatured: !featured })}
              className={cn(
                "group relative overflow-hidden rounded-lg border text-left transition-all",
                featured ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/40",
              )}
            >
              <div className="aspect-[3/4] bg-muted">
                {img?.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img.url} alt={p.name} className="size-full object-cover" />
                )}
              </div>
              <div className="absolute right-2 top-2">
                <Star
                  className={cn(
                    "size-5",
                    featured ? "fill-primary text-primary" : "text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]",
                  )}
                />
              </div>
              <div className="truncate p-2 text-sm font-medium">{p.name}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
