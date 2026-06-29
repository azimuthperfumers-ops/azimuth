import { orderQueue } from "@azimuth/queue";

export async function handlePaymentCaptured(
  paymentEntity: Record<string, unknown>,
  eventId: string,
) {
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

  console.log(`[webhook:razorpay] payment.captured enqueued rzp_order=${razorpayOrderId}`);
}
