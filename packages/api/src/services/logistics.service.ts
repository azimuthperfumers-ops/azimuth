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
  cancelShipment(waybill: string): Promise<{ cancelled: boolean; message?: string }>;
}

// ── Factory ───────────────────────────────────────────────────────────────────

import { StubLogisticsProvider } from "./providers/stub.provider";
import { ShiprocketProvider } from "./providers/shiprocket.provider";
import { env } from "../env";

export function createLogisticsService(): ILogisticsService {
  if (!env.SHIPROCKET_EMAIL || !env.SHIPROCKET_PASSWORD) {
    console.warn("[logistics] SHIPROCKET_EMAIL or SHIPROCKET_PASSWORD not set — using stub");
    return new StubLogisticsProvider();
  }
  return new ShiprocketProvider();
}
