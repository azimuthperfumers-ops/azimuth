// Courier status → order/shipment state machine. This is the single source of
// truth for "a courier told us AWB X is now status Y": it's driven both by the
// Shiprocket webhook (push) and by the admin "reconcile" action (pull via the
// tracking API). Keeping it here — not in the webhook HTTP layer — is what lets
// the pull path reuse the exact same mapping and side effects.

import type { Database } from "@azimuth/db";
import { schema } from "@azimuth/db";
import { eq } from "drizzle-orm";

import {
  alertAdminDeliveryFailed,
  alertAdminOrderDelivered,
  notifyOrderDelivered,
} from "@azimuth/comms";

import {
  advanceOrderStatus,
  applyOrderStockMovement,
} from "../repositories/order.repository";
import {
  advanceShipmentStatus,
  deriveOrderStatus,
  getOrderShipments,
} from "../repositories/shipment.repository";
import { createLogisticsService } from "./logistics.service";
import { getOrderContact, toOrderInfo } from "./order-notify";

type OrderRow = typeof schema.orders.$inferSelect;
type ShipmentRow = typeof schema.orderShipments.$inferSelect;
type OurOrderStatus = OrderRow["status"];
type ShipmentStatus = ShipmentRow["status"];

// Courier status → the status of the parcel it refers to. An order dispatches as
// several parcels, so an update only ever describes one of them; the order's own
// status is derived from all of them afterwards (deriveOrderStatus).
const SHIPMENT_STATUS_MAP: Record<string, ShipmentStatus | null> = {
  "PICKUP SCHEDULED": null,
  "PICKUP GENERATED": null,
  "MANIFEST GENERATED": null,
  "MANIFESTED": null,
  "OUT FOR PICKUP": null,
  "PICKUP QUEUED": null,

  "PICKED UP": "picked_up",
  "PICKUP DONE": "picked_up",

  "SHIPPED": "in_transit",
  "IN TRANSIT": "in_transit",
  "REACHED AT DESTINATION HUB": "in_transit",
  "REACHED DESTINATION HUB": "in_transit",
  "DISPATCHED": "in_transit",
  "ARRIVED AT DESTINATION": "in_transit",

  "OUT FOR DELIVERY": "out_for_delivery",
  "SHIPMENT OUT FOR DELIVERY": "out_for_delivery",

  "DELIVERED": "delivered",
  "SHIPMENT DELIVERED": "delivered",

  "UNDELIVERED": "delivery_attempted",
  "DELIVERY FAILED": "delivery_attempted",
  "NDR": "delivery_attempted",
  "NOT DELIVERED": "delivery_attempted",
  "DELIVERY ATTEMPTED": "delivery_attempted",

  "RETURN TO ORIGIN": "rto_initiated",
  "RTO INITIATED": "rto_initiated",
  "RTO IN TRANSIT": "rto_initiated",
  "RTO OUT FOR DELIVERY": "rto_initiated",
  "LOST": "rto_initiated",

  "RTO DELIVERED": "rto_delivered",
};

// Legacy single-parcel orders have no shipment row — map straight to order status.
const STATUS_MAP: Record<string, OurOrderStatus | null> = {
  "PICKUP SCHEDULED": null,
  "PICKUP GENERATED": null,
  "MANIFEST GENERATED": null,
  "MANIFESTED": null,
  "OUT FOR PICKUP": null,
  "PICKUP QUEUED": null,

  "PICKED UP": "picked_up",
  "PICKUP DONE": "picked_up",

  "SHIPPED": null,
  "IN TRANSIT": null,
  "REACHED AT DESTINATION HUB": null,
  "REACHED DESTINATION HUB": null,
  "DISPATCHED": null,
  "ARRIVED AT DESTINATION": null,

  "OUT FOR DELIVERY": "out_for_delivery",
  "SHIPMENT OUT FOR DELIVERY": "out_for_delivery",

  "DELIVERED": "delivered",
  "SHIPMENT DELIVERED": "delivered",

  "UNDELIVERED": "delivery_attempted",
  "DELIVERY FAILED": "delivery_attempted",
  "NDR": "delivery_attempted",
  "NOT DELIVERED": "delivery_attempted",
  "DELIVERY ATTEMPTED": "delivery_attempted",

  "RETURN TO ORIGIN": "rto_initiated",
  "RTO INITIATED": "rto_initiated",
  "RTO IN TRANSIT": "rto_initiated",
  "RTO OUT FOR DELIVERY": "rto_initiated",
  "LOST": "rto_initiated",

  "RTO DELIVERED": "rto_delivered",
};

