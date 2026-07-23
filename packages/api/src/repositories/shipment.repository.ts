import { asc, eq } from "drizzle-orm";

import type { Database } from "@azimuth/db";
import { schema } from "@azimuth/db";

import { splitIntoPackages, type VariantDims } from "../services/packaging";

export type ShipmentRow = typeof schema.orderShipments.$inferSelect;
export type ShipmentStatus = ShipmentRow["status"];
export type OrderStatus = typeof schema.orders.$inferSelect["status"];

// ── Parcel rows for an order ──────────────────────────────────────────────────

/**
 * Materialise the parcels for an order — one per unit — and return them ordered.
 *
 * Idempotent: the (order_id, package_number) unique index means a retried booking
 * reuses the existing rows instead of creating a second set, so a parcel that
 * already has an AWB is never re-booked.
 */
export async function ensureOrderShipments(db: Database, orderId: string): Promise<ShipmentRow[]> {
  const existing = await getOrderShipments(db, orderId);
  if (existing.length > 0) return existing;

  const items = await db.query.orderItems.findMany({
    where: eq(schema.orderItems.orderId, orderId),
    orderBy: asc(schema.orderItems.id),
  });
  if (items.length === 0) return [];

  const variantIds = items.map((i) => i.variantId).filter((id): id is string => id != null);
  const variants =
    variantIds.length > 0
      ? await db.query.productVariants.findMany({
          where: (v, { inArray }) => inArray(v.id, variantIds),
          columns: { id: true, weightGrams: true, boxLengthCm: true, boxWidthCm: true, boxHeightCm: true },
        })
      : [];

  const dims = new Map<string, VariantDims>(variants.map((v) => [v.id, v]));

  const packages = splitIntoPackages(
    items.map((item) => ({
      orderItemId: item.id,
      variantId: item.variantId,
      productName: item.productName,
      variantSku: item.variantSku,
      sizeMl: item.sizeMl,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
    })),
    dims,
  );

  await db
    .insert(schema.orderShipments)
    .values(
      packages.map((pkg) => ({
        orderId,
        packageNumber: pkg.packageNumber,
        orderItemId: pkg.orderItemId,
        variantId: pkg.variantId,
        productName: pkg.productName,
        variantSku: pkg.variantSku,
        sizeMl: pkg.sizeMl,
        weightGrams: pkg.weightGrams,
        lengthCm: pkg.lengthCm,
        widthCm: pkg.widthCm,
        heightCm: pkg.heightCm,
        status: "pending" as const,
      })),
    )
    // A concurrent booking attempt may have inserted them first — take theirs.
    .onConflictDoNothing();

  return getOrderShipments(db, orderId);
}

export function getOrderShipments(db: Database, orderId: string): Promise<ShipmentRow[]> {
  return db.query.orderShipments.findMany({
    where: eq(schema.orderShipments.orderId, orderId),
    orderBy: asc(schema.orderShipments.packageNumber),
  });
}

// ── Parcel status transitions (append-only) ───────────────────────────────────

/**
 * Move one parcel to a new status and record the transition. No-ops when the
 * status is unchanged, so repeated courier webhooks don't pad the audit trail.
 */
export async function advanceShipmentStatus(
  db: Database,
  shipmentId: string,
  toStatus: ShipmentStatus,
  actorId: string,
  note?: string,
): Promise<ShipmentRow | undefined> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ status: schema.orderShipments.status })
      .from(schema.orderShipments)
      .where(eq(schema.orderShipments.id, shipmentId));

    if (!current) return undefined;
    if (current.status === toStatus) return undefined;

    const [updated] = await tx
      .update(schema.orderShipments)
      .set({ status: toStatus })
      .where(eq(schema.orderShipments.id, shipmentId))
      .returning();

    if (updated) {
      await tx.insert(schema.orderShipmentEvents).values({
        shipmentId,
        orderId: updated.orderId,
        fromStatus: current.status,
        toStatus,
        note: note ?? null,
        actorId,
      });
    }

    return updated;
  });
}

// ── Order status derived from its parcels ─────────────────────────────────────

// How far along the order is, given one parcel. The order can only be as far
// along as its least-advanced parcel, so these are compared by rank.
const PROGRESS: Record<string, { rank: number; orderStatus: OrderStatus }> = {
  pending: { rank: 0, orderStatus: "processing" },
  failed: { rank: 0, orderStatus: "processing" },
  booked: { rank: 1, orderStatus: "processing" },
  picked_up: { rank: 2, orderStatus: "picked_up" },
  in_transit: { rank: 2, orderStatus: "picked_up" },
  out_for_delivery: { rank: 3, orderStatus: "out_for_delivery" },
  delivered: { rank: 4, orderStatus: "delivered" },
};

/**
 * Collapse per-parcel statuses into the single status shown on the order.
 *
 * The order lags its slowest parcel — "delivered" only once every parcel landed —
 * except for states that need attention now (a failed delivery attempt, a parcel
 * heading back to us), which surface as soon as any one parcel enters them.
 *
 * Returns null when the parcels imply no order-level status (all cancelled, or
 * no parcels at all), meaning "leave the order status alone".
 */
export function deriveOrderStatus(statuses: ShipmentStatus[]): OrderStatus | null {
  const live = statuses.filter((s) => s !== "cancelled");
  if (live.length === 0) return null;

  // Needs attention now — don't wait for the other parcels.
  if (live.includes("delivery_attempted")) return "delivery_attempted";
  if (live.includes("rto_initiated")) return "rto_initiated";

  // Every parcel came back: the order as a whole is an RTO.
  if (live.every((s) => s === "rto_delivered")) return "rto_delivered";

  // A returned parcel is finished travelling — it shouldn't hold the order back,
  // but it must not count as delivered either.
  const inFlight = live.filter((s) => s !== "rto_delivered");
  if (inFlight.length === 0) return null;

  let slowest = PROGRESS[inFlight[0]!] ?? PROGRESS.pending!;
  for (const status of inFlight) {
    const progress = PROGRESS[status];
    if (progress && progress.rank < slowest.rank) slowest = progress;
  }
  return slowest.orderStatus;
}
