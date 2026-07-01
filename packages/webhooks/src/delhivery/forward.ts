import { eq } from "drizzle-orm";

import { db, schema } from "@azimuth/db";
import { advanceOrderStatus } from "@azimuth/api";
import { alertAdminDeliveryFailed } from "@azimuth/comms";
import { orderInfo } from "@azimuth/queue";

import { DELHIVERY_STATUS_MAP } from "./types.js";
import type { DelhiveryWebhookBody } from "./types.js";

const TERMINAL: readonly string[] = ["delivered", "refunded", "rto_delivered"];

export async function processForwardShipment(body: DelhiveryWebhookBody) {
  const awb = (body.Shipment?.AWB ?? "").trim();
  const statusType = (body.Shipment?.Status?.StatusType ?? "").trim().toUpperCase();
  const statusLabel = body.Shipment?.Status?.Status ?? statusType;

  const targetStatus = DELHIVERY_STATUS_MAP[statusType as keyof typeof DELHIVERY_STATUS_MAP];

  if (targetStatus === null || targetStatus === undefined) {
    console.log(`[webhook:delhivery] AWB=${awb} "${statusType}" — no action`);
    return;
  }

  const order = await db.query.orders.findFirst({
    where: eq(schema.orders.delhiveryWaybill, awb),
  });
  if (!order) {
    console.warn(`[webhook:delhivery] no order for AWB=${awb}`);
    return;
  }
  if (TERMINAL.includes(order.status)) {
    console.log(`[webhook:delhivery] order ${order.orderNumber} already ${order.status} — skip`);
    return;
  }

  const note = [statusLabel, body.Shipment?.Status?.StatusLocation, body.Shipment?.Status?.Instructions]
    .filter(Boolean)
    .join(" · ");

  await advanceOrderStatus(db, order.id, targetStatus, "webhook:delhivery", note || undefined);
  console.log(`[webhook:delhivery] order ${order.orderNumber} AWB=${awb} → ${targetStatus}`);

  if (targetStatus === "delivery_attempted") {
    const info = orderInfo(order);
    await alertAdminDeliveryFailed(info).catch((e) =>
      console.error("[webhook:delhivery] alertAdminDeliveryFailed:", e),
    );
  }
}
