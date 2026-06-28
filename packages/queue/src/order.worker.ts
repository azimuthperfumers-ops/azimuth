import { UnrecoverableError, Worker } from "bullmq";
import { and, eq, inArray } from "drizzle-orm";

import { db, schema } from "@azimuth/db";
import { advanceOrderStatus } from "@azimuth/api";
import { alertAdminNewOrder, alertAdminRefund, notifyOrderPlaced, notifyRefundInitiated, notifyShipped } from "@azimuth/comms";
import { createLogisticsService, createRazorpayService } from "@azimuth/api";

import { redisOpts } from "./connection.js";
import { getCustomerContact, orderInfo } from "./comms.js";
import { orderQueue } from "./order.queue.js";
import type { OrderJobData, PaymentCapturedJob, PaymentFailedJob, BookShipmentJob, InitiateRefundJob, CancelShipmentJob } from "./order.queue.js";

async function processPaymentCaptured(data: PaymentCapturedJob) {
  const { razorpayOrderId, razorpayPaymentId, amountPaise } = data;

  const order = await db.query.orders.findFirst({
    where: eq(schema.orders.razorpayOrderId, razorpayOrderId),
  });

  if (!order) {
    console.warn(`[order-worker] No order for razorpay_order_id=${razorpayOrderId}`);
    return;
  }

  // Idempotent — frontend verify may have already advanced status
  if (order.status !== "pending_payment") {
    console.log(`[order-worker] Order ${order.orderNumber} already ${order.status}, skipping capture`);
    // Still enqueue shipment booking if not yet booked
    if ((order.status === "paid" || order.status === "processing") && !order.delhiveryWaybill) {
      await orderQueue.add("book_shipment", { type: "book_shipment", orderId: order.id });
    }
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
    "worker:order",
    `payment.captured: ${razorpayPaymentId} (₹${amountPaise / 100})`,
  );

  await advanceOrderStatus(
    db,
    order.id,
    "processing",
    "worker:order",
    "Shipment booking queued",
  );

  console.log(`[order-worker] Order ${order.orderNumber} marked paid → processing`);

  // Send notifications + enqueue Shiprocket booking in parallel
  const updatedOrder = await db.query.orders.findFirst({ where: eq(schema.orders.id, order.id) });
  if (updatedOrder) {
    const contact = await getCustomerContact(updatedOrder);
    const info = orderInfo(updatedOrder);
    await Promise.all([
      notifyOrderPlaced(contact, info),
      alertAdminNewOrder(info),
    ]);
  }

  // Shiprocket booking is separate job — own retry budget, decoupled from payment capture
  await orderQueue.add("book_shipment", { type: "book_shipment", orderId: order.id });
  console.log(`[order-worker] Enqueued book_shipment for order=${order.id}`);
}

async function processPaymentFailed(data: PaymentFailedJob) {
  const { razorpayOrderId, razorpayPaymentId } = data;

  await db
    .update(schema.paymentAttempts)
    .set({ gatewayPaymentId: razorpayPaymentId ?? null, status: "failed" })
    .where(eq(schema.paymentAttempts.gatewayOrderId, razorpayOrderId));

  console.log(`[order-worker] Payment failed for rzp_order_id=${razorpayOrderId}`);
}

async function processBookShipment(data: BookShipmentJob) {
  const { orderId } = data;

  const order = await db.query.orders.findFirst({
    where: eq(schema.orders.id, orderId),
    with: { items: true },
  });

  if (!order) {
    console.warn(`[order-worker] book_shipment: order ${orderId} not found`);
    return;
  }

  // Idempotent — already booked
  if (order.delhiveryWaybill) {
    console.log(`[order-worker] Order ${order.orderNumber} already has waybill ${order.delhiveryWaybill}, skipping`);
    return;
  }

  const TERMINAL = ["delivered", "cancelled", "refunded", "rto_delivered"];
  if (TERMINAL.includes(order.status)) {
    console.log(`[order-worker] book_shipment: order ${order.orderNumber} already ${order.status}, skip`);
    return;
  }

  const addr = order.shippingAddress as {
    fullName?: string; phone?: string;
    line1?: string; line2?: string | null;
    city?: string; state?: string; pincode?: string;
  };

  // Fetch variant dimensions — box dimensions for packed shipment
  const variantIds = order.items
    .map((i) => i.variantId)
    .filter((id): id is string => id != null);

  const variants = variantIds.length > 0
    ? await db
        .select({
          id: schema.productVariants.id,
          weightGrams: schema.productVariants.weightGrams,
          boxLengthCm: schema.productVariants.boxLengthCm,
          boxWidthCm: schema.productVariants.boxWidthCm,
          boxHeightCm: schema.productVariants.boxHeightCm,
        })
        .from(schema.productVariants)
        .where(inArray(schema.productVariants.id, variantIds))
    : [];

  const variantMap = new Map(variants.map((v) => [v.id, v]));

  // Aggregate weight across all items; use box dimensions of heaviest item
  let totalWeightGrams = 0;
  let maxWeight = 0;
  let boxL = 15, boxW = 10, boxH = 10; // safe defaults (cm)

  for (const item of order.items) {
    const v = item.variantId ? variantMap.get(item.variantId) : undefined;
    const itemWeight = (v?.weightGrams ?? 200) * item.quantity;
    totalWeightGrams += itemWeight;
    if (itemWeight > maxWeight) {
      maxWeight = itemWeight;
      boxL = v?.boxLengthCm ?? 15;
      boxW = v?.boxWidthCm ?? 10;
      boxH = v?.boxHeightCm ?? 10;
    }
  }

  // Add 100g packaging buffer
  totalWeightGrams += 100;

  const logistics = createLogisticsService();
  let result: Awaited<ReturnType<typeof logistics.createShipment>>;
  try {
    result = await logistics.createShipment({
      orderNumber: order.orderNumber,
      customerName: addr.fullName ?? "Customer",
      customerPhone: addr.phone ?? "",
      address: {
        line1: addr.line1 ?? "",
        line2: addr.line2,
        city: addr.city ?? "",
        state: addr.state ?? "",
        pincode: addr.pincode ?? "",
      },
      items: order.items.map((item) => ({
        name: item.productName,
        sku: item.variantSku,
        qty: item.quantity,
        price: Number(item.unitPrice),
      })),
      codAmount: 0,
      weightGrams: totalWeightGrams,
      lengthCm: boxL,
      widthCm: boxW,
      heightCm: boxH,
    });
  } catch (err) {
    // Auth/credential errors must not be retried — they trigger Shiprocket login-block
    const msg = err instanceof Error ? err.message : String(err);
    if (
      (err instanceof Error && (err as { unrecoverable?: boolean }).unrecoverable) ||
      msg.includes("auth failed") ||
      msg.includes("blocked") ||
      msg.includes("403")
    ) {
      throw new UnrecoverableError(`Shiprocket booking failed: ${msg}`);
    }
    throw err;
  }

  if (result.status === "failed") {
    const msg = `Shiprocket booking failed: ${result.errorMessage}`;
    if (result.errorMessage?.includes("auth failed") || result.errorMessage?.includes("blocked")) {
      throw new UnrecoverableError(msg);
    }
    throw new Error(msg);
  }

  // Persist waybill + tracking URL, advance status to "processing"
  await db
    .update(schema.orders)
    .set({
      delhiveryWaybill: result.waybill,
      trackingUrl: result.trackingUrl,
      estimatedDeliveryDate: result.estimatedDeliveryDate ?? null,
    })
    .where(eq(schema.orders.id, orderId));

  await advanceOrderStatus(db, orderId, "processing", "worker:order", `Shipment booked: ${result.waybill}`);

  console.log(`[order-worker] Order ${order.orderNumber} booked → waybill=${result.waybill}`);

  // Notify customer with tracking link
  const contact = await getCustomerContact(order);
  const info = orderInfo({ ...order, delhiveryWaybill: result.waybill, trackingUrl: result.trackingUrl });
  await notifyShipped(contact, info).catch((err) =>
    console.error(`[order-worker] notifyShipped failed for ${order.orderNumber}:`, err),
  );
}

