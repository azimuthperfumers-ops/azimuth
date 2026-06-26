import type { Database } from "@azimuth/db";

import { createInventoryRepository } from "../repositories/inventory.repository";
import type { AddStockInput, AdjustStockInput, LedgerHistoryInput, ProductLedgerInput } from "../schemas/inventory.schema";

export function createInventoryService(db: Database) {
  const inventoryRepository = createInventoryRepository(db);

  return {
    addStock(input: AddStockInput, actorId: string) {
      return inventoryRepository.recordMovement({
        variantId: input.variantId,
        delta: input.quantity,
        reason: "restock",
        actorId,
        note: input.note,
      });
    },

    adjustStock(input: AdjustStockInput, actorId: string) {
      return inventoryRepository.recordMovement({
        variantId: input.variantId,
        delta: input.delta,
        reason: input.reason,
        actorId,
        note: input.note,
      });
    },

    ledgerHistory(input: LedgerHistoryInput) {
      return inventoryRepository.listLedgerForVariant(input.variantId, input.limit);
    },

    productLedger(input: ProductLedgerInput) {
      return inventoryRepository.listLedgerForProduct(input.productId, {
        page: input.page,
        pageSize: input.pageSize,
        variantId: input.variantId,
        type: input.type,
        fromDate: input.fromDate,
        toDate: input.toDate,
      });
    },
  };
}

export type InventoryService = ReturnType<typeof createInventoryService>;
