import { UnrecoverableError, Worker } from "bullmq";
import { and, eq, inArray, lt } from "drizzle-orm";

import { db, schema } from "@azimuth/db";
import { advanceOrderStatus, applyOrderStockMovement } from "@azimuth/api";
import { alertAdminNewOrder, alertAdminRefund, notifyOrderPlaced, notifyRefundInitiated } from "@azimuth/comms";
import { createLogisticsService, createRazorpayService } from "@azimuth/api";

import { redisOpts } from "./connection.js";
import { getCustomerContact, orderInfo } from "./comms.js";
import { orderQueue, PENDING_PAYMENT_TIMEOUT_MS } from "./order.queue.js";
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

// Shared by the payment.captured webhook path and the expire-pending-payments sweep's
// reconciliation path (when Razorpay confirms a captured payment we never got a webhook for).
async function markOrderPaidAndBookShipment(
  order: typeof schema.orders.$inferSelect,
  razorpayPaymentId: string,
  note: string,
) {
  await db
    .update(schema.orders)
    .set({ razorpayPaymentId })
    .where(eq(schema.orders.id, order.id));

  await db
    .update(schema.paymentAttempts)
    .set({ gatewayPaymentId: razorpayPaymentId, status: "captured" })
    .where(eq(schema.paymentAttempts.gatewayOrderId, order.razorpayOrderId!));

  await advanceOrderStatus(db, order.id, "paid", "worker:order", note);
  await advanceOrderStatus(db, order.id, "processing", "worker:order", "Shipment booking queued");

  // Stock committed the moment payment lands — idempotent per order+variant
  await applyOrderStockMovement(db, order.id, "sale", `Order ${order.orderNumber} paid`);

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
}

async function processPaymentCaptured(data: PaymentCapturedJob) {
  const { razorpayOrderId, razorpayPaymentId, amountPaise } = data;

  const order = await db.query.orders.findFirst({
    where: eq(schema.orders.razorpayOrderId, razorpayOrderId),
  });

  if (!order) {
    console.warn(`[order-worker] No order for razorpay_order_id=${razorpayOrderId}`);
    return {};
  }

  // payment_failed is recoverable: the order may have been marked abandoned/expired
  // moments before a slow UPI capture landed. Money arrived — fulfil the order.
  if (order.status !== "pending_payment" && order.status !== "payment_failed") {
    console.log(`[order-worker] Order ${order.orderNumber} already ${order.status}, skipping capture`);
    if ((order.status === "paid" || order.status === "processing") && !order.waybill) {
      await enqueueBookShipment(order.id);
    }
    return {};
  }

  if (order.status === "payment_failed") {
    console.warn(`[order-worker] Late capture for ${order.orderNumber} (was payment_failed) — recovering`);
  }

  // Captured amount must cover the order total (rzp order is created server-side with
  // the exact amount, so a mismatch means partial capture or tampering — hold for admin).
  const expectedPaise = Math.round(Number(order.total) * 100);
  if (amountPaise < expectedPaise) {
    console.error(
      `[order-worker] AMOUNT MISMATCH order ${order.orderNumber}: captured ₹${amountPaise / 100} < expected ₹${expectedPaise / 100} — NOT advancing, needs manual review`,
    );
    await db.insert(schema.orderStatusHistory).values({
      orderId: order.id,
      fromStatus: order.status,
      toStatus: order.status,
      note: `payment.captured amount mismatch: got ₹${amountPaise / 100}, expected ₹${expectedPaise / 100} (payment ${razorpayPaymentId}) — held for manual review`,
      actorId: "worker:order",
    });
    return { held: "amount_mismatch" };
  }

  await markOrderPaidAndBookShipment(
    order,
    razorpayPaymentId,
    `payment.captured: ${razorpayPaymentId} (₹${amountPaise / 100})`,
  );

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

  const order = await db.query.orders.findFirst({
    where: eq(schema.orders.razorpayOrderId, razorpayOrderId),
  });

  if (order && order.status === "pending_payment") {
    await advanceOrderStatus(
      db,
      order.id,
      "payment_failed",
      "worker:order",
      `payment.failed webhook: ${razorpayPaymentId ?? "no payment id"}`,
    );
    console.log(`[order-worker] Order ${order.orderNumber} marked payment_failed after payment.failed`);
  } else {
    console.log(`[order-worker] Payment failed for rzp_order_id=${razorpayOrderId}`);
  }

  return {};
}

