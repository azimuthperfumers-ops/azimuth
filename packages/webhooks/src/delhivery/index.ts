import type { Request, Response } from "express";

import { isAlreadyProcessed, recordEvent } from "../utils.js";
import { processForwardShipment } from "./forward.js";
import { processReturnShipment } from "./return.js";
import type { DelhiveryWebhookBody } from "./types.js";

// Auth: Delhivery sends the secret as ?token=<value> in the query string.
// The token is set when registering the webhook with Delhivery support.

export async function delhiveryWebhookHandler(req: Request, res: Response) {
  const secret = process.env.DELHIVERY_WEBHOOK_TOKEN;
  if (!secret) {
    console.error("[webhook:delhivery] DELHIVERY_WEBHOOK_TOKEN not set — rejecting");
    res.status(503).json({ error: "Webhook auth not configured" });
    return;
  }
  const provided = req.query["token"];
  if (!provided || provided !== secret) {
    console.warn("[webhook:delhivery] invalid or missing token query param");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Delhivery sends a single object per call (not an array)
  const raw = req.body as DelhiveryWebhookBody;
  const awb = (raw.Shipment?.AWB ?? "").trim();

  if (!awb) {
    res.json({ ok: true }); // empty / malformed — ack anyway
    return;
  }

  const statusType = (raw.Shipment?.Status?.StatusType ?? "unknown").trim().toUpperCase();
  const eventId = `delhivery:${awb}:${statusType}`;

  if (await isAlreadyProcessed(eventId)) {
    console.log(`[webhook:delhivery] already processed ${eventId}`);
    res.json({ ok: true });
    return;
  }

  await recordEvent("delhivery", eventId, statusType, raw as Record<string, unknown>);

  // Detect return shipment: its AWB is stored in orders.return_waybill
  const { db, schema } = await import("@azimuth/db");
  const { eq } = await import("drizzle-orm");

  const isReturn = await db.query.orders
    .findFirst({ where: eq(schema.orders.returnWaybill, awb), columns: { id: true } })
    .then((r) => !!r);

  try {
    if (isReturn) {
      await processReturnShipment(raw);
    } else {
      await processForwardShipment(raw);
    }
  } catch (err) {
    console.error(`[webhook:delhivery] error processing ${eventId}:`, err);
  }

  res.json({ ok: true });
}
