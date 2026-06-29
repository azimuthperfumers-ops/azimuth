import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { schema } from "@azimuth/db";
import { adminProcedure } from "../middleware/auth.middleware";
import { router } from "../trpc";
import { orderQueue } from "../lib/order-queue";

const JOB_TYPES = ["book_shipment", "cancel_shipment", "initiate_refund", "return_shipment", "exchange_shipment"] as const;
const JOB_STATUSES = ["pending", "running", "completed", "failed"] as const;

export const jobRouter = router({
  adminList: adminProcedure
    .input(
      z.object({
        type: z.enum(JOB_TYPES).optional(),
        status: z.enum(JOB_STATUSES).optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().nonnegative().default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input.type) conditions.push(eq(schema.backgroundJobs.type, input.type));
      if (input.status) conditions.push(eq(schema.backgroundJobs.status, input.status));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [jobs, countResult] = await Promise.all([
        ctx.db.query.backgroundJobs.findMany({
          where,
          orderBy: [desc(schema.backgroundJobs.createdAt)],
          limit: input.limit,
          offset: input.offset,
          with: {
            order: { columns: { id: true, orderNumber: true } },
            ticket: { columns: { ticketNumber: true } },
          },
        }),
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.backgroundJobs)
          .where(where),
      ]);

      return { jobs, total: countResult[0]?.count ?? 0 };
    }),

  adminCancel: adminProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.db.query.backgroundJobs.findFirst({
        where: eq(schema.backgroundJobs.id, input.jobId),
      });

      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      if (job.status !== "failed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only failed jobs can be cancelled" });
      }

      // Mark completed so retry is blocked
      await ctx.db
        .update(schema.backgroundJobs)
        .set({
          status: "completed",
          result: { note: "Dismissed by admin" },
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.backgroundJobs.id, input.jobId));

      return { ok: true };
    }),

  adminRetry: adminProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.db.query.backgroundJobs.findFirst({
        where: eq(schema.backgroundJobs.id, input.jobId),
      });

      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      if (job.status !== "failed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only failed jobs can be retried" });
      }

      const payload = job.payload as Record<string, unknown>;
      const jobName = (job.type === "exchange_shipment" ? "return_shipment" : job.type) as string;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bullJob = await (orderQueue as any).add(jobName, { ...payload, dbJobId: job.id });

      await ctx.db
        .update(schema.backgroundJobs)
        .set({
          status: "pending",
          bullmqJobId: bullJob.id?.toString(),
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.backgroundJobs.id, input.jobId));

      return { ok: true };
    }),
});
