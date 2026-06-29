import "dotenv/config";
import { auth } from "@azimuth/auth";
import { db, schema } from "@azimuth/db";
import { eq } from "drizzle-orm";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@azimuth.local";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "admin1234";
const ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? "Admin";

const existing = await db
  .select({ id: schema.user.id })
  .from(schema.user)
  .where(eq(schema.user.email, ADMIN_EMAIL))
  .limit(1);

if (existing.length > 0) {
  await db.update(schema.user).set({ role: "admin" }).where(eq(schema.user.email, ADMIN_EMAIL));
  console.log(`Admin role set for existing user: ${ADMIN_EMAIL}`);
  process.exit(0);
}

const result = await auth.api.signUpEmail({
  body: { name: ADMIN_NAME, email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  headers: new Headers(),
});

if (!result?.user?.id) {
  console.error("Signup failed");
  process.exit(1);
}

await db.update(schema.user).set({ role: "admin" }).where(eq(schema.user.id, result.user.id));

console.log(`Admin created: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
