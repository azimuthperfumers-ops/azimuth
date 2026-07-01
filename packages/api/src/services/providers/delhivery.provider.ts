// Delhivery Express B2C API. Do not import outside logistics.service.ts.
// Base URLs: staging-express.delhivery.com (test) | express.delhivery.com (prod)
// Auth: Authorization: Token <token>
// Shipment create: POST /api/cmu/create.json  body=form: format=json&data=<json>

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

export class DelhiveryProvider implements ILogisticsService {
  private readonly base: string;
  private readonly token: string;
  private readonly pickupName: string;       // registered pickup location name on Delhivery
  private readonly warehousePincode: string;
  private readonly warehousePhone: string;
  private readonly warehouseCity: string;
  private readonly warehouseState: string;
  private readonly warehouseAddress: string;
  private readonly warehouseName: string;

  constructor() {
    this.base = (env.DELHIVERY_BASE_URL ?? "https://staging-express.delhivery.com").replace(/\/$/, "");
    this.token = env.DELHIVERY_TOKEN ?? "";
    this.pickupName = env.DELHIVERY_PICKUP_NAME ?? "AZIMUTH SURFACE";
    this.warehousePincode = env.DELHIVERY_WAREHOUSE_PINCODE ?? "305005";
    this.warehousePhone = env.DELHIVERY_WAREHOUSE_PHONE ?? "";
    this.warehouseCity = env.DELHIVERY_WAREHOUSE_CITY ?? "Ajmer";
    this.warehouseState = env.DELHIVERY_WAREHOUSE_STATE ?? "Rajasthan";
    this.warehouseAddress = env.DELHIVERY_WAREHOUSE_ADDRESS ?? "";
    this.warehouseName = env.DELHIVERY_WAREHOUSE_NAME ?? "Azimuth Perfumers";
  }

