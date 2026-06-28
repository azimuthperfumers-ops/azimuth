import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { env } from "./env";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(resolve(__dirname, "../seed/seed-images.sql"), "utf8");

const client = postgres(env.DATABASE_URL);

try {
  await client.unsafe(sql);
  console.log("Image seed complete.");
} finally {
  await client.end();
}
