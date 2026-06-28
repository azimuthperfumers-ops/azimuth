import type { Request, Response } from "express";
import { eq } from "drizzle-orm";

import { db, schema } from "@azimuth/db";
import { advanceOrderStatus, createRazorpayService } from "@azimuth/api";
import { orderQueue } from "@azimuth/queue";

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

  const eventType = event.event;

  // Razorpay webhooks may not include a top-level `id` — derive a stable idempotency key
  // from the payment entity id + event type, which is always unique per event
  const paymentEntity = (event.payload?.payment as { entity?: Record<string, unknown> } | undefined)
    ?.entity;
  const paymentId = paymentEntity?.id as string | undefined;
  const eventId = event.id ?? (paymentId ? `${eventType}:${paymentId}` : null);

  if (!eventId) {
    console.warn(`[webhook:razorpay] Could not derive event ID for ${eventType}, skipping`);
    res.json({ status: "ok" });
    return;
  }

  // Idempotency check — use db.select() to avoid Drizzle relational-query alias bug
  const [existing] = await db
    .select({ id: schema.webhookEvents.id })
    .from(schema.webhookEvents)
    .where(eq(schema.webhookEvents.eventId, eventId))
    .limit(1);

  if (existing) {
    res.json({ status: "already_processed" });
    return;
  }

  // Record event before enqueuing so crashes don't double-process on retry
  await db.insert(schema.webhookEvents).values({
    gateway: "razorpay",
    eventId,
    eventType,
    payload: event as Record<string, unknown>,
  });

  // Enqueue for reliable async processing — return 200 immediately
  try {
    if (eventType === "payment.captured" && paymentEntity) {
      const razorpayOrderId = paymentEntity.order_id as string;
      const razorpayPaymentId = paymentEntity.id as string;
      const amountPaise = Number(paymentEntity.amount);

      await orderQueue.add("payment_captured", {
        type: "payment_captured",
        eventId,
        razorpayOrderId,
        razorpayPaymentId,
        amountPaise,
      });

      console.log(`[webhook:razorpay] Enqueued payment_captured rzp_order=${razorpayOrderId}`);
    } else if (eventType === "payment.failed" && paymentEntity) {
      const razorpayOrderId = paymentEntity.order_id as string | undefined;
      const razorpayPaymentId = (paymentEntity.id as string | undefined) ?? null;

      if (razorpayOrderId) {
        await orderQueue.add("payment_failed", {
          type: "payment_failed",
          eventId,
          razorpayOrderId,
          razorpayPaymentId,
        });

        console.log(`[webhook:razorpay] Enqueued payment_failed rzp_order=${razorpayOrderId}`);
      }
    } else if (eventType === "refund.processed" || eventType === "refund.created") {
      const refundEntity = (event.payload?.refund as { entity?: Record<string, unknown> } | undefined)?.entity;
      const refundPaymentId = refundEntity?.payment_id as string | undefined;
      const refundId = refundEntity?.id as string | undefined;

      if (refundPaymentId && refundId) {
        const order = await db.query.orders.findFirst({
          where: eq(schema.orders.razorpayPaymentId, refundPaymentId),
        });
        if (order && order.status !== "refunded") {
          await advanceOrderStatus(
            db, order.id, "refunded", "webhook:razorpay",
            `Razorpay refund settled: ${refundId}`,
          );
          console.log(`[webhook:razorpay] Order ${order.orderNumber} marked refunded via ${eventType}`);
        }
      }
    }
  } catch (err) {
    // Enqueue failed — event already recorded in DB for manual replay
    console.error(`[webhook:razorpay] Failed to enqueue ${eventType} (${eventId}):`, err);
  }

  res.json({ status: "ok" });
}
