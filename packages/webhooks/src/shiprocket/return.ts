import { eq } from "drizzle-orm";

import { db, schema } from "@azimuth/db";
import { advanceOrderStatus, applyOrderStockMovement, orderHasScheduledExchange } from "@azimuth/api";
import { orderQueue } from "@azimuth/queue";
import { alertAdminExchangeReceived, alertAdminRefund, notifyRefundInitiated } from "@azimuth/comms";
import { getCustomerContact, orderInfo } from "@azimuth/queue";

import type { ShiprocketBody } from "./forward.js";

type OurOrderStatus = typeof schema.orders.$inferSelect["status"];

// Return/reverse shipment status mapping.
// is_return=1 events: courier picking up from customer → bringing back to warehouse.
const STATUS_MAP: Record<string, OurOrderStatus | null> = {
  // Courier heading to customer for pickup
  "OUT FOR PICKUP": null,
  "PICKUP SCHEDULED": null,
  "MANIFESTED": null,

  // Courier picked up return from customer
  "PICKED UP": "rto_initiated",
  "PICKUP DONE": "rto_initiated",

  // Return in transit back to warehouse
  "IN TRANSIT": null,
  "SHIPPED": null,
  "REACHED AT DESTINATION HUB": null,

  // Return delivered back to warehouse
  "DELIVERED": "rto_delivered",
  "SHIPMENT DELIVERED": "rto_delivered",

  // Failed to pick up from customer — no status change, just log
  "UNDELIVERED": null,
  "DELIVERY FAILED": null,
  "NDR": null,
  "NOT DELIVERED": null,
};

const TERMINAL: readonly string[] = ["rto_delivered"];

export async function processReturnShipment(body: ShiprocketBody) {
  const awb = String(body.awb ?? "").trim();
  const rawStatus = (body.current_status ?? "").trim().toUpperCase();
  const targetStatus: OurOrderStatus | null | undefined = STATUS_MAP[rawStatus];

  if (targetStatus === null) {
    console.log(`[webhook:shiprocket] [RETURN] AWB=${awb} "${rawStatus}" — no action`);
    return;
  }
  if (targetStatus === undefined) {
    console.log(`[webhook:shiprocket] [RETURN] AWB=${awb} unknown status "${rawStatus}" — ignored`);
    return;
  }

  const order = await db.query.orders.findFirst({
    where: eq(schema.orders.returnWaybill, awb),
  });
  if (!order) {
    console.warn(`[webhook:shiprocket] [RETURN] no order for return AWB=${awb}`);
    return;
  }
  if (TERMINAL.includes(order.status)) {
    console.log(`[webhook:shiprocket] [RETURN] order ${order.orderNumber} already ${order.status} — skip`);
    return;
  }

  const note = [
    "[RETURN]",
    body.courier_name && `Courier: ${body.courier_name}`,
    rawStatus,
  ].filter(Boolean).join(" · ");

  await advanceOrderStatus(db, order.id, targetStatus, "webhook:shiprocket", note);
  console.log(`[webhook:shiprocket] [RETURN] order ${order.orderNumber} → ${targetStatus}`);

  if (targetStatus === "rto_delivered") {
    // Check if this was an exchange (ship replacement) or plain return (refund)
    const isExchange = await orderHasScheduledExchange(db, order.id);

    if (isExchange) {
      // Exchange: returned unit in, replacement unit out — net zero, both on ledger
      await applyOrderStockMovement(db, order.id, "replacement_in", "Exchange item received at warehouse");
      await applyOrderStockMovement(db, order.id, "replacement_out", "Replacement dispatched for exchange");

      // Item back at warehouse — alert admin to ship replacement
      const info = orderInfo(order);
      await alertAdminExchangeReceived(info).catch((e) =>
        console.error("[webhook:shiprocket] [RETURN] exchange alert:", e),
      );
      console.log(`[webhook:shiprocket] [RETURN] exchange item received for ${order.orderNumber} — alert admin to ship`);
    } else {
      // Plain return: item physically back — restock even if refund must be manual
      await applyOrderStockMovement(db, order.id, "return", "Return received at warehouse");

      if (!order.razorpayPaymentId) {
        console.warn(`[webhook:shiprocket] [RETURN] ${order.orderNumber} restocked but has no razorpayPaymentId — refund manually`);
        return;
      }

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
        await db.update(schema.backgroundJobs).set({ bullmqJobId: refundBullJob.id?.toString() }).where(eq(schema.backgroundJobs.id, refundJob.id));
      }
      const contact = await getCustomerContact(order);
      const info = orderInfo(order);
      await Promise.all([notifyRefundInitiated(contact, info), alertAdminRefund(info)]).catch((e) =>
        console.error("[webhook:shiprocket] [RETURN] refund notify:", e),
      );
      console.log(`[webhook:shiprocket] [RETURN] refund queued for ${order.orderNumber}`);
    }
  }
}
