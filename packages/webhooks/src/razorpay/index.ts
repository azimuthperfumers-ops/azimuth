import type { Request, Response } from "express";
import { createRazorpayService } from "@azimuth/api";
import { isAlreadyProcessed, recordEvent } from "../utils.js";
import { handlePaymentCaptured } from "./payment-captured.js";
import { handlePaymentFailed } from "./payment-failed.js";
import { handleRefundCreated } from "./refund-created.js";
import { handleRefundProcessed } from "./refund-processed.js";
import { handleRefundFailed } from "./refund-failed.js";
import { handleDispute } from "./dispute.js";

// Critical events where a handler failure must return 500 so Razorpay retries.
// recordEvent is deferred until after the handler succeeds for these.
const CRITICAL_EVENTS = new Set(["payment.captured", "refund.processed"]);

function extractEntities(payload: Record<string, unknown>) {
  return {
    payment: (payload?.payment as { entity?: Record<string, unknown> } | undefined)?.entity,
    refund: (payload?.refund as { entity?: Record<string, unknown> } | undefined)?.entity,
    dispute: (payload?.dispute as { entity?: Record<string, unknown> } | undefined)?.entity,
  };
}

export async function razorpayWebhookHandler(req: Request, res: Response) {
  const sig = req.headers["x-razorpay-signature"];
  if (typeof sig !== "string") {
    res.status(400).json({ error: "Missing x-razorpay-signature header" });
    return;
  }

  let svc;
  try {
    svc = createRazorpayService();
  } catch {
    res.status(500).json({ error: "Payment service not configured" });
    return;
  }

  const rawBody = req.body as Buffer;
  if (!svc.verifyWebhookSignature(rawBody, sig)) {
    res.status(400).json({ error: "Invalid webhook signature" });
    return;
  }

  let event: { id?: string; event: string; payload: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody.toString("utf8")) as typeof event;
  } catch {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  const { event: eventType, payload } = event;
  const { payment, refund, dispute } = extractEntities(payload);
  const entityId = payment?.id ?? refund?.id ?? dispute?.id ?? null;
  const eventId = event.id ?? (entityId ? `${eventType}:${String(entityId)}` : null);

  if (!eventId) {
    console.warn(`[webhook:razorpay] Could not derive event ID for ${eventType}`);
    res.json({ status: "ok" });
    return;
  }

  if (await isAlreadyProcessed(eventId)) {
    res.json({ status: "already_processed" });
    return;
  }

  const isCritical = CRITICAL_EVENTS.has(eventType);

  if (!isCritical) {
    await recordEvent("razorpay", eventId, eventType, event as Record<string, unknown>);
  }

  try {
    if (eventType === "payment.captured" && payment) {
      await handlePaymentCaptured(payment, eventId);

    } else if (eventType === "payment.failed" && payment) {
      await handlePaymentFailed(payment, eventId);

    } else if (eventType === "refund.created" && refund) {
      handleRefundCreated(refund);

    } else if (eventType === "refund.processed" && refund) {
      await handleRefundProcessed(refund);

    } else if (eventType === "refund.failed" && refund) {
      await handleRefundFailed(refund);

    } else if (eventType.startsWith("payment.dispute.") && dispute) {
      await handleDispute(dispute, eventType);

    } else {
      console.log(`[webhook:razorpay] unhandled event ${eventType} (${eventId})`);
    }

    // Record only after successful processing for critical events so Razorpay
    // retries if the handler throws (idempotency key not consumed on failure).
    if (isCritical) {
      await recordEvent("razorpay", eventId, eventType, event as Record<string, unknown>);
    }
  } catch (err) {
    console.error(`[webhook:razorpay] Failed to process ${eventType} (${eventId}):`, err);
    if (isCritical) {
      res.status(500).json({ error: "Handler failed" });
      return;
    }
  }

  res.json({ status: "ok" });
}
