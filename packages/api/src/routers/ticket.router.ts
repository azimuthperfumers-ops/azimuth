import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { schema } from "@azimuth/db";
import { alertAdminNewTicket } from "@azimuth/comms";
import { advanceOrderStatus } from "../repositories/order.repository";
import { adminProcedure, protectedProcedure } from "../middleware/auth.middleware";
import { router } from "../trpc";
import { orderQueue } from "../lib/order-queue";

// ── Helpers ───────────────────────────────────────────────────────────────────

type DB = Parameters<typeof advanceOrderStatus>[0];

async function generateTicketNumber(db: DB): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `TKT-${year}-`;
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.tickets)
    .where(sql`"ticket_number" LIKE ${prefix + "%"}`);
  const next = (result[0]?.count ?? 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

// ── Router ────────────────────────────────────────────────────────────────────

export const ticketRouter = router({
  // ── User: create ticket ────────────────────────────────────────────────────

  create: protectedProcedure
    .input(
      z.object({
        subject: z.string().min(5).max(200),
        message: z.string().min(10),
        type: z.enum(["general", "return", "exchange", "refund", "damaged", "other"]).default("general"),
        orderId: z.string().uuid().optional(),
        attachmentUrls: z.array(z.string().url()).max(5).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const PHOTO_REQUIRED = new Set(["return", "exchange", "damaged"]);
      if (PHOTO_REQUIRED.has(input.type) && (!input.attachmentUrls || input.attachmentUrls.length === 0)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "At least one photo is required for return, exchange, and damaged item requests.",
        });
      }

      const userId = ctx.session.user.id;

      // Ticket number comes from a count — retry on unique collision under concurrency
      let ticket: typeof schema.tickets.$inferSelect | undefined;
      for (let attempt = 0; attempt < 3 && !ticket; attempt++) {
        const ticketNumber = await generateTicketNumber(ctx.db);
        try {
          [ticket] = await ctx.db
            .insert(schema.tickets)
            .values({
              ticketNumber,
              userId,
              orderId: input.orderId ?? null,
              type: input.type,
              subject: input.subject,
              status: "open",
            })
            .returning();
        } catch (err) {
          const e = err as { code?: string; cause?: { code?: string } };
          if (e?.code !== "23505" && e?.cause?.code !== "23505") throw err;
        }
      }

      if (!ticket) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // First message from user
      await ctx.db.insert(schema.ticketMessages).values({
        ticketId: ticket.id,
        senderId: userId,
        senderRole: "user",
        content: input.message,
        attachmentUrls: input.attachmentUrls ?? [],
      });

      await alertAdminNewTicket({
        ticketNumber: ticket.ticketNumber,
        type: input.type,
        subject: input.subject,
      });

      return ticket;
    }),

  // ── User/Admin: get ticket with messages ───────────────────────────────────

  get: protectedProcedure
    .input(z.object({ ticketId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const isAdmin = ctx.session.user.role === "admin";

      const ticket = await ctx.db.query.tickets.findFirst({
        where: and(
          eq(schema.tickets.id, input.ticketId),
          isAdmin ? undefined : eq(schema.tickets.userId, userId),
        ),
        with: {
          messages: { orderBy: [schema.ticketMessages.createdAt] },
          actions: { orderBy: [desc(schema.ticketActions.createdAt)] },
          order: {
            columns: {
              orderNumber: true,
              status: true,
              total: true,
              razorpayPaymentId: true,
              waybill: true,
              shippingAddress: true,
            },
          },
          user: { columns: { name: true, email: true } },
        },
      });

      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      return ticket;
    }),

  // ── User: list own tickets ─────────────────────────────────────────────────

  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.tickets.findMany({
      where: eq(schema.tickets.userId, ctx.session.user.id),
      orderBy: [desc(schema.tickets.updatedAt)],
      columns: {
        id: true, ticketNumber: true, subject: true, type: true, status: true,
        orderId: true, createdAt: true, updatedAt: true,
      },
    });
  }),

  // ── Admin: list all tickets ────────────────────────────────────────────────

  adminList: adminProcedure
    .input(
      z.object({
        status: z.enum(["open", "awaiting_admin", "awaiting_user", "resolved", "closed"]).optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().nonnegative().default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.query.tickets.findMany({
        where: input.status ? eq(schema.tickets.status, input.status) : undefined,
        orderBy: [desc(schema.tickets.updatedAt)],
        limit: input.limit,
        offset: input.offset,
        with: {
          user: { columns: { name: true, email: true } },
          order: { columns: { orderNumber: true, status: true } },
        },
      });
    }),

  // ── User: send message (always senderRole:"user") ─────────────────────────

  sendMessage: protectedProcedure
    .input(
      z.object({
        ticketId: z.string().uuid(),
        content: z.string().max(2000).default(""),
        attachmentUrls: z.array(z.string().url()).max(5).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const ticket = await ctx.db.query.tickets.findFirst({
        where: and(eq(schema.tickets.id, input.ticketId), eq(schema.tickets.userId, userId)),
      });

      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (ticket.status === "closed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Ticket is closed" });
      }
      if (!input.content.trim() && (!input.attachmentUrls || input.attachmentUrls.length === 0)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Message or attachment required" });
      }

      await ctx.db.insert(schema.ticketMessages).values({
        ticketId: ticket.id,
        senderId: userId,
        senderRole: "user",
        content: input.content,
        attachmentUrls: input.attachmentUrls ?? [],
      });

      await ctx.db
        .update(schema.tickets)
        .set({ status: "awaiting_admin", updatedAt: new Date() })
        .where(eq(schema.tickets.id, ticket.id));

      return { ok: true };
    }),

  // ── Admin: send message (always senderRole:"admin") ────────────────────────

  adminSendMessage: adminProcedure
    .input(
      z.object({
        ticketId: z.string().uuid(),
        content: z.string().max(2000).default(""),
        attachmentUrls: z.array(z.string().url()).max(5).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const adminId = ctx.session.user.id;

      const ticket = await ctx.db.query.tickets.findFirst({
        where: eq(schema.tickets.id, input.ticketId),
      });

      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (ticket.status === "closed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Ticket is closed" });
      }
      if (!input.content.trim() && (!input.attachmentUrls || input.attachmentUrls.length === 0)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Message or attachment required" });
      }

      await ctx.db.insert(schema.ticketMessages).values({
        ticketId: ticket.id,
        senderId: adminId,
        senderRole: "admin",
        content: input.content,
        attachmentUrls: input.attachmentUrls ?? [],
      });

      await ctx.db
        .update(schema.tickets)
        .set({ status: "awaiting_user", updatedAt: new Date() })
        .where(eq(schema.tickets.id, ticket.id));

      return { ok: true };
    }),

  // ── Admin: take action (refund / return / exchange / close) ───────────────

  adminAction: adminProcedure
    .input(
      z.object({
        ticketId: z.string().uuid(),
        action: z.enum(["refund", "return", "exchange", "close", "reopen"]),
        note: z.string().optional(),
        returnReason: z.string().optional(),
        pickupDate: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const adminId = ctx.session.user.id;

      const ticket = await ctx.db.query.tickets.findFirst({
        where: eq(schema.tickets.id, input.ticketId),
        with: {
          order: true,
          user: { columns: { name: true, email: true, phone: true } },
        },
      });

      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });

      const order = ticket.order;

      // ── Refund ────────────────────────────────────────────────────────────

      if (input.action === "refund") {
        if (!order) throw new TRPCError({ code: "BAD_REQUEST", message: "No order linked to ticket" });
        if (!order.razorpayPaymentId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No Razorpay payment ID on order" });
        }

        const amountPaise = Math.round(Number(order.total) * 100);
        const payload = {
          type: "initiate_refund" as const,
          orderId: order.id,
          razorpayPaymentId: order.razorpayPaymentId,
          amountPaise,
          reason: input.note ?? "Customer requested refund",
        };

        const [dbJob] = await ctx.db
          .insert(schema.backgroundJobs)
          .values({ type: "initiate_refund", status: "pending", payload, orderId: order.id, ticketId: ticket.id })
          .returning({ id: schema.backgroundJobs.id });

        if (!dbJob) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const bullJob = await orderQueue.add("initiate_refund", { ...payload, dbJobId: dbJob.id });
        await ctx.db
          .update(schema.backgroundJobs)
          .set({ bullmqJobId: bullJob.id?.toString() })
          .where(eq(schema.backgroundJobs.id, dbJob.id));

        await ctx.db.insert(schema.ticketActions).values({
          ticketId: ticket.id,
          adminId,
          actionType: "refund_initiated",
          metadata: { dbJobId: dbJob.id, amountPaise },
        });

        await ctx.db.update(schema.tickets)
          .set({ status: "awaiting_user", updatedAt: new Date() })
          .where(eq(schema.tickets.id, ticket.id));

        if (input.note) {
          await ctx.db.insert(schema.ticketMessages).values({
            ticketId: ticket.id, senderId: adminId, senderRole: "admin",
            content: input.note,
          });
        }

        return { ok: true, detail: `Refund ₹${Number(order.total)} queued — processing in background` };
      }

      // ── Return or Exchange ────────────────────────────────────────────────

      if (input.action === "return" || input.action === "exchange") {
        if (!order) throw new TRPCError({ code: "BAD_REQUEST", message: "No order linked to ticket" });

        const shippingAddr = order.shippingAddress as {
          fullName?: string; phone?: string;
          line1?: string; line2?: string | null;
          city?: string; state?: string; pincode?: string;
        };

        if (!shippingAddr.pincode || !shippingAddr.city || !shippingAddr.line1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Order has incomplete shipping address" });
        }

        const jobType = input.action === "exchange" ? "exchange_shipment" : "return_shipment";
        const payload = {
          type: "return_shipment" as const,
          orderId: order.id,
          ticketId: ticket.id,
          action: input.action as "return" | "exchange",
          originalOrderNumber: order.orderNumber,
          customerName: shippingAddr.fullName ?? ticket.user?.name ?? "Customer",
          customerPhone: shippingAddr.phone ?? ticket.user?.phone ?? "",
          pickupAddress: {
            line1: shippingAddr.line1!,
            line2: shippingAddr.line2,
            city: shippingAddr.city!,
            state: shippingAddr.state ?? "",
            pincode: shippingAddr.pincode!,
          },
          returnReason: input.returnReason ?? "Customer requested return",
          adminId,
          pickupDate: input.pickupDate,
        };

        const [dbJob] = await ctx.db
          .insert(schema.backgroundJobs)
          .values({ type: jobType, status: "pending", payload, orderId: order.id, ticketId: ticket.id })
          .returning({ id: schema.backgroundJobs.id });

        if (!dbJob) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const bullJob = await orderQueue.add("return_shipment", { ...payload, dbJobId: dbJob.id });
        await ctx.db
          .update(schema.backgroundJobs)
          .set({ bullmqJobId: bullJob.id?.toString() })
          .where(eq(schema.backgroundJobs.id, dbJob.id));

        await ctx.db.update(schema.tickets)
          .set({ status: "awaiting_user", updatedAt: new Date() })
          .where(eq(schema.tickets.id, ticket.id));

        return { ok: true, detail: `${input.action === "exchange" ? "Exchange" : "Return"} pickup queued — processing in background` };
      }

      // ── Close ─────────────────────────────────────────────────────────────

      if (input.action === "close") {
        await ctx.db.update(schema.tickets)
          .set({ status: "closed", closedAt: new Date(), updatedAt: new Date() })
          .where(eq(schema.tickets.id, ticket.id));

        await ctx.db.insert(schema.ticketActions).values({
          ticketId: ticket.id, adminId, actionType: "closed",
          metadata: { note: input.note },
        });

        if (input.note) {
          await ctx.db.insert(schema.ticketMessages).values({
            ticketId: ticket.id, senderId: adminId, senderRole: "admin",
            content: input.note,
          });
        }

        return { ok: true, detail: "Ticket closed" };
      }

      // ── Reopen ────────────────────────────────────────────────────────────

      if (input.action === "reopen") {
        await ctx.db.update(schema.tickets)
          .set({ status: "open", closedAt: null, updatedAt: new Date() })
          .where(eq(schema.tickets.id, ticket.id));

        await ctx.db.insert(schema.ticketActions).values({
          ticketId: ticket.id, adminId, actionType: "reopened", metadata: {},
        });

        return { ok: true, detail: "Ticket reopened" };
      }

      return { ok: true, detail: "Done" };
    }),
});
