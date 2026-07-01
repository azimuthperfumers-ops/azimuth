import { auth, env as authEnv } from "@azimuth/auth";
import { schema } from "@azimuth/db";
import { TRPCError } from "@trpc/server";
import { randomUUID, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { publicProcedure, router } from "../trpc";
import { protectedProcedure } from "../middleware/auth.middleware";

// Timing-safe string comparison — prevents timing attacks on the invite code.
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const bufA = Buffer.from(enc.encode(a));
  const bufB = Buffer.from(enc.encode(b));
  if (bufA.length !== bufB.length) {
    // Always do a comparison to avoid leaking length via timing.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export const adminAuthRouter = router({
  signUp: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        email: z.string().email(),
        password: z.string().min(8).max(128),
        inviteCode: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!safeEqual(input.inviteCode, authEnv.ADMIN_INVITE_CODE)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Invalid invite code." });
      }

      // Create via better-auth's server API so password hashing, verification
      // email flow, etc. all go through the canonical path.
      const result = await auth.api.signUpEmail({
        body: { name: input.name, email: input.email, password: input.password },
        headers: new Headers(),
        // asResponse: false is the default — returns the parsed body
      });

      if (!result?.user?.id) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Signup failed." });
      }

      // Elevate to admin. The `role` field has `input: false` in better-auth so
      // it can't be passed during normal signup — we set it immediately after.
      await ctx.db
        .update(schema.user)
        .set({ role: "admin" })
        .where(eq(schema.user.id, result.user.id));

      return { ok: true };
    }),

  // Step 1 of Google admin signup: verify invite code, return a short-lived token.
  verifyInviteForGoogle: publicProcedure
    .input(z.object({ inviteCode: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!safeEqual(input.inviteCode, authEnv.ADMIN_INVITE_CODE)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Invalid invite code." });
      }
      const token = randomUUID();
      await ctx.redis.set(`admin:google-signup:${token}`, "1", "EX", 300);
      return { token };
    }),

  // Step 2: called after Google OAuth callback with the token from step 1.
  // Elevates the newly created Google user to admin and consumes the token.
  completeGoogleSignup: protectedProcedure
    .input(z.object({ token: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const key = `admin:google-signup:${input.token}`;
      const val = await ctx.redis.get(key);
      if (!val) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Invalid or expired signup token." });
      }

      // Reject if account already existed before the signup flow started (> 5 min old)
      const user = await ctx.db.query.user.findFirst({
        where: eq(schema.user.id, ctx.session.user.id),
        columns: { createdAt: true, role: true },
      });
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      if (user.role === "admin") {
        await ctx.redis.del(key);
        throw new TRPCError({ code: "CONFLICT", message: "This Google account is already an admin." });
      }
      const ageMs = Date.now() - new Date(user.createdAt).getTime();
      if (ageMs > 5 * 60 * 1000) {
        await ctx.redis.del(key);
        throw new TRPCError({ code: "CONFLICT", message: "An account with this Google account already exists. Sign in instead." });
      }

      await ctx.redis.del(key);
      await ctx.db
        .update(schema.user)
        .set({ role: "admin" })
        .where(eq(schema.user.id, ctx.session.user.id));
      return { ok: true };
    }),
});