  private headers() {
    return { Authorization: `Token ${this.token}` };
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.base}${path}`, { headers: this.headers() });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`[delhivery] GET ${path} ${res.status}: ${text.slice(0, 300)}`);
    }
    return res.json() as Promise<T>;
  }

  // Delhivery create/edit endpoints use multipart form: format=json&data=<json_string>
  private async postForm<T>(path: string, payload: unknown): Promise<T> {
    const body = new URLSearchParams({ format: "json", data: JSON.stringify(payload) });
    const res = await fetch(`${this.base}${path}`, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`[delhivery] POST ${path} ${res.status}: ${text.slice(0, 300)}`);
    }
    return res.json() as Promise<T>;
  }

  // ── Serviceability ─────────────────────────────────────────────────────────

  async checkServiceability(pincode: string): Promise<ServiceabilityResult> {
    try {
      type PinResp = {
        delivery_codes?: {
          postal_code?: { pin?: number; pre_paid?: string; cod?: string; pickup?: string };
        }[];
      };
      const data = await this.get<PinResp>(`/c/api/pin-codes/json/?filter_codes=${pincode}`);
      const entry = data.delivery_codes?.[0]?.postal_code;
      if (!entry || entry.pre_paid !== "Y") {
        return { serviceable: false, mode: null, estimatedDays: null, cod: false };
      }
      return {
        serviceable: true,
        mode: "Surface",
        estimatedDays: null,
        cod: entry.cod === "Y",
      };
    } catch (err) {
      console.error("[delhivery] serviceability error:", err);
      return { serviceable: false, mode: null, estimatedDays: null, cod: false };
    }
  }

  // ── Shipping rate ──────────────────────────────────────────────────────────
  // Endpoint: GET /api/kinko/v1/invoice/charges/.json
  // Params: md=S (surface)|E (express), ss=Delivered, d_pin, o_pin, cgm (grams), pt=Pre-paid, cod=0

  async getShippingRate(destPincode: string, weightGrams: number): Promise<ShippingRateResult> {
    try {
      type RateResp = {
        total_amount?: number;
        freight_charge?: number;
        error?: string;
      };
      const params = new URLSearchParams({
        md: "S",
        ss: "Delivered",
        d_pin: destPincode,
        o_pin: this.warehousePincode,
        cgm: String(weightGrams),
        pt: "Pre-paid",
        cod: "0",
      });
      const data = await this.get<RateResp>(`/api/kinko/v1/invoice/charges/.json?${params}`);
      const charge = data.total_amount ?? data.freight_charge ?? 0;
      if (charge === 0 && env.DELHIVERY_RATE_FALLBACK_INR) {
        return { available: true, chargeInr: env.DELHIVERY_RATE_FALLBACK_INR, estimatedDays: null };
      }
      return {
        available: charge > 0,
        chargeInr: Math.ceil(charge),
        estimatedDays: null,
      };
    } catch (err) {
      console.error("[delhivery] rate error:", err);
      return { available: false, chargeInr: 0, estimatedDays: null };
    }
  }

  // ── Forward shipment creation ──────────────────────────────────────────────
  // POST /api/cmu/create.json  (form-encoded: format=json&data=<shipment_json>)
  // On success: packages[0].status === "Success" and packages[0].waybill is set

  async createShipment(input: CreateShipmentInput): Promise<ShipmentResult> {
    type CreateResp = {
      packages?: { status?: string; waybill?: string; refnum?: string; remarks?: string[] }[];
      success?: boolean;
      error?: string;
    };

    const totalAmount = input.items.reduce((s, i) => s + i.price * i.qty, 0);
    const fullAddress = input.address.line1 + (input.address.line2 ? ` ${input.address.line2}` : "");

    const payload = {
      shipments: [
        {
          name: input.customerName,
          add: fullAddress,
          pin: input.address.pincode,
          city: input.address.city,
          state: input.address.state,
          country: "India",
          phone: input.customerPhone,
          order: input.orderNumber,
          payment_mode: "Prepaid",
          // return address = warehouse (if courier cannot deliver)
          return_pin: this.warehousePincode,
          return_city: this.warehouseCity,
          return_phone: this.warehousePhone,
          return_add: this.warehouseAddress,
          return_name: this.warehouseName,
          return_state: this.warehouseState,
          return_country: "India",
          products_desc: input.items.map((i) => i.name).join(", "),
          hsn_code: "3303",
          cod_amount: String(input.codAmount ?? 0),
          order_date: null,
          total_amount: String(totalAmount),
          seller_add: this.warehouseAddress,
          seller_name: this.warehouseName,
          seller_inv: input.orderNumber,
          quantity: String(input.items.reduce((s, i) => s + i.qty, 0)),
          waybill: "",
          shipment_width: input.widthCm,
          shipment_height: input.heightCm,
          weight: input.weightGrams / 1000,
          shipment_length: input.lengthCm,
          fragile_shipment: false,
        },
      ],
      pickup_location: { name: this.pickupName },
    };

    try {
      const resp = await this.postForm<CreateResp>("/api/cmu/create.json", payload);
      const pkg = resp.packages?.[0];
      if (!pkg?.waybill || pkg.status !== "Success") {
        const msg = pkg?.remarks?.filter(Boolean).join(", ") ?? resp.error ?? "Shipment creation failed";
        console.error("[delhivery] createShipment failed:", JSON.stringify(resp));
        return { waybill: "", trackingUrl: "", status: "failed", errorMessage: msg };
      }
      console.log(`[delhivery] order ${input.orderNumber} → waybill=${pkg.waybill}`);
      return {
        waybill: pkg.waybill,
        trackingUrl: `https://www.delhivery.com/track/package/${pkg.waybill}`,
        status: "created",
      };
    } catch (err) {
      return { waybill: "", trackingUrl: "", status: "failed", errorMessage: String(err) };
    }
  }

  // ── Tracking ───────────────────────────────────────────────────────────────
  // GET /api/v1/packages/json/?waybill={waybill}&verbose=false

  async trackShipment(waybill: string): Promise<TrackingResult> {
    try {
      type TrackResp = {
        ShipmentData?: {
          Shipment?: {
            AWB?: string;
            Status?: {
              Status?: string;
              StatusType?: string;
              StatusDateTime?: string;
              StatusLocation?: string;
              Instructions?: string;
            };
            Scans?: {
              ScanDetail?: {
                Scan?: string;
                ScanType?: string;
                ScanDateTime?: string;
                ScannedLocation?: string;
                Instructions?: string;
              };
            }[];
          };
        }[];
      };
      const data = await this.get<TrackResp>(`/api/v1/packages/json/?waybill=${waybill}&verbose=false`);
      const shipment = data.ShipmentData?.[0]?.Shipment;
      const status = shipment?.Status;
      const latestScan = shipment?.Scans?.[0]?.ScanDetail;
      return {
        waybill,
        status: status?.Status ?? "Unknown",
        statusDetail: latestScan?.Instructions ?? latestScan?.Scan ?? status?.Instructions ?? status?.Status ?? "No details",
        scannedAt: latestScan?.ScanDateTime ?? status?.StatusDateTime ?? undefined,
        location: latestScan?.ScannedLocation ?? status?.StatusLocation ?? undefined,
      };
    } catch (err) {
      console.error("[delhivery] track error:", err);
      return { waybill, status: "Unknown", statusDetail: "Tracking unavailable" };
    }
  }

  // ── Return (reverse) shipment ──────────────────────────────────────────────
  // Same create.json endpoint but addresses are swapped:
  //   delivery address = warehouse, seller/origin = customer
  //   pickup_location is still our registered location (Delhivery creates a reverse task)

  async createReturnShipment(input: CreateReturnShipmentInput): Promise<ShipmentResult> {
    type CreateResp = {
      packages?: { status?: string; waybill?: string; remarks?: string[] }[];
      success?: boolean;
      error?: string;
    };

    const customerAddress =
      input.pickupAddress.line1 + (input.pickupAddress.line2 ? ` ${input.pickupAddress.line2}` : "");

    const payload = {
      shipments: [
        {
          // destination = warehouse
          name: this.warehouseName,
          add: this.warehouseAddress,
          pin: this.warehousePincode,
          city: this.warehouseCity,
          state: this.warehouseState,
          country: "India",
          phone: this.warehousePhone,
          order: `RET-${input.originalOrderNumber}`,
          payment_mode: "Prepaid",
          // return address = customer (for failed reverse pickup)
          return_pin: input.pickupAddress.pincode,
          return_city: input.pickupAddress.city,
          return_phone: input.customerPhone,
          return_add: customerAddress,
          return_name: input.customerName,
          return_state: input.pickupAddress.state,
          return_country: "India",
          products_desc: `Return - ${input.returnReason}`,
          hsn_code: "3303",
          cod_amount: "0",
          order_date: null,
          total_amount: "0",
          // seller = customer (origin of the reverse shipment)
          seller_add: customerAddress,
          seller_name: input.customerName,
          seller_inv: `RET-${input.originalOrderNumber}`,
          quantity: "1",
          waybill: "",
          shipment_width: input.widthCm,
          shipment_height: input.heightCm,
          weight: input.weightGrams / 1000,
          shipment_length: input.lengthCm,
          fragile_shipment: false,
        },
      ],
      pickup_location: { name: this.pickupName },
    };

    try {
      const resp = await this.postForm<CreateResp>("/api/cmu/create.json", payload);
      const pkg = resp.packages?.[0];
      if (!pkg?.waybill || pkg.status !== "Success") {
        const msg = pkg?.remarks?.filter(Boolean).join(", ") ?? resp.error ?? "Return shipment creation failed";
        return { waybill: "", trackingUrl: "", status: "failed", errorMessage: msg };
      }
      console.log(`[delhivery] return ${input.originalOrderNumber} → waybill=${pkg.waybill}`);
      return {
        waybill: pkg.waybill,
        trackingUrl: `https://www.delhivery.com/track/package/${pkg.waybill}`,
        status: "created",
      };
    } catch (err) {
      return { waybill: "", trackingUrl: "", status: "failed", errorMessage: String(err) };
    }
  }

  // ── Exchange shipment ──────────────────────────────────────────────────────
  // Return leg first (customer → warehouse), then forward leg (warehouse → customer)

  async createExchangeShipment(
    input: CreateReturnShipmentInput & { items: { name: string; sku: string; units: number; price: number }[] },
  ): Promise<ExchangeShipmentResult> {
    const returnResult = await this.createReturnShipment(input);
    if (returnResult.status === "failed") {
      return { status: "failed", errorMessage: `Return leg: ${returnResult.errorMessage}` };
    }

    const forwardInput: CreateShipmentInput = {
      orderNumber: `EX-${input.originalOrderNumber}`,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      address: input.pickupAddress,
      items: input.items.map((i) => ({ name: i.name, sku: i.sku, qty: i.units, price: i.price })),
      codAmount: 0,
      weightGrams: input.weightGrams,
      lengthCm: input.lengthCm,
      widthCm: input.widthCm,
      heightCm: input.heightCm,
    };

    const forwardResult = await this.createShipment(forwardInput);
    if (forwardResult.status === "failed") {
      return {
        status: "failed",
        errorMessage: `Forward leg: ${forwardResult.errorMessage} (return AWB=${returnResult.waybill} — cancel manually if needed)`,
      };
    }

    return {
      status: "created",
      returnAwb: returnResult.waybill,
      forwardAwb: forwardResult.waybill,
    };
  }

  // ── Cancel ─────────────────────────────────────────────────────────────────
  // POST /api/p/edit?waybill={waybill}&cancellation=true

  async cancelShipment(waybill: string): Promise<{ cancelled: boolean; message?: string }> {
    try {
      const res = await fetch(`${this.base}/api/p/edit?waybill=${waybill}&cancellation=true`, {
        method: "POST",
        headers: this.headers(),
      });
      const text = await res.text().catch(() => "");
      if (!res.ok) {
        return { cancelled: false, message: `HTTP ${res.status}: ${text.slice(0, 200)}` };
      }
      console.log(`[delhivery] cancel waybill=${waybill}: ${text.slice(0, 100)}`);
      return { cancelled: true, message: "Cancellation requested" };
    } catch (err) {
      return { cancelled: false, message: String(err) };
    }
  }

  // ── Pickup request ─────────────────────────────────────────────────────────
  // POST /fm/request/new/  — call after creating shipments to schedule a pickup slot
  // Returns: { pickup_id, status, ... }

  async schedulePickup(packageCount: number, pickupTime?: string): Promise<void> {
    const time =
      pickupTime ??
      (() => {
        const d = new Date();
        d.setHours(d.getHours() + 2, 0, 0, 0);
        return d.toISOString().slice(0, 19).replace("T", " ");
      })();
    try {
      await fetch(`${this.base}/fm/request/new/`, {
        method: "POST",
        headers: { ...this.headers(), "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_time: time,
          pickup_location: this.pickupName,
          expected_package_count: packageCount,
          pickup_date: time.slice(0, 10),
          pickup_mode: "Surface",
        }),
      });
    } catch (err) {
      console.warn("[delhivery] schedulePickup failed (non-fatal):", err);
    }
  }
}
