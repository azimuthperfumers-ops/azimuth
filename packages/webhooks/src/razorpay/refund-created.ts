// refund.created fires when Razorpay accepts the refund request.
// Worker already set order to refund_processing after the API call.
// No DB state change needed here — just log for audit trail.
export function handleRefundCreated(refundEntity: Record<string, unknown>) {
  const refId = String(refundEntity.id ?? "?");
  const pmtId = String(refundEntity.payment_id ?? "?");
  console.log(`[webhook:razorpay] refund.created refund=${refId} payment=${pmtId} — awaiting refund.processed`);
}
