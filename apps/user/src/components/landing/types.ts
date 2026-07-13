export type LandingProduct = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  themeColor: string | null;
  isFeatured: boolean;
  category: { id: string; name: string } | null;
  images: { url: string; isPrimary: boolean; isSecondary: boolean }[];
  variants: {
    id: string;
    sku: string;
    sizeMl: number;
    mrp: string;
    effectivePrice: number | string;
    status: string;
    isDefault: boolean;
    concentration: string;
  }[];
};

export function primaryImage(product: LandingProduct) {
  return product.images.find((i) => i.isPrimary) ?? product.images[0];
}

export function secondaryImage(product: LandingProduct) {
  const primary = primaryImage(product);
  return product.images.find((i) => i.isSecondary && i.url !== primary?.url);
}

export function defaultVariant(product: LandingProduct) {
  const active = product.variants.filter((v) => v.status === "active");
  return active.find((v) => v.isDefault) ?? active[0];
}

export function fromPrice(product: LandingProduct): number | null {
  const prices = product.variants
    .filter((v) => v.status === "active")
    .map((v) => Number(v.effectivePrice));
  return prices.length > 0 ? Math.min(...prices) : null;
}

export const CONCENTRATION_LABEL: Record<string, string> = {
  edp: "Eau de Parfum",
  edt: "Eau de Toilette",
  parfum: "Parfum",
  cologne: "Cologne",
  attar: "Attar",
};

// Landing imagery — real ingredient/mood photos the admin can swap in the
// content playground ("Landing" surface). These bundled webp files are the
// fallback shown until (or unless) the admin uploads their own.
export type IngredientImage = { url: string; label: string };

export const LANDING_INGREDIENT_DEFAULTS: IngredientImage[] = [
  { url: "/ingredients/amber.webp", label: "Amber" },
  { url: "/ingredients/rose.webp", label: "Rose" },
  { url: "/ingredients/citrus.webp", label: "Citrus" },
  { url: "/ingredients/patchouli.webp", label: "Patchouli" },
  { url: "/ingredients/lavender.webp", label: "Lavender" },
  { url: "/ingredients/smoke.webp", label: "Smoke" },
  { url: "/ingredients/strawberry.webp", label: "Berry" },
  { url: "/ingredients/jasmine.webp", label: "Jasmine" },
  { url: "/ingredients/cedar.webp", label: "Cedarwood" },
  { url: "/ingredients/marine.webp", label: "Marine" },
  { url: "/ingredients/candy.webp", label: "Sweet" },
];
