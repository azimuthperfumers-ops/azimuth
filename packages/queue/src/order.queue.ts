import { Queue } from "bullmq";
import { redisOpts } from "./connection.js";

// Orders stuck in `pending_payment` with no webhook ever arriving (e.g. user abandons
// the Razorpay checkout) would sit there forever without this sweep. 30 minutes:
// real UPI/netbanking payments can legitimately take a few minutes to settle, and the
// sweep reconciles against Razorpay before failing anything.
export const PENDING_PAYMENT_TIMEOUT_MS = 30 * 60 * 1000;

export type PaymentCapturedJob = {
  type: "payment_captured";
  eventId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amountPaise: number;
};

export type PaymentFailedJob = {
  type: "payment_failed";
  eventId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
};

export type BookShipmentJob = {
  type: "book_shipment";
  dbJobId?: string;
  orderId: string;
};

export type InitiateRefundJob = {
  type: "initiate_refund";
  dbJobId?: string;
  orderId: string;
  razorpayPaymentId: string;
  amountPaise: number;
  reason: string;
};

export type CancelShipmentJob = {
  type: "cancel_shipment";
  dbJobId?: string;
  orderId: string;
  waybill: string;
};

// Recall of ONE parcel's AWB, queued when an admin detaches that parcel from
// Shiprocket to ship it themselves. Unlike cancel_shipment it leaves the order
// (and every other parcel) alone — the goods are still going to the customer.
export type CancelParcelJob = {
  type: "cancel_parcel";
  dbJobId?: string;
  orderId: string;
  shipmentId: string;
  waybill: string;
};

export type ExpirePendingPaymentsJob = {
  type: "expire_pending_payments";
  /** Set by `scheduleOrderPaymentExpiry` — the one order this timer was armed
   *  for. Absent on the safety-net sweep, which scans every pending order. */
  orderId?: string;
};

export type OrderJobData =
  | PaymentCapturedJob
  | PaymentFailedJob
  | BookShipmentJob
  | InitiateRefundJob
  | CancelShipmentJob
  | CancelParcelJob
  | ExpirePendingPaymentsJob;

export const orderQueue = new Queue<OrderJobData>("order-events", {
  connection: redisOpts(),
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

/**
 * Safety net only — the real work is done by the per-order timers armed at
 * checkout (`scheduleOrderPaymentExpiry` in @azimuth/api). This exists purely to
 * catch orders whose timer was lost, e.g. if Redis were flushed between the
 * order being placed and its window closing.
 *
 * Deliberately 6-hourly, not minutes. Neon autosuspends the compute after 5
 * minutes idle, so anything polling faster than that pins the database awake
 * around the clock — this used to run `every: 5 * 60 * 1000` and cost ~6
 * CU-hrs/day doing nothing. Four wake-ups a day is a rounding error, and a
 * lost timer only delays failing an already-abandoned checkout.
 */
export async function scheduleExpirePendingPayments() {
  await orderQueue.upsertJobScheduler(
    "expire-pending-payments",
    { every: 6 * 60 * 60 * 1000 },
    { name: "expire_pending_payments", data: { type: "expire_pending_payments" } },
  );
}
