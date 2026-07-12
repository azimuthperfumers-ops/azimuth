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
  CreateReturnShipmentInput,
  ExchangeShipmentResult,
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
  private readonly locationId: string | undefined;

  constructor() {
    this.pickupLocation = env.SHIPROCKET_PICKUP_LOCATION ?? "Primary";
    this.channelId = env.SHIPROCKET_CHANNEL_ID;
    this.warehousePincode = env.SHIPROCKET_WAREHOUSE_PINCODE ?? "110001";
    this.warehousePhone = env.SHIPROCKET_WAREHOUSE_PHONE ?? "";
    this.warehouseCity = env.SHIPROCKET_WAREHOUSE_CITY ?? "";
    this.warehouseState = env.SHIPROCKET_WAREHOUSE_STATE ?? "";
    this.warehouseAddress = env.SHIPROCKET_WAREHOUSE_ADDRESS ?? "Warehouse";
    this.locationId = env.SHIPROCKET_LOCATION_ID;
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

  // Assign a reverse AWB to a return shipment. Shiprocket's create/return response
  // does NOT include an AWB — "Generate AWB for Return Shipment" is a separate call:
  // /courier/assign/awb with is_return: 1.
  private async assignReturnAwb(shipmentId: number): Promise<{ awb?: string; error?: string }> {
    type AwbResp = {
      awb_assign_status?: number;
      response?: {
        data?: { awb_code?: string; awb_assign_error?: string };
        error?: string;
      };
      message?: string | null;
    };
    try {
      const resp = await apiPost<AwbResp>("/courier/assign/awb", {
        shipment_id: shipmentId,
        is_return: 1,
      });
      const awb = resp.response?.data?.awb_code;
      if (awb) return { awb };
      return {
        error:
          resp.response?.data?.awb_assign_error ||
          resp.message ||
          resp.response?.error ||
          `Return AWB assignment failed (status=${resp.awb_assign_status ?? "?"})`,
      };
    } catch (err) {
      return { error: String(err) };
    }
  }

  async createReturnShipment(input: CreateReturnShipmentInput): Promise<ShipmentResult> {
    type ReturnResp = {
      order_id?: number;
      shipment_id?: number;
      return_order_id?: number;
      return_shipment_id?: number;
      awb_code?: string;
      status?: string;
      message?: string | string[];
    };

    try {
      const resp = await apiPost<ReturnResp>("/orders/create/return", {
        order_id: `RET-${input.originalOrderNumber}`,
        order_date: new Date().toISOString().split("T")[0],
        channel_id: this.channelId,
        pickup_customer_name: input.customerName,
        pickup_phone: input.customerPhone,
        pickup_address: input.pickupAddress.line1 + (input.pickupAddress.line2 ? ` ${input.pickupAddress.line2}` : ""),
        pickup_city: input.pickupAddress.city,
        pickup_state: input.pickupAddress.state,
        pickup_country: "India",
        pickup_pincode: input.pickupAddress.pincode,
        shipping_customer_name: "Azimuth Perfumers",
        shipping_phone: this.warehousePhone,
        shipping_address: this.warehouseAddress,
        shipping_city: this.warehouseCity,
        shipping_state: this.warehouseState,
        shipping_country: "India",
        shipping_pincode: this.warehousePincode,
        payment_method: "Prepaid",
        sub_total: 0,
        return_reason: input.returnReason,
        pickup_date: input.pickupDate ?? new Date(Date.now() + 86400000).toISOString().split("T")[0],
        order_items: [{ name: "Return", sku: `RET-${input.originalOrderNumber}`, units: 1, selling_price: 0 }],
        length: input.lengthCm,
        breadth: input.widthCm,
        height: input.heightCm,
        weight: input.weightGrams / 1000,
      });

      // Some responses include the AWB directly; otherwise assign it in a second
      // step against the return shipment_id (the documented flow).
      let awb = resp.awb_code;
      if (!awb) {
        const shipmentId = resp.shipment_id ?? resp.return_shipment_id;
        if (!shipmentId) {
          const msg = Array.isArray(resp.message)
            ? resp.message.join(", ")
            : (resp.message ?? "Return order creation failed — no shipment_id in response");
          return { waybill: "", trackingUrl: "", status: "failed", errorMessage: msg };
        }
        const assigned = await this.assignReturnAwb(shipmentId);
        if (!assigned.awb) {
          return { waybill: "", trackingUrl: "", status: "failed", errorMessage: `Return created (shipment ${shipmentId}) but AWB assignment failed: ${assigned.error}` };
        }
        awb = assigned.awb;
      }

      return {
        waybill: awb,
        trackingUrl: `https://shiprocket.co/tracking/${awb}`,
        status: "created",
      };
    } catch (err) {
      return { waybill: "", trackingUrl: "", status: "failed", errorMessage: String(err) };
    }
  }

  async createExchangeShipment(
    input: CreateReturnShipmentInput & { items: { name: string; sku: string; units: number; price: number }[] },
  ): Promise<ExchangeShipmentResult> {
    type ExchangeResp = {
      success?: boolean;
      message?: string | string[];
      data?: {
        forward_orders?: { order_id?: number; shipment_id?: number; awb_code?: string };
        return_orders?: { order_id?: number; shipment_id?: number; awb_code?: string };
      };
    };

    try {
      const nameParts = input.customerName.trim().split(" ");
      const firstName = nameParts[0] ?? input.customerName;
      const lastName = nameParts.slice(1).join(" ") || firstName;

      const addr = input.pickupAddress.line1 + (input.pickupAddress.line2 ? ` ${input.pickupAddress.line2}` : "");
      const weightKg = input.weightGrams / 1000;
      const subTotal = input.items.reduce((s, i) => s + i.price * i.units, 0);

      const resp = await apiPost<ExchangeResp>("/orders/create/exchange", {
        exchange_order_id: `EX-${input.originalOrderNumber}`,
        return_order_id: `R-${input.originalOrderNumber}`,
        order_date: new Date().toISOString().split("T")[0],
        channel_id: this.channelId,
        payment_method: "prepaid",

        // pickup = collect return from customer
        buyer_pickup_first_name: firstName,
        buyer_pickup_last_name: lastName,
        buyer_pickup_address: addr,
        buyer_pickup_address_2: "",
        buyer_pickup_city: input.pickupAddress.city,
        buyer_pickup_state: input.pickupAddress.state,
        buyer_pickup_country: "India",
        buyer_pickup_pincode: input.pickupAddress.pincode,
        buyer_pickup_phone: input.customerPhone,

        // shipping = deliver replacement to customer (same address)
        buyer_shipping_first_name: firstName,
        buyer_shipping_last_name: lastName,
        buyer_shipping_address: addr,
        buyer_shipping_address_2: "",
        buyer_shipping_city: input.pickupAddress.city,
        buyer_shipping_state: input.pickupAddress.state,
        buyer_shipping_country: "India",
        buyer_shipping_pincode: input.pickupAddress.pincode,
        buyer_shipping_phone: input.customerPhone,

        seller_pickup_location_id: this.locationId,
        seller_shipping_location_id: this.locationId,

        sub_total: subTotal,
        total_discount: 0,
        return_reason: "29",
        qc_check: "true",

        order_items: input.items.map((i) => ({
          name: i.name,
          sku: i.sku,
          units: i.units,
          selling_price: String(i.price),
          hsn: 3303,
          exchange_item_name: i.name,
          exchange_item_sku: i.sku,
        })),

        // return package dims
        return_length: input.lengthCm,
        return_breadth: input.widthCm,
        return_height: input.heightCm,
        return_weight: weightKg,

        // exchange (forward) package dims — same product
        exchange_length: input.lengthCm,
        exchange_breadth: input.widthCm,
        exchange_height: input.heightCm,
        exchange_weight: weightKg,
      });

      if (!resp.success || !resp.data) {
        const msg = Array.isArray(resp.message) ? resp.message.join(", ") : (resp.message ?? "Exchange shipment failed");
        return { status: "failed", errorMessage: msg };
      }

      let returnAwb = resp.data.return_orders?.awb_code?.trim() || undefined;
      const forwardAwb = resp.data.forward_orders?.awb_code?.trim() || undefined;

      // Exchange creation may not assign the reverse AWB inline — without it the
      // return-leg webhook can never be matched to the order, so assign explicitly.
      const returnShipId = resp.data.return_orders?.shipment_id;
      if (!returnAwb && returnShipId) {
        const assigned = await this.assignReturnAwb(returnShipId);
        if (assigned.awb) {
          returnAwb = assigned.awb;
        } else {
          console.warn(`[shiprocket] exchange return AWB assignment failed for shipment ${returnShipId}: ${assigned.error}`);
        }
      }
      if (returnAwb) console.log(`[shiprocket] exchange return AWB=${returnAwb}`);
      if (forwardAwb) console.log(`[shiprocket] exchange forward AWB=${forwardAwb}`);

      return {
        status: "created",
        returnOrderId: resp.data.return_orders?.order_id,
        forwardOrderId: resp.data.forward_orders?.order_id,
        returnShipmentId: resp.data.return_orders?.shipment_id,
        forwardShipmentId: resp.data.forward_orders?.shipment_id,
        returnAwb,
        forwardAwb,
      };
    } catch (err) {
      return { status: "failed", errorMessage: String(err) };
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
