/**
 * Single source of truth for how an order or parcel status is written and
 * coloured in the admin. Every screen imports from here so a status never reads
 * one way on the orders list and another on the customer page.
 *
 * The palette is deliberately semantic rather than decorative:
 *   amber   — waiting on someone (payment, a return decision)
 *   sky → indigo → violet → cyan  — the parcel moving, deepening as it advances
 *   orange  — went wrong but recoverable (failed attempt, coming back to us)
 *   emerald — money in / delivered
 *   red     — dead (payment failed, cancelled)
 *   slate   — closed and settled, nothing to do
 */

// Mirrors orderStatusEnum in packages/db/src/schema/orders.ts, in the order a
// human would walk through them — also the order of the filter dropdown.
export const ORDER_STATUSES = [
  "pending_payment",
  "payment_failed",
  "paid",
  "processing",
  "picked_up",
  "shipped",
  "out_for_delivery",
  "delivery_attempted",
  "delivered",
  "cancelled",
  "refund_processing",
  "refunded",
  "rto_initiated",
  "rto_delivered",
  "return_requested",
  "return_approved",
  "exchange_requested",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * The subset the orders list can filter on. Deliberately narrower than
 * ORDER_STATUSES: `adminList` validates `status` against ORDER_STATUS_VALUES in
 * packages/api/src/routers/order.router.ts, and offering a value it rejects would
 * just throw. Orders in the other states still appear in the list and still get
 * their own label and colour — you just can't filter down to them yet.
 */
export type OrderStatusFilter = (typeof ORDER_STATUS_FILTERS)[number];

export const ORDER_STATUS_FILTERS = [
  "pending_payment",
  "payment_failed",
  "paid",
  "processing",
  "picked_up",
  "shipped",
  "out_for_delivery",
  "delivery_attempted",
  "delivered",
  "cancelled",
  "refunded",
  "rto_initiated",
  "rto_delivered",
] as const satisfies readonly OrderStatus[];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  payment_failed: "Payment failed",
  paid: "Paid",
  processing: "Processing",
  picked_up: "Picked up",
  shipped: "In transit",
  out_for_delivery: "Out for delivery",
  delivery_attempted: "Delivery attempted",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refund_processing: "Refund processing",
  refunded: "Refunded",
  rto_initiated: "Returning to us",
  rto_delivered: "Return received",
  return_requested: "Return requested",
  return_approved: "Return approved",
  exchange_requested: "Exchange requested",
};

const AMBER = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900";
const RED = "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900";
const EMERALD = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900";
const SKY = "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-900";
const INDIGO = "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-900";
const VIOLET = "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-900";
const CYAN = "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-900";
const ORANGE = "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-900";
const SLATE = "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700";
const FUCHSIA = "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950/50 dark:text-fuchsia-300 dark:border-fuchsia-900";

// Delivered is the one status that earns a filled badge — it's what the whole
// pipeline is aiming at, and it should be findable at a glance down the column.
const DELIVERED = "bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-600 dark:text-white dark:border-emerald-600";

export const ORDER_STATUS_BADGE: Record<OrderStatus, string> = {
  pending_payment: AMBER,
  payment_failed: RED,
  paid: EMERALD,
  processing: SKY,
  picked_up: INDIGO,
  shipped: VIOLET,
  out_for_delivery: CYAN,
  delivery_attempted: ORANGE,
  delivered: DELIVERED,
  cancelled: RED,
  refund_processing: AMBER,
  refunded: SLATE,
  rto_initiated: ORANGE,
  rto_delivered: SLATE,
  return_requested: FUCHSIA,
  return_approved: VIOLET,
  exchange_requested: FUCHSIA,
};

/** Label for any status string, including one this build doesn't know yet. */
export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABEL[status as OrderStatus] ?? status.replace(/_/g, " ");
}

export function orderStatusBadge(status: string): string {
  return ORDER_STATUS_BADGE[status as OrderStatus] ?? SLATE;
}