const TERMINAL: readonly string[] = ["delivered", "refunded", "rto_delivered"];

// Order states that already reflect a cancellation/refund — a cancellation event
// arriving on one of these has nothing left to do.
const CANCEL_HANDLED: readonly string[] = ["cancelled", "refund_processing", "refunded"];

// Shiprocket reports cancellation with a few different phrasings (CANCELED,
// CANCELLATION REQUESTED, …). None are forward-movement statuses, so they aren't
// in STATUS_MAP — we branch on them explicitly instead.
export function isCancellationStatus(rawStatus: string): boolean {
  return rawStatus.toUpperCase().includes("CANCEL");
}

// One courier status update for a single AWB (parcel). Fields beyond awb/status
// are optional enrichments — the webhook has them, the tracking-pull may not.
export interface CourierStatusUpdate {
  awb: string;
  currentStatus: string;
  courierName?: string;
  etd?: string;
  pod?: string;
  /** When the courier is scheduled to collect (Shiprocket sends this on every event). */
  pickupScheduledDate?: string;
}

/**
 * Shiprocket's `pod` field is not always a link. On most delivered events it
 * carries the *availability* word — "Available" / "Not Available" — and only
 * sometimes the actual image URL. Storing the word put `src="Available"` in the
 * admin, which the browser resolved against the current page: a broken image
 * that navigated to /orders/Available when clicked.
 *
 * So: a POD is only a POD if it's an http(s) URL. Anything else means the
 * courier has one on file but didn't hand it over, and we show nothing.
 */
export function podImageFrom(pod: string | undefined | null): string | null {
  const value = String(pod ?? "").trim();
  return /^https?:\/\//i.test(value) ? value : null;
}

export interface ApplyResult {
  awb: string;
  matched: boolean;
  changed: boolean;
  message: string;
}

/**
 * Apply one courier status update to the order/shipment it belongs to.
 * `actorId` is stamped on every audit-trail row so the source is visible
 * ("webhook:shiprocket" vs "admin:reconcile:<uid>").
 */
