import { z } from "zod";
import { schema } from "@azimuth/db";
import { asc, desc, eq } from "drizzle-orm";
import { adminProcedure } from "../middleware/auth.middleware";
import { publicProcedure, router } from "../trpc";

export const contentRouter = router({
  getSection: publicProcedure
    .input(z.object({ section: z.string() }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.db.query.siteContent.findFirst({
        where: eq(schema.siteContent.section, input.section),
      });
      return (row?.data ?? {}) as Record<string, unknown>;
    }),

  updateSection: adminProcedure
    .input(z.object({ section: z.string(), data: z.record(z.string(), z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(schema.siteContent)
        .values({ section: input.section, data: input.data })
        .onConflictDoUpdate({
          target: schema.siteContent.section,
          set: { data: input.data, updatedAt: new Date() },
        });
      return { ok: true };
    }),

  listBanners: publicProcedure
    .input(z.object({ page: z.enum(["home", "shop"]) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.banners.findMany({
        where: eq(schema.banners.page, input.page),
        orderBy: [asc(schema.banners.sortOrder)],
      });
    }),

  listAllBanners: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.query.banners.findMany({
      orderBy: [asc(schema.banners.page), asc(schema.banners.sortOrder)],
    });
  }),

  createBanner: adminProcedure
    .input(z.object({
      page: z.enum(["home", "shop"]),
      imageUrl: z.string().min(1),
      alt: z.string().default(""),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.banners.findMany({
        where: eq(schema.banners.page, input.page),
        orderBy: [desc(schema.banners.sortOrder)],
        limit: 1,
      });
      const nextOrder = existing.length > 0 ? (existing[0]!.sortOrder + 1) : 0;
      const [banner] = await ctx.db
        .insert(schema.banners)
        .values({ page: input.page, imageUrl: input.imageUrl, alt: input.alt, sortOrder: nextOrder })
        .returning();
      return banner!;
    }),

  updateBanner: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      alt: z.string().optional(),
      active: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const set: Record<string, unknown> = {};
      if (rest.alt !== undefined) set.alt = rest.alt;
      if (rest.active !== undefined) set.active = rest.active;
      if (rest.sortOrder !== undefined) set.sortOrder = rest.sortOrder;
      await ctx.db.update(schema.banners).set(set).where(eq(schema.banners.id, id));
      return { ok: true };
    }),

  deleteBanner: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(schema.banners).where(eq(schema.banners.id, input.id));
      return { ok: true };
    }),
});
