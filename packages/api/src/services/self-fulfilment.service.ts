// Pulling an order out of Shiprocket and shipping it ourselves.
//
// Shiprocket sometimes sits on a booked parcel for days — no pickup, ETD sliding
// forward, customer waiting. The way out is physical: post it yourself. This
// module is what makes that survivable in the data, because a naive "cancel it on
// the dashboard" is actively harmful — Shiprocket then pushes a CANCELED webhook,
// applyCourierStatus cancels the whole order, and an order that is genuinely in
// the post shows the customer "Cancelled" and the admin "Refund due".
//
// Detaching a parcel therefore does five things at once:
//   1. moves its AWB out of `waybill` into `detachedWaybill`, so no Shiprocket
//      code path — webhook, reconcile, re-book — can ever match it again,
//   2. records the courier we're actually using and its consignment number,
//   3. queues the recall of that AWB at Shiprocket (retried, because Shiprocket
//      being unreachable is the whole reason we're here),
//   4. re-derives the order status from the parcels, which is what lifts a
//      wrongly-cancelled order back out of `cancelled` and clears "Refund due",
//   5. puts the goods back off the shelf if the earlier cancellation restocked
//      them — they're leaving the building after all.

import type { Database } from "@azimuth/db";
import { schema } from "@azimuth/db";
import { and, eq } from "drizzle-orm";

import { alertAdminOrderDelivered, notifyOrderDelivered } from "@azimuth/comms";

import { orderQueue } from "../lib/order-queue";
import { advanceOrderStatus } from "../repositories/order.repository";
import { getOrderContact, toOrderInfo } from "./order-notify";
import { createInventoryRepository } from "../repositories/inventory.repository";
import {
  advanceShipmentStatus,
  deriveOrderStatus,
  getOrderShipments,
  type ShipmentRow,
  type ShipmentStatus,
} from "../repositories/shipment.repository";

type OrderRow = typeof schema.orders.$inferSelect;

export interface SelfFulfilParcelInput {
  shipmentId: string;
  /** Consignment / tracking number at the new courier. Optional — not every parcel has one yet. */
  trackingNumber?: string;
  /** Tracking page for this parcel, if the courier has one. */
  trackingUrl?: string;
}

export interface SelfFulfilInput {
  orderId: string;
  /** As the customer would recognise it: "India Post — Speed Post", "Delhivery (direct)". */
  courierName: string;
  /** Why we pulled it out of Shiprocket. Mandatory: this is the record of the decision. */
  reason: string;
  parcels: SelfFulfilParcelInput[];
  /** Ask Shiprocket to cancel the old AWBs. Off only when it was already cancelled there. */
  cancelAtCourier: boolean;
  /** True when the parcel is already in the post; false when it's packed but not handed over. */
  markShipped: boolean;
}

export interface SelfFulfilResult {
  orderNumber: string;
  detached: number;
  /** Parcels whose AWB recall was queued at Shiprocket. */
  recallQueued: number;
  orderStatus: OrderRow["status"];
  /** True when this rescued an order that a courier cancellation had already killed. */
  revivedFromCancelled: boolean;
  restocked: boolean;
}

/** Statuses where the goods are gone or the money is settled — self-fulfilment is meaningless. */
const BLOCKED_ORDER_STATUSES: readonly string[] = ["delivered", "refund_processing", "refunded"];

/**
 * Hand the named parcels of an order to our own courier.
 *
 * Idempotent per parcel: a parcel already on the manual channel is updated (new
 * tracking number, corrected courier) rather than detached twice, and its AWB is
 * never recalled a second time.
 */
