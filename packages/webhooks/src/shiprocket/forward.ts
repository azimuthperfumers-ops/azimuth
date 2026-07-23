import { eq } from "drizzle-orm";

import { db, schema } from "@azimuth/db";
import {
  advanceOrderStatus,
  advanceShipmentStatus,
  applyOrderStockMovement,
  deriveOrderStatus,
  getOrderShipments,
} from "@azimuth/api";
import { alertAdminDeliveryFailed, alertAdminOrderDelivered, notifyOrderDelivered } from "@azimuth/comms";
import { getCustomerContact, orderInfo } from "@azimuth/queue";

type OurOrderStatus = typeof schema.orders.$inferSelect["status"];
type ShipmentStatus = typeof schema.orderShipments.$inferSelect["status"];

// Courier status → the status of the parcel it refers to. An order dispatches as
// several parcels, so a webhook only ever describes one of them; the order's own
// status is derived from all of them afterwards (deriveOrderStatus).
const SHIPMENT_STATUS_MAP: Record<string, ShipmentStatus | null> = {
  "PICKUP SCHEDULED": null,
  "PICKUP GENERATED": null,
  "MANIFEST GENERATED": null,
  "MANIFESTED": null,
  "OUT FOR PICKUP": null,
  "PICKUP QUEUED": null,

  "PICKED UP": "picked_up",
  "PICKUP DONE": "picked_up",

  "SHIPPED": "in_transit",
  "IN TRANSIT": "in_transit",
  "REACHED AT DESTINATION HUB": "in_transit",
  "REACHED DESTINATION HUB": "in_transit",
  "DISPATCHED": "in_transit",
  "ARRIVED AT DESTINATION": "in_transit",

  "OUT FOR DELIVERY": "out_for_delivery",
  "SHIPMENT OUT FOR DELIVERY": "out_for_delivery",

  "DELIVERED": "delivered",
  "SHIPMENT DELIVERED": "delivered",

  "UNDELIVERED": "delivery_attempted",
  "DELIVERY FAILED": "delivery_attempted",
  "NDR": "delivery_attempted",
  "NOT DELIVERED": "delivery_attempted",
  "DELIVERY ATTEMPTED": "delivery_attempted",

  "RETURN TO ORIGIN": "rto_initiated",
  "RTO INITIATED": "rto_initiated",
  "RTO IN TRANSIT": "rto_initiated",
  "RTO OUT FOR DELIVERY": "rto_initiated",
  "LOST": "rto_initiated",

  "RTO DELIVERED": "rto_delivered",
};

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

  if (!(rawStatus in STATUS_MAP)) {
    console.log(`[webhook:shiprocket] AWB=${awb} unknown status "${rawStatus}" — ignored`);
    return;
  }

  const note = [
    body.courier_name && `Courier: ${body.courier_name}`,
    rawStatus,
    body.etd && `ETD: ${body.etd}`,
  ].filter(Boolean).join(" · ");

  // The AWB identifies one parcel. Orders placed before per-parcel shipments
  // existed have no shipment row, so fall back to the order-level AWB.
  const shipment = await db.query.orderShipments.findFirst({
    where: eq(schema.orderShipments.waybill, awb),
  });

  const order = shipment
    ? await db.query.orders.findFirst({ where: eq(schema.orders.id, shipment.orderId) })
    : await db.query.orders.findFirst({ where: eq(schema.orders.waybill, awb) });

  if (!order) {
    console.warn(`[webhook:shiprocket] no order for AWB=${awb} — possible spoofed request`);
    return;
  }
  if (TERMINAL.includes(order.status)) {
    console.log(`[webhook:shiprocket] order ${order.orderNumber} already ${order.status} — skip`);
    return;
  }

  // ── Update the parcel this webhook is about ────────────────────────────────
  let targetStatus: OurOrderStatus | null | undefined;

  if (shipment) {
    const parcelStatus = SHIPMENT_STATUS_MAP[rawStatus];

    if (parcelStatus) {
      if (body.etd || body.courier_name) {
        await db
          .update(schema.orderShipments)
          .set({
            ...(body.etd ? { estimatedDeliveryDate: body.etd } : {}),
            ...(body.courier_name ? { courierName: body.courier_name } : {}),
          })
          .where(eq(schema.orderShipments.id, shipment.id));
      }
      if (parcelStatus === "delivered" && body.pod && body.pod !== "Not Available") {
        await db.update(schema.orderShipments).set({ podImageUrl: body.pod }).where(eq(schema.orderShipments.id, shipment.id));
      }
      await advanceShipmentStatus(db, shipment.id, parcelStatus, "webhook:shiprocket", note || undefined);
      console.log(`[webhook:shiprocket] order ${order.orderNumber} parcel P${shipment.packageNumber} → ${parcelStatus}`);
    }

    // The order moves on what ALL its parcels are doing, not just this one — an
    // order of four parcels is only "delivered" when the fourth one lands.
    const siblings = await getOrderShipments(db, order.id);
    targetStatus = deriveOrderStatus(siblings.map((s) => s.status));

    if (!targetStatus || targetStatus === order.status) {
      const summary = siblings.map((s) => `P${s.packageNumber}:${s.status}`).join(" ");
      console.log(`[webhook:shiprocket] order ${order.orderNumber} stays ${order.status} — parcels [${summary}]`);
      return;
    }
  } else {
    // Legacy single-parcel order — the AWB is the whole order.
    targetStatus = STATUS_MAP[rawStatus];
    if (!targetStatus) {
      console.log(`[webhook:shiprocket] AWB=${awb} "${rawStatus}" — no action`);
      return;
    }
    if (body.etd) {
      await db.update(schema.orders).set({ estimatedDeliveryDate: body.etd }).where(eq(schema.orders.id, order.id));
    }
    if (targetStatus === "delivered" && body.pod && body.pod !== "Not Available") {
      await db.update(schema.orders).set({ podImageUrl: body.pod }).where(eq(schema.orders.id, order.id));
    }
  }

  await advanceOrderStatus(db, order.id, targetStatus, "webhook:shiprocket", note || undefined);
  console.log(`[webhook:shiprocket] order ${order.orderNumber} → ${targetStatus}`);

  // Courier RTO completed — undelivered parcel physically back at warehouse
  if (targetStatus === "rto_delivered") {
    await applyOrderStockMovement(db, order.id, "return", "RTO parcel received back at warehouse");
  }

  // Shiprocket sends courier tracking notifications (shipped/OFD/delivered/NDR) to customers directly.
  // We only alert admin on delivery failure.
  if (targetStatus === "delivery_attempted") {
    const info = orderInfo(order);
    await alertAdminDeliveryFailed(info);
  }

  // Delivered: customer email with the "rate your purchase" nudge + admin ping
  if (targetStatus === "delivered") {
    const contact = await getCustomerContact(order);
    const info = orderInfo(order);
    await Promise.all([
      notifyOrderDelivered(contact, info),
      alertAdminOrderDelivered(info),
    ]).catch((e) => console.error("[webhook:shiprocket] delivered notify:", e));
  }
}
