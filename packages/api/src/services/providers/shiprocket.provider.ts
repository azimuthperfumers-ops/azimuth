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
import { MIN_BILLABLE_GRAMS } from "../packaging";
import { cacheGet, cacheSet, cacheDel } from "@azimuth/redis";

const BASE = "https://apiv2.shiprocket.in/v1/external";

// ── Serviceability response ───────────────────────────────────────────────────

type ServiceabilityResp = {
  data?: {
    available_courier_companies?: {
      courier_company_id?: number;
      courier_name?: string;
      is_surface?: number;
      rate?: number;
      freight_charge?: number;
      estimated_delivery_days?: number;
      cod?: number;
    }[];
  };
};

type SurfaceCourier = {
  courierCompanyId: number | null;
  courierName: string;
  rate: number;
  estimatedDays: number | null;
  cod: boolean;
};

// ── Token cache ───────────────────────────────────────────────────────────────
// Token valid ~10 days. Cached in-process AND in Redis so a server restart
// reuses the existing token instead of logging in again — a login storm across
// restarts is what trips Shiprocket's "too many failed login attempts" lockout.

const TOKEN_CACHE_KEY = "shiprocket:auth-token";
const AUTH_COOLDOWN_MS = 15 * 60 * 1000;

let _token: string | null = null;
let _tokenExpiresAt = 0;
// After an unrecoverable auth failure (bad creds / lockout) we stop attempting
// login until this timestamp — retrying only renews Shiprocket's block.
let _authBlockedUntil = 0;

async function getToken(): Promise<string> {
  const nowMs = Date.now();
  // In-memory token still fresh? (refresh 1h before expiry)
  if (_token && nowMs < _tokenExpiresAt - 60 * 60 * 1000) return _token;

  // Reuse a Redis-persisted token across restarts before logging in again.
  if (!_token) {
    const cached = await cacheGet(TOKEN_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as { token: string; expiresAt: number };
        if (parsed.token && nowMs < parsed.expiresAt - 60 * 60 * 1000) {
          _token = parsed.token;
          _tokenExpiresAt = parsed.expiresAt;
          return _token;
        }
      } catch {
        // corrupt entry — fall through to a fresh login
      }
    }
  }

  // Don't hammer the login endpoint during a known lockout cooldown.
  if (nowMs < _authBlockedUntil) {
    throw new ShiprocketUnrecoverableError(
      `[shiprocket] auth in cooldown until ${new Date(_authBlockedUntil).toISOString()} — skipping login`,
    );
  }

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
    // Unrecoverable by retry: 401/403 (bad credentials) OR a 400 lockout
    // ("User blocked due to too many failed login attempts"). Retrying login
    // only deepens/renews the block, so back off for a cooldown window and let
    // Shiprocket's block expire on its own.
    const lockedOut = /blocked|too many failed login/i.test(text);
    if (res.status === 401 || res.status === 403 || (res.status === 400 && lockedOut)) {
      _authBlockedUntil = Date.now() + AUTH_COOLDOWN_MS;
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
  _authBlockedUntil = 0; // successful login clears any prior cooldown

  // Persist for other processes / restarts; TTL kept ~1h under real expiry.
  const ttlSeconds = Math.max(60, Math.floor((_tokenExpiresAt - nowMs) / 1000) - 3600);
  await cacheSet(TOKEN_CACHE_KEY, JSON.stringify({ token: _token, expiresAt: _tokenExpiresAt }), ttlSeconds);

  console.log("[shiprocket] token refreshed");
  return _token;
}

async function apiGet<T>(path: string): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (res.status === 401) {
    // Force token refresh on next call — drop both in-memory and Redis copies
    // so a stale persisted token can't 401 in a loop.
    _token = null;
    await cacheDel(TOKEN_CACHE_KEY);
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
    await cacheDel(TOKEN_CACHE_KEY);
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

  // Surface couriers for one parcel, cheapest first.
  //
  // Perfume is a flammable/hazmat good — air cargo is not an option, so every
  // quote, serviceability check and AWB assignment is filtered to is_surface=1.
  // Shiprocket has no request-side mode filter, so the response is filtered here;
  // an empty list means "not deliverable by surface", not "not deliverable".
  private async getSurfaceCouriers(destPincode: string, weightGrams: number): Promise<SurfaceCourier[]> {
    const weightKg = weightGrams / 1000;
    const data = await apiGet<ServiceabilityResp>(
      `/courier/serviceability/?pickup_postcode=${this.warehousePincode}&delivery_postcode=${destPincode}&weight=${weightKg}&cod=0`,
    );
    const companies = data.data?.available_courier_companies ?? [];
    return companies
      .filter((c) => Number(c.is_surface ?? 0) === 1)
      .map((c) => ({
        courierCompanyId: c.courier_company_id ?? null,
        courierName: c.courier_name ?? "",
        rate: c.rate ?? c.freight_charge ?? 0,
        estimatedDays: c.estimated_delivery_days ?? null,
        cod: Number(c.cod ?? 0) === 1,
      }))
      .sort((a, b) => a.rate - b.rate);
  }

  async checkServiceability(pincode: string): Promise<ServiceabilityResult> {
    try {
      const couriers = await this.getSurfaceCouriers(pincode, MIN_BILLABLE_GRAMS);
      const best = couriers[0];
      if (!best) return { serviceable: false, mode: null, estimatedDays: null, cod: false };
      return {
        serviceable: true,
        mode: "Surface",
        estimatedDays: best.estimatedDays,
        cod: best.cod,
      };
    } catch (err) {
      console.error("[shiprocket] serviceability error:", err);
      return { serviceable: false, mode: null, estimatedDays: null, cod: false };
    }
  }

  async getShippingRate(destPincode: string, weightGrams: number): Promise<ShippingRateResult> {
    try {
      const couriers = await this.getSurfaceCouriers(destPincode, weightGrams);
      const best = couriers[0];
      if (!best) return { available: false, chargeInr: 0, estimatedDays: null };
      return {
        available: best.rate > 0,
        chargeInr: Math.ceil(best.rate),
        estimatedDays: best.estimatedDays,
      };
    } catch (err) {
      console.error("[shiprocket] rate error:", err);
      return { available: false, chargeInr: 0, estimatedDays: null };
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

    // Always assign an explicit courier: Shiprocket's auto-assign picks its
    // "Recommended" courier, which is both pricier and free to be an air service.
    // Perfume cannot fly, so no-surface-courier is a hard failure — never fall
    // back to auto-assign.
    let surfaceCourier: SurfaceCourier | undefined;
    try {
      const couriers = await this.getSurfaceCouriers(input.address.pincode, input.weightGrams);
      surfaceCourier = couriers[0];
    } catch (err) {
      return { waybill: "", trackingUrl: "", status: "failed", errorMessage: `Surface courier lookup failed: ${String(err)}` };
    }

    if (!surfaceCourier?.courierCompanyId) {
      const msg = `No surface courier available for pincode ${input.address.pincode} at ${input.weightGrams}g — perfume cannot ship by air`;
      console.error(`[shiprocket] ${msg}`);
      return { waybill: "", trackingUrl: "", status: "failed", errorMessage: msg };
    }

    console.log(
      `[shiprocket] surface courier_id=${surfaceCourier.courierCompanyId} (${surfaceCourier.courierName}) for pincode=${input.address.pincode}`,
    );

    try {
      const awbResp = await apiPost<AwbResp>("/courier/assign/awb", {
        shipment_id: shipmentId,
        courier_id: surfaceCourier.courierCompanyId,
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
        courierName: awbResp.response?.data?.courier_name ?? surfaceCourier.courierName,
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
