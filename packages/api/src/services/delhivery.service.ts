// Delhivery shipping carrier interface.
// Stub returns safe defaults until real API token is configured.
// Real impl: POST https://track.delhivery.com/api/kinko/v1/invoice/shipments/json/
// Auth: Token <DELHIVERY_API_TOKEN> header

export type ServiceabilityResult = {
  serviceable: boolean;
  mode: "Surface" | "Express" | null; // Perfumes = Surface only (flammable)
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
  codAmount: number; // 0 for prepaid
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

export interface IDelhiveryService {
  checkServiceability(pincode: string): Promise<ServiceabilityResult>;
  createShipment(input: CreateShipmentInput): Promise<ShipmentResult>;
  trackShipment(waybill: string): Promise<TrackingResult>;
}

export class StubDelhiveryService implements IDelhiveryService {
  async checkServiceability(pincode: string): Promise<ServiceabilityResult> {
    console.log(`[delhivery:stub] serviceability check — pincode ${pincode}`);
    return { serviceable: true, mode: "Surface", estimatedDays: 5, cod: false };
  }

  async createShipment(input: CreateShipmentInput): Promise<ShipmentResult> {
    const fakeWaybill = `STUB${Date.now()}`;
    console.log(`[delhivery:stub] create shipment — ${input.orderNumber} → ${fakeWaybill}`);
    return {
      waybill: fakeWaybill,
      trackingUrl: `https://www.delhivery.com/track/package/${fakeWaybill}`,
      status: "created",
    };
  }

  async trackShipment(waybill: string): Promise<TrackingResult> {
    console.log(`[delhivery:stub] track — ${waybill}`);
    return {
      waybill,
      status: "In Transit",
      statusDetail: "Shipment is in transit",
    };
  }
}

export function createDelhiveryService(): IDelhiveryService {
  // Swap StubDelhiveryService for RealDelhiveryService when DELHIVERY_API_TOKEN is set
  const token = process.env.DELHIVERY_API_TOKEN;
  if (token) {
    console.warn("[delhivery] DELHIVERY_API_TOKEN set but real impl not built yet — using stub");
  }
  return new StubDelhiveryService();
}