export async function applyCourierStatus(
  db: Database,
  update: CourierStatusUpdate,
  actorId = "webhook:shiprocket",
): Promise<ApplyResult> {
  const awb = String(update.awb ?? "").trim();
  const rawStatus = (update.currentStatus ?? "").trim().toUpperCase();
  const cancellation = isCancellationStatus(rawStatus);

  if (!awb) return { awb, matched: false, changed: false, message: "empty AWB" };

  if (!cancellation && !(rawStatus in STATUS_MAP)) {
    return { awb, matched: false, changed: false, message: `unknown status "${rawStatus}"` };
  }

  const note = [
    update.courierName && `Courier: ${update.courierName}`,
    rawStatus,
    update.etd && `ETD: ${update.etd}`,
  ]
    .filter(Boolean)
    .join(" · ");

  // An AWB the admin deliberately pulled out of Shiprocket is dead to us: the
  // parcel is in the post under our own courier. Shiprocket still emits events for
  // it — the CANCELED that follows the recall above all — and acting on those
  // would cancel an order that is genuinely on its way, show the customer
  // "Cancelled" and put the order in the Refund due queue. Drop them here, before
  // any lookup that could match the order another way.
  const detached = await db.query.orderShipments.findFirst({
    where: eq(schema.orderShipments.detachedWaybill, awb),
  });
  if (detached && detached.fulfillmentChannel === "manual") {
    console.log(
      `[shipment-sync] ignoring "${rawStatus}" for AWB=${awb} — package P${detached.packageNumber} was detached from Shiprocket and is being shipped by us`,
    );
    return { awb, matched: false, changed: false, message: "AWB detached — self-fulfilled package" };
  }

  // The AWB identifies one parcel. Orders placed before per-parcel shipments
  // existed have no shipment row, so fall back to the order-level AWB.
  const shipment = await db.query.orderShipments.findFirst({
    where: eq(schema.orderShipments.waybill, awb),
  });

  const order = shipment
    ? await db.query.orders.findFirst({ where: eq(schema.orders.id, shipment.orderId) })
    : await db.query.orders.findFirst({ where: eq(schema.orders.waybill, awb) });

  if (!order) {
    console.warn(`[shipment-sync] no order for AWB=${awb} (actor=${actorId})`);
    return { awb, matched: false, changed: false, message: "no matching order" };
  }
  if (TERMINAL.includes(order.status)) {
    return { awb, matched: true, changed: false, message: `order already ${order.status}` };
  }

  // Courier-side cancellation → its own path (cancel + refund), not a forward move.
  if (cancellation) {
    const changed = await handleCourierCancellation(db, order, shipment, note, actorId);
    return { awb, matched: true, changed, message: changed ? "cancelled · refund pending admin decision" : "cancellation already handled" };
  }

  // ── Update the parcel this update is about ─────────────────────────────────
  let targetStatus: OurOrderStatus | null | undefined;

  if (shipment) {
    // Enrichments ride on every event (including "PICKUP SCHEDULED", which carries
    // no status change) — persist them regardless of whether the status advances.
    const enrich: Partial<typeof schema.orderShipments.$inferInsert> = {};
    if (update.pickupScheduledDate) enrich.pickupScheduledDate = update.pickupScheduledDate;
    if (update.etd) enrich.estimatedDeliveryDate = update.etd;
    if (update.courierName) enrich.courierName = update.courierName;
    if (Object.keys(enrich).length > 0) {
      await db.update(schema.orderShipments).set(enrich).where(eq(schema.orderShipments.id, shipment.id));
    }

    const parcelStatus = SHIPMENT_STATUS_MAP[rawStatus];
    if (parcelStatus) {
      const podUrl = parcelStatus === "delivered" ? podImageFrom(update.pod) : null;
      if (podUrl) {
        await db.update(schema.orderShipments).set({ podImageUrl: podUrl }).where(eq(schema.orderShipments.id, shipment.id));
      }
      await advanceShipmentStatus(db, shipment.id, parcelStatus, actorId, note || undefined);
    }

    // The order moves on what ALL its parcels are doing, not just this one.
    const siblings = await getOrderShipments(db, order.id);
    targetStatus = deriveOrderStatus(siblings.map((s) => s.status));

    if (!targetStatus || targetStatus === order.status) {
      return { awb, matched: true, changed: Boolean(parcelStatus), message: `parcel → ${parcelStatus ?? "no change"}; order stays ${order.status}` };
    }
  } else {
    // Legacy single-parcel order — the AWB is the whole order.
    targetStatus = STATUS_MAP[rawStatus];
    if (!targetStatus || targetStatus === order.status) {
      return { awb, matched: true, changed: false, message: `order stays ${order.status}` };
    }
    if (update.etd) {
      await db.update(schema.orders).set({ estimatedDeliveryDate: update.etd }).where(eq(schema.orders.id, order.id));
    }
    const podUrl = targetStatus === "delivered" ? podImageFrom(update.pod) : null;
    if (podUrl) {
      await db.update(schema.orders).set({ podImageUrl: podUrl }).where(eq(schema.orders.id, order.id));
    }
  }

  await advanceOrderStatus(db, order.id, targetStatus, actorId, note || undefined);

  // Courier RTO completed — undelivered parcel physically back at warehouse.
  if (targetStatus === "rto_delivered") {
    await applyOrderStockMovement(db, order.id, "return", "RTO parcel received back at warehouse");
  }

  // Shiprocket sends courier tracking notifications (shipped/OFD/delivered/NDR) to
  // customers directly. We only alert admin on delivery failure.
  if (targetStatus === "delivery_attempted") {
    await alertAdminDeliveryFailed(toOrderInfo(order)).catch((e) => console.error("[shipment-sync] delivery-failed alert:", e));
  }

  // Delivered: customer "rate your purchase" nudge + admin ping.
  if (targetStatus === "delivered") {
    const contact = await getOrderContact(db, order);
    const info = toOrderInfo(order);
    await Promise.all([notifyOrderDelivered(contact, info), alertAdminOrderDelivered(info)]).catch((e) =>
      console.error("[shipment-sync] delivered notify:", e),
    );
  }

  return { awb, matched: true, changed: true, message: `order → ${targetStatus}` };
}

/**
 * The shipment was cancelled at the courier. Mirror the admin cancel flow so admin
 * + customer see the change and the money comes back:
 *   1. mark the affected parcel cancelled,
 *   2. if the WHOLE order is cancelled → restock, refund (wallet instant / Razorpay
 *      queued), move the order to `cancelled`, and alert admin,
 *   3. if only SOME parcels are cancelled → keep the order moving on the rest but
 *      flag admin, since a partial refund needs a human decision.
 * Returns true when it made a change.
 */
