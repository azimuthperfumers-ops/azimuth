import { sql } from "drizzle-orm";

import type { Database } from "@azimuth/db";
import { schema } from "@azimuth/db";

// Indian financial year runs Apr–Mar. A date in Jan–Mar belongs to the FY that
// started the previous April. Returns the "26-27" style label.
export function financialYearLabel(date: Date): string {
  const y = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? y : y - 1; // month 3 = April
  const yy = (n: number) => String(n % 100).padStart(2, "0");
  return `${yy(startYear)}-${yy(startYear + 1)}`;
}

export function invoicePrefix(date: Date): string {
  return `AZ/${financialYearLabel(date)}/`;
}

// Next gap-free number in the current FY series, e.g. AZ/26-27/0001. Count-based
// like the order-number generator — the caller retries on a unique-index clash
// (two concurrent captures racing for the same sequence).
export async function nextInvoiceNumber(db: Database, date: Date): Promise<string> {
  const prefix = invoicePrefix(date);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.orders)
    .where(sql`"gst_invoice_number" LIKE ${prefix + "%"}`);
  const next = (row?.count ?? 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}
