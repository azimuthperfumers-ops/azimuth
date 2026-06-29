import type { Request, Response } from "express";
import { isAlreadyProcessed, recordEvent } from "../utils.js";
import { processForwardShipment } from "./forward.js";
import { processReturnShipment } from "./return.js";
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

  for (const body of bodies) {
    const awb = String(body.awb ?? "").trim();
    if (!awb) continue;

    const isReturn = body.is_return === 1;
    const status = (body.current_status ?? "").trim().toUpperCase();
    const eventId = `shiprocket:${isReturn ? "return:" : ""}${awb}:${status}`;

    if (await isAlreadyProcessed(eventId)) {
      console.log(`[webhook:shiprocket] already processed ${eventId}`);
      continue;
    }

    await recordEvent("shiprocket", eventId, status || "unknown", body as Record<string, unknown>);

    try {
      if (isReturn) {
        await processReturnShipment(body);
      } else {
        await processForwardShipment(body);
      }
    } catch (err) {
      console.error(`[webhook:shiprocket] error processing ${eventId}:`, err);
    }
  }

  res.json({ status: "ok" });
}
