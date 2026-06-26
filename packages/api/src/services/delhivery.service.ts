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

// ── Real implementation ───────────────────────────────────────────────────────

const BASE_URL = "https://track.delhivery.com";

class RealDelhiveryService implements IDelhiveryService {
  private token: string;
  private pickupLocation: string;

  constructor(token: string, pickupLocation: string) {
    this.token = token;
    this.pickupLocation = pickupLocation;
  }

  private headers() {
    return {
      Authorization: `Token ${this.token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  async checkServiceability(pincode: string): Promise<ServiceabilityResult> {
    const url = `${BASE_URL}/c/api/pin-codes/json/?filter_codes=${pincode}`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) return { serviceable: false, mode: null, estimatedDays: null, cod: false };

    const data = (await res.json()) as {
      delivery_codes?: {
        postal_code?: { status?: string };
        pre_paid?: { surface_days?: number; express_days?: number };
        cash_on_delivery?: { cod?: string };
      }[];
    };

    const entry = data.delivery_codes?.[0];
    if (!entry || entry.postal_code?.status !== "Y") {
      return { serviceable: false, mode: null, estimatedDays: null, cod: false };
    }

    const surfaceDays = entry.pre_paid?.surface_days ?? null;
    const cod = entry.cash_on_delivery?.cod === "Y";

    return {
      serviceable: true,
      mode: "Surface", // Perfumes are flammable — surface only
      estimatedDays: surfaceDays ? Number(surfaceDays) : null,
      cod,
    };
  }

  async createShipment(input: CreateShipmentInput): Promise<ShipmentResult> {
    const shipmentPayload = {
      pickup_location: { name: this.pickupLocation },
      shipments: [
        {
          name: input.customerName,
          add: input.address.line1 + (input.address.line2 ? `, ${input.address.line2}` : ""),
          pin: input.address.pincode,
          city: input.address.city,
          state: input.address.state,
          country: "India",
          phone: input.customerPhone,
          order: input.orderNumber,
          payment_mode: input.codAmount > 0 ? "COD" : "Prepaid",
          cod_amount: input.codAmount,
          order_date: new Date().toISOString().split("T")[0],
          total_amount: input.items.reduce((s, i) => s + i.price * i.qty, 0),
          products_desc: input.items.map((i) => i.name).join(", "),
          hsn_code: "3303", // Perfume HSN
          shipping_mode: "Surface",
          weight: input.weightGrams / 1000, // grams → kg
          length: input.lengthCm,
          breadth: input.widthCm,
          height: input.heightCm,
        },
      ],
    };

    const body = new URLSearchParams({
      format: "json",
      data: JSON.stringify(shipmentPayload),
    });

    const res = await fetch(`${BASE_URL}/api/kinko/v1/invoice/shipments/json/`, {
      method: "POST",
      headers: {
        Authorization: `Token ${this.token}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });

    const data = (await res.json()) as {
      packages?: { status?: string; waybill?: string; remarks?: string }[];
    };

    const pkg = data.packages?.[0];
    if (!res.ok || !pkg || pkg.status !== "Success" || !pkg.waybill) {
      return {
        waybill: "",
        trackingUrl: "",
        status: "failed",
        errorMessage: pkg?.remarks ?? "Shipment creation failed",
      };
    }

    return {
      waybill: pkg.waybill,
      trackingUrl: `https://www.delhivery.com/track/package/${pkg.waybill}`,
      status: "created",
    };
  }

  async trackShipment(waybill: string): Promise<TrackingResult> {
    const url = `${BASE_URL}/api/v1/packages/json/?waybill=${waybill}`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) {
      return { waybill, status: "Unknown", statusDetail: "Tracking unavailable" };
    }

    const data = (await res.json()) as {
      ShipmentData?: {
        Shipment?: {
          Status?: {
            Status?: string;
            StatusCode?: string;
            StatusLocation?: string;
            StatusDateTime?: string;
            Instructions?: string;
          };
        };
      }[];
    };

    const shipment = data.ShipmentData?.[0]?.Shipment;
    const statusObj = shipment?.Status;

    return {
      waybill,
      status: statusObj?.Status ?? "Unknown",
      statusDetail: statusObj?.Instructions ?? statusObj?.Status ?? "No details",
      scannedAt: statusObj?.StatusDateTime ?? undefined,
      location: statusObj?.StatusLocation ?? undefined,
    };
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createDelhiveryService(): IDelhiveryService {
  const token = process.env.DELHIVERY_API_TOKEN;
  const pickupLocation = process.env.DELHIVERY_PICKUP_LOCATION;

  if (!token) {
    return new StubDelhiveryService();
  }

  if (!pickupLocation) {
    console.warn("[delhivery] DELHIVERY_PICKUP_LOCATION not set — using stub");
    return new StubDelhiveryService();
  }

  return new RealDelhiveryService(token, pickupLocation);
}
