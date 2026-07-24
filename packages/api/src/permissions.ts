// ── Staff RBAC: the single source of truth ───────────────────────────────────
// Both the API middleware (server-side enforcement) and the admin panel
// (sidebar visibility + button gating) read this map. Change access here and it
// propagates to both. Keep in sync with the `staff_role` pg enum in
// packages/db/src/schema/auth.ts.

export const STAFF_ROLES = [
  "owner",
  "orders_manager",
  "cataloging",
  "accounts",
  "support",
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

// One entry per admin-panel section. `resource:read` = may view it,
// `resource:write` = may view AND edit it. Enforcement is per-procedure.
export const RESOURCES = [
  "dashboard",
  "analytics",
  "products",
  "categories",
  "inventory",
  "notes",
  "orders",
  // Money actions on orders (refunds, payment confirmation, invoices). No nav
  // section of its own — it gates the finance buttons on the orders pages.
  "payments",
  "jobs",
  "discounts",
  "coupons",
  "customers",
  "wallets",
  "tickets",
  "content",
  "settings",
  "staff",
] as const;
export type Resource = (typeof RESOURCES)[number];

export type Access = "read" | "write";
export type Permission = `${Resource}:${Access}`;

// Human labels for the /staff UI.
export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  owner: "Owner",
  orders_manager: "Orders Manager",
  cataloging: "Cataloging",
  accounts: "Accounts",
  support: "Support",
};

// Highest access level each role holds on each resource. Absent = no access.
// `owner` is handled specially (full write on everything) and omitted here.
// NOTE: this is the proposed default matrix — tune cells freely.
const ROLE_ACCESS: Record<Exclude<StaffRole, "owner">, Partial<Record<Resource, Access>>> = {
  orders_manager: {
    dashboard: "read",
    analytics: "read",
    products: "read",
    orders: "write",
    payments: "write",
    jobs: "write",
    inventory: "write",
    customers: "read",
    tickets: "read",
  },
  cataloging: {
    // No overview at all — cataloging works from the catalog sections, not the
    // dashboard or analytics.
    products: "write",
    categories: "write",
    inventory: "write",
    notes: "write",
    orders: "read",
    discounts: "write",
    coupons: "write",
    content: "write",
  },
  accounts: {
    dashboard: "read",
    analytics: "write",
    orders: "read",
    // Finance: refunds, payment confirmation, invoices.
    payments: "write",
    discounts: "read",
    coupons: "read",
    customers: "read",
    wallets: "write",
  },
  support: {
    dashboard: "read",
    customers: "read",
    orders: "read",
    wallets: "read",
    tickets: "write",
  },
};

// write satisfies read; read satisfies only read.
function levelSatisfies(held: Access, needed: Access): boolean {
  return held === "write" || needed === "read";
}

/** Does this staff role hold `access` on `resource`? Owner always yes. */
export function can(role: StaffRole | null | undefined, resource: Resource, access: Access): boolean {
  if (!role) return false;
  if (role === "owner") return true;
  const held = ROLE_ACCESS[role][resource];
  return held ? levelSatisfies(held, access) : false;
}

/** Flat permission list for a role — sent to the client so the UI can gate. */
export function permissionsFor(role: StaffRole | null | undefined): Permission[] {
  if (!role) return [];
  const out: Permission[] = [];
  for (const resource of RESOURCES) {
    if (can(role, resource, "write")) out.push(`${resource}:write`, `${resource}:read`);
    else if (can(role, resource, "read")) out.push(`${resource}:read`);
  }
  return out;
}
