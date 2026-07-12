import type { Database } from "@azimuth/db";
import { schema } from "@azimuth/db";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, gte, inArray, lt, lte, sql } from "drizzle-orm";

type InventoryReason = (typeof schema.inventoryReasonEnum.enumValues)[number];

export function createInventoryRepository(db: Database) {
  return {
    // Single entry point for every stock change: locks the variant row,
    // writes the immutable ledger entry, and updates stock_cached — all in
    // one transaction, so the cache can never drift from the ledger.
    async recordMovement(params: {
      variantId: string;
      delta: number;
      reason: InventoryReason;
      actorId?: string;
      note?: string;
      refType?: string;
      refId?: string;
      // Order-driven sales may push stock negative (payment already captured — a
      // negative balance is the honest "oversold" signal for admin). Manual admin
      // adjustments keep the >= 0 guard.
      allowNegative?: boolean;
    }) {
      return db.transaction(async (tx) => {
        const [variant] = await tx
          .select({ stockCached: schema.productVariants.stockCached })
          .from(schema.productVariants)
          .where(eq(schema.productVariants.id, params.variantId))
          .for("update");

        if (!variant) {
          throw new TRPCError({ code: "NOT_FOUND", message: "variant not found" });
        }

        const balanceAfter = variant.stockCached + params.delta;
        if (balanceAfter < 0 && !params.allowNegative) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "stock cannot go below zero" });
        }

        const [ledgerEntry] = await tx
          .insert(schema.inventoryLedger)
          .values({
            variantId: params.variantId,
            delta: params.delta,
            balanceAfter,
            reason: params.reason,
            refType: params.refType,
            refId: params.refId,
            actorId: params.actorId,
            note: params.note,
          })
          .returning();

        await tx
          .update(schema.productVariants)
          .set({ stockCached: balanceAfter })
          .where(eq(schema.productVariants.id, params.variantId));

        return ledgerEntry;
      });
    },

    // Stock sold online but still physically in the warehouse (paid/processing —
    // awaiting pickup). Admin keeps these units aside so offline sales can't take them.
    // In-transit shown separately: those units already left the building.
    async bookedStock() {
      type OrderStatus = (typeof schema.orders.$inferSelect)["status"];
      const BOOKED: OrderStatus[] = ["paid", "processing"];
      const IN_TRANSIT: OrderStatus[] = ["picked_up", "shipped", "out_for_delivery", "delivery_attempted"];

      const rows = await db
        .select({
          variantId: schema.orderItems.variantId,
          sku: schema.productVariants.sku,
          sizeMl: schema.productVariants.sizeMl,
          productName: schema.products.name,
          stockCached: schema.productVariants.stockCached,
          status: schema.orders.status,
          orderNumber: schema.orders.orderNumber,
          quantity: schema.orderItems.quantity,
        })
        .from(schema.orderItems)
        .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
        .innerJoin(schema.productVariants, eq(schema.orderItems.variantId, schema.productVariants.id))
        .innerJoin(schema.products, eq(schema.productVariants.productId, schema.products.id))
        .where(inArray(schema.orders.status, [...BOOKED, ...IN_TRANSIT]));

      const byVariant = new Map<string, {
        variantId: string;
        productName: string;
        sku: string;
        sizeMl: number;
        stockCached: number;
        bookedQty: number;
        inTransitQty: number;
        bookedOrders: { orderNumber: string; quantity: number; status: string }[];
      }>();

      for (const row of rows) {
        if (!row.variantId) continue;
        let entry = byVariant.get(row.variantId);
        if (!entry) {
          entry = {
            variantId: row.variantId,
            productName: row.productName,
            sku: row.sku,
            sizeMl: row.sizeMl,
            stockCached: row.stockCached,
            bookedQty: 0,
            inTransitQty: 0,
            bookedOrders: [],
          };
          byVariant.set(row.variantId, entry);
        }
        if (BOOKED.includes(row.status)) {
          entry.bookedQty += row.quantity;
          entry.bookedOrders.push({ orderNumber: row.orderNumber, quantity: row.quantity, status: row.status });
        } else {
          entry.inTransitQty += row.quantity;
        }
      }

      return [...byVariant.values()].sort(
        (a, b) => b.bookedQty - a.bookedQty || a.productName.localeCompare(b.productName),
      );
    },

    async listLedgerForVariant(variantId: string, limit: number) {
      return db.query.inventoryLedger.findMany({
        where: eq(schema.inventoryLedger.variantId, variantId),
        orderBy: desc(schema.inventoryLedger.createdAt),
        limit,
      });
    },

    async listLedgerForProduct(
      productId: string,
      opts: {
        page: number;
        pageSize: number;
        variantId?: string;
        type?: "credit" | "debit";
        fromDate?: Date;
        toDate?: Date;
      },
    ) {
      const variants = await db
        .select({
          id: schema.productVariants.id,
          sku: schema.productVariants.sku,
          sizeMl: schema.productVariants.sizeMl,
        })
        .from(schema.productVariants)
        .where(eq(schema.productVariants.productId, productId));

      if (!variants.length) return { rows: [], total: 0, variants: [] };

      const variantIds = variants.map((v) => v.id);

      const conditions = [inArray(schema.inventoryLedger.variantId, variantIds)];
      if (opts.variantId) conditions.push(eq(schema.inventoryLedger.variantId, opts.variantId));
      if (opts.type === "credit") conditions.push(gt(schema.inventoryLedger.delta, 0));
      if (opts.type === "debit") conditions.push(lt(schema.inventoryLedger.delta, 0));
      if (opts.fromDate) conditions.push(gte(schema.inventoryLedger.createdAt, opts.fromDate));
      if (opts.toDate) conditions.push(lte(schema.inventoryLedger.createdAt, opts.toDate));

      const where = and(...conditions);

      const countResult = await db
        .select({ total: sql<number>`cast(count(*) as int)` })
        .from(schema.inventoryLedger)
        .where(where);
      const total = countResult[0]?.total ?? 0;

      const rows = await db
        .select()
        .from(schema.inventoryLedger)
        .where(where)
        .orderBy(desc(schema.inventoryLedger.createdAt))
        .limit(opts.pageSize)
        .offset(opts.page * opts.pageSize);

      const variantMap = new Map(variants.map((v) => [v.id, v]));

      return {
        rows: rows.map((r) => ({ ...r, variant: variantMap.get(r.variantId) ?? null })),
        total,
        variants,
      };
    },
  };
}

export type InventoryRepository = ReturnType<typeof createInventoryRepository>;
