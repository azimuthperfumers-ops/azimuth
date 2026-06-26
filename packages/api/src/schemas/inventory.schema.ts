import { z } from "zod";

export const addStockSchema = z.object({
  variantId: z.uuid(),
  quantity: z.number().int().positive(),
  note: z.string().max(500).optional(),
});
export type AddStockInput = z.infer<typeof addStockSchema>;

export const adjustStockSchema = z.object({
  variantId: z.uuid(),
  delta: z.number().int().refine((v) => v !== 0, "delta cannot be zero"),
  reason: z.enum(["adjustment", "damage", "return"]),
  note: z.string().max(500).optional(),
});
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

export const ledgerHistorySchema = z.object({
  variantId: z.uuid(),
  limit: z.number().int().min(1).max(100).default(50),
});
export type LedgerHistoryInput = z.infer<typeof ledgerHistorySchema>;

export const productLedgerSchema = z.object({
  productId: z.uuid(),
  page: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(100).default(50),
  variantId: z.uuid().optional(),
  type: z.enum(["credit", "debit"]).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});
export type ProductLedgerInput = z.infer<typeof productLedgerSchema>;