async function handleCourierCancellation(
  db: Database,
  order: OrderRow,
  shipment: ShipmentRow | undefined,
  note: string,
  actorId: string,
): Promise<boolean> {
  if (CANCEL_HANDLED.includes(order.status)) {
    return false;
  }

  if (shipment && shipment.status !== "cancelled") {
    await advanceShipmentStatus(db, shipment.id, "cancelled", actorId, note || undefined);
  }

  // A courier cancellation NEVER auto-refunds. The refund — whether to refund at
  // all, and to wallet vs bank — is a deliberate admin decision made from the
  // dashboard. Here we only reflect the cancellation and flag it for that decision.

  // Partial vs whole-order cancellation. With no shipment row (legacy single-parcel
  // order) the AWB is the whole order, so it's always a whole-order cancellation.
  if (shipment) {
    const siblings = await getOrderShipments(db, order.id);
    const live = siblings.filter((s) => s.status !== "cancelled");
    if (live.length > 0) {
      // Other parcels are still shipping — the order carries on, derived from them.
      // A partial refund (if any) is entirely the admin's call.
      const derived = deriveOrderStatus(siblings.map((s) => s.status));
      if (derived && derived !== order.status) {
        await advanceOrderStatus(db, order.id, derived, actorId, `Parcel P${shipment.packageNumber} cancelled at courier · ${note} · partial refund pending admin decision`);
      }
      console.warn(
        `[shipment-sync] order ${order.orderNumber} PARTIAL cancel — parcel P${shipment.packageNumber} cancelled, ` +
          `${live.length} parcel(s) still active; partial refund left to admin`,
      );
      return true;
    }
  }

  // ── Whole order cancelled at the courier ───────────────────────────────────
  // Goods never left the warehouse (or are being sent back) → restock. Idempotent.
  // Inventory returning to the shelf is unrelated to the refund decision.
  if (["paid", "processing"].includes(order.status)) {
    await applyOrderStockMovement(db, order.id, "return", "Order cancelled at courier before dispatch");
  }

  // Move to cancelled and flag for a manual refund decision — do NOT push any refund.
  await advanceOrderStatus(
    db,
    order.id,
    "cancelled",
    actorId,
    note
      ? `Cancelled at courier · ${note} · refund pending admin decision`
      : "Cancelled at courier (Shiprocket) · refund pending admin decision",
  );
  console.log(`[shipment-sync] order ${order.orderNumber} → cancelled (courier cancellation, actor=${actorId}) — refund left to admin`);

  return true;
}

export interface ReconcileResult {
  orderNumber: string;
  checked: number;
  updates: ApplyResult[];
  finalStatus: OurOrderStatus;
}

/**
 * Admin-triggered pull: ask Shiprocket for the live status of every parcel on the
 * order and feed each through applyCourierStatus — the same path the webhook uses.
 * Recovers orders whose webhook was missed (e.g. a dashboard cancellation that
 * never reached us).
 */
export async function reconcileOrderWithCourier(
  db: Database,
  orderId: string,
  actorId: string,
): Promise<ReconcileResult> {
  const order = await db.query.orders.findFirst({
    where: eq(schema.orders.id, orderId),
    with: { shipments: true },
  });
  if (!order) throw new Error("Order not found");

  // Prefer per-parcel AWBs; fall back to the order-level AWB for legacy orders.
  // Self-shipped parcels are skipped: Shiprocket no longer knows anything true
  // about them, and their old AWB reads as CANCELED there.
  const awbs = order.shipments
    .filter((s) => s.waybill && s.status !== "cancelled" && s.fulfillmentChannel !== "manual")
    .map((s) => s.waybill!) as string[];
  if (awbs.length === 0 && order.waybill) awbs.push(order.waybill);

  const logistics = createLogisticsService();
  const updates: ApplyResult[] = [];

  for (const awb of awbs) {
    try {
      const tracking = await logistics.trackShipment(awb);
      if (!tracking.status || tracking.status.toUpperCase() === "UNKNOWN") {
        updates.push({ awb, matched: true, changed: false, message: "no courier status yet" });
        continue;
      }
      const result = await applyCourierStatus(
        db,
        { awb, currentStatus: tracking.status },
        actorId,
      );
      updates.push(result);
    } catch (err) {
      console.error(`[shipment-sync] reconcile AWB=${awb} failed:`, err);
      updates.push({ awb, matched: false, changed: false, message: `tracking failed: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  const fresh = await db.query.orders.findFirst({
    where: eq(schema.orders.id, orderId),
    columns: { status: true, orderNumber: true },
  });

  return {
    orderNumber: order.orderNumber,
    checked: awbs.length,
    updates,
    finalStatus: fresh?.status ?? order.status,
  };
}
