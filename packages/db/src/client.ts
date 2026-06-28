import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "./env";
import * as schema from "./schema";

const queryClient = postgres(env.DATABASE_URL, {
  idle_timeout: 20,
  max_lifetime: 1800,
  connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema });

export type Database = typeof db;
