/** Customer-facing name for each order status. Shared so the account page, the
 *  delete-account blockers list and anywhere else read identically. */
export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending_payment: "Awaiting payment",
  payment_failed: "Payment failed",
  paid: "Payment confirmed",
  processing: "Processing",
  picked_up: "Picked up by courier",
  out_for_delivery: "Out for delivery",
  delivery_attempted: "Delivery attempted",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refund_processing: "Refund processing",
  refunded: "Refunded",
  rto_initiated: "Return in transit",
  rto_delivered: "Return delivered",
  return_requested: "Return requested",
  return_approved: "Return approved",
  exchange_requested: "Exchange requested",
};

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABEL[status] ?? status.replace(/_/g, " ");
}
