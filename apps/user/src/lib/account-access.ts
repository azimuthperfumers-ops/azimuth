/**
 * Who the storefront is for.
 *
 * Customers (`role: "user"`) obviously, plus the owner — they need to walk their
 * own shop as a buyer, place test orders and see what a customer sees. Every
 * other staff role (orders_manager, cataloging, accounts, support) works out of
 * admin.azimuth.net.in and has no business holding a shopping session here, and
 * `role: "system"` is not a person at all.
 *
 * One account can only be one of these, so the check is a single predicate used
 * both at sign-in and on every session the app already holds.
 */
export type AccountLike = { role?: string | null; staffRole?: string | null } | null | undefined;

export function canUseStorefront(account: AccountLike): boolean {
  if (!account) return false;
  return account.role === "user" || account.staffRole === "owner";
}

export const STAFF_ACCOUNT_MESSAGE =
  "That's a staff account — please sign in at the admin panel instead.";
