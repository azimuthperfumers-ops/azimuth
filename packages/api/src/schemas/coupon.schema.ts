import { z } from "zod";

export const createCouponSchema = z.object({
  code: z.string().min(1).max(32).toUpperCase(),
  description: z.string().max(500).optional(),
  type: z.enum(["percentage", "flat"]),
  value: z.number().positive(),
  minCartValue: z.number().min(0).default(0),
  maxDiscount: z.number().positive().optional(),
  usageLimit: z.number().int().positive().optional(),
  usageLimitPerUser: z.number().int().positive().optional(),
  isActive: z.boolean().default(true),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional(),
});
export type CreateCouponInput = z.infer<typeof createCouponSchema>;

export const updateCouponSchema = createCouponSchema.partial().extend({ id: z.uuid() });
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;

export const deleteCouponSchema = z.object({ id: z.uuid() });
export type DeleteCouponInput = z.infer<typeof deleteCouponSchema>;

export const listCouponsSchema = z.object({
  isActive: z.boolean().optional(),
});
export type ListCouponsInput = z.infer<typeof listCouponsSchema>;

export const validateCouponSchema = z.object({
  code: z.string().min(1),
  cartTotal: z.number().positive(),
  userId: z.string().optional(),
});
export type ValidateCouponInput = z.infer<typeof validateCouponSchema>;

export const recordCouponUsageSchema = z.object({
  couponId: z.uuid(),
  userId: z.string().min(1),
  orderId: z.uuid().optional(),
});
export type RecordCouponUsageInput = z.infer<typeof recordCouponUsageSchema>;
