/**
 * Repairs saved addresses that predate the strict address rules.
 *
 * Addresses stored before validation existed can hold a phone written as
 * "+91 98765 43210" or a state spelled "Karnatka" — both of which Shiprocket
 * rejects at booking time, after the customer has paid. This walks every saved
 * address, rewrites the ones normalisation can fix, and lists the ones that need
 * a human (a phone with too few digits can't be guessed).
 *
 *   pnpm --filter @azimuth/server normalize:addresses           # dry run
 *   pnpm --filter @azimuth/server normalize:addresses --apply   # write changes
 */

import "dotenv/config";
import { db, schema } from "@azimuth/db";
import { eq } from "drizzle-orm";

import { normalizeAddress, validateAddress } from "@azimuth/api/address";

const apply = process.argv.includes("--apply");

const rows = await db
  .select({
    id: schema.userAddresses.id,
    userId: schema.userAddresses.userId,
    fullName: schema.userAddresses.fullName,
    phone: schema.userAddresses.phone,
    line1: schema.userAddresses.line1,
    line2: schema.userAddresses.line2,
    city: schema.userAddresses.city,
    state: schema.userAddresses.state,
    pincode: schema.userAddresses.pincode,
  })
  .from(schema.userAddresses);

let repaired = 0;
let alreadyClean = 0;
const unfixable: { id: string; userId: string; problems: string }[] = [];

for (const row of rows) {
  const fixed = normalizeAddress(row);
  const changed = (["fullName", "phone", "line1", "line2", "city", "state", "pincode"] as const).some(
    (k) => (row[k] ?? "") !== (fixed[k] ?? ""),
  );

  const errs = validateAddress(fixed);
  if (Object.keys(errs).length > 0) {
    unfixable.push({
      id: row.id,
      userId: row.userId,
      problems: Object.entries(errs).map(([k, v]) => `${k}: ${v}`).join(", "),
    });
    continue;
  }

  if (!changed) {
    alreadyClean += 1;
    continue;
  }

  console.log(
    `${apply ? "fixing" : "would fix"} ${row.id}: ` +
      `phone ${JSON.stringify(row.phone)} → ${JSON.stringify(fixed.phone)}, ` +
      `state ${JSON.stringify(row.state)} → ${JSON.stringify(fixed.state)}`,
  );

  if (apply) {
    await db
      .update(schema.userAddresses)
      .set({
        fullName: fixed.fullName,
        phone: fixed.phone,
        line1: fixed.line1,
        line2: fixed.line2,
        city: fixed.city,
        state: fixed.state,
        pincode: fixed.pincode,
      })
      .where(eq(schema.userAddresses.id, row.id));
  }
  repaired += 1;
}

console.log(
  `\n${rows.length} saved addresses — ${alreadyClean} already clean, ` +
    `${repaired} ${apply ? "repaired" : "repairable"}, ${unfixable.length} need the customer.`,
);

if (unfixable.length > 0) {
  console.log("\nCannot be fixed automatically (the customer must re-enter these):");
  for (const u of unfixable) console.log(`  address ${u.id} (user ${u.userId}) — ${u.problems}`);
}

if (!apply && repaired > 0) console.log("\nDry run. Re-run with --apply to write the changes.");

process.exit(0);
