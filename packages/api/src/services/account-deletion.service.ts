import type { Database } from "@azimuth/db";
import { schema } from "@azimuth/db";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import { createAccountDeletionRepository } from "../repositories/account-deletion.repository";
import { createWalletRepository } from "../repositories/wallet.repository";
import type { DeleteAccountInput } from "../schemas/user.schema";

/**
 * Self-service account deletion for storefront customers.
 *
 * Two rules shape the whole flow:
 *  1. Anything still owed in either direction blocks it — a moving parcel or a
 *     pending refund needs a reachable customer, and an open ticket needs someone
 *     to reply to.
 *  2. Leftover wallet credit does NOT block it. Store credit can never be cashed
 *     out, so refusing to delete until it is spent would trap the customer in an
 *     account they want gone. They are warned, and the balance stays visible to
 *     the admin afterwards so it can still be honoured.
 */
export function createAccountDeletionService(db: Database) {
  const repo = createAccountDeletionRepository(db);
  const wallet = createWalletRepository(db);

  async function loadUser(userId: string) {
    const row = await db.query.user.findFirst({
      where: eq(schema.user.id, userId),
      columns: {
        id: true,
        name: true,
        email: true,
        phone: true,
        phoneNumber: true,
        role: true,
        deletedAt: true,
      },
    });
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Account not found." });
    if (row.deletedAt) {
      throw new TRPCError({ code: "NOT_FOUND", message: "This account has already been deleted." });
    }
    // Staff accounts are created and removed by the owner from the admin panel;
    // letting one delete itself here would orphan its audit trail.
    if (row.role !== "user") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Staff accounts can't be deleted here. Ask the store owner to remove it.",
      });
    }
    return row;
  }

  return {
    /**
     * Everything the confirmation screen needs: what stops the deletion, what the
     * customer stands to lose, and what we will keep.
     */
    async preview(userId: string) {
      const user = await loadUser(userId);

      const [blockingOrders, openTickets, walletBalance, orderCount] = await Promise.all([
        repo.blockingOrders(userId),
        repo.openTickets(userId),
        wallet.getBalance(userId),
        repo.orderCount(userId),
      ]);

      return {
        email: user.email,
        canDelete: blockingOrders.length === 0 && openTickets.length === 0,
        blockingOrders,
        openTickets,
        // Warning, not a blocker — see the note at the top of this file.
        walletBalance,
        orderCount,
      };
    },

    /**
     * Point of no return. Re-checks eligibility server-side (the preview the
     * browser saw may be minutes stale) and then purges in one transaction.
     */
    async deleteAccount(
      userId: string,
      input: DeleteAccountInput,
      meta: { ipAddress?: string | null } = {},
    ) {
      const user = await loadUser(userId);

      // Typed confirmation must match the account being deleted, so a stale tab
      // or a mis-click can't take out the wrong session's account.
      if (input.confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The email you typed doesn't match this account.",
        });
      }

      const [blockingOrders, openTickets, walletBalance, orderCount] = await Promise.all([
        repo.blockingOrders(userId),
        repo.openTickets(userId),
        wallet.getBalance(userId),
        repo.orderCount(userId),
      ]);

      if (blockingOrders.length > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            blockingOrders.length === 1
              ? `Order ${blockingOrders[0]!.orderNumber} is still in progress. You can delete your account once it's delivered, cancelled or refunded.`
              : `${blockingOrders.length} orders are still in progress. You can delete your account once they're delivered, cancelled or refunded.`,
        });
      }

      if (openTickets.length > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            openTickets.length === 1
              ? `Support request ${openTickets[0]!.ticketNumber} is still open. We'll need to reach you to close it.`
              : `${openTickets.length} support requests are still open. We'll need to reach you to close them.`,
        });
      }

      // Losing money should never be a surprise, so the client has to say out
      // loud that it knows credit is being left behind.
      if (walletBalance > 0 && !input.acknowledgeWalletForfeit) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Your wallet still holds ₹${walletBalance.toFixed(2)} in store credit. Confirm you understand it will be lost before continuing.`,
        });
      }

      const { deletionId } = await repo.purge({
        userId,
        originalEmail: user.email,
        originalName: user.name ?? null,
        originalPhone: user.phone ?? user.phoneNumber ?? null,
        walletBalance,
        orderCount,
        reason: input.reason?.trim() || null,
        ipAddress: meta.ipAddress ?? null,
      });

      return { deletionId, ordersRetained: orderCount, walletBalanceForfeited: walletBalance };
    },
  };
}

export type AccountDeletionService = ReturnType<typeof createAccountDeletionService>;
