import Link from "next/link";

import { CONCENTRATION_LABEL, defaultVariant, primaryImage, secondaryImage, type LandingProduct } from "./types";

function CardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[3/4] w-full bg-muted" />
      <div className="mt-5 h-3.5 w-28 bg-muted" />
      <div className="mt-3 h-3 w-40 bg-muted" />
    </div>
  );
}

export function CollectionSection({
  products,
  isLoading,
}: {
  products: LandingProduct[];
  isLoading: boolean;
}) {
  const shown = products.slice(0, 6);

  return (
    <section id="collection" className="px-6 py-24 sm:px-10 md:px-16">
      <div className="text-center">
        <div className="text-[11px] font-semibold tracking-[0.3em] text-primary uppercase">
          Azimuth Perfumers
        </div>
        <h2 className="font-heading mt-3.5 text-[clamp(2.6rem,4.4vw,4.2rem)] font-medium text-foreground">
          The <em className="text-primary">Collection</em>
        </h2>
      </div>

      {isLoading && (
        <div className="mt-16 grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}

      {!isLoading && shown.length === 0 && (
        <p className="mt-16 text-center text-sm text-muted-foreground">
          Nothing&apos;s live in the catalog yet — check back soon.
        </p>
      )}

      {!isLoading && shown.length > 0 && (
        <>
          <div className="mt-16 grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((product) => {
              const image = primaryImage(product);
              const secondary = secondaryImage(product);
              const variant = defaultVariant(product);
              const slug = product.slug ?? product.id;
              return (
                <div key={product.id} className="flex flex-col">
                  <Link
                    href={`/shop/${slug}`}
                    className="group relative block aspect-[3/4] overflow-hidden"
                    style={{ backgroundColor: product.themeColor ?? "#e8e0d5" }}
                  >
                    {image?.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={image.url}
                        alt={product.name}
                        className={`h-full w-full object-cover ${
                          secondary
                            ? "group-hover:invisible"
                            : "transition-transform duration-500 ease-out group-hover:scale-[1.05]"
                        }`}
                      />
                    )}
                    {secondary && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={secondary.url}
                        alt={product.name}
                        aria-hidden
                        className="invisible absolute inset-0 h-full w-full object-cover group-hover:visible"
                      />
                    )}
                    {product.category && (
                      <span className="absolute top-4.5 left-4.5 bg-background/94 px-3 py-1.5 text-[10px] font-semibold tracking-[0.22em] text-foreground uppercase">
                        {product.category.name}
                      </span>
                    )}
                  </Link>
                  <div className="mt-5.5 flex items-baseline justify-between gap-3">
                    <div className="font-heading text-[30px] text-foreground">{product.name}</div>
                    {variant && (
                      <div className="text-[10px] tracking-[0.24em] whitespace-nowrap text-muted-foreground uppercase">
                        {CONCENTRATION_LABEL[variant.concentration] ?? variant.concentration} ·{" "}
                        {variant.sizeMl}ml
                      </div>
                    )}
                  </div>
                  {product.description && (
                    <p className="mt-2.5 min-h-[66px] text-[14px] leading-[1.65] text-muted-foreground">
                      {product.description}
                    </p>
                  )}
                  <Link
                    href={`/shop/${slug}`}
                    className="mt-4.5 self-start border-b border-foreground/35 pb-1 text-[11px] font-semibold tracking-[0.22em] text-foreground uppercase transition-colors hover:border-primary hover:text-primary"
                  >
                    Discover {product.name} →
                  </Link>
                </div>
              );
            })}
          </div>

          <div className="mt-16 text-center">
            <Link
              href="/shop"
              className="inline-flex h-11 items-center border border-foreground px-10 text-[10.5px] font-semibold tracking-[0.2em] text-foreground uppercase transition-all hover:bg-foreground hover:text-background"
            >
              View all fragrances
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
