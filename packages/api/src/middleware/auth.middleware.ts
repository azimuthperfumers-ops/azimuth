import { TRPCError } from "@trpc/server";

import { middleware, publicProcedure } from "../trpc";
import { can, type Access, type Resource, type StaffRole } from "../permissions";

const isAuthed = middleware(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({ ctx: { ...ctx, session: ctx.session } });
});

export const protectedProcedure = publicProcedure.use(isAuthed);

const isAdmin = middleware(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  if (ctx.session.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  return next({ ctx: { ...ctx, session: ctx.session } });
});

// Any authenticated staff member (role='admin'), regardless of staffRole.
export const adminProcedure = publicProcedure.use(isAdmin);

// Read the staff role off the session in one place. An admin with no staffRole
// gets NO access (deny by default) — never an implicit owner. The 0013 migration
// backfills every pre-existing admin to 'owner', and seed-admin sets it too, so a
// null staffRole only happens for accounts that were never granted a real role.
function staffRoleOf(session: { user: { role: string; staffRole?: StaffRole | null } }): StaffRole | null {
  if (session.user.role !== "admin") return null;
  return session.user.staffRole ?? null;
}

/**
 * Gate a procedure on a specific permission. Usage:
 *   permissionProcedure("orders", "write").mutation(...)
 * Owner passes everything; other roles per the matrix in permissions.ts.
 */
export function permissionProcedure(resource: Resource, access: Access) {
  const isAllowed = middleware(({ ctx, next }) => {
    if (!ctx.session) throw new TRPCError({ code: "UNAUTHORIZED" });
    if (ctx.session.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    if (!can(staffRoleOf(ctx.session), resource, access)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You don't have access to this action.",
      });
    }
    return next({ ctx: { ...ctx, session: ctx.session } });
  });
  return publicProcedure.use(isAllowed);
}

const isOwner = middleware(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: "UNAUTHORIZED" });
  if (staffRoleOf(ctx.session) !== "owner") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Owner access required." });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});

// Staff management (create/manage other staff) — owner only.
export const ownerProcedure = publicProcedure.use(isOwner);
