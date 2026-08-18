import { z } from "zod";
import { schema } from "@azimuth/db";
import { CacheKey, CacheTtl, cacheDel, cacheGetOrSet } from "../lib/redis";
import { permissionProcedure } from "../middleware/auth.middleware";
import { publicProcedure, router } from "../trpc";

export const settingsRouter = router({
  // Public — checkout + cart can read free-shipping threshold. Cached: every
  // cart and checkout render asks for this, and it only changes when an admin
  // saves the form below (which deletes the key).
  get: publicProcedure.query(async ({ ctx }) =>
    cacheGetOrSet(CacheKey.siteSettings(), CacheTtl.content, async () => {
      const row = await ctx.db.query.siteSettings.findFirst();
      return { freeShippingAboveInr: Number(row?.freeShippingAboveInr ?? 999) };
    }),
  ),

  update: permissionProcedure("settings", "write")
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
      await cacheDel(CacheKey.siteSettings());
      return { freeShippingAboveInr: input.freeShippingAboveInr };
    }),
});
