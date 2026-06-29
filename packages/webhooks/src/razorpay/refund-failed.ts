import { and, desc, eq } from "drizzle-orm";

import { db, schema } from "@azimuth/db";
import { advanceOrderStatus } from "@azimuth/api";

// refund.failed fires when Razorpay cannot process the refund (rare).
// Reverts order from refund_processing to previous status.
// Marks the background job failed so admin sees it in job queue.
export async function handleRefundFailed(refundEntity: Record<string, unknown>) {
  const paymentId = refundEntity.payment_id as string | undefined;
  const refundId = refundEntity.id as string | undefined;
  const failReason = String(refundEntity.description ?? refundEntity.failure_reason ?? "Unknown");
  if (!paymentId) return;

  const order = await db.query.orders.findFirst({
    where: eq(schema.orders.razorpayPaymentId, paymentId),
  });
  if (!order) return;

  if (order.status === "refund_processing") {
    const [prevEntry] = await db
      .select({ fromStatus: schema.orderStatusHistory.fromStatus })
      .from(schema.orderStatusHistory)
      .where(eq(schema.orderStatusHistory.orderId, order.id))
      .orderBy(desc(schema.orderStatusHistory.createdAt))
      .limit(1);

    const revertTo = prevEntry?.fromStatus ?? "paid";
    await advanceOrderStatus(
      db, order.id, revertTo, "webhook:razorpay",
      `Refund FAILED: ${refundId ?? "?"} — ${failReason}. Reverted to ${revertTo}. Retry required.`,
    );
  }

  // Mark the background job failed so it shows in admin job queue
  const [job] = await db
    .select({ id: schema.backgroundJobs.id })
    .from(schema.backgroundJobs)
    .where(and(eq(schema.backgroundJobs.orderId, order.id), eq(schema.backgroundJobs.type, "initiate_refund")))
    .orderBy(desc(schema.backgroundJobs.createdAt))
    .limit(1);

  if (job) {
    await db
      .update(schema.backgroundJobs)
      .set({ status: "failed", errorMessage: `refund.failed: ${failReason}`, updatedAt: new Date() })
      .where(eq(schema.backgroundJobs.id, job.id));
  }

  console.error(
    `[webhook:razorpay] REFUND FAILED for order ${order.orderNumber} — manual retry required. refund=${refundId ?? "?"} reason=${failReason}`,
  );
}
