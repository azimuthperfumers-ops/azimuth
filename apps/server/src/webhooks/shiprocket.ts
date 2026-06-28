import type { Request, Response } from "express";
import { eq } from "drizzle-orm";

import { db, schema } from "@azimuth/db";
import { advanceOrderStatus } from "@azimuth/api";
import {
  alertAdminDeliveryFailed,
  notifyDelivered,
  notifyDeliveryFailed,
  notifyOutForDelivery,
  notifyShipped,
} from "@azimuth/comms";
import { getCustomerContact, orderInfo } from "@azimuth/queue";

// ── Shiprocket webhook payload ────────────────────────────────────────────────
// No HMAC signature — validate by cross-checking awb against our DB.
// Payload reference: https://apidocs.shiprocket.in (Webhooks section)

interface ShiprocketWebhookBody {
  awb?: string | number;          // sample payload sends number, not string
  order_id?: string | number;
  channel_order_id?: string;
  courier_name?: string;
  current_status?: string;        // e.g. "Delivered" — we toUpperCase() before lookup
  current_status_id?: number;
  shipment_status?: string;
  shipment_status_id?: number;
  current_timestamp?: string;
  etd?: string;
  delivered_date?: string;
  pickup_scheduled_date?: string;
  scans?: { date: string; activity: string; location: string }[];
}

// ── Status mapping ────────────────────────────────────────────────────────────

type OurOrderStatus = typeof schema.orders.$inferSelect["status"];

// Shiprocket current_status strings (uppercase)
const STATUS_MAP: Record<string, OurOrderStatus | null> = {
  // Pickup
  "PICKUP SCHEDULED": null,
  "PICKUP GENERATED": null,
  "MANIFESTED": null,
  "PICKED UP": "picked_up",
  "PICKUP DONE": "picked_up",

  // In transit — no status change
  "IN TRANSIT": null,
  "REACHED AT DESTINATION HUB": null,
  "REACHED DESTINATION HUB": null,
  "DISPATCHED": null,
  "SHIPPED": null,

  // Out for delivery
  "OUT FOR DELIVERY": "out_for_delivery",
  "SHIPMENT OUT FOR DELIVERY": "out_for_delivery",

  // Delivered
  "DELIVERED": "delivered",
  "SHIPMENT DELIVERED": "delivered",

  // Failed delivery
  "UNDELIVERED": "delivery_attempted",
  "DELIVERY FAILED": "delivery_attempted",
  "NDR": "delivery_attempted",
  "RETURN TO ORIGIN": "rto_initiated",

  // RTO
  "RTO INITIATED": "rto_initiated",
  "RTO IN TRANSIT": "rto_initiated",
  "RTO OUT FOR DELIVERY": "rto_initiated",
  "RTO DELIVERED": "rto_delivered",
};

const TERMINAL: readonly string[] = ["delivered", "refunded", "rto_delivered"];

// ── Processor ─────────────────────────────────────────────────────────────────

async function processEvent(body: ShiprocketWebhookBody) {
  const awb = body.awb != null ? String(body.awb).trim() : "";
  if (!awb) return;

  const rawStatus = (body.current_status ?? "").trim().toUpperCase();
  const targetStatus: OurOrderStatus | null | undefined = STATUS_MAP[rawStatus];

  if (targetStatus === null) {
    console.log(`[webhook:shiprocket] AWB=${awb} status="${rawStatus}" — no action`);
    return;
  }
  if (targetStatus === undefined) {
    console.log(`[webhook:shiprocket] AWB=${awb} unknown status="${rawStatus}" — ignored`);
    return;
  }

  // Cross-check AWB in our DB — Shiprocket doesn't sign webhooks, so this is our auth
  const order = await db.query.orders.findFirst({
    where: eq(schema.orders.delhiveryWaybill, awb),
  });

  if (!order) {
    console.warn(`[webhook:shiprocket] no order for AWB=${awb} — possible spoofed request, ignoring`);
    return;
  }

  if (TERMINAL.includes(order.status)) {
    console.log(`[webhook:shiprocket] order ${order.orderNumber} already ${order.status} — skip`);
    return;
  }

  // Update ETD if Shiprocket sends a newer estimate
  if (body.etd) {
    await db
      .update(schema.orders)
      .set({ estimatedDeliveryDate: body.etd })
      .where(eq(schema.orders.id, order.id));
  }

  const note = [
    body.courier_name && `Courier: ${body.courier_name}`,
    rawStatus,
    body.etd && `ETD: ${body.etd}`,
  ]
    .filter(Boolean)
    .join(" · ");

  await advanceOrderStatus(db, order.id, targetStatus, "webhook:shiprocket", note || undefined);
  console.log(`[webhook:shiprocket] order ${order.orderNumber} → ${targetStatus}`);

  const contact = await getCustomerContact(order);
  const info = orderInfo(order);

  if (targetStatus === "picked_up") {
    await notifyShipped(contact, { ...info, trackingUrl: order.trackingUrl ?? undefined });
  } else if (targetStatus === "out_for_delivery") {
    await notifyOutForDelivery(contact, info);
  } else if (targetStatus === "delivered") {
    await notifyDelivered(contact, info);
  } else if (targetStatus === "delivery_attempted") {
    await Promise.all([notifyDeliveryFailed(contact, info), alertAdminDeliveryFailed(info)]);
  }
}

// ── Express handler ───────────────────────────────────────────────────────────

export async function shiprocketWebhookHandler(req: Request, res: Response) {
  // Validate x-api-key token if SHIPROCKET_WEBHOOK_SECRET is configured
  const secret = process.env.SHIPROCKET_WEBHOOK_SECRET;
  if (secret) {
    const provided = req.headers["x-api-key"];
    if (!provided || provided !== secret) {
      console.warn("[webhook:shiprocket] invalid or missing x-api-key token");
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  const raw = req.body as unknown;

  // Shiprocket may send single object or array
  const bodies: ShiprocketWebhookBody[] = Array.isArray(raw)
    ? (raw as ShiprocketWebhookBody[])
    : [(raw as ShiprocketWebhookBody)];

  for (const body of bodies) {
    const awb = body.awb != null ? String(body.awb).trim() : "";
    if (!awb) continue;

    const status = (body.current_status ?? "").trim().toUpperCase();
    const eventId = `shiprocket:${awb}:${status}`;

    // Idempotency — use select() not relational query to avoid Drizzle alias bug
    const [existing] = await db
      .select({ id: schema.webhookEvents.id })
      .from(schema.webhookEvents)
      .where(eq(schema.webhookEvents.eventId, eventId))
      .limit(1);

    if (existing) {
      console.log(`[webhook:shiprocket] already processed ${eventId}`);
      continue;
    }

    await db.insert(schema.webhookEvents).values({
      gateway: "shiprocket",
      eventId,
      eventType: status || "unknown",
      payload: body as Record<string, unknown>,
    });

    try {
      await processEvent(body);
    } catch (err) {
      console.error(`[webhook:shiprocket] error processing ${eventId}:`, err);
    }
  }

  res.json({ status: "ok" });
}
