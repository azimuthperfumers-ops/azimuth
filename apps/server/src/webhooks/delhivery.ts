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
import { getCustomerContact, orderInfo } from "../lib/comms.js";
import { env } from "../lib/env.js";

// ── Payload shape ─────────────────────────────────────────────────────────────
// Delhivery pushes { Shipment: { AWB, Status: { StatusType, Status, StatusDateTime, StatusLocation, Instructions }, ... } }
// May arrive as a single object OR an array. Auth: ?token= query param.

interface DelhiveryStatus {
  Status: string;           // "Manifested", "Out for Delivery", "Delivered", etc.
  StatusDateTime: string;   // "2024-01-09T17:10:42.767"
  StatusType: string;       // Short scan code: "MF", "OFD", "DL", "UD", "PKD", …
  StatusLocation: string;
  Instructions?: string;
}

interface DelhiveryShipment {
  AWB: string;
  ReferenceNo?: string;
  Status: DelhiveryStatus;
  PickUpDate?: string;
  NSLCode?: string;
  Sortcode?: string;
}

interface DelhiveryWebhookBody {
  Shipment: DelhiveryShipment;
}

// ── Scan code → our order status ──────────────────────────────────────────────
// StatusType values sourced from Delhivery Push API docs + observed payloads.
// null = in-transit/intermediate scan, no status change needed.

type OurOrderStatus = typeof schema.orders.$inferSelect["status"];

const SCAN_TO_STATUS: Record<string, OurOrderStatus | null> = {
  // Pickup
  PKD: "picked_up",       // Picked up from shipper
  PU: "picked_up",

  // Manifested / in-transit — no change
  MF: null,
  IT: null,               // In transit hub scan
  SHP: null,              // Shipment created
  OB: null,               // Out-bound scan

  // Out for delivery
  OFD: "out_for_delivery",

  // Delivered
  DL: "delivered",

  // Failed delivery attempts
  UD: "delivery_attempted",   // Undelivered (customer not available)
  NDR: "delivery_attempted",  // Non-delivery report
  CNR: "delivery_attempted",  // Customer not reachable

  // Return / RTO
  RT: "rto_initiated",
  RTO: "rto_initiated",
  RTI: "rto_initiated",
  RTD: "rto_delivered",       // RTO delivered back to shipper
};

// Fallback: map full Status strings when StatusType is unknown/absent
const STATUS_STR_TO_STATUS: Record<string, OurOrderStatus | null> = {
  "Picked Up": "picked_up",
  "Pickup Done": "picked_up",
  "Out for Delivery": "out_for_delivery",
  "Delivered": "delivered",
  "Undelivered": "delivery_attempted",
  "Customer Not Available": "delivery_attempted",
  "Customer Not Reachable": "delivery_attempted",
  "Delivery Failed": "delivery_attempted",
  "Return Initiated": "rto_initiated",
  "RTO Initiated": "rto_initiated",
  "RTO Delivered": "rto_delivered",
  // no-ops
  "Manifested": null,
  "In Transit": null,
  "Dispatched": null,
  "Pending": null,
};

const TERMINAL: readonly string[] = ["delivered", "refunded", "rto_delivered"];

// ── Event processor ───────────────────────────────────────────────────────────

async function processShipment(shipment: DelhiveryShipment) {
  const { AWB, Status: scanStatus } = shipment;
  if (!AWB) return;

  const scanType = scanStatus?.StatusType;
  const statusStr = scanStatus?.Status;

  let targetStatus: OurOrderStatus | null | undefined;
  if (scanType && scanType in SCAN_TO_STATUS) {
    targetStatus = SCAN_TO_STATUS[scanType];
  } else if (statusStr && statusStr in STATUS_STR_TO_STATUS) {
    targetStatus = STATUS_STR_TO_STATUS[statusStr];
  }

  if (targetStatus === null) {
    console.log(`[webhook:delhivery] AWB=${AWB} type=${scanType ?? statusStr} — no status change`);
    return;
  }

  if (targetStatus === undefined) {
    console.log(`[webhook:delhivery] AWB=${AWB} unknown scan type=${scanType ?? statusStr} — ignored`);
    return;
  }

  const order = await db.query.orders.findFirst({
    where: eq(schema.orders.delhiveryWaybill, AWB),
  });

  if (!order) {
    console.warn(`[webhook:delhivery] no order found for AWB=${AWB}`);
    return;
  }

  if (TERMINAL.includes(order.status)) {
    console.log(`[webhook:delhivery] order ${order.orderNumber} is ${order.status} — skipping ${targetStatus}`);
    return;
  }

  const noteParts = [
    scanType && `Code: ${scanType}`,
    scanStatus.Instructions && `Remarks: ${scanStatus.Instructions}`,
    scanStatus.StatusLocation && `Location: ${scanStatus.StatusLocation}`,
    scanStatus.StatusDateTime && `At: ${scanStatus.StatusDateTime}`,
  ].filter(Boolean);

  await advanceOrderStatus(
    db,
    order.id,
    targetStatus,
    "webhook:delhivery",
    noteParts.join(" · ") || undefined,
  );

  console.log(`[webhook:delhivery] order ${order.orderNumber} → ${targetStatus}`);

  const contact = await getCustomerContact(order);
  const info = orderInfo(order);
  if (targetStatus === "picked_up") await notifyShipped(contact, info);
  else if (targetStatus === "out_for_delivery") await notifyOutForDelivery(contact, info);
  else if (targetStatus === "delivered") await notifyDelivered(contact, info);
  else if (targetStatus === "delivery_attempted") {
    await Promise.all([notifyDeliveryFailed(contact, info), alertAdminDeliveryFailed(info)]);
  }
}

// ── Express handler ───────────────────────────────────────────────────────────

export async function delhiveryWebhookHandler(req: Request, res: Response) {
  const webhookToken = env.DELHIVERY_WEBHOOK_TOKEN;
  if (webhookToken && req.query.token !== webhookToken) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const raw = req.body as unknown;

  // Normalise: single { Shipment } or array of { Shipment }
  const bodies: DelhiveryWebhookBody[] = Array.isArray(raw)
    ? (raw as DelhiveryWebhookBody[])
    : [(raw as DelhiveryWebhookBody)];

  for (const body of bodies) {
    const shipment = body?.Shipment;
    if (!shipment?.AWB) continue;

    const scanType = shipment.Status?.StatusType ?? "";
    const statusStr = shipment.Status?.Status ?? "";
    const eventId = `delhivery:${shipment.AWB}:${scanType}:${shipment.Status?.StatusDateTime ?? Date.now()}`;

    const existing = await db.query.webhookEvents.findFirst({
      where: eq(schema.webhookEvents.eventId, eventId),
    });
    if (existing) continue;

    await db.insert(schema.webhookEvents).values({
      gateway: "delhivery",
      eventId,
      eventType: scanType || statusStr || "unknown",
      payload: shipment as unknown as Record<string, unknown>,
    });

    try {
      await processShipment(shipment);
    } catch (err) {
      console.error(`[webhook:delhivery] error processing ${eventId}:`, err);
    }
  }

  res.json({ status: "ok" });
}
