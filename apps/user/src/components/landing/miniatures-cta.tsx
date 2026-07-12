import Link from "next/link";

import { Reveal } from "@/components/reveal";
import { INGREDIENT_ICONS, type IngredientName } from "./ingredient-carousel";
import { primaryImage, type LandingProduct } from "./types";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const TILE_WASHES = ["#6E5B33", "#A5675D", "#262338"];

const COLUMN_INGREDIENTS: IngredientName[][] = [
  ["Amber", "Rose", "Oud"],
  ["Citrus", "Vanilla", "Patchouli"],
  ["Cedarwood", "Chamomile", "Incense"],
];

type Cell =
  | { kind: "photo"; url: string; alt: string }
  | { kind: "tile"; name: IngredientName; wash: string };

function buildColumn(products: LandingProduct[], col: number): Cell[] {
  const photos: Cell[] = products
    .map((p) => ({ url: primaryImage(p)?.url, alt: p.name }))
    .filter((p): p is { url: string; alt: string } => !!p.url)
    .filter((_, i) => i % 3 === col)
    .slice(0, 3)
    .map((p) => ({ kind: "photo", ...p }));

  const tiles: Cell[] = COLUMN_INGREDIENTS[col]!.map((name, i) => ({
    kind: "tile",
    name,
    wash: TILE_WASHES[(col + i) % TILE_WASHES.length]!,
  }));

  // Interleave photo / tile; tiles alone when the catalog has no photos yet
  const cells: Cell[] = [];
  const max = Math.max(photos.length, tiles.length);
  for (let i = 0; i < max; i++) {
    const photo = photos[i];
    const tile = tiles[i];
    if (photo) cells.push(photo);
    if (tile) cells.push(tile);
  }
  return cells;
}

function ColumnCell({ cell }: { cell: Cell }) {
  if (cell.kind === "photo") {
    return (
      <div className="w-full shrink-0 overflow-hidden rounded-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cell.url} alt={cell.alt} className="aspect-[3/4] w-full object-cover" />
      </div>
    );
  }
  const Icon = INGREDIENT_ICONS[cell.name];
  return (
    <div
      className="flex aspect-[3/4] w-full shrink-0 flex-col items-center justify-center gap-2 rounded-xl text-[#FAF6EE]"
      style={{ background: `linear-gradient(160deg, ${cell.wash} 0%, ${cell.wash}C0 100%)` }}
    >
      <Icon className="size-11" />
      <div className="font-heading text-[15px] leading-none italic">{cell.name}</div>
    </div>
  );
}

// Three columns drifting top-to-bottom at different speeds
function DriftColumns({ products }: { products: LandingProduct[] }) {
  const durations = ["36s", "52s", "44s"];
  return (
    <div className="absolute inset-0 flex gap-3 px-6 py-0">
      {[0, 1, 2].map((col) => {
        const cells = buildColumn(products, col);
        return (
          <div key={col} className="min-w-0 flex-1 overflow-hidden">
            <div
              className="drift-col flex flex-col gap-3"
              style={{ "--drift-duration": durations[col] } as React.CSSProperties}
            >
              {[0, 1].map((copy) => (
                <div key={copy} className="flex flex-col gap-3 pb-3" aria-hidden={copy === 1}>
                  {cells.map((cell, i) => (
                    <ColumnCell key={`${copy}-${i}`} cell={cell} />
                  ))}
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
            {/* Fade masks top and bottom so columns emerge from the dark */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-foreground to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-foreground to-transparent" />
            <DriftColumns products={products} />
          </div>
        </div>
      </Reveal>
    </section>
  );
}
