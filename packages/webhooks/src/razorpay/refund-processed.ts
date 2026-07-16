import { and, eq, inArray } from "drizzle-orm";

import { db, schema } from "@azimuth/db";
import { advanceOrderStatus } from "@azimuth/api";
import { alertAdminRefund } from "@azimuth/comms";
import { orderInfo } from "@azimuth/queue";

// refund.processed fires when money is actually sent to customer's account.
// This is the authoritative signal to mark order refunded and close the support ticket.
export async function handleRefundProcessed(refundEntity: Record<string, unknown>) {
  const paymentId = refundEntity.payment_id as string | undefined;
  const refundId = refundEntity.id as string | undefined;
  if (!paymentId || !refundId) return;

  const order = await db.query.orders.findFirst({
    where: eq(schema.orders.razorpayPaymentId, paymentId),
  });

  if (!order) {
    console.warn(`[webhook:razorpay] refund.processed: no order for payment_id=${paymentId}`);
    return;
  }
  if (order.status === "refunded") {
    console.log(`[webhook:razorpay] order ${order.orderNumber} already refunded`);
    return;
  }

  await advanceOrderStatus(
    db, order.id, "refunded", "webhook:razorpay",
    `Razorpay refund confirmed: ${refundId}`,
  );

  // Close any open refund-linked tickets now that money has landed
  await db
    .update(schema.tickets)
    .set({ status: "resolved", updatedAt: new Date() })
    .where(
      and(
        eq(schema.tickets.orderId, order.id),
        inArray(schema.tickets.status, ["open", "awaiting_admin", "awaiting_user"]),
      ),
    );

  await alertAdminRefund(orderInfo(order), "razorpay").catch(() => {});

  console.log(`[webhook:razorpay] order ${order.orderNumber} → refunded (${refundId})`);
}
