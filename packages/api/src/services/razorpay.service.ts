import crypto from "crypto";

import Razorpay from "razorpay";

export interface IRazorpayService {
  getKeyId(): string;
  createOrder(params: {
    amountPaise: number;
    currency: string;
    receipt: string;
    orderId: string;
  }): Promise<{ id: string; amount: number; currency: string }>;
  verifyPaymentSignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    signature: string,
  ): boolean;
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
  refundPayment(params: {
    paymentId: string;
    amountPaise: number;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<{ id: string; amount: number }>;
}

class RazorpayService implements IRazorpayService {
  private rzp: Razorpay;
  private keyId: string;
  private keySecret: string;
  private webhookSecret: string;

  constructor(keyId: string, keySecret: string, webhookSecret: string) {
    this.rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
    this.keyId = keyId;
    this.keySecret = keySecret;
    this.webhookSecret = webhookSecret;
  }

  getKeyId() {
    return this.keyId;
  }

  async createOrder(params: {
    amountPaise: number;
    currency: string;
    receipt: string;
    orderId: string;
  }) {
    const order = await this.rzp.orders.create({
      amount: params.amountPaise,
      currency: params.currency,
      receipt: params.receipt,
      notes: { orderId: params.orderId },
    });
    return { id: order.id, amount: Number(order.amount), currency: order.currency };
  }

  verifyPaymentSignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    signature: string,
  ): boolean {
    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expected = crypto.createHmac("sha256", this.keySecret).update(body).digest("hex");
    const expBuf = Buffer.from(expected, "utf8");
    const sigBuf = Buffer.from(signature, "utf8");
    if (expBuf.byteLength !== sigBuf.byteLength) return false;
    return crypto.timingSafeEqual(expBuf, sigBuf);
  }

  async refundPayment(params: {
    paymentId: string;
    amountPaise: number;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<{ id: string; amount: number }> {
    const refund = await this.rzp.payments.refund(params.paymentId, {
      amount: params.amountPaise,
      speed: "normal",
      receipt: params.receipt,
      notes: params.notes ?? {},
    });
    return { id: refund.id, amount: Number(refund.amount) };
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const expected = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(rawBody)
      .digest("hex");
    const expBuf = Buffer.from(expected, "utf8");
    const sigBuf = Buffer.from(signature, "utf8");
    if (expBuf.byteLength !== sigBuf.byteLength) return false;
    return crypto.timingSafeEqual(expBuf, sigBuf);
  }
}

export function createRazorpayService(): IRazorpayService {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  const missing = [
    !keyId && "RAZORPAY_KEY_ID",
    !keySecret && "RAZORPAY_KEY_SECRET",
    !webhookSecret && "RAZORPAY_WEBHOOK_SECRET",
  ]
    .filter(Boolean)
    .join(", ");

  if (missing) throw new Error(`Razorpay not configured: ${missing} missing`);

  return new RazorpayService(keyId!, keySecret!, webhookSecret!);
}
