import type { Database } from "@azimuth/db";
import { schema } from "@azimuth/db";
import { and, count, desc, eq, inArray, notInArray, sql } from "drizzle-orm";

type OrderStatus = (typeof schema.orderStatusEnum.enumValues)[number];
type TicketStatus = (typeof schema.ticketStatusEnum.enumValues)[number];

/**
 * Order states that leave nothing outstanding between us and the customer:
 * money has settled and no parcel is moving. Everything else — in transit, awaiting
 * dispatch, mid-refund, mid-return — needs a reachable name, phone and address, so it
 * blocks deletion until it lands.
 *
 * `pending_payment` / `payment_failed` are settled by omission: those orders never
 * shipped and never will, so they hold nothing up.
 */
export const SETTLED_ORDER_STATUSES: readonly OrderStatus[] = [
  "pending_payment",
  "payment_failed",
  "delivered",
  "cancelled",
  "refunded",
  "rto_delivered",
];

/** Ticket states where a human on our side still owes the customer an answer. */
export const OPEN_TICKET_STATUSES: readonly TicketStatus[] = [
  "open",
  "awaiting_admin",
  "awaiting_user",
];

export function createAccountDeletionRepository(db: Database) {
  return {
    /** Orders that must land before the account can go. Newest first. */
    blockingOrders(userId: string) {
      return db
        .select({
          id: schema.orders.id,
          orderNumber: schema.orders.orderNumber,
          status: schema.orders.status,
          total: schema.orders.total,
          createdAt: schema.orders.createdAt,
        })
        .from(schema.orders)
        .where(
          and(
            eq(schema.orders.userId, userId),
            notInArray(schema.orders.status, [...SETTLED_ORDER_STATUSES]),
          ),
        )
        .orderBy(desc(schema.orders.createdAt));
    },

    /** Support conversations still awaiting a resolution. Newest first. */
    openTickets(userId: string) {
      return db
        .select({
          id: schema.tickets.id,
          ticketNumber: schema.tickets.ticketNumber,
          subject: schema.tickets.subject,
          status: schema.tickets.status,
          createdAt: schema.tickets.createdAt,
        })
        .from(schema.tickets)
        .where(
          and(
            eq(schema.tickets.userId, userId),
            inArray(schema.tickets.status, [...OPEN_TICKET_STATUSES]),
          ),
        )
        .orderBy(desc(schema.tickets.createdAt));
    },

    async orderCount(userId: string): Promise<number> {
      const [row] = await db
        .select({ value: count() })
        .from(schema.orders)
        .where(eq(schema.orders.userId, userId));
      return row?.value ?? 0;
    },

    /**
     * The purge itself, in one transaction.
     *
     * Removed outright: everything that only serves the live shopping experience
     * (addresses, cart, wishlist) plus every credential and session, so the account
     * is immediately unreachable.
     *
     * Kept on purpose:
     *  - orders + items + shipments — GST invoices are legally retained, and the
     *    shipping-address snapshot on the order is part of that invoice record.
     *  - wallet + ledger — outstanding store credit stays on the books as a
     *    liability the admin can still see and honour.
     *  - support tickets — the dispute history behind those orders.
     *  - product ratings — already just a 1–5 score against a now-anonymous id;
     *    deleting them would silently move every product's average.
     *
     * The `user` row survives as a tombstone: orders reference it with
     * onDelete:'restrict', so it cannot be removed without taking the books with it.
     * Every identifying column is overwritten instead, and the real email is
     * released so the person can sign up again from scratch.
     */
    purge(params: {
      userId: string;
      originalEmail: string;
      originalName: string | null;
      originalPhone: string | null;
      walletBalance: number;
      orderCount: number;
      reason?: string | null;
      ipAddress?: string | null;
    }) {
      const { userId } = params;

      return db.transaction(async (tx) => {
        // Audit row first: if anything below fails the whole thing rolls back,
        // but if it succeeds we are guaranteed a record of what was destroyed.
        const [audit] = await tx
          .insert(schema.accountDeletions)
          .values({
            userId,
            originalEmail: params.originalEmail,
            originalName: params.originalName,
            originalPhone: params.originalPhone,
            walletBalance: params.walletBalance.toFixed(2),
            orderCount: params.orderCount,
            reason: params.reason ?? null,
            ipAddress: params.ipAddress ?? null,
          })
          .returning({ id: schema.accountDeletions.id });

        // Sequential, not Promise.all — these share one connection and the
        // volumes are tiny, so there is nothing to win by pipelining them.
        await tx.delete(schema.userAddresses).where(eq(schema.userAddresses.userId, userId));
        await tx.delete(schema.wishlistItems).where(eq(schema.wishlistItems.userId, userId));
        await tx.delete(schema.cartItems).where(eq(schema.cartItems.userId, userId));
        // Credentials (password hash, Google tokens) and every live session.
        await tx.delete(schema.account).where(eq(schema.account.userId, userId));
        await tx.delete(schema.session).where(eq(schema.session.userId, userId));

        // `.invalid` is reserved by RFC 2606 and can never resolve, so a stray
        // mailer can't reach a stranger. Keyed on the id to satisfy the unique index.
        await tx
          .update(schema.user)
          .set({
            name: "Deleted account",
            email: `deleted-${userId}@deleted.invalid`,
            emailVerified: false,
            phone: null,
            phoneNumber: null,
            phoneNumberVerified: null,
            image: null,
            deletedAt: sql`now()`,
          })
          .where(eq(schema.user.id, userId));

        return { deletionId: audit?.id ?? null };
      });
    },

    /** Audit rows for a user, newest first — powers the admin tombstone banner. */
    listForUser(userId: string) {
      return db
        .select()
        .from(schema.accountDeletions)
        .where(eq(schema.accountDeletions.userId, userId))
        .orderBy(desc(schema.accountDeletions.createdAt));
    },
  };
}

export type AccountDeletionRepository = ReturnType<typeof createAccountDeletionRepository>;
