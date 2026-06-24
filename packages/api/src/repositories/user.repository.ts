import type { Database } from "@azimuth/db";
import { schema } from "@azimuth/db";
import { eq } from "drizzle-orm";

export function createUserRepository(db: Database) {
  return {
    async updateName(id: string, name: string) {
      const [updated] = await db
        .update(schema.user)
        .set({ name })
        .where(eq(schema.user.id, id))
        .returning();

      return updated;
    },
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
