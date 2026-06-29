import { Queue } from "bullmq";
import { redisOpts } from "./connection.js";

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
  | ReturnShipmentJob;

export const orderQueue = new Queue<OrderJobData>("order-events", {
  connection: redisOpts(),
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});
