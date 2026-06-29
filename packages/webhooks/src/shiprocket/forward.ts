import { eq } from "drizzle-orm";

import { db, schema } from "@azimuth/db";
import { advanceOrderStatus } from "@azimuth/api";
import { alertAdminDeliveryFailed } from "@azimuth/comms";
import { orderInfo } from "@azimuth/queue";

type OurOrderStatus = typeof schema.orders.$inferSelect["status"];

const STATUS_MAP: Record<string, OurOrderStatus | null> = {
  // Pre-pickup — no status change
  "PICKUP SCHEDULED": null,
  "PICKUP GENERATED": null,
  "MANIFEST GENERATED": null,
  "MANIFESTED": null,
  "OUT FOR PICKUP": null,
  "PICKUP QUEUED": null,

  // Picked up by courier
  "PICKED UP": "picked_up",
  "PICKUP DONE": "picked_up",

  // In transit — already picked_up, no further change
  "SHIPPED": null,
  "IN TRANSIT": null,
  "REACHED AT DESTINATION HUB": null,
  "REACHED DESTINATION HUB": null,
  "DISPATCHED": null,
  "ARRIVED AT DESTINATION": null,

  // Out for delivery
  "OUT FOR DELIVERY": "out_for_delivery",
  "SHIPMENT OUT FOR DELIVERY": "out_for_delivery",

  // Delivered
  "DELIVERED": "delivered",
  "SHIPMENT DELIVERED": "delivered",

  // Failed delivery / NDR
  "UNDELIVERED": "delivery_attempted",
  "DELIVERY FAILED": "delivery_attempted",
  "NDR": "delivery_attempted",
  "NOT DELIVERED": "delivery_attempted",
  "DELIVERY ATTEMPTED": "delivery_attempted",

  // RTO initiated
  "RETURN TO ORIGIN": "rto_initiated",
  "RTO INITIATED": "rto_initiated",
  "RTO IN TRANSIT": "rto_initiated",
  "RTO OUT FOR DELIVERY": "rto_initiated",
  "LOST": "rto_initiated",

  // RTO completed
  "RTO DELIVERED": "rto_delivered",
};

const TERMINAL: readonly string[] = ["delivered", "refunded", "rto_delivered"];

export interface ShiprocketBody {
  awb?: string | number;
  courier_name?: string;
  current_status?: string;
  etd?: string;
  delivered_date?: string;
  pod_status?: string;
  pod?: string;
  is_return?: number;
}

export async function processForwardShipment(body: ShiprocketBody) {
  const awb = String(body.awb ?? "").trim();
  const rawStatus = (body.current_status ?? "").trim().toUpperCase();
  const targetStatus: OurOrderStatus | null | undefined = STATUS_MAP[rawStatus];

  if (targetStatus === null) {
    console.log(`[webhook:shiprocket] AWB=${awb} "${rawStatus}" — no action`);
    return;
  }
  if (targetStatus === undefined) {
    console.log(`[webhook:shiprocket] AWB=${awb} unknown status "${rawStatus}" — ignored`);
    return;
  }

  const order = await db.query.orders.findFirst({
    where: eq(schema.orders.delhiveryWaybill, awb),
  });
  if (!order) {
    console.warn(`[webhook:shiprocket] no order for AWB=${awb} — possible spoofed request`);
    return;
  }
  if (TERMINAL.includes(order.status)) {
    console.log(`[webhook:shiprocket] order ${order.orderNumber} already ${order.status} — skip`);
    return;
  }

  if (body.etd) {
    await db.update(schema.orders).set({ estimatedDeliveryDate: body.etd }).where(eq(schema.orders.id, order.id));
  }

  if (targetStatus === "delivered" && body.pod && body.pod !== "Not Available") {
    await db.update(schema.orders).set({ podImageUrl: body.pod }).where(eq(schema.orders.id, order.id));
  }

  const note = [
    body.courier_name && `Courier: ${body.courier_name}`,
    rawStatus,
    body.etd && `ETD: ${body.etd}`,
  ].filter(Boolean).join(" · ");

  await advanceOrderStatus(db, order.id, targetStatus, "webhook:shiprocket", note || undefined);
  console.log(`[webhook:shiprocket] order ${order.orderNumber} → ${targetStatus}`);

  // Shiprocket sends courier tracking notifications (shipped/OFD/delivered/NDR) to customers directly.
  // We only alert admin on delivery failure.
  if (targetStatus === "delivery_attempted") {
    const info = orderInfo(order);
    await alertAdminDeliveryFailed(info);
  }
}
