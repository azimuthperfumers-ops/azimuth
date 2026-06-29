import { UnrecoverableError, Worker } from "bullmq";
import { and, eq, inArray } from "drizzle-orm";

import { db, schema } from "@azimuth/db";
import { advanceOrderStatus } from "@azimuth/api";
import { alertAdminNewOrder, alertAdminRefund, notifyOrderPlaced, notifyRefundInitiated } from "@azimuth/comms";
import { createLogisticsService, createRazorpayService } from "@azimuth/api";

import { redisOpts } from "./connection.js";
import { getCustomerContact, orderInfo } from "./comms.js";
import { orderQueue } from "./order.queue.js";
import type {
  OrderJobData,
  PaymentCapturedJob,
  PaymentFailedJob,
  BookShipmentJob,
  InitiateRefundJob,
  CancelShipmentJob,
  ReturnShipmentJob,
} from "./order.queue.js";

// ── DB job tracking helpers ───────────────────────────────────────────────────

async function dbJobRunning(dbJobId: string, attempt: number) {
  await db
    .update(schema.backgroundJobs)
    .set({ status: "running", attempts: attempt, updatedAt: new Date() })
    .where(eq(schema.backgroundJobs.id, dbJobId))
    .catch((e: unknown) => console.warn("[worker] dbJobRunning:", e));
}

async function dbJobCompleted(dbJobId: string, result: Record<string, unknown>) {
  await db
    .update(schema.backgroundJobs)
    .set({ status: "completed", result, completedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.backgroundJobs.id, dbJobId))
    .catch((e: unknown) => console.warn("[worker] dbJobCompleted:", e));
}

async function dbJobFailed(dbJobId: string, errorMessage: string, isFinal: boolean, attempt: number) {
  await db
    .update(schema.backgroundJobs)
    .set({
      status: isFinal ? "failed" : "pending",
      attempts: attempt,
      errorMessage,
      updatedAt: new Date(),
    })
    .where(eq(schema.backgroundJobs.id, dbJobId))
    .catch((e: unknown) => console.warn("[worker] dbJobFailed:", e));
}

// ── Job processors ────────────────────────────────────────────────────────────

