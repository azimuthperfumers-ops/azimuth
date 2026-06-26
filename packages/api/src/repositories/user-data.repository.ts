import type { Database } from "@azimuth/db";
import { schema } from "@azimuth/db";
import { and, desc, eq } from "drizzle-orm";

import type {
  AddAddressInput,
  AddToWishlistInput,
  UpdateAddressInput,
} from "../schemas/user-data.schema";

export function createUserDataRepository(db: Database) {
  return {
    async listAddresses(userId: string) {
      return db.query.userAddresses.findMany({
        where: eq(schema.userAddresses.userId, userId),
        orderBy: [desc(schema.userAddresses.isDefault), desc(schema.userAddresses.createdAt)],
      });
    },

    async addAddress(userId: string, input: AddAddressInput) {
      return db.transaction(async (tx) => {
        if (input.isDefault) {
          await tx
            .update(schema.userAddresses)
            .set({ isDefault: false })
            .where(eq(schema.userAddresses.userId, userId));
        }
        const [addr] = await tx
          .insert(schema.userAddresses)
          .values({ ...input, userId })
          .returning();
        return addr!;
      });
    },

    async updateAddress(userId: string, id: string, input: UpdateAddressInput) {
      const { id: _id, ...fields } = input;
      return db.transaction(async (tx) => {
        if (fields.isDefault) {
          await tx
            .update(schema.userAddresses)
            .set({ isDefault: false })
            .where(eq(schema.userAddresses.userId, userId));
        }
        const [addr] = await tx
          .update(schema.userAddresses)
          .set(fields)
          .where(and(eq(schema.userAddresses.id, id), eq(schema.userAddresses.userId, userId)))
          .returning();
        return addr ?? null;
      });
    },

    async deleteAddress(userId: string, id: string) {
      await db
        .delete(schema.userAddresses)
        .where(and(eq(schema.userAddresses.id, id), eq(schema.userAddresses.userId, userId)));
    },

    async setDefaultAddress(userId: string, id: string) {
      return db.transaction(async (tx) => {
        await tx
          .update(schema.userAddresses)
          .set({ isDefault: false })
          .where(eq(schema.userAddresses.userId, userId));
        const [addr] = await tx
          .update(schema.userAddresses)
          .set({ isDefault: true })
          .where(and(eq(schema.userAddresses.id, id), eq(schema.userAddresses.userId, userId)))
          .returning();
        return addr ?? null;
      });
    },

    async listWishlist(userId: string) {
      return db.query.wishlistItems.findMany({
        where: eq(schema.wishlistItems.userId, userId),
        orderBy: desc(schema.wishlistItems.createdAt),
        with: {
          product: {
            with: {
              images: true,
              variants: true,
              category: true,
            },
          },
          variant: true,
        },
      });
    },

    async addToWishlist(userId: string, input: AddToWishlistInput) {
      const [item] = await db
        .insert(schema.wishlistItems)
        .values({ userId, productId: input.productId, variantId: input.variantId ?? null })
        .returning();
      return item!;
    },

    async removeFromWishlist(userId: string, id: string) {
      await db
        .delete(schema.wishlistItems)
        .where(and(eq(schema.wishlistItems.id, id), eq(schema.wishlistItems.userId, userId)));
    },
  };
}

export type UserDataRepository = ReturnType<typeof createUserDataRepository>;