export async function selfFulfilOrder(
  db: Database,
  input: SelfFulfilInput,
  actorId: string,
): Promise<SelfFulfilResult> {
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, input.orderId) });
  if (!order) throw new Error("Order not found");

  if (BLOCKED_ORDER_STATUSES.includes(order.status)) {
    throw new Error(
      `Cannot self-ship a ${order.status.replace(/_/g, " ")} order — the goods or the money are already settled.`,
    );
  }
  if (order.refundMethod) {
    throw new Error(
      "A refund has already been issued for this order. Ship the goods under a new order instead, so the money and the parcel don't disagree.",
    );
  }

  const all = await getOrderShipments(db, input.orderId);
  const byId = new Map(all.map((s) => [s.id, s]));

  const targets = input.parcels.map((p) => {
    const parcel = byId.get(p.shipmentId);
    if (!parcel) throw new Error(`Package ${p.shipmentId} does not belong to this order`);
    return { input: p, parcel };
  });
  if (targets.length === 0) throw new Error("Select at least one package to ship yourself");

  const wasCancelled = order.status === "cancelled";
  const shippedAt = input.markShipped ? new Date() : null;
  // A parcel already in the post is in_transit; one that's packed but not handed
  // over is only booked — with us, not with a courier.
  const newStatus: ShipmentStatus = input.markShipped ? "in_transit" : "booked";

  const recalls: { shipmentId: string; waybill: string }[] = [];
  let detached = 0;

  for (const { input: wanted, parcel } of targets) {
    // The AWB to release: normally the live one, but a re-run (or a parcel
    // detached earlier) has already moved it aside.
    const shiprocketAwb = parcel.waybill ?? parcel.detachedWaybill;
    const alreadyManual = parcel.fulfillmentChannel === "manual";
    const recall = input.cancelAtCourier && parcel.waybill != null;

    await db
      .update(schema.orderShipments)
      .set({
        fulfillmentChannel: "manual",
        manualCourierName: input.courierName,
        manualTrackingNumber: wanted.trackingNumber ?? parcel.manualTrackingNumber,
        manualTrackingUrl: wanted.trackingUrl ?? parcel.manualTrackingUrl,
        manualShippedAt: shippedAt ?? parcel.manualShippedAt,

        // Everything below is Shiprocket's and is now stale. Clearing `waybill`
        // is the load-bearing part: it releases the unique index and takes the
        // parcel out of every AWB lookup in the codebase.
        waybill: null,
        trackingUrl: null,
        estimatedDeliveryDate: null,
        pickupScheduledDate: null,
        shiprocketShipmentId: null,
        errorMessage: null,

        detachedWaybill: shiprocketAwb,
        detachedAt: parcel.detachedAt ?? new Date(),
        detachedBy: parcel.detachedBy ?? actorId,
        detachReason: input.reason,

        courierCancelState: recall ? "pending" : parcel.courierCancelState,
        courierCancelNote: recall ? null : parcel.courierCancelNote,
      })
      .where(eq(schema.orderShipments.id, parcel.id));

    if (!alreadyManual) detached += 1;

    const trackingNote = wanted.trackingNumber ? ` · ${input.courierName} ${wanted.trackingNumber}` : ` · ${input.courierName}`;
    const detachNote = `Detached from Shiprocket${shiprocketAwb ? ` (AWB ${shiprocketAwb})` : ""}${trackingNote} · ${input.reason}`;

    // advanceShipmentStatus no-ops when the parcel is already in the target
    // status — which is common here (a parcel already in_transit stays in_transit).
    // The detach must land in the parcel's trail either way, so annotate when the
    // transition didn't write one.
    const moved = await advanceShipmentStatus(db, parcel.id, newStatus, actorId, detachNote);
    if (!moved) {
      await db.insert(schema.orderShipmentEvents).values({
        shipmentId: parcel.id,
        orderId: input.orderId,
        fromStatus: parcel.status,
        toStatus: parcel.status,
        note: detachNote,
        actorId,
      });
    }

    if (recall && shiprocketAwb) recalls.push({ shipmentId: parcel.id, waybill: shiprocketAwb });
  }

  // ── The order-level AWB fields must stop pointing at a dead shipment ────────
  // Legacy single-parcel lookups read orders.waybill, and applyCourierStatus falls
  // back to it when no parcel row matches — leaving a detached AWB there would let
  // a late cancellation webhook cancel the order through the back door.
  const fresh = await getOrderShipments(db, input.orderId);
  const liveShiprocket = fresh.find((s) => s.fulfillmentChannel === "shiprocket" && s.waybill);
  await db
    .update(schema.orders)
    .set({
      waybill: liveShiprocket?.waybill ?? null,
      trackingUrl: liveShiprocket?.trackingUrl ?? null,
      estimatedDeliveryDate: liveShiprocket?.estimatedDeliveryDate ?? null,
    })
    .where(eq(schema.orders.id, input.orderId));

  // ── Goods leave the building again ─────────────────────────────────────────
  const restocked = await redispatchStock(db, order, actorId);

  // ── The order follows its parcels ──────────────────────────────────────────
  const derived = deriveOrderStatus(fresh.map((s) => s.status));
  const parcelSummary = targets
    .map(({ input: w, parcel }) => `P${parcel.packageNumber}${w.trackingNumber ? ` ${w.trackingNumber}` : ""}`)
    .join(", ");
  const note =
    `Self-shipped via ${input.courierName} (${parcelSummary}) — unlinked from Shiprocket. ${input.reason}`;

  if (derived && derived !== order.status) {
    await advanceOrderStatus(db, input.orderId, derived, actorId, note);
  } else {
    // Status genuinely unchanged (e.g. still processing) — the decision still has
    // to be readable in the trail, so annotate rather than transition.
    await db.insert(schema.orderStatusHistory).values({
      orderId: input.orderId,
      fromStatus: order.status,
      toStatus: order.status,
      note,
      actorId,
    });
  }

  // ── Recall the old AWBs, out of band ───────────────────────────────────────
  for (const recall of recalls) {
    await queueParcelRecall(db, input.orderId, recall.shipmentId, recall.waybill);
  }

  const after = await db.query.orders.findFirst({
    where: eq(schema.orders.id, input.orderId),
    columns: { status: true },
  });

  return {
    orderNumber: order.orderNumber,
    detached,
    recallQueued: recalls.length,
    orderStatus: after?.status ?? order.status,
    revivedFromCancelled: wasCancelled && after?.status !== "cancelled",
    restocked,
  };
}

