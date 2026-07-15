import { Queue } from "bullmq";

export type BookShipmentJob = { type: "book_shipment"; dbJobId?: string; orderId: string };
export type InitiateRefundJob = { type: "initiate_refund"; dbJobId?: string; orderId: string; razorpayPaymentId: string; amountPaise: number; reason: string };
export type CancelShipmentJob = { type: "cancel_shipment"; dbJobId?: string; orderId: string; waybill: string };

export type OrderJobPayload = BookShipmentJob | InitiateRefundJob | CancelShipmentJob;

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
