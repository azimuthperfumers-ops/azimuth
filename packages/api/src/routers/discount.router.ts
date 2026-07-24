import { permissionProcedure } from "../middleware/auth.middleware";
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

const readDiscounts = permissionProcedure("discounts", "read");
const writeDiscounts = permissionProcedure("discounts", "write");

export const discountRouter = router({
  list: readDiscounts
    .input(listDiscountsSchema)
    .query(({ ctx, input }) => createDiscountService(ctx.db).listDiscounts(input)),

  get: readDiscounts
    .input(getDiscountSchema)
    .query(({ ctx, input }) => createDiscountService(ctx.db).getDiscount(input)),

  create: writeDiscounts
    .input(createDiscountSchema)
    .mutation(({ ctx, input }) => createDiscountService(ctx.db).createDiscount(input)),

  update: writeDiscounts
    .input(updateDiscountSchema)
    .mutation(({ ctx, input }) => createDiscountService(ctx.db).updateDiscount(input)),

  delete: writeDiscounts
    .input(deleteDiscountSchema)
    .mutation(({ ctx, input }) => createDiscountService(ctx.db).deleteDiscount(input)),

  addProduct: writeDiscounts
    .input(addDiscountProductSchema)
    .mutation(({ ctx, input }) => createDiscountService(ctx.db).addProduct(input)),

  removeProduct: writeDiscounts
    .input(removeDiscountProductSchema)
    .mutation(({ ctx, input }) => createDiscountService(ctx.db).removeProduct(input)),

  listForProduct: readDiscounts
    .input(listForProductSchema)
    .query(({ ctx, input }) => createDiscountService(ctx.db).listDiscountsForProduct(input)),

  listLinkedVariants: readDiscounts
    .query(({ ctx }) => createDiscountService(ctx.db).listLinkedVariants()),
});
