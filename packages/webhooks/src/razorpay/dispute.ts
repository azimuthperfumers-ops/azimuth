import { eq } from "drizzle-orm";

import { db, schema } from "@azimuth/db";
import { advanceOrderStatus } from "@azimuth/api";

// Handles all payment.dispute.* events.
// Writes a note to orderStatusHistory for audit trail.
// action_required logs as error — admin must respond to bank within deadline.
export async function handleDispute(
  disputeEntity: Record<string, unknown>,
  eventType: string,
) {
  const paymentId = disputeEntity.payment_id as string | undefined;
  const disputeId = disputeEntity.id as string | undefined;
  const reason = String(disputeEntity.reason_code ?? disputeEntity.reason_description ?? "Unknown");
  const amount = disputeEntity.amount as number | undefined;
  const respondBy = disputeEntity.respond_by as string | undefined;

  if (!paymentId) return;

  const order = await db.query.orders.findFirst({
    where: eq(schema.orders.razorpayPaymentId, paymentId),
  });

  if (!order) {
    console.warn(`[webhook:razorpay] ${eventType}: no order for payment_id=${paymentId}`);
    return;
  }

  const isUrgent = eventType === "payment.dispute.action_required";

  const note = [
    `DISPUTE${isUrgent ? " (ACTION REQUIRED)" : ""}: ${eventType}`,
    `Dispute ID: ${disputeId ?? "?"}`,
    `Reason: ${reason}`,
    amount ? `Amount: ₹${(amount / 100).toFixed(2)}` : null,
    respondBy ? `Respond by: ${respondBy}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Keep order status, just append audit note
  await advanceOrderStatus(db, order.id, order.status, "webhook:razorpay", note);

  console[isUrgent ? "error" : "warn"](
    `[webhook:razorpay] ${note} — order ${order.orderNumber}`,
  );
}
