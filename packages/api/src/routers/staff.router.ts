import { auth } from "@azimuth/auth";
import { schema, type Database } from "@azimuth/db";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, ne, sql } from "drizzle-orm";
import { z } from "zod";

import { ownerProcedure } from "../middleware/auth.middleware";
import { STAFF_ROLES } from "../permissions";
import { router } from "../trpc";

const staffRoleSchema = z.enum(STAFF_ROLES);

// Count remaining owners excluding one user — used to block removing/demoting the
// last owner, which would leave nobody able to manage staff.
async function otherOwnerCount(db: Database, exceptUserId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.user)
    .where(and(eq(schema.user.staffRole, "owner"), ne(schema.user.id, exceptUserId)));
  return row?.count ?? 0;
}

export const staffRouter = router({
  // Every staff member (role='admin'), newest first.
  list: ownerProcedure.query(async ({ ctx }) => {
    const staff = await ctx.db.query.user.findMany({
      where: eq(schema.user.role, "admin"),
      columns: {
        id: true,
        name: true,
        email: true,
        staffRole: true,
        emailVerified: true,
        createdAt: true,
      },
      orderBy: desc(schema.user.createdAt),
    });

    // Live session count per member, so "sign out everywhere" says how much it
    // will actually do — and a stale login on a shared machine is visible at all.
    const now = new Date();
    const sessions = await ctx.db
      .select({ userId: schema.session.userId, count: sql<number>`count(*)::int` })
      .from(schema.session)
      .where(gt(schema.session.expiresAt, now))
      .groupBy(schema.session.userId);
    const active = new Map(sessions.map((r) => [r.userId, r.count]));

    return { staff: staff.map((s) => ({ ...s, activeSessions: active.get(s.id) ?? 0 })) };
  }),

  // Sign a staff member out of every device without touching their password.
  // The password reset already does this as a side effect; this is the case where
  // forcing a new password is the wrong tool — a lost laptop, a shared browser.
  revokeSessions: ownerProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const target = await ctx.db.query.user.findFirst({
        where: eq(schema.user.id, input.userId),
        columns: { id: true, email: true, role: true, staffRole: true },
      });
      if (!target || target.role !== "admin") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Staff member not found." });
      }

      const removed = await ctx.db
        .delete(schema.session)
        .where(eq(schema.session.userId, target.id))
        .returning({ id: schema.session.id });

      await ctx.db.insert(schema.staffAudit).values({
        action: "sessions_revoked",
        actorId: ctx.session.user.id,
        actorEmail: ctx.session.user.email,
        targetUserId: target.id,
        targetEmail: target.email,
        toRole: target.staffRole,
        note: `${removed.length} session(s) ended`,
      });

      return { ok: true, revoked: removed.length };
    }),

  // Append-only audit history for the staff page.
  audit: ownerProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }))
    .query(async ({ ctx, input }) => {
      const entries = await ctx.db.query.staffAudit.findMany({
        orderBy: desc(schema.staffAudit.createdAt),
        limit: input.limit,
      });
      return { entries };
    }),

  // Create a staff account directly (owner sets the password). Staff emails are
  // pre-verified — they never go through the customer email-verification flow.
  create: ownerProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(100),
        email: z.string().email(),
        password: z.string().min(8).max(128),
        staffRole: staffRoleSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const email = input.email.toLowerCase().trim();

      const existing = await ctx.db.query.user.findFirst({
        where: eq(schema.user.email, email),
        columns: { id: true },
      });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists." });
      }

      // Hash + persist through better-auth so the credential is stored exactly
      // like any other password login.
      const result = await auth.api.signUpEmail({
        body: { name: input.name, email, password: input.password },
        headers: new Headers(),
      });
      if (!result?.user?.id) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not create the staff account." });
      }

      // Elevate to staff, assign the role, and mark verified (no verification step
      // for staff).
      await ctx.db
        .update(schema.user)
        .set({ role: "admin", staffRole: input.staffRole, emailVerified: true })
        .where(eq(schema.user.id, result.user.id));

      await ctx.db.insert(schema.staffAudit).values({
        action: "staff_created",
        actorId: ctx.session.user.id,
        actorEmail: ctx.session.user.email,
        targetUserId: result.user.id,
        targetEmail: email,
        toRole: input.staffRole,
      });

      return { ok: true, userId: result.user.id };
    }),

  // Change an existing staff member's role.
  changeRole: ownerProcedure
    .input(z.object({ userId: z.string(), staffRole: staffRoleSchema }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You can't change your own role." });
      }
      const target = await ctx.db.query.user.findFirst({
        where: eq(schema.user.id, input.userId),
        columns: { id: true, email: true, role: true, staffRole: true },
      });
      if (!target || target.role !== "admin") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Staff member not found." });
      }
      if (target.staffRole === input.staffRole) return { ok: true };

      // Don't demote the last owner.
      if (target.staffRole === "owner" && input.staffRole !== "owner") {
        if ((await otherOwnerCount(ctx.db, target.id)) === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "At least one owner must remain." });
        }
      }

      await ctx.db
        .update(schema.user)
        .set({ staffRole: input.staffRole })
        .where(eq(schema.user.id, target.id));

      await ctx.db.insert(schema.staffAudit).values({
        action: "role_changed",
        actorId: ctx.session.user.id,
        actorEmail: ctx.session.user.email,
        targetUserId: target.id,
        targetEmail: target.email,
        fromRole: target.staffRole,
        toRole: input.staffRole,
      });

      return { ok: true };
    }),

  // Revoke staff access — the account reverts to a normal customer (role='user',
  // staffRole cleared). Orders/audit references survive.
  remove: ownerProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You can't remove yourself." });
      }
      const target = await ctx.db.query.user.findFirst({
        where: eq(schema.user.id, input.userId),
        columns: { id: true, email: true, role: true, staffRole: true },
      });
      if (!target || target.role !== "admin") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Staff member not found." });
      }
      if (target.staffRole === "owner" && (await otherOwnerCount(ctx.db, target.id)) === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "At least one owner must remain." });
      }

      await ctx.db
        .update(schema.user)
        .set({ role: "user", staffRole: null })
        .where(eq(schema.user.id, target.id));
      // Kill their active sessions so access ends immediately.
      await ctx.db.delete(schema.session).where(eq(schema.session.userId, target.id));

      await ctx.db.insert(schema.staffAudit).values({
        action: "staff_removed",
        actorId: ctx.session.user.id,
        actorEmail: ctx.session.user.email,
        targetUserId: target.id,
        targetEmail: target.email,
        fromRole: target.staffRole,
      });

      return { ok: true };
    }),

  // Owner resets a staff member's password.
  resetPassword: ownerProcedure
    .input(z.object({ userId: z.string(), password: z.string().min(8).max(128) }))
    .mutation(async ({ ctx, input }) => {
      const target = await ctx.db.query.user.findFirst({
        where: eq(schema.user.id, input.userId),
        columns: { id: true, email: true, role: true, staffRole: true },
      });
      if (!target || target.role !== "admin") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Staff member not found." });
      }

      const authCtx = await auth.$context;
      const hashed = await authCtx.password.hash(input.password);
      const updated = await ctx.db
        .update(schema.account)
        .set({ password: hashed })
        .where(and(eq(schema.account.userId, target.id), eq(schema.account.providerId, "credential")))
        .returning({ id: schema.account.id });
      if (updated.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This account has no password login to reset." });
      }
      // Invalidate existing sessions after a password reset.
      await ctx.db.delete(schema.session).where(eq(schema.session.userId, target.id));

      await ctx.db.insert(schema.staffAudit).values({
        action: "password_reset",
        actorId: ctx.session.user.id,
        actorEmail: ctx.session.user.email,
        targetUserId: target.id,
        targetEmail: target.email,
        toRole: target.staffRole,
      });

      return { ok: true };
    }),
});