async function processPaymentCaptured(data: PaymentCapturedJob) {
  const { razorpayOrderId, razorpayPaymentId, amountPaise } = data;

  const order = await db.query.orders.findFirst({
    where: eq(schema.orders.razorpayOrderId, razorpayOrderId),
  });

  if (!order) {
    console.warn(`[order-worker] No order for razorpay_order_id=${razorpayOrderId}`);
    return {};
  }

  if (order.status !== "pending_payment") {
    console.log(`[order-worker] Order ${order.orderNumber} already ${order.status}, skipping capture`);
    if ((order.status === "paid" || order.status === "processing") && !order.delhiveryWaybill) {
      await enqueueBookShipment(order.id);
    }
    return {};
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

  const updatedOrder = await db.query.orders.findFirst({ where: eq(schema.orders.id, order.id) });
  if (updatedOrder) {
    const contact = await getCustomerContact(updatedOrder);
    const info = orderInfo(updatedOrder);
    await Promise.all([
      notifyOrderPlaced(contact, info),
      alertAdminNewOrder(info),
    ]);
  }

  await enqueueBookShipment(order.id);
  console.log(`[order-worker] Enqueued book_shipment for order=${order.id}`);
  return {};
}

async function enqueueBookShipment(orderId: string) {
  const [dbJob] = await db
    .insert(schema.backgroundJobs)
    .values({
      type: "book_shipment",
      status: "pending",
      payload: { type: "book_shipment", orderId },
      orderId,
    })
    .returning({ id: schema.backgroundJobs.id });

  const bullJob = await orderQueue.add("book_shipment", {
    type: "book_shipment",
    orderId,
    dbJobId: dbJob?.id,
  });

  if (dbJob) {
    await db
      .update(schema.backgroundJobs)
      .set({ bullmqJobId: bullJob.id?.toString() })
      .where(eq(schema.backgroundJobs.id, dbJob.id))
      .catch(() => {});
  }
}

async function processPaymentFailed(data: PaymentFailedJob) {
  const { razorpayOrderId, razorpayPaymentId } = data;

  await db
    .update(schema.paymentAttempts)
    .set({ gatewayPaymentId: razorpayPaymentId ?? null, status: "failed" })
    .where(eq(schema.paymentAttempts.gatewayOrderId, razorpayOrderId));

  console.log(`[order-worker] Payment failed for rzp_order_id=${razorpayOrderId}`);
  return {};
}

async function processBookShipment(data: BookShipmentJob) {
  const { orderId } = data;

  const order = await db.query.orders.findFirst({
    where: eq(schema.orders.id, orderId),
    with: { items: true },
  });

  if (!order) {
    console.warn(`[order-worker] book_shipment: order ${orderId} not found`);
    return {};
  }

  if (order.delhiveryWaybill) {
    console.log(`[order-worker] Order ${order.orderNumber} already has waybill ${order.delhiveryWaybill}, skipping`);
    return { waybill: order.delhiveryWaybill };
  }

  const BOOK_SHIPMENT_BLOCKED = ["delivered", "cancelled", "refunded", "rto_initiated", "rto_delivered", "refund_processing"];
  if (BOOK_SHIPMENT_BLOCKED.includes(order.status)) {
    console.log(`[order-worker] book_shipment: order ${order.orderNumber} is ${order.status} — skipping, nothing to do`);
    return {};
  }

  const addr = order.shippingAddress as {
    fullName?: string; phone?: string;
    line1?: string; line2?: string | null;
    city?: string; state?: string; pincode?: string;
  };

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

  let totalWeightGrams = 0;
  let maxWeight = 0;
  let boxL = 15, boxW = 10, boxH = 10;

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

  return { waybill: result.waybill, trackingUrl: result.trackingUrl };
}

async function processInitiateRefund(data: InitiateRefundJob) {
  const { orderId, razorpayPaymentId, amountPaise, reason } = data;

  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
  if (!order) {
    console.warn(`[order-worker] initiate_refund: order ${orderId} not found`);
    return {};
  }
  if (order.status === "refunded") {
    console.log(`[order-worker] Order ${order.orderNumber} already refunded, skipping`);
    return {};
  }
  if (order.status === "refund_processing") {
    console.log(`[order-worker] initiate_refund: order ${order.orderNumber} refund already in progress — skipping`);
    return {};
  }

  const svc = createRazorpayService();
  let refund: { id: string; amount: number };
  try {
    refund = await svc.refundPayment({
      paymentId: razorpayPaymentId,
      amountPaise,
      receipt: `refund-${order.orderNumber}`,
      notes: { orderId, orderNumber: order.orderNumber, reason },
    });
  } catch (err) {
    if (err instanceof Error && err.message.toLowerCase().includes("duplicate receipt")) {
      // Refund already submitted in a prior attempt (crash/timeout before job completed).
      // Idempotent: advance order to refund_processing so webhook can close the loop.
      console.warn(`[order-worker] initiate_refund: duplicate receipt for order ${order.orderNumber} — refund already exists, completing idempotently`);
      await advanceOrderStatus(
        db, orderId, "refund_processing", "worker:order",
        "Razorpay refund previously submitted (recovered from duplicate receipt on retry)",
      );
      return { note: "duplicate_receipt_idempotent" };
    }
    throw err;
  }

  // Mark refund_processing — webhook refund.processed will advance to refunded
  await advanceOrderStatus(
    db, orderId, "refund_processing", "worker:order",
    `Razorpay refund initiated: ${refund.id} (₹${(amountPaise / 100).toFixed(2)}) — awaiting refund.processed webhook`,
  );

  // Notify customer now (they care that refund was submitted; money arrives in 5-7 days)
  const contact = await getCustomerContact(order);
  const info = orderInfo(order);
  await notifyRefundInitiated(contact, info)
    .catch((e: unknown) => console.error("[order-worker] refund notify:", e));

  console.log(`[order-worker] Refund initiated for order ${order.orderNumber}: ${refund.id}`);
  return { razorpayRefundId: refund.id, amountPaise: refund.amount };
}

async function processCancelShipment(data: CancelShipmentJob) {
  const { orderId, waybill } = data;

  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
  if (!order) {
    throw new UnrecoverableError(`cancel_shipment: order ${orderId} not found`);
  }

  const CANCEL_BLOCKED = ["delivered", "rto_delivered"];
  if (CANCEL_BLOCKED.includes(order.status)) {
    console.log(`[order-worker] cancel_shipment: order ${order.orderNumber} is ${order.status} — skipping`);
    return {};
  }

  if (order.delhiveryWaybill !== waybill) {
    console.log(`[order-worker] cancel_shipment: waybill mismatch for order ${order.orderNumber} (job=${waybill}, current=${order.delhiveryWaybill ?? "none"}) — skipping`);
    return {};
  }

  const logistics = createLogisticsService();
  await logistics.cancelShipment(waybill);
  console.log(`[order-worker] Cancelled shipment waybill=${waybill} for order ${orderId}`);
  return { waybill };
}

async function processReturnShipment(data: ReturnShipmentJob) {
  const {
    orderId, ticketId, action,
    originalOrderNumber, customerName, customerPhone,
    pickupAddress, returnReason, adminId, pickupDate,
  } = data;

  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
  if (!order) {
    throw new UnrecoverableError(`return_shipment: order ${orderId} not found`);
  }

  const RETURN_BLOCKED = ["rto_initiated", "rto_delivered", "refunded", "refund_processing", "cancelled"];
  if (RETURN_BLOCKED.includes(order.status)) {
    console.log(`[order-worker] return_shipment: order ${order.orderNumber} is ${order.status} — skipping, nothing to do`);
    return {};
  }

  const delvSvc = createLogisticsService();

  if (action === "exchange") {
    // ── Exchange: creates reverse pickup + new forward shipment in one call ───
    const orderWithItems = await db.query.orders.findFirst({
      where: eq(schema.orders.id, orderId),
      with: { items: true },
    });
    if (!orderWithItems) throw new UnrecoverableError(`exchange_shipment: order ${orderId} missing items`);

    const exchangeResult = await delvSvc.createExchangeShipment({
      originalOrderNumber,
      customerName,
      customerPhone,
      pickupAddress,
      returnReason,
      weightGrams: 500,
      lengthCm: 15,
      widthCm: 10,
      heightCm: 10,
      pickupDate,
      items: orderWithItems.items.map((i) => ({
        name: i.productName,
        sku: i.variantSku,
        units: i.quantity,
        price: Number(i.unitPrice),
      })),
    });

    if (exchangeResult.status === "failed") {
      throw new Error(`Exchange shipment failed: ${exchangeResult.errorMessage}`);
    }

    // Store exchange return AWB in returnWaybill so the is_return=1 webhook can find this order
    if (exchangeResult.returnAwb) {
      await db
        .update(schema.orders)
        .set({ returnWaybill: exchangeResult.returnAwb })
        .where(eq(schema.orders.id, orderId));
    }

    await advanceOrderStatus(db, orderId, "rto_initiated", "worker:order", "Exchange pickup scheduled");

    await db.insert(schema.ticketActions).values({
      ticketId,
      adminId,
      actionType: "exchange_scheduled",
      metadata: {
        returnOrderId: exchangeResult.returnOrderId,
        forwardOrderId: exchangeResult.forwardOrderId,
        returnShipmentId: exchangeResult.returnShipmentId,
        forwardShipmentId: exchangeResult.forwardShipmentId,
        returnAwb: exchangeResult.returnAwb,
        forwardAwb: exchangeResult.forwardAwb,
      },
    });

    await db.update(schema.tickets).set({ status: "awaiting_user", updatedAt: new Date() }).where(eq(schema.tickets.id, ticketId));
    await db.insert(schema.ticketMessages).values({
      ticketId, senderId: adminId, senderRole: "admin",
      content: `We've scheduled a return pickup for your order. A replacement will be shipped once we receive the item back.`,
    });

    console.log(`[order-worker] Exchange scheduled for order ${orderId}: returnShipment=${exchangeResult.returnShipmentId}, forwardShipment=${exchangeResult.forwardShipmentId}`);
    return { returnShipmentId: exchangeResult.returnShipmentId, forwardShipmentId: exchangeResult.forwardShipmentId };
  }

  // ── Return: reverse pickup only ─────────────────────────────────────────────
  const returnResult = await delvSvc.createReturnShipment({
    originalOrderNumber,
    customerName,
    customerPhone,
    pickupAddress,
    returnReason,
    weightGrams: 500,
    lengthCm: 15,
    widthCm: 10,
    heightCm: 10,
    pickupDate,
  });

  if (returnResult.status === "failed") {
    throw new Error(`Return shipment failed: ${returnResult.errorMessage}`);
  }

  await db
    .update(schema.orders)
    .set({ returnWaybill: returnResult.waybill })
    .where(eq(schema.orders.id, orderId));

  await advanceOrderStatus(
    db, orderId, "rto_initiated", "worker:order",
    `Return pickup scheduled. Reverse AWB: ${returnResult.waybill}`,
  );

  await db.insert(schema.ticketActions).values({
    ticketId, adminId, actionType: "return_scheduled",
    metadata: { reverseWaybill: returnResult.waybill, trackingUrl: returnResult.trackingUrl },
  });

  await db.update(schema.tickets).set({ status: "awaiting_user", updatedAt: new Date() }).where(eq(schema.tickets.id, ticketId));
  await db.insert(schema.ticketMessages).values({
    ticketId, senderId: adminId, senderRole: "admin",
    content: `We've scheduled a return pickup for your order. Reverse AWB: ${returnResult.waybill}. Track at ${returnResult.trackingUrl}`,
  });

  console.log(`[order-worker] Return pickup scheduled for order ${orderId}: AWB=${returnResult.waybill}`);
  return { waybill: returnResult.waybill, trackingUrl: returnResult.trackingUrl };
}

// ── Worker ────────────────────────────────────────────────────────────────────

export function startOrderWorker() {
  const worker = new Worker<OrderJobData, Record<string, unknown>>(
    "order-events",
    async (job) => {
      const { data } = job;
      if (data.type === "payment_captured") {
        return await processPaymentCaptured(data);
      } else if (data.type === "payment_failed") {
        return await processPaymentFailed(data);
      } else if (data.type === "book_shipment") {
        return await processBookShipment(data);
      } else if (data.type === "initiate_refund") {
        return await processInitiateRefund(data);
      } else if (data.type === "cancel_shipment") {
        return await processCancelShipment(data);
      } else if (data.type === "return_shipment") {
        return await processReturnShipment(data);
      }
      return {};
    },
    {
      connection: redisOpts(),
      concurrency: 5,
    },
  );

  worker.on("active", async (job) => {
    const dbJobId = (job.data as { dbJobId?: string }).dbJobId;
    if (dbJobId) {
      await dbJobRunning(dbJobId, job.attemptsMade + 1);
    }
  });

  worker.on("completed", async (job) => {
    const dbJobId = (job.data as { dbJobId?: string }).dbJobId;
    if (dbJobId) {
      await dbJobCompleted(dbJobId, (job.returnvalue as Record<string, unknown>) ?? {});
    }
    console.log(`[order-worker] Job ${job.id} (${job.data.type}) done`);
  });

  worker.on("failed", async (job, err) => {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(
      `[order-worker] Job ${job?.id} (${job?.data.type}) failed attempt ${job?.attemptsMade}/${job?.opts.attempts}: ${errMsg}`,
    );

    const dbJobId = (job?.data as { dbJobId?: string } | undefined)?.dbJobId;
    const isFinal = (job?.attemptsMade ?? 0) >= (job?.opts.attempts ?? 1);

    if (dbJobId) {
      await dbJobFailed(dbJobId, errMsg, isFinal, job?.attemptsMade ?? 0);
    }

    if (
      job &&
      job.name === "book_shipment" &&
      isFinal
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

  return worker;
}
