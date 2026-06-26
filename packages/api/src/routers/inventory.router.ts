import { adminProcedure } from "../middleware/auth.middleware";
import { addStockSchema, adjustStockSchema, ledgerHistorySchema, productLedgerSchema } from "../schemas/inventory.schema";
import { createInventoryService } from "../services/inventory.service";
import { router } from "../trpc";

export const inventoryRouter = router({
  addStock: adminProcedure
    .input(addStockSchema)
    .mutation(({ ctx, input }) => createInventoryService(ctx.db).addStock(input, ctx.session.user.id)),

  adjustStock: adminProcedure
    .input(adjustStockSchema)
    .mutation(({ ctx, input }) => createInventoryService(ctx.db).adjustStock(input, ctx.session.user.id)),

  ledgerHistory: adminProcedure
    .input(ledgerHistorySchema)
    .query(({ ctx, input }) => createInventoryService(ctx.db).ledgerHistory(input)),

  productLedger: adminProcedure
    .input(productLedgerSchema)
    .query(({ ctx, input }) => createInventoryService(ctx.db).productLedger(input)),
});
