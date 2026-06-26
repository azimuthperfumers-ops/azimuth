import type { Database } from "@azimuth/db";

import { createUserDataRepository } from "../repositories/user-data.repository";
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

    listWishlist(userId: string) {
      return repo.listWishlist(userId);
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
