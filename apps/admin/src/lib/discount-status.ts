/**
 * Single source of truth for whether a discount is actually biting right now.
 *
 * A discount has two independent switches: the `isActive` toggle a human sets,
 * and the date window it was created with. The admin used to render only the
 * toggle, so a discount that ran out last month still read "Active" while the
 * storefront had long since stopped applying it.
 *
 * The window test here mirrors fetchActiveDiscountMap in
 * packages/api/src/utils/pricing.ts exactly — that query is what customers see,
 * and this badge is a claim about it. If one changes, change the other.
 *
 * Note the window is compared against the stored timestamps as-is: `endsAt` is
 * written from a date input, i.e. midnight at the start of that day, so a
 * discount "ending 31 Aug" stops applying as 31 Aug begins, not as it ends.
 */

export type DiscountStatus = "live" | "scheduled" | "expired" | "inactive";

export type DiscountWindow = {
  isActive: boolean;
  startsAt: Date | string;
  endsAt?: Date | string | null;
};

export function discountStatus(d: DiscountWindow, now: Date = new Date()): DiscountStatus {
  // Someone reached in and switched it off — that outranks whatever the dates say.
  if (!d.isActive) return "inactive";
  if (d.endsAt && new Date(d.endsAt) < now) return "expired";
  if (new Date(d.startsAt) > now) return "scheduled";
  return "live";
}

/** True only when the storefront would apply this discount at `now`. */
export function isDiscountLive(d: DiscountWindow, now: Date = new Date()): boolean {
  return discountStatus(d, now) === "live";
}

export const DISCOUNT_STATUS_LABEL: Record<DiscountStatus, string> = {
  live: "Active",
  scheduled: "Scheduled",
  expired: "Expired",
  inactive: "Inactive",
};

/**
 * Only the live state earns a filled badge. Scheduled and expired are outlined
 * so a column of them doesn't read as a column of running promotions.
 */
export const DISCOUNT_STATUS_VARIANT: Record<DiscountStatus, "default" | "secondary" | "outline"> = {
  live: "default",
  scheduled: "outline",
  expired: "outline",
  inactive: "secondary",
};
