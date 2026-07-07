export type LandingProduct = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  themeColor: string | null;
  isFeatured: boolean;
  category: { id: string; name: string } | null;
  images: { url: string; isPrimary: boolean }[];
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
