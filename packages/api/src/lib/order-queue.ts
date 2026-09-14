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
export const PENDING_PAYMENT_TIMEOUT_MS = 30 * 60 * 1000;

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
 * It uses `-`, not `:`: BullMQ builds its Redis keys as `bull:<queue>:<jobId>`
 * and rejects any custom id containing a colon ("Custom Id cannot contain :").
 *
 * Never throws and never hangs. This runs after the order row is already
 * committed, so letting it fail would 500 a checkout whose order exists —
 * the customer sees a generic error, retries, and mints duplicates while the
 * payment window they were told about never opens. A timer that was never
 * armed only delays failing an abandoned checkout until the worker's 6-hourly
 * safety-net sweep (`scheduleExpirePendingPayments` in @azimuth/queue), which
 * exists for exactly this case.
 *
 * The timeout is not belt-and-braces: `redisOpts()` sets
 * `maxRetriesPerRequest: null` and leaves ioredis' offline queue enabled, so a
 * command issued while the socket is down waits indefinitely instead of
 * rejecting. try/catch alone would let checkout stall on it.
 */
const ARM_TIMER_TIMEOUT_MS = 3000;

export async function scheduleOrderPaymentExpiry(orderId: string) {
  const add = orderQueue.add(
    "expire_pending_payments",
    { type: "expire_pending_payments", orderId },
    {
      // A minute past the window so the worker's own cutoff check can't lose a race.
      delay: PENDING_PAYMENT_TIMEOUT_MS + 60_000,
      jobId: `expire-${orderId}`,
      attempts: 3,
    },
  );

  // Swallow a late rejection too — the race below leaves `add` unhandled otherwise.
  add.catch(() => undefined);

  const timedOut = Symbol("timeout");
  let timer: NodeJS.Timeout | undefined;
  try {
    const result = await Promise.race([
      add,
      new Promise<typeof timedOut>((resolve) => {
        timer = setTimeout(() => resolve(timedOut), ARM_TIMER_TIMEOUT_MS);
        timer.unref?.();
      }),
    ]);
    if (result === timedOut) {
      console.warn(
        `[order-queue] expiry timer not armed for ${orderId}: redis did not respond in ${ARM_TIMER_TIMEOUT_MS}ms — 6-hourly sweep will settle it`,
      );
    }
  } catch (err) {
    console.warn(
      `[order-queue] expiry timer not armed for ${orderId}: ${(err as Error).message} — 6-hourly sweep will settle it`,
    );
  } finally {
    if (timer) clearTimeout(timer);
  }
}
