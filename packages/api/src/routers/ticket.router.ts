import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { schema } from "@azimuth/db";
import { alertAdminNewTicket, notifyRefundInitiated } from "@azimuth/comms";
import { advanceOrderStatus } from "../repositories/order.repository";
import { createWalletRepository } from "../repositories/wallet.repository";
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
        type: z.enum(["general", "refund", "damaged", "other"]).default("general"),
        orderId: z.string().uuid().optional(),
        attachmentUrls: z.array(z.string().url()).max(5).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Refund policy: no returns/exchanges. Refund only with proof — a photo to
      // compare against the courier's delivery (POD) image, or an unpacking video.
      const PROOF_REQUIRED = new Set(["refund", "damaged"]);
      if (PROOF_REQUIRED.has(input.type) && (!input.attachmentUrls || input.attachmentUrls.length === 0)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Proof is required for refund and damaged item requests — attach photos of the parcel or an unpacking video.",
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
        ticketId: ticket.id,
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
              // Courier's proof-of-delivery image — admin compares it against the
              // customer's uploaded photos/video before approving a refund.
              podImageUrl: true,
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

  // ── Admin: take action (refund / close / reopen) ───────────────────────────
  // No returns/exchanges — refund-only policy, granted after verifying proof.

  adminAction: adminProcedure
    .input(
      z.object({
        ticketId: z.string().uuid(),
        action: z.enum(["refund", "close", "reopen"]),
        note: z.string().optional(),
        // Where a refund goes: bank/card (Razorpay) or in-app wallet.
        refundDestination: z.enum(["razorpay", "wallet"]).default("razorpay"),
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

        // Never refund money that was never paid, and never refund twice.
        if (order.status === "pending_payment" || order.status === "payment_failed") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot refund: this order was never paid." });
        }
        if (["refund_processing", "refunded", "cancelled"].includes(order.status)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot refund: order is already ${order.status}` });
        }

        const amountPaise = Math.round(Number(order.total) * 100);
        // Wallet-paid orders can only be refunded to the wallet.
        const destination = order.paymentMethod === "wallet" ? "wallet" : input.refundDestination;

        // ── Refund to wallet — instant store credit ──────────────────────────
        if (destination === "wallet") {
          await createWalletRepository(ctx.db).record({
            userId: order.userId,
            amount: Number(order.total),
            type: "refund_credit",
            refType: "order",
            refId: order.id,
            note: input.note ?? `Refund for order ${order.orderNumber}`,
            actorId: adminId,
            idempotent: true,
          });
          await ctx.db.update(schema.orders).set({ refundMethod: "wallet" }).where(eq(schema.orders.id, order.id));
          await advanceOrderStatus(ctx.db, order.id, "refunded", adminId, `Refunded ₹${Number(order.total)} to wallet. ${input.note ?? ""}`.trim());
          await ctx.db.insert(schema.ticketActions).values({
            ticketId: ticket.id, adminId, actionType: "refund_initiated",
            metadata: { destination: "wallet", amountPaise },
          });
          await ctx.db.update(schema.tickets).set({ status: "awaiting_user", updatedAt: new Date() }).where(eq(schema.tickets.id, ticket.id));
          await ctx.db.insert(schema.ticketMessages).values({
            ticketId: ticket.id, senderId: adminId, senderRole: "admin",
            content: input.note ?? `We've refunded ₹${Number(order.total)} to your Azimuth wallet.`,
          });
          notifyRefundInitiated(
            { name: ticket.user?.name ?? "Customer", email: ticket.user?.email, phone: ticket.user?.phone },
            {
              orderId: order.id,
              orderNumber: order.orderNumber,
              totalInr: new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(order.total)),
            },
            "wallet",
          ).catch((e: unknown) => console.error("[ticket] wallet refund notify:", e));
          return { ok: true, detail: `Refunded ₹${Number(order.total)} to wallet` };
        }

        // ── Refund to bank (Razorpay) ────────────────────────────────────────
        if (!order.razorpayPaymentId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No Razorpay payment on order — refund to wallet instead." });
        }
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
        await ctx.db.update(schema.orders).set({ refundMethod: "razorpay" }).where(eq(schema.orders.id, order.id));

        await ctx.db.insert(schema.ticketActions).values({
          ticketId: ticket.id,
          adminId,
          actionType: "refund_initiated",
          metadata: { dbJobId: dbJob.id, amountPaise, destination: "razorpay" },
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
