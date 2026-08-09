import { z } from "zod";

import {
  collapseSpaces,
  isValidPhone,
  isValidPincode,
  normalizeState,
  sanitizePhone,
  sanitizePincode,
} from "../lib/address-validation";

/**
 * Address fields are normalised before they are checked, so a phone pasted as
 * "+91 98765 43210" is stored as "9876543210" rather than rejected — but a phone
 * that still isn't a bookable 10-digit mobile after cleaning never reaches the
 * database. See lib/address-validation.ts for why the courier demands this.
 */
const phoneField = z
  .string()
  .transform(sanitizePhone)
  .refine(isValidPhone, "Enter a valid 10-digit mobile number");

const pincodeField = z
  .string()
  .transform(sanitizePincode)
  .refine(isValidPincode, "Enter a valid 6-digit pincode");

const stateField = z
  .string()
  .transform((v) => normalizeState(v) ?? collapseSpaces(v))
  .refine((v) => normalizeState(v) !== null, "Choose a valid Indian state");

const trimmed = (min: number, max: number, message: string) =>
  z.string().transform(collapseSpaces).refine((v) => v.length >= min && v.length <= max, message);

const addressFields = {
  label: z.string().min(1).max(50).default("Home"),
  fullName: trimmed(2, 120, "Enter the full name"),
  phone: phoneField,
  line1: trimmed(5, 200, "Enter the house / building and street"),
  line2: z.string().max(200).transform(collapseSpaces).optional(),
  city: trimmed(2, 100, "Enter a valid city"),
  state: stateField,
  pincode: pincodeField,
  isDefault: z.boolean().default(false),
};

export const addAddressSchema = z.object(addressFields);
export type AddAddressInput = z.infer<typeof addAddressSchema>;

export const updateAddressSchema = z.object({
  id: z.uuid(),
  label: z.string().min(1).max(50).optional(),
  fullName: addressFields.fullName.optional(),
  phone: phoneField.optional(),
  line1: addressFields.line1.optional(),
  line2: z.string().max(200).transform(collapseSpaces).optional().nullable(),
  city: addressFields.city.optional(),
  state: stateField.optional(),
  pincode: pincodeField.optional(),
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
