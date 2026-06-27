// Delhivery-specific HTTP integration. Do not import this outside logistics.service.ts.
// Swap to shiprocket or any other carrier by adding a new file here + wiring in the factory.

import type {
  ILogisticsService,
  ServiceabilityResult,
  CreateShipmentInput,
  ShipmentResult,
  TrackingResult,
  CreateReturnShipmentInput,
} from "../logistics.service";
import { env } from "../../env";

const BASE_URL = "https://track.delhivery.com";

// ── Stub ──────────────────────────────────────────────────────────────────────

export class StubLogisticsProvider implements ILogisticsService {
  async checkServiceability(pincode: string): Promise<ServiceabilityResult> {
    console.log(`[logistics:stub] serviceability — ${pincode}`);
    return { serviceable: true, mode: "Surface", estimatedDays: 5, cod: false };
  }

  async createShipment(input: CreateShipmentInput): Promise<ShipmentResult> {
    const waybill = `STUB${Date.now()}`;
    console.log(`[logistics:stub] create shipment — ${input.orderNumber} → ${waybill}`);
    return { waybill, trackingUrl: `https://www.delhivery.com/track/package/${waybill}`, status: "created" };
  }

  async trackShipment(waybill: string): Promise<TrackingResult> {
    console.log(`[logistics:stub] track — ${waybill}`);
    return { waybill, status: "In Transit", statusDetail: "Shipment is in transit" };
  }

  async createReturnShipment(input: CreateReturnShipmentInput): Promise<ShipmentResult> {
    const waybill = `STUBRET${Date.now()}`;
    console.log(`[logistics:stub] return — ${input.originalOrderNumber} → ${waybill}`);
    return { waybill, trackingUrl: `https://www.delhivery.com/track/package/${waybill}`, status: "created" };
  }
}

// ── Real ──────────────────────────────────────────────────────────────────────

export class DelhiveryProvider implements ILogisticsService {
  constructor(
    private readonly token: string,
    private readonly pickupLocation: string,
  ) {}

  private headers() {
    return {
      Authorization: `Token ${this.token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  async checkServiceability(pincode: string): Promise<ServiceabilityResult> {
    const res = await fetch(`${BASE_URL}/c/api/pin-codes/json/?filter_codes=${pincode}`, {
      headers: this.headers(),
    });
    if (!res.ok) return { serviceable: false, mode: null, estimatedDays: null, cod: false };

    const data = (await res.json()) as {
      delivery_codes?: {
        postal_code?: { status?: string };
        pre_paid?: { surface_days?: number };
        cash_on_delivery?: { cod?: string };
      }[];
    };

    const entry = data.delivery_codes?.[0];
    if (!entry || entry.postal_code?.status !== "Y") {
      return { serviceable: false, mode: null, estimatedDays: null, cod: false };
    }

    return {
      serviceable: true,
      mode: "Surface", // perfumes = flammable = surface only
      estimatedDays: entry.pre_paid?.surface_days ? Number(entry.pre_paid.surface_days) : null,
      cod: entry.cash_on_delivery?.cod === "Y",
    };
  }

  async createShipment(input: CreateShipmentInput): Promise<ShipmentResult> {
    const payload = {
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
          hsn_code: "3303",
          shipping_mode: "Surface",
          weight: input.weightGrams / 1000,
          length: input.lengthCm,
          breadth: input.widthCm,
          height: input.heightCm,
        },
      ],
    };

    const body = new URLSearchParams({ format: "json", data: JSON.stringify(payload) });
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
      return { waybill: "", trackingUrl: "", status: "failed", errorMessage: pkg?.remarks ?? "Shipment creation failed" };
    }

    return {
      waybill: pkg.waybill,
      trackingUrl: `https://www.delhivery.com/track/package/${pkg.waybill}`,
      status: "created",
    };
  }

  async createReturnShipment(input: CreateReturnShipmentInput): Promise<ShipmentResult> {
    const payload = {
      pickup_location: {
        name: this.pickupLocation,
        add: env.DELHIVERY_WAREHOUSE_ADDRESS ?? "",
        city: env.DELHIVERY_WAREHOUSE_CITY ?? "",
        pin_code: env.DELHIVERY_WAREHOUSE_PINCODE ?? "",
        state: env.DELHIVERY_WAREHOUSE_STATE ?? "",
        country: "India",
        phone: env.DELHIVERY_WAREHOUSE_PHONE ?? "",
      },
      shipments: [
        {
          name: input.customerName,
          add: input.pickupAddress.line1 + (input.pickupAddress.line2 ? `, ${input.pickupAddress.line2}` : ""),
          pin: input.pickupAddress.pincode,
          city: input.pickupAddress.city,
          state: input.pickupAddress.state,
          country: "India",
          phone: input.customerPhone,
          order: `RET-${input.originalOrderNumber}`,
          payment_mode: "Pickup",
          cod_amount: 0,
          order_date: new Date().toISOString().split("T")[0],
          total_amount: 0,
          products_desc: `Return: ${input.returnReason}`,
          hsn_code: "3303",
          shipping_mode: "Surface",
          weight: input.weightGrams / 1000,
          length: input.lengthCm,
          breadth: input.widthCm,
          height: input.heightCm,
          add_return_services: "1",
          return_reason: input.returnReason,
        },
      ],
    };

    const body = new URLSearchParams({ format: "json", data: JSON.stringify(payload) });
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
      return { waybill: "", trackingUrl: "", status: "failed", errorMessage: pkg?.remarks ?? "Return shipment creation failed" };
    }

    return {
      waybill: pkg.waybill,
      trackingUrl: `https://www.delhivery.com/track/package/${pkg.waybill}`,
      status: "created",
    };
  }

  async trackShipment(waybill: string): Promise<TrackingResult> {
    const res = await fetch(`${BASE_URL}/api/v1/packages/json/?waybill=${waybill}`, {
      headers: this.headers(),
    });
    if (!res.ok) return { waybill, status: "Unknown", statusDetail: "Tracking unavailable" };

    const data = (await res.json()) as {
      ShipmentData?: {
        Shipment?: {
          Status?: {
            Status?: string;
            StatusLocation?: string;
            StatusDateTime?: string;
            Instructions?: string;
          };
        };
      }[];
    };

    const s = data.ShipmentData?.[0]?.Shipment?.Status;
    return {
      waybill,
      status: s?.Status ?? "Unknown",
      statusDetail: s?.Instructions ?? s?.Status ?? "No details",
      scannedAt: s?.StatusDateTime ?? undefined,
      location: s?.StatusLocation ?? undefined,
    };
  }
}
