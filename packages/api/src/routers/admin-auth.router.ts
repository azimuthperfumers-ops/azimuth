import { auth, env as authEnv } from "@azimuth/auth";
import { schema } from "@azimuth/db";
import { TRPCError } from "@trpc/server";
import { timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { publicProcedure, router } from "../trpc";

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
});
