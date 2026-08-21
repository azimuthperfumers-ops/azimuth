import { Queue } from "bullmq";

export type BookShipmentJob = { type: "book_shipment"; dbJobId?: string; orderId: string };
export type InitiateRefundJob = { type: "initiate_refund"; dbJobId?: string; orderId: string; razorpayPaymentId: string; amountPaise: number; reason: string };
export type CancelShipmentJob = { type: "cancel_shipment"; dbJobId?: string; orderId: string; waybill: string };
/** Recall one parcel's AWB after it was detached from Shiprocket for self-fulfilment. */
export type CancelParcelJob = { type: "cancel_parcel"; dbJobId?: string; orderId: string; shipmentId: string; waybill: string };

/**
 * Fail one abandoned checkout once its payment window closes. Carries the order
 * it was queued for so the worker reads a single row instead of scanning the
 * table — see `scheduleOrderPaymentExpiry`. `orderId` is optional because the
 * worker's 6-hourly safety-net sweep reuses this same job type unscoped.
 */
export type ExpirePendingPaymentsJob = { type: "expire_pending_payments"; orderId?: string };

export type OrderJobPayload =
  | BookShipmentJob
  | InitiateRefundJob
  | CancelShipmentJob
  | CancelParcelJob
  | ExpirePendingPaymentsJob;

/** Payment window. Mirrors PENDING_PAYMENT_TIMEOUT_MS in @azimuth/queue — the
 *  producer can't import the worker package (circular dep). */
const PENDING_PAYMENT_TIMEOUT_MS = 30 * 60 * 1000;

function redisOpts() {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  const parsed = new URL(url);
  const isTls = parsed.protocol === "rediss:";
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || (isTls ? "6380" : "6379"), 10),
    username: parsed.username || undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    tls: isTls ? {} : undefined,
    maxRetriesPerRequest: null as null,
    keepAlive: 20000,
  };
}

// Producer-only queue — worker lives in @azimuth/queue to avoid circular deps
export const orderQueue = new Queue<OrderJobPayload>("order-events", {
  connection: redisOpts(),
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

/**
 * Arm a one-shot timer to expire this order when its payment window closes.
 *
 * Replaces what used to be a blind 5-minute sweep. That sweep queried Postgres
 * 288x/day whether or not any order was actually pending, which kept the Neon
 * compute permanently awake (it autosuspends after 5 minutes idle) and burned
 * the entire free compute allowance on finding nothing. A checkout's deadline
 * is known the moment it starts, so schedule against it instead of hunting.
 *
 * `jobId` keys the timer to the order, so a retried mutation can't arm two.
 */
export async function scheduleOrderPaymentExpiry(orderId: string) {
  await orderQueue.add(
    "expire_pending_payments",
    { type: "expire_pending_payments", orderId },
    {
      // A minute past the window so the worker's own cutoff check can't lose a race.
      delay: PENDING_PAYMENT_TIMEOUT_MS + 60_000,
      jobId: `expire:${orderId}`,
      attempts: 3,
    },
  );
}
