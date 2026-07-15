// App-facing logistics interface. Callers never touch provider files directly.

// ── Types ─────────────────────────────────────────────────────────────────────

export type ServiceabilityResult = {
  serviceable: boolean;
  mode: "Surface" | "Express" | null;
  estimatedDays: number | null;
  cod: boolean;
};

export type CreateShipmentInput = {
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