async function processInitiateRefund(data: InitiateRefundJob) {
  const { orderId, razorpayPaymentId, amountPaise, reason } = data;

  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
  if (!order) {
    console.warn(`[order-worker] initiate_refund: order ${orderId} not found`);
    return;
  }
  if (order.status === "refunded") {
    console.log(`[order-worker] Order ${order.orderNumber} already refunded, skipping`);
    return;
  }

  const svc = createRazorpayService();
  const refund = await svc.refundPayment({
    paymentId: razorpayPaymentId,
    amountPaise,
    receipt: `refund-${order.orderNumber}`,
    notes: { orderId, orderNumber: order.orderNumber, reason },
  });

  await advanceOrderStatus(
    db, orderId, "refunded", "worker:order",
    `Razorpay refund initiated: ${refund.id} (₹${(amountPaise / 100).toFixed(2)})`,
  );

  const contact = await getCustomerContact(order);
  const info = orderInfo(order);
  await Promise.all([
    notifyRefundInitiated(contact, info),
    alertAdminRefund(info),
  ]).catch((e: unknown) => console.error("[order-worker] refund notify:", e));

  console.log(`[order-worker] Refund initiated for order ${order.orderNumber}: ${refund.id}`);
}

async function processCancelShipment(data: CancelShipmentJob) {
  const { orderId, waybill } = data;
  const logistics = createLogisticsService();
  try {
    await logistics.cancelShipment(waybill);
    console.log(`[order-worker] Cancelled shipment waybill=${waybill} for order ${orderId}`);
  } catch (err) {
    console.error(`[order-worker] cancelShipment failed for ${waybill}:`, err);
  }
}

export function startOrderWorker() {
  const worker = new Worker<OrderJobData>(
    "order-events",
    async (job) => {
      const { data } = job;
      if (data.type === "payment_captured") {
        await processPaymentCaptured(data);
      } else if (data.type === "payment_failed") {
        await processPaymentFailed(data);
      } else if (data.type === "book_shipment") {
        await processBookShipment(data);
      } else if (data.type === "initiate_refund") {
        await processInitiateRefund(data);
      } else if (data.type === "cancel_shipment") {
        await processCancelShipment(data);
      }
    },
    {
      connection: redisOpts(),
      concurrency: 5,
    },
  );

  worker.on("failed", async (job, err) => {
    console.error(
      `[order-worker] Job ${job?.id} (${job?.data.type}) failed attempt ${job?.attemptsMade}/${job?.opts.attempts}:`,
      err.message,
    );
    // On final exhausted retry for book_shipment, write error to order history so admin can see + retry
    if (
      job &&
      job.name === "book_shipment" &&
      job.attemptsMade >= (job.opts.attempts ?? 1)
    ) {
      const { orderId } = job.data as BookShipmentJob;
      try {
        await advanceOrderStatus(
          db,
          orderId,
          "processing",
          "worker:order",
          `Shipment booking failed after ${job.attemptsMade} attempts — needs manual retry. Error: ${err.message}`,
        );
      } catch (dbErr) {
        console.error("[order-worker] Failed to record booking error to DB:", dbErr);
      }
    }
  });

  worker.on("completed", (job) => {
    console.log(`[order-worker] Job ${job.id} (${job.data.type}) done`);
  });

  return worker;
}
