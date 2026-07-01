import { and, eq } from "drizzle-orm";

import { db, schema } from "@azimuth/db";
import { advanceOrderStatus } from "@azimuth/api";
import { orderQueue } from "@azimuth/queue";
import { alertAdminExchangeReceived, alertAdminRefund, notifyRefundInitiated } from "@azimuth/comms";
import { getCustomerContact, orderInfo } from "@azimuth/queue";

import type { DelhiveryWebhookBody } from "./types.js";
import { DELHIVERY_STATUS_MAP } from "./types.js";

const TERMINAL: readonly string[] = ["rto_delivered"];

// Return StatusType → our status
// For reverse shipments: PKD = courier picked up from customer (rto_initiated)
//                        RTD = returned to warehouse (rto_delivered)
const RETURN_STATUS_MAP: Record<string, typeof schema.orders.$inferSelect["status"] | null> = {
  MF: null,
  UD: null,
  OFD: null,  // courier heading to customer for pickup
  PKD: "rto_initiated",   // courier picked up from customer
  IT: null,
  SHP: null,
  OB: null,
  NDR: null,  // failed pickup attempt from customer — just log
  CNR: null,
  DL: "rto_delivered",   // delivered back to warehouse
  RTD: "rto_delivered",
};

export async function processReturnShipment(body: DelhiveryWebhookBody) {
  const awb = (body.Shipment?.AWB ?? "").trim();
  const statusType = (body.Shipment?.Status?.StatusType ?? "").trim().toUpperCase();
  const statusLabel = body.Shipment?.Status?.Status ?? statusType;

  const targetStatus = RETURN_STATUS_MAP[statusType];

  if (targetStatus === null || targetStatus === undefined) {
    console.log(`[webhook:delhivery] [RETURN] AWB=${awb} "${statusType}" — no action`);
    return;
  }

  const order = await db.query.orders.findFirst({
    where: eq(schema.orders.returnWaybill, awb),
  });
  if (!order) {
    console.warn(`[webhook:delhivery] [RETURN] no order for return AWB=${awb}`);
    return;
  }
  if (TERMINAL.includes(order.status)) {
    console.log(`[webhook:delhivery] [RETURN] order ${order.orderNumber} already ${order.status} — skip`);
    return;
  }

  const note = ["[RETURN]", statusLabel, body.Shipment?.Status?.StatusLocation]
    .filter(Boolean)
    .join(" · ");

  await advanceOrderStatus(db, order.id, targetStatus, "webhook:delhivery", note);
  console.log(`[webhook:delhivery] [RETURN] order ${order.orderNumber} AWB=${awb} → ${targetStatus}`);

  if (targetStatus === "rto_delivered") {
    const exchangeAction = await db.query.ticketActions
      .findFirst({
        where: and(eq(schema.ticketActions.actionType, "exchange_scheduled")),
        with: { ticket: { columns: { orderId: true } } },
      })
      .then((a) => (a?.ticket?.orderId === order.id ? a : null));

    if (exchangeAction) {
      const info = orderInfo(order);
      await alertAdminExchangeReceived(info).catch((e) =>
        console.error("[webhook:delhivery] [RETURN] exchange alert:", e),
      );
      console.log(`[webhook:delhivery] [RETURN] exchange item received for ${order.orderNumber}`);
    } else if (order.razorpayPaymentId) {
      const refundPayload = {
        type: "initiate_refund" as const,
        orderId: order.id,
        razorpayPaymentId: order.razorpayPaymentId,
        amountPaise: Math.round(Number(order.total) * 100),
        reason: "Return received at warehouse",
      };
      const [refundJob] = await db
        .insert(schema.backgroundJobs)
        .values({ type: "initiate_refund", status: "pending", payload: refundPayload, orderId: order.id })
        .returning({ id: schema.backgroundJobs.id });
      const refundBullJob = await orderQueue.add("initiate_refund", { ...refundPayload, dbJobId: refundJob?.id });
      if (refundJob) {
        await db
          .update(schema.backgroundJobs)
          .set({ bullmqJobId: refundBullJob.id?.toString() })
          .where(eq(schema.backgroundJobs.id, refundJob.id));
      }
      const contact = await getCustomerContact(order);
      const info = orderInfo(order);
      await Promise.all([notifyRefundInitiated(contact, info), alertAdminRefund(info)]).catch((e) =>
        console.error("[webhook:delhivery] [RETURN] refund notify:", e),
      );
      console.log(`[webhook:delhivery] [RETURN] refund queued for ${order.orderNumber}`);
    }
  }
}
