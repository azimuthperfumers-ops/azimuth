import type { Database } from "@azimuth/db";
import { TRPCError } from "@trpc/server";

import { createUserRepository } from "../repositories/user.repository";
import type { UpdateProfileInput } from "../schemas/user.schema";

export function createUserService(db: Database) {
  const userRepository = createUserRepository(db);

  return {
    async updateProfile(userId: string, input: UpdateProfileInput) {
      const updated = await userRepository.updateName(userId, input.name);

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return updated;
    },
  };
}
