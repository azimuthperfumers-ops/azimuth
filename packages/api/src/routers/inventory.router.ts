import { permissionProcedure } from "../middleware/auth.middleware";
import { addStockSchema, adjustStockSchema, ledgerHistorySchema, productLedgerSchema } from "../schemas/inventory.schema";
import { createInventoryService } from "../services/inventory.service";
import { router } from "../trpc";

const readInventory = permissionProcedure("inventory", "read");
const writeInventory = permissionProcedure("inventory", "write");

export const inventoryRouter = router({
  addStock: writeInventory
    .input(addStockSchema)
    .mutation(({ ctx, input }) => createInventoryService(ctx.db).addStock(input, ctx.session.user.id)),

  adjustStock: writeInventory
    .input(adjustStockSchema)
    .mutation(({ ctx, input }) => createInventoryService(ctx.db).adjustStock(input, ctx.session.user.id)),

  bookedStock: readInventory
    .query(({ ctx }) => createInventoryService(ctx.db).bookedStock()),

  ledgerHistory: readInventory
    .input(ledgerHistorySchema)
    .query(({ ctx, input }) => createInventoryService(ctx.db).ledgerHistory(input)),

  productLedger: readInventory
    .input(productLedgerSchema)
    .query(({ ctx, input }) => createInventoryService(ctx.db).productLedger(input)),
});
