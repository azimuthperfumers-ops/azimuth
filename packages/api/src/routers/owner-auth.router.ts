import { auth, env as authEnv } from "@azimuth/auth";
import { schema, type Database } from "@azimuth/db";
import { rateLimit } from "@azimuth/redis";
import { TRPCError } from "@trpc/server";
import { randomUUID, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../middleware/auth.middleware";
import { publicProcedure, router } from "../trpc";

// The placeholder shipped in env defaults. Registration is refused while the code
// is still this value so a fresh/misconfigured deploy can't be claimed with a
// publicly-known secret.
const DEFAULT_CODE = "change-me-before-deploy";

// Brute-force throttle: at most this many owner-code attempts per IP per window,
// counted whether or not the code was correct.
const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60;

// Timing-safe comparison of the owner invite code — never short-circuits on the
// first differing byte, so the code can't be recovered via response timing.
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(new TextEncoder().encode(a));
  const bufB = Buffer.from(new TextEncoder().encode(b));
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA); // constant-time dummy compare
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

// Throttle first (so wrong guesses still burn the budget), then refuse the default
// code, then constant-time compare. Order matters for brute-force resistance.
async function guardCode(ip: string, code: string) {
  const rl = await rateLimit(`owner-register:${ip}`, MAX_ATTEMPTS, WINDOW_SECONDS);
  if (!rl.allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Too many attempts. Try again in ${Math.ceil(rl.resetInSeconds / 60)} min.`,
    });
  }
  if (authEnv.ADMIN_INVITE_CODE === DEFAULT_CODE) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Owner registration is disabled until ADMIN_INVITE_CODE is set to a strong secret.",
    });
  }
  if (!safeEqual(code, authEnv.ADMIN_INVITE_CODE)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Invalid owner code." });
  }
}

async function recordOwnerAudit(db: Database, userId: string, email: string) {
  await db.insert(schema.staffAudit).values({
    action: "staff_created",
    actorId: userId,
    actorEmail: email,
    targetUserId: userId,
    targetEmail: email,
    toRole: "owner",
    note: "Owner self-registration (invite code)",
  });
}

export const ownerAuthRouter = router({
  // Register a new owner with email + password, gated by the owner invite code.
  registerOwner: publicProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(100),
        email: z.string().email(),
        password: z.string().min(8).max(128),
        inviteCode: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await guardCode(ctx.ip, input.inviteCode);
      const email = input.email.toLowerCase().trim();

      const existing = await ctx.db.query.user.findFirst({
        where: eq(schema.user.email, email),
        columns: { id: true },
      });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists." });
      }

      const result = await auth.api.signUpEmail({
        body: { name: input.name, email, password: input.password },
        headers: new Headers(),
      });
      if (!result?.user?.id) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not create the account." });
      }

      // Elevate to owner and pre-verify (staff emails skip verification).
      await ctx.db
        .update(schema.user)
        .set({ role: "admin", staffRole: "owner", emailVerified: true })
        .where(eq(schema.user.id, result.user.id));

      await recordOwnerAudit(ctx.db, result.user.id, email);
      return { ok: true };
    }),

  // Google flow, step 1: verify the code, hand back a short-lived one-time token.
  verifyCodeForGoogle: publicProcedure
    .input(z.object({ inviteCode: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await guardCode(ctx.ip, input.inviteCode);
      const token = randomUUID();
      await ctx.redis.set(`owner:google-signup:${token}`, "1", "EX", 300);
      return { token };
    }),

  // Google flow, step 2: after OAuth, elevate the freshly-created Google user to
  // owner and consume the token. Requires an authenticated (just-created) session.
  completeGoogleOwner: protectedProcedure
    .input(z.object({ token: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const key = `owner:google-signup:${input.token}`;
      const val = await ctx.redis.get(key);
      if (!val) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Invalid or expired signup token." });
      }

      const existing = await ctx.db.query.user.findFirst({
        where: eq(schema.user.id, ctx.session.user.id),
        columns: { createdAt: true, staffRole: true, email: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      if (existing.staffRole === "owner") {
        await ctx.redis.del(key);
        throw new TRPCError({ code: "CONFLICT", message: "This account is already an owner." });
      }
      // Only elevate a just-created account, never a pre-existing one signing in —
      // stops a token from hijacking an established account into owner.
      const ageMs = Date.now() - new Date(existing.createdAt).getTime();
      if (ageMs > 5 * 60 * 1000) {
        await ctx.redis.del(key);
        throw new TRPCError({ code: "CONFLICT", message: "This Google account already exists. Sign in instead." });
      }

      await ctx.redis.del(key); // one-time use
      await ctx.db
        .update(schema.user)
        .set({ role: "admin", staffRole: "owner", emailVerified: true })
        .where(eq(schema.user.id, ctx.session.user.id));

      await recordOwnerAudit(ctx.db, ctx.session.user.id, existing.email);
      return { ok: true };
    }),
});
