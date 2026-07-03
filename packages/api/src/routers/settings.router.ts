import { z } from "zod";
import { schema } from "@azimuth/db";
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
        .insert(schema.siteSettings)
        .values({
          id: "1",
          freeShippingAboveInr: String(input.freeShippingAboveInr),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.siteSettings.id,
          set: {
            freeShippingAboveInr: String(input.freeShippingAboveInr),
            updatedAt: new Date(),
          },
        });
      return { freeShippingAboveInr: input.freeShippingAboveInr };
    }),
});
