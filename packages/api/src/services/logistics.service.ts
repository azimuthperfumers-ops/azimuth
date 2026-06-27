// App-facing logistics interface. Callers never touch provider files directly.
// To add Shiprocket: implement ILogisticsService in providers/shiprocket.provider.ts,
// set LOGISTICS_PROVIDER=shiprocket in env, wire in createLogisticsService() below.

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

export type CreateReturnShipmentInput = {
  originalOrderNumber: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: {
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    pincode: string;
  };
  returnReason: string;
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

// ── Interface ─────────────────────────────────────────────────────────────────

export interface ILogisticsService {
  checkServiceability(pincode: string): Promise<ServiceabilityResult>;
  getShippingRate(destPincode: string, weightGrams: number): Promise<ShippingRateResult>;
  createShipment(input: CreateShipmentInput): Promise<ShipmentResult>;
  trackShipment(waybill: string): Promise<TrackingResult>;
  createReturnShipment(input: CreateReturnShipmentInput): Promise<ShipmentResult>;
}

// ── Factory ───────────────────────────────────────────────────────────────────

import { DelhiveryProvider, StubLogisticsProvider } from "./providers/delhivery.provider";
import { env } from "../env";

export function createLogisticsService(): ILogisticsService {
  if (env.LOGISTICS_PROVIDER === "delhivery") {
    if (!env.DELHIVERY_API_TOKEN || !env.DELHIVERY_PICKUP_LOCATION) {
      console.log("HERE");
      
      console.warn("[logistics] DELHIVERY_API_TOKEN or DELHIVERY_PICKUP_LOCATION not set — using stub");
      return new StubLogisticsProvider();
    }
     console.log("HEEEEEERE");
    return new DelhiveryProvider(env.DELHIVERY_API_TOKEN, env.DELHIVERY_PICKUP_LOCATION);
  }

  throw new Error(`[logistics] Unknown LOGISTICS_PROVIDER: "${env.LOGISTICS_PROVIDER}"`);
}
