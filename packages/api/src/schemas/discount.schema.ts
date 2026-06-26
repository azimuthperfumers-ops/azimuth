import { z } from "zod";

export const createDiscountSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["percentage", "flat"]),
  value: z.number().positive(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional(),
  isActive: z.boolean().default(true),
});
export type CreateDiscountInput = z.infer<typeof createDiscountSchema>;

export const updateDiscountSchema = createDiscountSchema.partial().extend({
  id: z.uuid(),
});
export type UpdateDiscountInput = z.infer<typeof updateDiscountSchema>;

export const deleteDiscountSchema = z.object({ id: z.uuid() });
export type DeleteDiscountInput = z.infer<typeof deleteDiscountSchema>;

export const listDiscountsSchema = z.object({
  isActive: z.boolean().optional(),
});
export type ListDiscountsInput = z.infer<typeof listDiscountsSchema>;

export const addDiscountProductSchema = z.object({
  discountId: z.uuid(),
  productId: z.uuid(),
  variantId: z.uuid(),
});
export type AddDiscountProductInput = z.infer<typeof addDiscountProductSchema>;

export const removeDiscountProductSchema = z.object({ id: z.uuid() });
export type RemoveDiscountProductInput = z.infer<typeof removeDiscountProductSchema>;

export const getDiscountSchema = z.object({ id: z.uuid() });
export type GetDiscountInput = z.infer<typeof getDiscountSchema>;

export const listForProductSchema = z.object({ productId: z.uuid() });
export type ListForProductInput = z.infer<typeof listForProductSchema>;
