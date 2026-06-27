import type { Database } from "@azimuth/db";
import { schema } from "@azimuth/db";
import { and, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";

export type DiscountInfo = { type: "percentage" | "flat"; value: number };

export function computeEffectivePrice(mrp: number, discount: DiscountInfo | undefined): number {
  if (!discount) return mrp;
  if (discount.type === "percentage") {
    return Math.round(mrp * (1 - discount.value / 100) * 100) / 100;
  }
  return Math.max(0, mrp - discount.value);
}

export async function fetchActiveDiscountMap(
  db: Database,
  variantIds: string[],
): Promise<Map<string, DiscountInfo>> {
  if (variantIds.length === 0) return new Map();
  const now = new Date();
  const rows = await db
    .select({
      variantId: schema.discountProducts.variantId,
      type: schema.discounts.type,
      value: schema.discounts.value,
    })
    .from(schema.discountProducts)
    .innerJoin(schema.discounts, eq(schema.discountProducts.discountId, schema.discounts.id))
    .where(
      and(
        inArray(schema.discountProducts.variantId, variantIds),
        eq(schema.discounts.isActive, true),
        lte(schema.discounts.startsAt, now),
        or(isNull(schema.discounts.endsAt), gte(schema.discounts.endsAt, now)),
      ),
    );

  const map = new Map<string, DiscountInfo>();
  for (const row of rows) {
    if (!map.has(row.variantId)) {
      map.set(row.variantId, { type: row.type, value: Number(row.value) });
    }
  }
  return map;
}