async function failStaleOrder(order: typeof schema.orders.$inferSelect, note: string) {
  await advanceOrderStatus(db, order.id, "payment_failed", "worker:order", note);

  await db
    .update(schema.paymentAttempts)
    .set({ status: "failed" })
    .where(
      and(
        eq(schema.paymentAttempts.orderId, order.id),
        inArray(schema.paymentAttempts.status, ["created", "authorized"]),
      ),
    );
}

async function processExpirePendingPayments() {
  const cutoff = new Date(Date.now() - PENDING_PAYMENT_TIMEOUT_MS);

  const stale = await db.query.orders.findMany({
    where: and(eq(schema.orders.status, "pending_payment"), lt(schema.orders.createdAt, cutoff)),
  });

  let failedCount = 0;
  let reconciledCount = 0;

  for (const order of stale) {
    // Never trust elapsed time alone — a slow/dropped webhook could mean the customer
    // actually paid. Ask Razorpay directly before failing anything.
    if (!order.razorpayOrderId) {
      await failStaleOrder(order, "Payment window expired — Razorpay order was never created");
      failedCount++;
      continue;
    }

    let payments: { id: string; status: string; amount: number }[];
    try {
      payments = await createRazorpayService().fetchOrderPayments(order.razorpayOrderId);
    } catch (err) {
      console.warn(
        `[order-worker] expire_pending_payments: could not reconcile order ${order.orderNumber} with Razorpay, leaving pending — ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }

    const captured = payments.find((p) => p.status === "captured");
    if (captured) {
      await markOrderPaidAndBookShipment(
        order,
        captured.id,
        `Reconciled from Razorpay (sweep): payment ${captured.id} was captured but no webhook was ever received`,
      );
      reconciledCount++;
      continue;
    }

    const stillInFlight = payments.some((p) => p.status === "authorized");
    if (stillInFlight) {
      // Authorized-but-not-yet-captured (e.g. manual capture flow) — don't fail it, let it resolve.
      console.log(`[order-worker] expire_pending_payments: order ${order.orderNumber} has an authorized payment in flight, skipping`);
      continue;
    }

    await failStaleOrder(
      order,
      `Payment window expired (${PENDING_PAYMENT_TIMEOUT_MS / 60000}min) — Razorpay confirms no captured payment`,
    );
    failedCount++;
  }

  if (failedCount > 0 || reconciledCount > 0) {
    console.log(`[order-worker] expire_pending_payments: marked ${failedCount} payment_failed, reconciled ${reconciledCount} stale order(s)`);
  }

  return { failedCount, reconciledCount };
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

  if (order.waybill) {
    console.log(`[order-worker] Order ${order.orderNumber} already has waybill ${order.waybill}, skipping`);
    return { waybill: order.waybill };
  }

  const BOOK_SHIPMENT_BLOCKED = ["delivered", "cancelled", "payment_failed", "refunded", "rto_initiated", "rto_delivered", "refund_processing"];
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

  // +100g packaging, 500g floor — must match order.estimateShipping so the rate
  // quoted at checkout is computed from the same billable weight as the booking.
  totalWeightGrams = Math.max(500, totalWeightGrams + 100);

  const orderUser = await db.query.user.findFirst({
    where: eq(schema.user.id, order.userId),
    columns: { email: true },
  });

  const logistics = createLogisticsService();
  let result: Awaited<ReturnType<typeof logistics.createShipment>>;
  try {
    result = await logistics.createShipment({
      orderNumber: order.orderNumber,
      customerName: addr.fullName ?? "Customer",
      customerPhone: addr.phone ?? "",
      customerEmail: orderUser?.email ?? undefined,
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
      waybill: result.waybill,
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
    // Retry after a crash between refund API success and status update: Razorpay
    // rejects the second full refund — treat as already-refunded and complete.
    if (err instanceof Error && err.message.toLowerCase().includes("fully refunded")) {
      console.warn(`[order-worker] initiate_refund: payment already fully refunded for order ${order.orderNumber} — completing idempotently`);
      await advanceOrderStatus(
        db, orderId, "refund_processing", "worker:order",
        "Razorpay reports payment already fully refunded (recovered on retry) — awaiting refund.processed webhook",
      );
      return { note: "already_fully_refunded_idempotent" };
    }
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

  if (order.waybill !== waybill) {
    console.log(`[order-worker] cancel_shipment: waybill mismatch for order ${order.orderNumber} (job=${waybill}, current=${order.waybill ?? "none"}) — skipping`);
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

  const RETURN_BLOCKED = ["rto_initiated", "rto_delivered", "refunded", "refund_processing", "cancelled", "payment_failed"];
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
      } else if (data.type === "expire_pending_payments") {
        return await processExpirePendingPayments();
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
