// Notification service interface — implementations wire email when creds arrive.
// Stub used until real provider (Twilio, MSG91, etc.) is configured.

export type OrderNotificationPayload = {
  userId: string;
  phone?: string | null;
  email?: string | null;
  orderNumber: string;
  orderId: string;
  total: number;
};

export type ShipmentNotificationPayload = {
  userId: string;
  phone?: string | null;
  email?: string | null;
  orderNumber: string;
  waybill: string;
  trackingUrl?: string | null;
};

export interface INotificationService {
  orderConfirmed(payload: OrderNotificationPayload): Promise<void>;
  orderShipped(payload: ShipmentNotificationPayload): Promise<void>;
  orderDelivered(payload: OrderNotificationPayload): Promise<void>;
  orderCancelled(payload: OrderNotificationPayload): Promise<void>;
  rtoInitiated(payload: ShipmentNotificationPayload): Promise<void>;
}

export class StubNotificationService implements INotificationService {
  async orderConfirmed(payload: OrderNotificationPayload) {
    console.log(`[notify:stub] order confirmed — ${payload.orderNumber} (user ${payload.userId})`);
  }

  async orderShipped(payload: ShipmentNotificationPayload) {
    console.log(`[notify:stub] order shipped — ${payload.orderNumber} waybill ${payload.waybill}`);
  }

  async orderDelivered(payload: OrderNotificationPayload) {
    console.log(`[notify:stub] order delivered — ${payload.orderNumber}`);
  }

  async orderCancelled(payload: OrderNotificationPayload) {
    console.log(`[notify:stub] order cancelled — ${payload.orderNumber}`);
  }

  async rtoInitiated(payload: ShipmentNotificationPayload) {
    console.log(`[notify:stub] RTO initiated — ${payload.orderNumber} waybill ${payload.waybill}`);
  }
}

export function createNotificationService(): INotificationService {
  // Swap StubNotificationService for real impl when provider creds arrive
  return new StubNotificationService();
}
