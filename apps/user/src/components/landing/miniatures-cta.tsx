import Link from "next/link";

import { Reveal } from "@/components/reveal";
import { trpc } from "@/lib/trpc";
import {
  LANDING_INGREDIENT_DEFAULTS,
  primaryImage,
  type IngredientImage,
  type LandingProduct,
} from "./types";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

type Cell = { url: string; alt: string };

// Interleave product bottles with real ingredient photos, one strand per column.
function buildColumn(
  products: LandingProduct[],
  ingredients: IngredientImage[],
  col: number,
): Cell[] {
  const photos: Cell[] = products
    .map((p) => ({ url: primaryImage(p)?.url, alt: p.name }))
    .filter((p): p is Cell => !!p.url)
    .filter((_, i) => i % 3 === col)
    .slice(0, 3);

  const ings: Cell[] = ingredients
    .filter((_, i) => i % 3 === col)
    .map((ing) => ({ url: ing.url, alt: ing.label }));

  const cells: Cell[] = [];
  const max = Math.max(photos.length, ings.length);
  for (let i = 0; i < max; i++) {
    if (photos[i]) cells.push(photos[i]!);
    if (ings[i]) cells.push(ings[i]!);
  }
  return cells;
}

function ColumnCell({ cell }: { cell: Cell }) {
  return (
    <div className="w-full shrink-0 overflow-hidden rounded-xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cell.url} alt={cell.alt} className="aspect-[3/4] w-full object-cover" />
    </div>
  );
}

// Three columns drifting top-to-bottom at different speeds. The strand is
// duplicated flat with a uniform per-cell margin so translateY(-50%) lands
// exactly one copy down — a seamless, never-stopping loop.
function DriftColumns({
  products,
  ingredients,
}: {
  products: LandingProduct[];
  ingredients: IngredientImage[];
}) {
  const durations = ["36s", "52s", "44s"];
  return (
    <div className="absolute inset-0 flex gap-3 px-6 py-0">
      {[0, 1, 2].map((col) => {
        const cells = buildColumn(products, ingredients, col);
        if (cells.length === 0) return <div key={col} className="min-w-0 flex-1" />;
        const strand = [...cells, ...cells];
        return (
          <div key={col} className="min-w-0 flex-1 overflow-hidden">
            <div
              className="drift-col flex flex-col"
              style={{ "--drift-duration": durations[col] } as React.CSSProperties}
            >
              {strand.map((cell, i) => (
                <div key={i} className="mb-3" aria-hidden={i >= cells.length}>
                  <ColumnCell cell={cell} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MiniaturesCta({ products }: { products: LandingProduct[] }) {
  const imagery = trpc.content.getSection.useQuery({ section: "landing_imagery" });
  const configured = imagery.data?.ingredients as IngredientImage[] | undefined;
  const ingredients =
    configured && configured.length > 0 ? configured : LANDING_INGREDIENT_DEFAULTS;

  return (
    <section className="px-6 pb-28 sm:px-10 md:px-16">
      <Reveal>
        <div className="grid grid-cols-1 overflow-hidden rounded-[28px] bg-secondary lg:grid-cols-2">
          <div className="flex flex-col justify-center px-6 py-11 sm:px-10 md:px-16 md:py-18">
            <div className="text-[11px] font-semibold tracking-[0.3em] text-primary uppercase">
              Small batch, by design
            </div>
            <h2 className="font-heading mt-4.5 text-[clamp(1.9rem,3.2vw,3rem)] leading-[1.15] font-medium text-foreground">
              Bottled in runs of two hundred. <em className="text-primary">Never more.</em>
            </h2>
            <p className="mt-5 max-w-[44ch] text-[15px] leading-[1.75] text-muted-foreground">
              Every bottle carries its batch number — proof that one pair of hands weighed,
              rested and sealed it. When a run sells through, it&apos;s gone.
            </p>
            <Link
              href="/shop"
              className="mt-8.5 inline-block self-start bg-foreground px-8 py-4.5 text-[12px] font-semibold tracking-[0.2em] text-background uppercase transition-colors hover:bg-primary"
            >
              Shop the collection
            </Link>
          </div>
          <div className="relative min-h-[380px] overflow-hidden bg-foreground lg:min-h-[480px]">
            <div
              className="pointer-events-none absolute inset-0 z-10 opacity-[0.07]"
              style={{ backgroundImage: GRAIN, backgroundSize: "200px 200px" }}
            />
            <DriftColumns products={products} ingredients={ingredients} />
          </div>
        </div>
      </Reveal>
    </section>
  );
}
