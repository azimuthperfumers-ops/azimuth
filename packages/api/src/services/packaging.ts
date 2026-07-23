// Parcel split. One unit = one physical package.
//
// Perfume is fragile and ships in its own box, so an order of N units dispatches
// as N separate parcels — each with its own weight, dimensions, courier rate and
// AWB. Rate quoting (order.estimateShipping / order.create) and shipment booking
// (the book_shipment worker) both derive their parcels from here, so the customer
// is never quoted a different parcel count than we actually ship.

// Packaging material added to every parcel, and the courier's minimum billable
// weight. Applied per parcel — each box is weighed on its own by the courier.
export const PACKAGING_BUFFER_GRAMS = 100;
export const MIN_BILLABLE_GRAMS = 500;

// Couriers bill on whichever is greater: what the parcel weighs, or the space it
// occupies. Volumetric weight (kg) = L×W×H(cm) / 5000, Shiprocket's default
// divisor. In grams that is L×W×H / 5.
//
// This matters because the rate API accepts only a weight — it has no dimension
// parameters — while the booking API is sent the box dimensions. Quote on dead
// weight alone and Shiprocket silently re-rates the parcel at booking on its
// volumetric weight, landing it in a heavier slab than the customer was charged
// for. So we resolve the applicable weight ourselves and quote on that.
const VOLUMETRIC_DIVISOR = 5000;

const DEFAULT_BOX = { lengthCm: 15, widthCm: 10, heightCm: 10 };

/** Variant weight is required in the catalog; this covers rows predating that. */
function fallbackUnitWeight(sizeMl: number): number {
  return sizeMl + 300;
}

export type VariantDims = {
  weightGrams: number | string | null;
  boxLengthCm: number | null;
  boxWidthCm: number | null;
  boxHeightCm: number | null;
};

/** A cart line or an order line — anything that carries a variant and a quantity. */
export type PackableItem = {
  variantId: string | null;
  sizeMl: number;
  quantity: number;
  productName?: string;
  variantSku?: string;
  unitPrice?: number;
  orderItemId?: string;
};

export type ShipmentPackage = {
  /** 1-based, stable within an order — becomes the customer-facing "Package n". */
  packageNumber: number;
  orderItemId: string | null;
  variantId: string | null;
  productName: string;
  variantSku: string;
  sizeMl: number;
  /** Billable weight for this single parcel (buffer + floor already applied). */
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  unitPrice: number;
};

/** Volumetric weight of a box, in grams. */
export function volumetricWeightGrams(lengthCm: number, widthCm: number, heightCm: number): number {
  return Math.ceil((lengthCm * widthCm * heightCm) / (VOLUMETRIC_DIVISOR / 1000));
}

/**
 * Applicable weight of one parcel — what the courier actually bills.
 *
 * The greater of the packed dead weight and the volumetric weight, floored at the
 * courier minimum. Quoting and booking must both use this, otherwise the customer
 * is charged for one slab and we are billed for another.
 */
export function billableWeightGrams(
  unitWeightGrams: number,
  box?: { lengthCm: number; widthCm: number; heightCm: number },
): number {
  const deadWeight = unitWeightGrams + PACKAGING_BUFFER_GRAMS;
  const volumetric = box ? volumetricWeightGrams(box.lengthCm, box.widthCm, box.heightCm) : 0;
  return Math.max(MIN_BILLABLE_GRAMS, deadWeight, volumetric);
}

/**
 * Expand order/cart lines into one parcel per unit, in a stable order
 * (line order, then unit index) so a re-run assigns the same package numbers.
 */
export function splitIntoPackages(
  items: PackableItem[],
  dims: Map<string, VariantDims>,
): ShipmentPackage[] {
  const packages: ShipmentPackage[] = [];

  for (const item of items) {
    const variant = item.variantId ? dims.get(item.variantId) : undefined;
    const unitWeight =
      variant?.weightGrams != null ? Number(variant.weightGrams) : fallbackUnitWeight(item.sizeMl);

    const box = {
      lengthCm: variant?.boxLengthCm ?? DEFAULT_BOX.lengthCm,
      widthCm: variant?.boxWidthCm ?? DEFAULT_BOX.widthCm,
      heightCm: variant?.boxHeightCm ?? DEFAULT_BOX.heightCm,
    };

    for (let unit = 0; unit < item.quantity; unit++) {
      packages.push({
        packageNumber: packages.length + 1,
        orderItemId: item.orderItemId ?? null,
        variantId: item.variantId,
        productName: item.productName ?? "Item",
        variantSku: item.variantSku ?? "",
        sizeMl: item.sizeMl,
        // The box travels with the parcel, so its volumetric weight is part of
        // what we get billed — fold it in before quoting.
        weightGrams: billableWeightGrams(unitWeight, box),
        ...box,
        unitPrice: item.unitPrice ?? 0,
      });
    }
  }

  return packages;
}

/**
 * Distinct parcel weights with how many parcels carry each. Rates are quoted per
 * distinct weight rather than per parcel — identical parcels cost the same, and
 * the courier API call is the expensive part.
 */
export function groupPackagesByWeight(packages: ShipmentPackage[]): { weightGrams: number; count: number }[] {
  const counts = new Map<number, number>();
  for (const pkg of packages) {
    counts.set(pkg.weightGrams, (counts.get(pkg.weightGrams) ?? 0) + 1);
  }
  return [...counts.entries()].map(([weightGrams, count]) => ({ weightGrams, count }));
}