/**
 * A courier cancellation restocks the order (goods aren't going out after all).
 * Self-fulfilment reverses that: they are going out, just by another route. The
 * ledger dedupes on (order, variant, reason), and `sale` is already spent from
 * the original payment — so the re-dispatch is its own movement, which also keeps
 * the two events distinguishable in the inventory trail.
 *
 * Only fires when a `return` movement actually exists: an order detached before it
 * was ever cancelled never went back on the shelf, and must not be decremented twice.
 */
async function redispatchStock(db: Database, order: OrderRow, actorId: string): Promise<boolean> {
  const items = await db.query.orderItems.findMany({
    where: eq(schema.orderItems.orderId, order.id),
  });

  const inventory = createInventoryRepository(db);
  let moved = false;

  for (const item of items) {
    if (!item.variantId) continue;

    const [returned] = await db
      .select({ id: schema.inventoryLedger.id })
      .from(schema.inventoryLedger)
      .where(
        and(
          eq(schema.inventoryLedger.refType, "order"),
          eq(schema.inventoryLedger.refId, order.id),
          eq(schema.inventoryLedger.variantId, item.variantId),
          eq(schema.inventoryLedger.reason, "return"),
        ),
      )
      .limit(1);
    if (!returned) continue;

    const [already] = await db
      .select({ id: schema.inventoryLedger.id })
      .from(schema.inventoryLedger)
      .where(
        and(
          eq(schema.inventoryLedger.refType, "order"),
          eq(schema.inventoryLedger.refId, order.id),
          eq(schema.inventoryLedger.variantId, item.variantId),
          eq(schema.inventoryLedger.reason, "replacement_out"),
        ),
      )
      .limit(1);
    if (already) continue;

    try {
      await inventory.recordMovement({
        variantId: item.variantId,
        delta: -item.quantity,
        reason: "replacement_out",
        refType: "order",
        refId: order.id,
        actorId,
        note: `Re-dispatched under self-fulfilment for ${order.orderNumber} after courier cancellation`,
        // Money is already captured — never block a dispatch on a stock guard.
        allowNegative: true,
      });
      moved = true;
    } catch (err) {
      console.error(
        `[self-fulfilment] re-dispatch movement failed for order=${order.id} variant=${item.variantId}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return moved;
}

/** Queue the Shiprocket-side recall of one detached AWB, tracked in the job table. */
async function queueParcelRecall(db: Database, orderId: string, shipmentId: string, waybill: string) {
  const payload = { type: "cancel_parcel" as const, orderId, shipmentId, waybill };
  const [job] = await db
    .insert(schema.backgroundJobs)
    .values({ type: "cancel_parcel", status: "pending", payload, orderId })
    .returning({ id: schema.backgroundJobs.id });
  const bull = await orderQueue.add("cancel_parcel", { ...payload, dbJobId: job?.id });
  if (job) {
    await db
      .update(schema.backgroundJobs)
      .set({ bullmqJobId: bull.id?.toString() })
      .where(eq(schema.backgroundJobs.id, job.id))
      .catch(() => {});
  }
}

// ── Moving a self-shipped parcel along ───────────────────────────────────────
// No courier is pushing us events for these, so the admin drives them by hand.
// Kept here (not in the router) so the order-status derivation that follows a
// parcel move is identical to the courier path's.

/** What an admin may set on a self-shipped parcel. No RTO/cancel — those are courier concepts. */
export const MANUAL_PARCEL_STATUSES = [
  "booked",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
] as const;

export type ManualParcelStatus = (typeof MANUAL_PARCEL_STATUSES)[number];

export async function setManualParcelStatus(
  db: Database,
  shipmentId: string,
  status: ManualParcelStatus,
  actorId: string,
  note?: string,
): Promise<{ orderStatus: OrderRow["status"]; parcel: ShipmentRow }> {
  const parcel = await db.query.orderShipments.findFirst({
    where: eq(schema.orderShipments.id, shipmentId),
  });
  if (!parcel) throw new Error("Package not found");
  if (parcel.fulfillmentChannel !== "manual") {
    throw new Error("This package is still on Shiprocket — its status comes from the courier.");
  }

  await advanceShipmentStatus(db, shipmentId, status, actorId, note ?? "Updated by admin (self-shipped)");

  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, parcel.orderId) });
  if (!order) throw new Error("Order not found");

  const siblings = await getOrderShipments(db, parcel.orderId);
  const derived = deriveOrderStatus(siblings.map((s) => s.status));
  if (derived && derived !== order.status) {
    await advanceOrderStatus(
      db,
      parcel.orderId,
      derived,
      actorId,
      `Package ${parcel.packageNumber} (${parcel.manualCourierName ?? "self-shipped"}) → ${status.replace(/_/g, " ")}`,
    );

    // Shiprocket notifies the customer itself on its own parcels; ours has no one
    // doing that, so the delivery mail/SMS has to come from here or not at all.
    if (derived === "delivered") {
      const contact = await getOrderContact(db, order);
      const info = toOrderInfo(order);
      await Promise.all([notifyOrderDelivered(contact, info), alertAdminOrderDelivered(info)]).catch((e) =>
        console.error("[self-fulfilment] delivered notify:", e),
      );
    }
  }

  const updated = await db.query.orderShipments.findFirst({
    where: eq(schema.orderShipments.id, shipmentId),
  });
  const after = await db.query.orders.findFirst({
    where: eq(schema.orders.id, parcel.orderId),
    columns: { status: true },
  });

  return { orderStatus: after?.status ?? order.status, parcel: updated ?? parcel };
}
