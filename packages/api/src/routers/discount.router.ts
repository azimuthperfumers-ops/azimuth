import { adminProcedure } from "../middleware/auth.middleware";
import {
  addDiscountProductSchema,
  createDiscountSchema,
  deleteDiscountSchema,
  getDiscountSchema,
  listDiscountsSchema,
  listForProductSchema,
  removeDiscountProductSchema,
  updateDiscountSchema,
} from "../schemas/discount.schema";
import { createDiscountService } from "../services/discount.service";
import { router } from "../trpc";

export const discountRouter = router({
  list: adminProcedure
    .input(listDiscountsSchema)
    .query(({ ctx, input }) => createDiscountService(ctx.db).listDiscounts(input)),

  get: adminProcedure
    .input(getDiscountSchema)
    .query(({ ctx, input }) => createDiscountService(ctx.db).getDiscount(input)),

  create: adminProcedure
    .input(createDiscountSchema)
    .mutation(({ ctx, input }) => createDiscountService(ctx.db).createDiscount(input)),

  update: adminProcedure
    .input(updateDiscountSchema)
    .mutation(({ ctx, input }) => createDiscountService(ctx.db).updateDiscount(input)),

  delete: adminProcedure
    .input(deleteDiscountSchema)
    .mutation(({ ctx, input }) => createDiscountService(ctx.db).deleteDiscount(input)),

  addProduct: adminProcedure
    .input(addDiscountProductSchema)
    .mutation(({ ctx, input }) => createDiscountService(ctx.db).addProduct(input)),

  removeProduct: adminProcedure
    .input(removeDiscountProductSchema)
    .mutation(({ ctx, input }) => createDiscountService(ctx.db).removeProduct(input)),

  listForProduct: adminProcedure
    .input(listForProductSchema)
    .query(({ ctx, input }) => createDiscountService(ctx.db).listDiscountsForProduct(input)),

  listLinkedVariants: adminProcedure
    .query(({ ctx }) => createDiscountService(ctx.db).listLinkedVariants()),
});
