// App-facing logistics interface. Callers never touch provider files directly.

// ── Types ─────────────────────────────────────────────────────────────────────

// Surface is the only mode we ship: perfume is flammable and barred from air
// cargo, so providers must filter air/express couriers out of every quote,
// serviceability check and AWB assignment.
export type ServiceabilityResult = {
  serviceable: boolean;
  mode: "Surface" | null;
  estimatedDays: number | null;
  cod: boolean;
};

export type CreateShipmentInput = {
  /**
   * Unique reference for this parcel at the provider. One order dispatches as
   * several parcels, so this carries a per-package suffix (e.g. AZ-2026-0007-P2)
   * — the provider rejects a duplicate.
   */
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  address: {
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    pincode: string;
  };
  items: { name: string; sku: string; qty: number; price: number }[];
  codAmount: number;
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

export type ShipmentResult = {
  waybill: string;
  trackingUrl: string;
  courierName?: string;
  estimatedDeliveryDate?: string;
  status: "created" | "failed";
  errorMessage?: string;
};

export type TrackingResult = {
  waybill: string;
  status: string;
  statusDetail: string;
  scannedAt?: string;
  location?: string;
};

export type ShippingRateResult = {
  available: boolean;
  chargeInr: number;
  estimatedDays: number | null;
};

// ── Interface ─────────────────────────────────────────────────────────────────
// Forward shipping only — refund-only policy, no reverse pickups or exchanges.

export interface ILogisticsService {
  checkServiceability(pincode: string): Promise<ServiceabilityResult>;
  getShippingRate(destPincode: string, weightGrams: number): Promise<ShippingRateResult>;
  createShipment(input: CreateShipmentInput): Promise<ShipmentResult>;
  trackShipment(waybill: string): Promise<TrackingResult>;
  cancelShipment(waybill: string): Promise<{ cancelled: boolean; message?: string }>;
}

// ── Multi-package quoting ─────────────────────────────────────────────────────

import { groupPackagesByWeight, type ShipmentPackage } from "./packaging";

export type MultiPackageRate = {
  /** False if even one parcel has no surface courier — we ship all or nothing. */
  available: boolean;
  /** Total charge across every parcel in the order. */
  chargeInr: number;
  /** Charge for each parcel, indexed by packageNumber - 1. */
  perPackageInr: number[];
  /** Slowest parcel — the order is only complete when the last one lands. */
  estimatedDays: number | null;
  packageCount: number;
};

/**
 * Price an order that dispatches as several parcels. Identical parcels cost the
 * same, so rates are fetched once per distinct weight and fanned back out —
 * a 5-bottle order of one variant costs one API call, not five.
 */
export async function quotePackages(
  logistics: ILogisticsService,
  destPincode: string,
  packages: ShipmentPackage[],
): Promise<MultiPackageRate> {
  if (packages.length === 0) {
    return { available: false, chargeInr: 0, perPackageInr: [], estimatedDays: null, packageCount: 0 };
  }

  const groups = groupPackagesByWeight(packages);
  const rates = await Promise.all(groups.map((g) => logistics.getShippingRate(destPincode, g.weightGrams)));

  const rateByWeight = new Map(groups.map((g, i) => [g.weightGrams, rates[i]!]));

  const perPackageInr = packages.map((pkg) => rateByWeight.get(pkg.weightGrams)?.chargeInr ?? 0);
  const available = rates.every((r) => r.available);
  const estimatedDays = rates.reduce<number | null>(
    (slowest, r) => (r.estimatedDays == null ? slowest : Math.max(slowest ?? 0, r.estimatedDays)),
    null,
  );

  return {
    available,
    chargeInr: available ? perPackageInr.reduce((s, c) => s + c, 0) : 0,
    perPackageInr,
    estimatedDays,
    packageCount: packages.length,
  };
}

// ── Factory ───────────────────────────────────────────────────────────────────
// No silent fallback: a misconfigured provider must fail the call (and the boot
// check in each app), never fake waybills.

import { ShiprocketProvider } from "./providers/shiprocket.provider";
import { env } from "../env";

export function createLogisticsService(): ILogisticsService {
  const provider = env.LOGISTICS_PROVIDER;

  if (provider !== "shiprocket") {
    throw new Error(
      `[logistics] unknown LOGISTICS_PROVIDER="${provider}" — only "shiprocket" is supported`,
    );
  }
  if (!env.SHIPROCKET_EMAIL || !env.SHIPROCKET_PASSWORD) {
    throw new Error("[logistics] SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD not set");
  }
  return new ShiprocketProvider();
}
