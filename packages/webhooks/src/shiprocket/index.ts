import type { Request, Response } from "express";
import { isAlreadyProcessed, recordEvent } from "../utils.js";
import { processForwardShipment } from "./forward.js";
import type { ShiprocketBody } from "./forward.js";

export async function shiprocketWebhookHandler(req: Request, res: Response) {
  const secret = process.env.SHIPROCKET_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhook:shiprocket] SHIPROCKET_WEBHOOK_SECRET not set — rejecting all requests");
    res.status(503).json({ error: "Webhook auth not configured" });
    return;
  }
  const provided = req.headers["x-api-key"];
  if (!provided || provided !== secret) {
    console.warn("[webhook:shiprocket] invalid or missing x-api-key");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const raw = req.body as unknown;
  const bodies: ShiprocketBody[] = Array.isArray(raw)
    ? (raw as ShiprocketBody[])
    : [(raw as ShiprocketBody)];

  let anyFailed = false;

  for (const body of bodies) {
    const awb = String(body.awb ?? "").trim();
    if (!awb) continue;

    // Refund-only policy: we never create reverse-pickup shipments, so is_return=1
    // events can't match any order — skip them.
    if (body.is_return === 1) {
      console.log(`[webhook:shiprocket] ignoring return-leg event for AWB=${awb} (no returns policy)`);
      continue;
    }

    const status = (body.current_status ?? "").trim().toUpperCase();
    const eventId = `shiprocket:${awb}:${status}`;

    if (await isAlreadyProcessed(eventId)) {
      console.log(`[webhook:shiprocket] already processed ${eventId}`);
      continue;
    }

    try {
      await processForwardShipment(body);
      // Record only after successful processing — a failed handler must leave the
      // idempotency key unconsumed so Shiprocket's retry re-delivers the event.
      await recordEvent("shiprocket", eventId, status || "unknown", body as Record<string, unknown>);
    } catch (err) {
      anyFailed = true;
      console.error(`[webhook:shiprocket] error processing ${eventId}:`, err);
    }
  }

  if (anyFailed) {
    // Non-2xx → Shiprocket retries the batch; already-recorded events are skipped above
    res.status(500).json({ status: "partial_failure" });
    return;
  }

  res.json({ status: "ok" });
}
