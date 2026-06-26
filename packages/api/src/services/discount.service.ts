import type { Database } from "@azimuth/db";
import { TRPCError } from "@trpc/server";

import { createDiscountRepository } from "../repositories/discount.repository";
import type {
  AddDiscountProductInput,
  CreateDiscountInput,
  DeleteDiscountInput,
  GetDiscountInput,
  ListDiscountsInput,
  ListForProductInput,
  RemoveDiscountProductInput,
  UpdateDiscountInput,
} from "../schemas/discount.schema";

function hasPgErrorCode(err: unknown, code: string): boolean {
  if (typeof err !== "object" || err === null) return false;
  if ("code" in err && err.code === code) return true;
  const cause = (err as { cause?: unknown }).cause;
  return typeof cause === "object" && cause !== null && "code" in cause && cause.code === code;
}

export function createDiscountService(db: Database) {
  const repo = createDiscountRepository(db);

  return {
    createDiscount(input: CreateDiscountInput) {
      return repo.createDiscount(input);
    },

    listDiscounts(input: ListDiscountsInput) {
      return repo.listDiscounts(input);
    },

    async getDiscount(input: GetDiscountInput) {
      const discount = await repo.getDiscount(input.id);
      if (!discount) throw new TRPCError({ code: "NOT_FOUND" });
      return discount;
    },

    async updateDiscount(input: UpdateDiscountInput) {
      const row = await repo.updateDiscount(input);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    },

    deleteDiscount(input: DeleteDiscountInput) {
      return repo.deleteDiscount(input.id);
    },

    async addProduct(input: AddDiscountProductInput) {
      try {
        return await repo.addProduct(input);
      } catch (err) {
        if (hasPgErrorCode(err, "23505")) {
          throw new TRPCError({ code: "CONFLICT", message: "variant is already linked to another discount" });
        }
        throw err;
      }
    },

    removeProduct(input: RemoveDiscountProductInput) {
      return repo.removeProduct(input.id);
    },

    listDiscountsForProduct(input: ListForProductInput) {
      return repo.listDiscountsForProduct(input.productId);
    },

    listLinkedVariants() {
      return repo.listLinkedVariants();
    },
  };
}

export type DiscountService = ReturnType<typeof createDiscountService>;
