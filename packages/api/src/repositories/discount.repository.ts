import type { Database } from "@azimuth/db";
import { schema } from "@azimuth/db";
import { asc, desc, eq } from "drizzle-orm";

import type {
  AddDiscountProductInput,
  CreateDiscountInput,
  ListDiscountsInput,
  UpdateDiscountInput,
} from "../schemas/discount.schema";

export function createDiscountRepository(db: Database) {
  return {
    async createDiscount(input: CreateDiscountInput) {
      const [row] = await db
        .insert(schema.discounts)
        .values({ ...input, value: input.value.toString() })
        .returning();
      return row;
    },

    async listDiscounts(filters: ListDiscountsInput) {
      return db.query.discounts.findMany({
        where: filters.isActive !== undefined ? eq(schema.discounts.isActive, filters.isActive) : undefined,
        orderBy: desc(schema.discounts.createdAt),
        with: { products: { with: { product: true } } },
      });
    },

    async getDiscount(id: string) {
      return db.query.discounts.findFirst({
        where: eq(schema.discounts.id, id),
        with: {
          products: {
            with: {
              product: { with: { images: true } },
              variant: true,
            },
          },
        },
      });
    },

    async updateDiscount(input: UpdateDiscountInput) {
      const { id, value, ...rest } = input;
      const [row] = await db
        .update(schema.discounts)
        .set({ ...rest, ...(value !== undefined ? { value: value.toString() } : {}) })
        .where(eq(schema.discounts.id, id))
        .returning();
      return row;
    },

    async deleteDiscount(id: string) {
      await db.delete(schema.discounts).where(eq(schema.discounts.id, id));
    },

    async addProduct(input: AddDiscountProductInput) {
      const [row] = await db.insert(schema.discountProducts).values(input).returning();
      return row;
    },

    async removeProduct(id: string) {
      await db.delete(schema.discountProducts).where(eq(schema.discountProducts.id, id));
    },

    async listActiveProductsForDiscount(discountId: string) {
      return db.query.discountProducts.findMany({
        where: eq(schema.discountProducts.discountId, discountId),
        with: { product: true },
        orderBy: asc(schema.discountProducts.createdAt),
      });
    },

    async listDiscountsForProduct(productId: string) {
      return db.query.discountProducts.findMany({
        where: eq(schema.discountProducts.productId, productId),
        with: { discount: true },
        orderBy: asc(schema.discountProducts.createdAt),
      });
    },

    async listLinkedVariants() {
      return db.query.discountProducts.findMany({
        with: {
          discount: {
            columns: { id: true, name: true, type: true, value: true, isActive: true },
          },
        },
      });
    },
  };
}

export type DiscountRepository = ReturnType<typeof createDiscountRepository>;
