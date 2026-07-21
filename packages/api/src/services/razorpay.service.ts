import crypto from "crypto";

import Razorpay from "razorpay";
import { env } from "../env";

export interface IRazorpayService {
  getKeyId(): string;
  createOrder(params: {
    amountPaise: number;
    currency: string;
    receipt: string;
    orderId?: string;
    notes?: Record<string, string>;
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
  // Reconciliation: ask Razorpay directly whether a payment ever landed against this
  // order, rather than trusting elapsed time or a client-side "dismiss" event alone —
  // webhooks can be delayed or dropped, and this is the authoritative source.
  fetchOrderPayments(razorpayOrderId: string): Promise<{ id: string; status: string; amount: number }[]>;
}

class RazorpayService implements IRazorpayService {
  private rzp: Razorpay;
  private keyId: string;
  private keySecret: string;
  private webhookSecret: string | undefined;

  constructor(keyId: string, keySecret: string, webhookSecret?: string) {
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
    orderId?: string;
    notes?: Record<string, string>;
  }) {
    const order = await this.rzp.orders.create({
      amount: params.amountPaise,
      currency: params.currency,
      receipt: params.receipt,
      notes: params.notes ?? (params.orderId ? { orderId: params.orderId } : {}),
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let refund: any;
    try {
      refund = await this.rzp.payments.refund(params.paymentId, {
        amount: params.amountPaise,
        speed: "normal",
        receipt: params.receipt,
        notes: params.notes ?? {},
      });
    } catch (raw) {
      // Razorpay SDK throws plain objects, not Error instances
      const msg =
        raw instanceof Error
          ? raw.message
          : typeof raw === "object" && raw !== null
            ? ((raw as { error?: { description?: string }; message?: string }).error?.description ??
              (raw as { message?: string }).message ??
              JSON.stringify(raw))
            : String(raw);
      throw new Error(`Razorpay refund failed: ${msg}`);
    }
    return { id: refund.id, amount: Number(refund.amount) };
  }

  async fetchOrderPayments(razorpayOrderId: string) {
    const { items } = await this.rzp.orders.fetchPayments(razorpayOrderId);
    return items.map((p) => ({ id: p.id, status: p.status, amount: Number(p.amount) }));
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    if (!this.webhookSecret) throw new Error("RAZORPAY_WEBHOOK_SECRET not configured");
    const expected = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(rawBody)
      .digest("hex");
    const expBuf = Buffer.from(expected, "utf8");
    const sigBuf = Buffer.from(signature, "utf8");
    const ok = expBuf.byteLength === sigBuf.byteLength && crypto.timingSafeEqual(expBuf, sigBuf);
    if (!ok) {
      // TEMP DIAGNOSTIC — reveals hidden chars/quotes in the secret without
      // logging the secret itself. Remove once webhooks return 200.
      const s = this.webhookSecret;
      console.warn(
        `[webhook:razorpay][debug] secretLen=${s.length} ` +
          `firstCharCode=${s.charCodeAt(0)} lastCharCode=${s.charCodeAt(s.length - 1)} ` +
          `expectedSig=${expected.slice(0, 12)}… receivedSig=${signature.slice(0, 12)}…`,
      );
    }
    return ok;
  }
}

export function createRazorpayService(): IRazorpayService {
  const keyId = env.RAZORPAY_KEY_ID;
  const keySecret = env.RAZORPAY_KEY_SECRET;

  const missing = [
    !keyId && "RAZORPAY_KEY_ID",
    !keySecret && "RAZORPAY_KEY_SECRET",
  ]
    .filter(Boolean)
    .join(", ");

  if (missing) throw new Error(`Razorpay not configured: ${missing} missing`);

  // webhookSecret optional at init — only required when verifyWebhookSignature is called (webhooks package)
  return new RazorpayService(keyId!, keySecret!, env.RAZORPAY_WEBHOOK_SECRET);
}
