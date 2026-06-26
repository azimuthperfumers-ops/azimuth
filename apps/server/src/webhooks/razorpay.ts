import type { Request, Response } from "express";
import { eq } from "drizzle-orm";

import { db, schema } from "@azimuth/db";
import { advanceOrderStatus, createRazorpayService } from "@azimuth/api";
import { alertAdminNewOrder, notifyOrderPlaced } from "@azimuth/comms";
import { getCustomerContact, orderInfo } from "../lib/comms.js";

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

  let event: { id: string; event: string; payload: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody.toString("utf8")) as typeof event;
  } catch {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  const { id: eventId, event: eventType } = event;

  // Idempotency — skip already-processed events
  const existing = await db.query.webhookEvents.findFirst({
    where: eq(schema.webhookEvents.eventId, eventId),
  });
  if (existing) {
    res.json({ status: "already_processed" });
    return;
  }

  // Record event before processing so crashes don't cause double-processing on retry
  await db.insert(schema.webhookEvents).values({
    gateway: "razorpay",
    eventId,
    eventType,
    payload: event as Record<string, unknown>,
  });

  try {
    if (eventType === "payment.captured") {
      await handlePaymentCaptured(event.payload);
    } else if (eventType === "payment.failed") {
      await handlePaymentFailed(event.payload);
    }
  } catch (err) {
    // Log but return 200 — Razorpay retries on non-2xx, event is already recorded for idempotency
    console.error(`[webhook:razorpay] Error processing ${eventType} (${eventId}):`, err);
  }

  res.json({ status: "ok" });
}

async function handlePaymentCaptured(payload: Record<string, unknown>) {
  const paymentEntity = (payload.payment as { entity: Record<string, string | number> }).entity;
  const razorpayOrderId = paymentEntity.order_id as string;
  const razorpayPaymentId = paymentEntity.id as string;
  const amountPaise = Number(paymentEntity.amount);

  const order = await db.query.orders.findFirst({
    where: eq(schema.orders.razorpayOrderId, razorpayOrderId),
  });

  if (!order) {
    console.warn(`[webhook:razorpay] No order for razorpay_order_id=${razorpayOrderId}`);
    return;
  }

  // Idempotent — skip if frontend verify already advanced the order
  if (order.status !== "pending_payment") {
    console.log(`[webhook:razorpay] Order ${order.orderNumber} already ${order.status}, skipping`);
    return;
  }

  await db
    .update(schema.orders)
    .set({ razorpayPaymentId })
    .where(eq(schema.orders.id, order.id));

  await db
    .update(schema.paymentAttempts)
    .set({ gatewayPaymentId: razorpayPaymentId, status: "captured" })
    .where(eq(schema.paymentAttempts.gatewayOrderId, razorpayOrderId));

  await advanceOrderStatus(
    db,
    order.id,
    "paid",
    "webhook:razorpay",
    `Webhook payment.captured: ${razorpayPaymentId} (₹${amountPaise / 100})`,
  );

  console.log(`[webhook:razorpay] Order ${order.orderNumber} marked paid`);

  const updatedOrder = await db.query.orders.findFirst({ where: eq(schema.orders.id, order.id) });
  if (updatedOrder) {
    const contact = await getCustomerContact(updatedOrder);
    const info = orderInfo(updatedOrder);
    await Promise.all([
      notifyOrderPlaced(contact, info),
      alertAdminNewOrder(info),
    ]);
  }
}

async function handlePaymentFailed(payload: Record<string, unknown>) {
  const paymentEntity = (payload.payment as { entity: Record<string, unknown> }).entity;
  const razorpayOrderId = paymentEntity.order_id as string | undefined;
  const razorpayPaymentId = paymentEntity.id as string | undefined;

  if (!razorpayOrderId) return;

  await db
    .update(schema.paymentAttempts)
    .set({ gatewayPaymentId: razorpayPaymentId ?? null, status: "failed" })
    .where(eq(schema.paymentAttempts.gatewayOrderId, razorpayOrderId));

  console.log(`[webhook:razorpay] Payment failed for rzp_order_id=${razorpayOrderId}`);
}
