import { orderQueue } from "@azimuth/queue";

export async function handlePaymentFailed(
  paymentEntity: Record<string, unknown>,
  eventId: string,
) {
  const razorpayOrderId = paymentEntity.order_id as string | undefined;
  if (!razorpayOrderId) return;

  await orderQueue.add("payment_failed", {
    type: "payment_failed",
    eventId,
    razorpayOrderId,
    razorpayPaymentId: (paymentEntity.id as string | undefined) ?? null,
  });

  console.log(`[webhook:razorpay] payment.failed enqueued rzp_order=${razorpayOrderId}`);
}
