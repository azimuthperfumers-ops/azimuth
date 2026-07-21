import { z } from "zod";

const addressFields = {
  label: z.string().min(1).max(50).default("Home"),
  fullName: z.string().min(1).max(120),
  phone: z.string().min(7).max(15),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  pincode: z.string().min(4).max(10),
  isDefault: z.boolean().default(false),
};

export const addAddressSchema = z.object(addressFields);
export type AddAddressInput = z.infer<typeof addAddressSchema>;

export const updateAddressSchema = z.object({
  id: z.uuid(),
  label: z.string().min(1).max(50).optional(),
  fullName: z.string().min(1).max(120).optional(),
  phone: z.string().min(7).max(15).optional(),
  line1: z.string().min(1).max(200).optional(),
  line2: z.string().max(200).optional().nullable(),
  city: z.string().min(1).max(100).optional(),
  state: z.string().min(1).max(100).optional(),
  pincode: z.string().min(4).max(10).optional(),
  isDefault: z.boolean().optional(),
});
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;

export const deleteAddressSchema = z.object({ id: z.uuid() });
export type DeleteAddressInput = z.infer<typeof deleteAddressSchema>;

export const setDefaultAddressSchema = z.object({ id: z.uuid() });
export type SetDefaultAddressInput = z.infer<typeof setDefaultAddressSchema>;

export const addToWishlistSchema = z.object({
  productId: z.uuid(),
  variantId: z.uuid().optional(),
});
export type AddToWishlistInput = z.infer<typeof addToWishlistSchema>;

export const removeFromWishlistSchema = z.object({ id: z.uuid() });
export type RemoveFromWishlistInput = z.infer<typeof removeFromWishlistSchema>;
