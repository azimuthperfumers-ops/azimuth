import type { Database } from "@azimuth/db";

import { createUserDataRepository } from "../repositories/user-data.repository";
import { withUrl } from "./catalog.service";
import { computeEffectivePrice, fetchActiveDiscountMap } from "../utils/pricing";
import type {
  AddAddressInput,
  AddToWishlistInput,
  UpdateAddressInput,
} from "../schemas/user-data.schema";

export function createUserDataService(db: Database) {
  const repo = createUserDataRepository(db);

  return {
    listAddresses(userId: string) {
      return repo.listAddresses(userId);
    },

    addAddress(userId: string, input: AddAddressInput) {
      return repo.addAddress(userId, input);
    },

    updateAddress(userId: string, input: UpdateAddressInput) {
      return repo.updateAddress(userId, input.id, input);
    },

    deleteAddress(userId: string, id: string) {
      return repo.deleteAddress(userId, id);
    },

    setDefaultAddress(userId: string, id: string) {
      return repo.setDefaultAddress(userId, id);
    },

    async listWishlist(userId: string) {
      const items = await repo.listWishlist(userId);
      const variantIds = items.flatMap((item) => item.product?.variants.map((v) => v.id) ?? []);
      const discountMap = await fetchActiveDiscountMap(db, variantIds);
      return items.map((item) => ({
        ...item,
        product: item.product
          ? {
              ...item.product,
              images: item.product.images.map(withUrl),
              variants: item.product.variants.map((v) => ({
                ...v,
                effectivePrice: computeEffectivePrice(Number(v.mrp), discountMap.get(v.id)),
              })),
            }
          : item.product,
      }));
    },

    addToWishlist(userId: string, input: AddToWishlistInput) {
      return repo.addToWishlist(userId, input);
    },

    removeFromWishlist(userId: string, id: string) {
      return repo.removeFromWishlist(userId, id);
    },
  };
}

export type UserDataService = ReturnType<typeof createUserDataService>;
