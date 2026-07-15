// Shiprocket API integration. Do not import outside logistics.service.ts.

// Thrown for errors that must not be retried (auth blocked, bad credentials)
export class ShiprocketUnrecoverableError extends Error {
  readonly unrecoverable = true;
  constructor(message: string) {
    super(message);
    this.name = "ShiprocketUnrecoverableError";
  }
}

import type {
  ILogisticsService,
  ServiceabilityResult,
  ShippingRateResult,
  CreateShipmentInput,
  ShipmentResult,
  TrackingResult,
} from "../logistics.service";
import { env } from "../../env";

const BASE = "https://apiv2.shiprocket.in/v1/external";

// ── Token cache ───────────────────────────────────────────────────────────────
// Token valid 10 days. Cache in memory; re-login on 401 or near-expiry.

let _token: string | null = null;
let _tokenExpiresAt = 0;

async function getToken(): Promise<string> {
  const nowMs = Date.now();
  // Refresh 1 hour before expiry
  if (_token && nowMs < _tokenExpiresAt - 60 * 60 * 1000) return _token;

  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: env.SHIPROCKET_EMAIL,
      password: env.SHIPROCKET_PASSWORD,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // 403 = account blocked / bad credentials — retrying login makes the block worse
    if (res.status === 403 || res.status === 401) {
      throw new ShiprocketUnrecoverableError(`[shiprocket] auth failed ${res.status}: ${text.slice(0, 200)}`);
    }
    throw new Error(`[shiprocket] auth failed ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { token?: string; expires_at?: string };
  if (!data.token) throw new Error("[shiprocket] auth response missing token");

  _token = data.token;
  // expires_at is ISO string; default 10 days if missing
  _tokenExpiresAt = data.expires_at
    ? new Date(data.expires_at).getTime()
    : nowMs + 10 * 24 * 60 * 60 * 1000;

  console.log("[shiprocket] token refreshed");
  return _token;
}

async function apiGet<T>(path: string): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (res.status === 401) {
    // Force token refresh on next call
    _token = null;
    throw new Error("[shiprocket] 401 — token expired, will retry");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`[shiprocket] GET ${path} failed ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    _token = null;
    throw new Error("[shiprocket] 401 — token expired, will retry");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`[shiprocket] POST ${path} failed ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export class ShiprocketProvider implements ILogisticsService {
  private readonly pickupLocation: string;
  private readonly channelId: number | undefined;
  private readonly warehousePincode: string;
  private readonly warehousePhone: string;
  private readonly warehouseCity: string;
  private readonly warehouseState: string;
  private readonly warehouseAddress: string;

  constructor() {
    // No placeholder defaults: a missing warehouse field would silently mis-serve
    // serviceability/rates. assertCriticalEnv catches this at boot; this guard
    // covers any other entry point.
    const required = {
      SHIPROCKET_PICKUP_LOCATION: env.SHIPROCKET_PICKUP_LOCATION,
      SHIPROCKET_WAREHOUSE_PINCODE: env.SHIPROCKET_WAREHOUSE_PINCODE,
      SHIPROCKET_WAREHOUSE_PHONE: env.SHIPROCKET_WAREHOUSE_PHONE,
      SHIPROCKET_WAREHOUSE_CITY: env.SHIPROCKET_WAREHOUSE_CITY,
      SHIPROCKET_WAREHOUSE_STATE: env.SHIPROCKET_WAREHOUSE_STATE,
      SHIPROCKET_WAREHOUSE_ADDRESS: env.SHIPROCKET_WAREHOUSE_ADDRESS,
    };
    const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length > 0) {
      throw new Error(`[shiprocket] missing env: ${missing.join(", ")}`);
    }

    this.pickupLocation = env.SHIPROCKET_PICKUP_LOCATION!;
    this.channelId = env.SHIPROCKET_CHANNEL_ID;
    this.warehousePincode = env.SHIPROCKET_WAREHOUSE_PINCODE!;
    this.warehousePhone = env.SHIPROCKET_WAREHOUSE_PHONE!;
    this.warehouseCity = env.SHIPROCKET_WAREHOUSE_CITY!;
    this.warehouseState = env.SHIPROCKET_WAREHOUSE_STATE!;
    this.warehouseAddress = env.SHIPROCKET_WAREHOUSE_ADDRESS!;
  }

  async checkServiceability(pincode: string): Promise<ServiceabilityResult> {
    try {
      type SvcResp = {
        data?: {
          available_courier_companies?: {
            is_surface?: number;
            estimated_delivery_days?: number;
            cod?: number;
          }[];
        };
      };
      const data = await apiGet<SvcResp>(
        `/courier/serviceability/?pickup_postcode=${this.warehousePincode}&delivery_postcode=${pincode}&weight=0.5&cod=0`,
      );
      const companies = data.data?.available_courier_companies ?? [];
      if (companies.length === 0) {
        return { serviceable: false, mode: null, estimatedDays: null, cod: false };
      }
      const best = companies[0]!;
      return {
        serviceable: true,
        mode: best.is_surface ? "Surface" : "Express",
        estimatedDays: best.estimated_delivery_days ?? null,
        cod: (best.cod ?? 0) === 1,
      };
    } catch (err) {
      console.error("[shiprocket] serviceability error:", err);
      return { serviceable: false, mode: null, estimatedDays: null, cod: false };
    }
  }

  async getShippingRate(destPincode: string, weightGrams: number): Promise<ShippingRateResult> {
    try {
      const weightKg = weightGrams / 1000;
      type RateResp = {
        data?: {
          available_courier_companies?: {
            rate?: number;
            freight_charge?: number;
            estimated_delivery_days?: number;
          }[];
        };
      };
      const data = await apiGet<RateResp>(
        `/courier/serviceability/?pickup_postcode=${this.warehousePincode}&delivery_postcode=${destPincode}&weight=${weightKg}&cod=0`,
      );
      const companies = data.data?.available_courier_companies ?? [];
      if (companies.length === 0) return { available: false, chargeInr: 0, estimatedDays: null };

      // Pick cheapest available courier
      const sorted = [...companies].sort(
        (a, b) => (a.rate ?? a.freight_charge ?? 999) - (b.rate ?? b.freight_charge ?? 999),
      );
      const best = sorted[0]!;
      const charge = best.rate ?? best.freight_charge ?? 0;
      return {
        available: charge > 0,
        chargeInr: Math.ceil(charge),
        estimatedDays: best.estimated_delivery_days ?? null,
      };
    } catch (err) {
      console.error("[shiprocket] rate error:", err);
      return { available: false, chargeInr: 0, estimatedDays: null };
    }
  }

  private async getCheapestCourierId(destPincode: string, weightGrams: number): Promise<number | null> {
    try {
      const weightKg = weightGrams / 1000;
      type CourierResp = {
        data?: {
          available_courier_companies?: {
            courier_company_id?: number;
            rate?: number;
            freight_charge?: number;
          }[];
        };
      };
      const data = await apiGet<CourierResp>(
        `/courier/serviceability/?pickup_postcode=${this.warehousePincode}&delivery_postcode=${destPincode}&weight=${weightKg}&cod=0`,
      );
      const companies = data.data?.available_courier_companies ?? [];
      if (companies.length === 0) return null;
      const sorted = [...companies].sort(
        (a, b) => (a.rate ?? a.freight_charge ?? 9999) - (b.rate ?? b.freight_charge ?? 9999),
      );
      return sorted[0]?.courier_company_id ?? null;
    } catch {
      return null;
    }
  }

  async createShipment(input: CreateShipmentInput): Promise<ShipmentResult> {
    // Step 1: Create order in Shiprocket
    type CreateOrderResp = {
      order_id?: number;
      shipment_id?: number;
      status?: string;
      status_code?: number;
      message?: string | string[];
    };

    const totalAmount = input.items.reduce((s, i) => s + i.price * i.qty, 0);
    const orderDate = new Date().toISOString().split("T")[0]!;

    const orderPayload = {
      order_id: input.orderNumber,
      order_date: orderDate,
      pickup_location: this.pickupLocation,
      ...(this.channelId ? { channel_id: this.channelId } : {}),
      billing_customer_name: input.customerName,
      billing_last_name: "",
      billing_address: input.address.line1 + (input.address.line2 ? ` ${input.address.line2}` : ""),
      billing_city: input.address.city,
      billing_pincode: input.address.pincode,
      billing_state: input.address.state,
      billing_country: "India",
      billing_email: input.customerEmail ?? "",
      billing_phone: input.customerPhone,
      shipping_is_billing: true,
      order_items: input.items.map((item) => ({
        name: item.name,
        sku: item.sku,
        units: item.qty,
        selling_price: item.price,
        discount: 0,
        tax: 0,
        hsn: 3303, // perfume HSN
      })),
      payment_method: "Prepaid", // always — Razorpay already collected
      sub_total: totalAmount,
      length: input.lengthCm,
      breadth: input.widthCm,
      height: input.heightCm,
      weight: input.weightGrams / 1000, // Shiprocket expects kg
    };

    let shiprocketOrderId: number;
    let shipmentId: number;

    try {
      const orderResp = await apiPost<CreateOrderResp>("/orders/create/adhoc", orderPayload);

      if (!orderResp.order_id || !orderResp.shipment_id) {
        const rawMsg = Array.isArray(orderResp.message)
          ? orderResp.message.join(", ")
          : (orderResp.message ?? "Order creation failed");

        // Shiprocket returns 422 "order already exists" on retry — fetch existing order instead
        if (rawMsg.toLowerCase().includes("already") || rawMsg.toLowerCase().includes("exists") || orderResp.status_code === 422) {
          console.warn(`[shiprocket] order ${input.orderNumber} already exists in Shiprocket, fetching existing`);
          type ListResp = { data?: { order_id?: number; shipment_id?: number }[] };
          const existing = await apiGet<ListResp>(`/orders/processing?filter_by=order_id&filter=${encodeURIComponent(input.orderNumber)}`);
          const found = existing.data?.[0];
          if (found?.order_id && found?.shipment_id) {
            shiprocketOrderId = found.order_id;
            shipmentId = found.shipment_id;
          } else {
            return { waybill: "", trackingUrl: "", status: "failed", errorMessage: `Duplicate order — could not fetch existing: ${rawMsg}` };
          }
        } else {
          console.error(`[shiprocket] order create failed:`, JSON.stringify(orderResp));
          return { waybill: "", trackingUrl: "", status: "failed", errorMessage: rawMsg };
        }
      } else {
        shiprocketOrderId = orderResp.order_id;
        shipmentId = orderResp.shipment_id;
      }
    } catch (err) {
      return { waybill: "", trackingUrl: "", status: "failed", errorMessage: String(err) };
    }

    // Step 2: Assign AWB (auto-assign best courier)
    type AwbResp = {
      awb_assign_status?: number;
      response?: {
        data?: {
          awb_code?: string;
          courier_name?: string;
          awb_assign_error?: string;
          etd?: string;
          others?: unknown;
        };
        status?: number;
        error?: string;
      };
      message?: string | null;
      status_code?: number;
    };

    // Pick cheapest courier explicitly — Shiprocket auto-assign picks "Recommended" (most expensive)
    const cheapestCourierId = await this.getCheapestCourierId(input.address.pincode, input.weightGrams);
    console.log(`[shiprocket] cheapest courier_id=${cheapestCourierId ?? "auto"} for pincode=${input.address.pincode}`);

    try {
      const awbResp = await apiPost<AwbResp>("/courier/assign/awb", {
        shipment_id: shipmentId,
        ...(cheapestCourierId ? { courier_id: cheapestCourierId } : {}),
      });

      const awbCode = awbResp.response?.data?.awb_code;
      if (!awbCode || awbResp.awb_assign_status !== 1) {
        // Extract the deepest available error message
        const errMsg =
          awbResp.response?.data?.awb_assign_error ||
          awbResp.message ||
          awbResp.response?.error ||
          `AWB assignment failed (status=${awbResp.awb_assign_status ?? "?"})`;
        console.error(`[shiprocket] AWB assign failed for shipment ${shipmentId}:`, JSON.stringify(awbResp));
        return {
          waybill: "",
          trackingUrl: "",
          status: "failed",
          errorMessage: errMsg,
        };
      }

      // Step 3: Request pickup
      await apiPost("/courier/generate/pickup", {
        shipment_id: [shipmentId],
      }).catch((err) => {
        // Pickup scheduling failure is non-fatal — Shiprocket will schedule it
        console.warn(`[shiprocket] pickup schedule failed for ${awbCode}:`, err);
      });

      const etd = awbResp.response?.data?.etd ?? undefined;
      console.log(`[shiprocket] Order ${input.orderNumber} → AWB=${awbCode} courier=${awbResp.response?.data?.courier_name} ETD=${etd ?? "unknown"}`);

      return {
        waybill: awbCode,
        trackingUrl: `https://shiprocket.co/tracking/${awbCode}`,
        estimatedDeliveryDate: etd,
        status: "created",
      };
    } catch (err) {
      return { waybill: "", trackingUrl: "", status: "failed", errorMessage: String(err) };
    }
  }

  async trackShipment(waybill: string): Promise<TrackingResult> {
    try {
      type TrackResp = {
        tracking_data?: {
          track_status?: number;
          shipment_track?: { current_status?: string; delivered_date?: string }[];
          shipment_track_activities?: {
            date?: string;
            activity?: string;
            location?: string;
          }[];
        };
      };
      const data = await apiGet<TrackResp>(`/courier/track/awb/${waybill}`);
      const track = data.tracking_data;
      const latest = track?.shipment_track?.[0];
      const activities = track?.shipment_track_activities ?? [];
      const latestActivity = activities[0];

      return {
        waybill,
        status: latest?.current_status ?? "Unknown",
        statusDetail: latestActivity?.activity ?? latest?.current_status ?? "No details",
        scannedAt: latestActivity?.date ?? undefined,
        location: latestActivity?.location ?? undefined,
      };
    } catch (err) {
      console.error("[shiprocket] track error:", err);
      return { waybill, status: "Unknown", statusDetail: "Tracking unavailable" };
    }
  }

  async cancelShipment(waybill: string): Promise<{ cancelled: boolean; message?: string }> {
    try {
      type CancelResp = { message?: string; status?: number; status_code?: number };
      const resp = await apiPost<CancelResp>("/orders/cancel/shipment/awbs", { awbs: [waybill] });
      const msg = resp.message ?? "Cancelled";
      console.log(`[shiprocket] cancelShipment waybill=${waybill}: ${msg}`);
      return { cancelled: true, message: msg };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[shiprocket] cancelShipment failed for ${waybill}:`, msg);
      return { cancelled: false, message: msg };
    }
  }
}
