/**
 * Address-field helpers for the storefront forms (checkout + account).
 *
 * The rules themselves live in `@azimuth/api/address` so the web app, the mobile
 * app and the tRPC schemas all agree on what a bookable address is. This module
 * only adds the keystroke-level glue the DOM inputs need.
 */

import {
  sanitizeAddressLine,
  sanitizeCity,
  sanitizeName,
  sanitizePhone,
  sanitizePincode,
} from "@azimuth/api/address";

export {
  INDIAN_STATES,
  PHONE_LENGTH,
  PINCODE_LENGTH,
  isValidPhone,
  isValidPincode,
  normalizeAddress,
  normalizeState,
  sanitizePhone,
  validateAddress,
} from "@azimuth/api/address";
export type { AddressErrors, AddressInput } from "@azimuth/api/address";

/**
 * Cleans a single field as it is typed, so the input can never hold a value the
 * courier would reject: no "+91", no stray spaces, no letters in a pincode.
 * Unknown keys (label, isDefault) pass through untouched.
 */
export function sanitizeAddressField(key: string, value: string): string {
  switch (key) {
    case "phone":
      return sanitizePhone(value);
    case "pincode":
      return sanitizePincode(value);
    case "fullName":
      return sanitizeName(value);
    case "city":
      return sanitizeCity(value);
    case "line1":
    case "line2":
      return sanitizeAddressLine(value);
    default:
      return value;
  }
}
