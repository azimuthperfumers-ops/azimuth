import type {
  ILogisticsService,
  ServiceabilityResult,
  ShippingRateResult,
  CreateShipmentInput,
  ShipmentResult,
  TrackingResult,
  CreateReturnShipmentInput,
} from "../logistics.service";


export class StubLogisticsProvider implements ILogisticsService {
  async checkServiceability(pincode: string): Promise<ServiceabilityResult> {
    console.log(`[logistics:stub] serviceability — ${pincode}`);
    return { serviceable: true, mode: "Surface", estimatedDays: 5, cod: false };
  }

  async getShippingRate(_destPincode: string, _weightGrams: number): Promise<ShippingRateResult> {
    return { available: true, chargeInr: 99, estimatedDays: 5 };
  }

  async createShipment(input: CreateShipmentInput): Promise<ShipmentResult> {
    const waybill = `STUB${Date.now()}`;
    console.log(`[logistics:stub] create shipment — ${input.orderNumber} → ${waybill}`);
    return { waybill, trackingUrl: `https://shiprocket.co/tracking/${waybill}`, status: "created" };
  }

  async trackShipment(waybill: string): Promise<TrackingResult> {
    console.log(`[logistics:stub] track — ${waybill}`);
    return { waybill, status: "In Transit", statusDetail: "Shipment is in transit" };
  }

  async createReturnShipment(input: CreateReturnShipmentInput): Promise<ShipmentResult> {
    const waybill = `STUBRET${Date.now()}`;
    console.log(`[logistics:stub] return — ${input.originalOrderNumber} → ${waybill}`);
    return { waybill, trackingUrl: `https://shiprocket.co/tracking/${waybill}`, status: "created" };
  }

  async cancelShipment(waybill: string): Promise<{ cancelled: boolean; message?: string }> {
    console.log(`[logistics:stub] cancel shipment — ${waybill}`);
    return { cancelled: true, message: "Stub: cancelled" };
  }
}
