import { eq } from "drizzle-orm";

import { db, schema } from "@azimuth/db";
import { advanceOrderStatus } from "@azimuth/api";

import type { ShiprocketBody } from "./forward.js";

type OurOrderStatus = typeof schema.orders.$inferSelect["status"];

// Return/reverse shipment status mapping.
// is_return=1 events: courier picking up from customer → bringing back to warehouse.
const STATUS_MAP: Record<string, OurOrderStatus | null> = {
  // Courier heading to customer for pickup
  "OUT FOR PICKUP": null,
  "PICKUP SCHEDULED": null,
  "MANIFESTED": null,

  // Courier picked up return from customer
  "PICKED UP": "rto_initiated",
  "PICKUP DONE": "rto_initiated",

  // Return in transit back to warehouse
  "IN TRANSIT": null,
  "SHIPPED": null,
  "REACHED AT DESTINATION HUB": null,

  // Return delivered back to warehouse
  "DELIVERED": "rto_delivered",
  "SHIPMENT DELIVERED": "rto_delivered",

  // Failed to pick up from customer — no status change, just log
  "UNDELIVERED": null,
  "DELIVERY FAILED": null,
  "NDR": null,
  "NOT DELIVERED": null,
};

const TERMINAL: readonly string[] = ["rto_delivered"];

export async function processReturnShipment(body: ShiprocketBody) {
  const awb = String(body.awb ?? "").trim();
  const rawStatus = (body.current_status ?? "").trim().toUpperCase();
  const targetStatus: OurOrderStatus | null | undefined = STATUS_MAP[rawStatus];

  if (targetStatus === null) {
    console.log(`[webhook:shiprocket] [RETURN] AWB=${awb} "${rawStatus}" — no action`);
    return;
  }
  if (targetStatus === undefined) {
    console.log(`[webhook:shiprocket] [RETURN] AWB=${awb} unknown status "${rawStatus}" — ignored`);
    return;
  }

  const order = await db.query.orders.findFirst({
    where: eq(schema.orders.returnWaybill, awb),
  });
  if (!order) {
    console.warn(`[webhook:shiprocket] [RETURN] no order for return AWB=${awb}`);
    return;
  }
  if (TERMINAL.includes(order.status)) {
    console.log(`[webhook:shiprocket] [RETURN] order ${order.orderNumber} already ${order.status} — skip`);
    return;
  }

  const note = [
    "[RETURN]",
    body.courier_name && `Courier: ${body.courier_name}`,
    rawStatus,
  ].filter(Boolean).join(" · ");

  await advanceOrderStatus(db, order.id, targetStatus, "webhook:shiprocket", note);
  console.log(`[webhook:shiprocket] [RETURN] order ${order.orderNumber} → ${targetStatus}`);
}
