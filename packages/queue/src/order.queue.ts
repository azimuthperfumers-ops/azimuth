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

export type ExpirePendingPaymentsJob = {
  type: "expire_pending_payments";
};

export type ReturnShipmentJob = {
  type: "return_shipment";
  dbJobId?: string;
  orderId: string;
  ticketId: string;
  action: "return" | "exchange";
  originalOrderNumber: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: {
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    pincode: string;
  };
  returnReason: string;
  adminId: string;
  pickupDate?: string;
};

export type OrderJobData =
  | PaymentCapturedJob
  | PaymentFailedJob
  | BookShipmentJob
  | InitiateRefundJob
  | CancelShipmentJob
  | ReturnShipmentJob
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

export async function scheduleExpirePendingPayments() {
  await orderQueue.upsertJobScheduler(
    "expire-pending-payments",
    { every: 5 * 60 * 1000 },
    { name: "expire_pending_payments", data: { type: "expire_pending_payments" } },
  );
}