// ─── Parcels ─────────────────────────────────────────────────────────────────
// Mirrors shipmentStatusEnum. A parcel is finer-grained than the order it
// belongs to: several parcels at different stages roll up into one order status.

export type ShipmentStatus =
  | "pending"
  | "booked"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivery_attempted"
  | "delivered"
  | "cancelled"
  | "rto_initiated"
  | "rto_delivered"
  | "failed";

export const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, string> = {
  pending: "Not booked",
  booked: "Booked",
  picked_up: "Picked up",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivery_attempted: "Delivery attempted",
  delivered: "Delivered",
  cancelled: "Cancelled",
  rto_initiated: "Returning to us",
  rto_delivered: "Return received",
  failed: "Booking failed",
};

export const SHIPMENT_STATUS_BADGE: Record<ShipmentStatus, string> = {
  pending: SLATE,
  booked: SKY,
  picked_up: INDIGO,
  in_transit: VIOLET,
  out_for_delivery: CYAN,
  delivery_attempted: ORANGE,
  delivered: DELIVERED,
  cancelled: RED,
  rto_initiated: ORANGE,
  rto_delivered: SLATE,
  failed: RED,
};

export function shipmentStatusLabel(status: string): string {
  return SHIPMENT_STATUS_LABEL[status as ShipmentStatus] ?? status.replace(/_/g, " ");
}

export function shipmentStatusBadge(status: string): string {
  return SHIPMENT_STATUS_BADGE[status as ShipmentStatus] ?? SLATE;
}

// ─── What the admin actually shows ───────────────────────────────────────────

/**
 * The order enum is coarser than reality: it has no `booked`, so an order whose
 * parcels are printed and waiting for a courier reads "Processing" — the same
 * word it had before anything was booked. That's the flatness on the orders list.
 *
 * Rather than add enum values and migrate on a live store, the admin *displays*
 * the parcels' own stage while the order is in a courier-driven state. The stored
 * order status is untouched — this only changes the words and the colour.
 *
 * Two consequences worth knowing:
 *  - "Booked" and "In transit" can appear here before the order row itself has
 *    caught up, because the parcel rows update on the courier event that the
 *    order-level derivation may have judged a no-op.
 *  - Money and terminal states (paid, cancelled, refunded, delivered, RTO) are
 *    never overridden — those are decided by us, not by a courier.
 */
const PARCEL_DRIVEN: readonly string[] = [
  "processing",
  "picked_up",
  "shipped",
  "out_for_delivery",
  "delivery_attempted",
];

// Same shape as deriveOrderStatus in packages/api — least-advanced parcel wins,
// except states that need attention, which surface immediately. Kept separate on
// purpose: that one must land on the order enum, this one is free to be finer.
const PARCEL_RANK: Record<string, number> = {
  pending: 0,
  failed: 0,
  booked: 1,
  picked_up: 2,
  in_transit: 3,
  out_for_delivery: 4,
  delivered: 5,
};

export function displayOrderStatus(order: {
  status: string;
  shipments?: readonly { status: string }[] | null;
}): { label: string; badge: string } {
  const fallback = {
    label: orderStatusLabel(order.status),
    badge: orderStatusBadge(order.status),
  };

  if (!PARCEL_DRIVEN.includes(order.status)) return fallback;

  const live = (order.shipments ?? []).filter((s) => s.status !== "cancelled");
  if (live.length === 0) return fallback;

  // A parcel in trouble outranks the rest — don't let a healthy sibling hide it.
  const urgent = live.find(
    (s) => s.status === "delivery_attempted" || s.status === "rto_initiated",
  );
  const chosen =
    urgent?.status ??
    live.reduce((slowest, s) =>
      (PARCEL_RANK[s.status] ?? 0) < (PARCEL_RANK[slowest.status] ?? 0) ? s : slowest,
    ).status;

  // An order isn't "delivered" because its slowest parcel is — that call belongs
  // to the server, which has already written it into the order row.
  if (chosen === "delivered") return fallback;

  return { label: shipmentStatusLabel(chosen), badge: shipmentStatusBadge(chosen) };
}
