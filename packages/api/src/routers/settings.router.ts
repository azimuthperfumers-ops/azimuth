import { z } from "zod";
import { schema } from "@azimuth/db";
import { eq } from "drizzle-orm";
import { adminProcedure } from "../middleware/auth.middleware";
import { publicProcedure, router } from "../trpc";

export const settingsRouter = router({
  // Public — checkout + cart can read free-shipping threshold
  get: publicProcedure.query(async ({ ctx }) => {
    const row = await ctx.db.query.siteSettings.findFirst();
    return { freeShippingAboveInr: Number(row?.freeShippingAboveInr ?? 999) };
  }),

  update: adminProcedure
    .input(z.object({ freeShippingAboveInr: z.number().nonnegative() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(schema.siteSettings)
        .set({
          freeShippingAboveInr: String(input.freeShippingAboveInr),
          updatedAt: new Date(),
        })
        .where(eq(schema.siteSettings.id, "1"));
      return { freeShippingAboveInr: input.freeShippingAboveInr };
    }),
});
