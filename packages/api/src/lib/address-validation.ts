/**
 * One definition of what a *shippable* Indian address looks like.
 *
 * Shiprocket validates the booking payload strictly and rejects the whole order
 * when a field is off — a phone carrying a "+91", a space or a hyphen comes back
 * as `422 {"billing_phone":["The billing phone must be a number.","The billing
 * phone must be 10 digits."]}`, and by then the customer has already paid. So the
 * rules live here, in a dependency-free module, and are applied in three places:
 *
 *   1. as the user types  — input is sanitised so bad characters never appear
 *   2. on submit          — `validateAddress` blocks the form
 *   3. on the server      — the tRPC schemas normalise + re-check every field
 *
 * Anything that reaches the courier has passed all three.
 */

export const PHONE_LENGTH = 10;
export const PINCODE_LENGTH = 6;

// ─── Sanitisers (run on every keystroke; never reject, only clean) ────────────

/**
 * Digits only, with the Indian country code / trunk prefix peeled off:
 * "+91 98765-43210", "0 9876543210" and "919876543210" all become "9876543210".
 * A 10-digit number that happens to start with "91" is left alone.
 */
export function sanitizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length > PHONE_LENGTH && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length > PHONE_LENGTH) digits = digits.replace(/^0+/, "");
  return digits.slice(0, PHONE_LENGTH);
}

/** Digits only, capped at six. */
export function sanitizePincode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, PINCODE_LENGTH);
}

/** Collapses runs of whitespace so " Ravi   Kumar " reads as "Ravi Kumar". */
export function collapseSpaces(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/**
 * Characters that have no business in a postal address and that break the
 * courier's JSON/CSV pipelines. Blocked by exclusion rather than by an allowlist
 * of letters, so names in any script survive — and so the expressions stay clear
 * of `\p{…}`, which React Native's Hermes engine does not reliably support.
 */
const SYMBOLS = /[<>"\\|^~`!@#$%*_+={}[\]:;?]/g;

/**
 * Names go on the shipping label, so keep the punctuation real names carry
 * (Dr., D'Souza, Rama-Krishna) and drop the rest — digits included.
 */
export function sanitizeName(raw: string): string {
  return raw.replace(SYMBOLS, "").replace(/\d/g, "").replace(/\s{2,}/g, " ").slice(0, 60);
}

/** Cities are label text too, but a few carry digits (e.g. "Sector 62"). */
export function sanitizeCity(raw: string): string {
  return raw.replace(SYMBOLS, "").replace(/\s{2,}/g, " ").slice(0, 60);
}

/** Address lines take almost anything; only the pipeline-breakers are stripped. */
export function sanitizeAddressLine(raw: string): string {
  return raw.replace(/[<>"\\|^~`]/g, "").replace(/\s{2,}/g, " ").slice(0, 200);
}

/**
 * True when the text holds something a human would read as a word — i.e. it is
 * not made up entirely of digits, spaces and punctuation. Script-agnostic, so
 * "बेंगलुरु" passes and "12-34" does not.
 */
function hasWordCharacter(text: string): boolean {
  return /[^\d\s.,'\-()/#&]/.test(text);
}

// ─── Indian states and union territories ─────────────────────────────────────

/** Exactly the spellings Shiprocket accepts, so the field can't be typo'd. */
export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export type IndianState = (typeof INDIAN_STATES)[number];

/** Older or colloquial spellings that saved addresses may still carry. */
const STATE_ALIASES: Record<string, IndianState> = {
  "orissa": "Odisha",
  "pondicherry": "Puducherry",
  "new delhi": "Delhi",
  "nct of delhi": "Delhi",
  "delhi ncr": "Delhi",
  "uttaranchal": "Uttarakhand",
  "j&k": "Jammu and Kashmir",
  "jammu & kashmir": "Jammu and Kashmir",
  "andaman & nicobar islands": "Andaman and Nicobar Islands",
  "daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
  "dadra and nagar haveli": "Dadra and Nagar Haveli and Daman and Diu",
  "tamilnadu": "Tamil Nadu",
  "up": "Uttar Pradesh",
  "mp": "Madhya Pradesh",
  "ap": "Andhra Pradesh",
  "hp": "Himachal Pradesh",
  "wb": "West Bengal",
  "tn": "Tamil Nadu",
};

/**
 * Maps free text onto the canonical spelling, or returns null when it isn't a
 * state at all. Case, spacing and "&" vs "and" are all forgiven.
 */
export function normalizeState(raw: string): IndianState | null {
  const key = collapseSpaces(raw).toLowerCase();
  if (!key) return null;
  const exact = INDIAN_STATES.find((s) => s.toLowerCase() === key);
  if (exact) return exact;
  if (STATE_ALIASES[key]) return STATE_ALIASES[key];
  const loosened = key.replace(/&/g, "and").replace(/\s+/g, " ");
  const loose = INDIAN_STATES.find((s) => s.toLowerCase() === loosened);
  return loose ?? STATE_ALIASES[loosened] ?? null;
}

// ─── Field-level checks ──────────────────────────────────────────────────────

/** Every Indian mobile number is ten digits starting 6–9. */
export function isValidPhone(raw: string): boolean {
  return /^[6-9]\d{9}$/.test(sanitizePhone(raw));
}

/** No Indian PIN code starts with a zero. */
export function isValidPincode(raw: string): boolean {
  return /^[1-9]\d{5}$/.test(sanitizePincode(raw));
}

// ─── Whole-address validation ────────────────────────────────────────────────

export type AddressInput = {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
};

export type AddressErrors = Partial<Record<keyof AddressInput, string>>;

/**
 * Returns a field → message map; an empty object means the address is bookable.
 * Messages are user-facing — they say what to do, not what failed.
 */
export function validateAddress(addr: AddressInput): AddressErrors {
  const errs: AddressErrors = {};

  const name = collapseSpaces(addr.fullName ?? "");
  if (!name) errs.fullName = "Required";
  else if (name.length < 2) errs.fullName = "Enter the full name";
  else if (!hasWordCharacter(name)) errs.fullName = "Enter a valid name";

  const phone = sanitizePhone(addr.phone ?? "");
  if (!phone) errs.phone = "Required";
  else if (phone.length < PHONE_LENGTH) errs.phone = "Enter all 10 digits";
  else if (!isValidPhone(phone)) errs.phone = "Enter a valid 10-digit mobile number";

  const line1 = collapseSpaces(addr.line1 ?? "");
  if (!line1) errs.line1 = "Required";
  else if (line1.length < 5) errs.line1 = "Enter the house / building and street";

  const city = collapseSpaces(addr.city ?? "");
  if (!city) errs.city = "Required";
  else if (city.length < 2 || !hasWordCharacter(city)) errs.city = "Enter a valid city";

  const state = collapseSpaces(addr.state ?? "");
  if (!state) errs.state = "Required";
  else if (!normalizeState(state)) errs.state = "Choose a state from the list";

  const pincode = sanitizePincode(addr.pincode ?? "");
  if (!pincode) errs.pincode = "Required";
  else if (!isValidPincode(pincode)) errs.pincode = "Enter a valid 6-digit pincode";

  return errs;
}

/**
 * The canonical form of an address: trimmed, de-prefixed, state spelled the way
 * the courier expects. Call it on anything headed for the database or the API.
 */
export function normalizeAddress<T extends AddressInput>(addr: T): T {
  return {
    ...addr,
    fullName: collapseSpaces(addr.fullName ?? ""),
    phone: sanitizePhone(addr.phone ?? ""),
    line1: collapseSpaces(addr.line1 ?? ""),
    line2: addr.line2 == null ? addr.line2 : (collapseSpaces(addr.line2) || null),
    city: collapseSpaces(addr.city ?? ""),
    state: normalizeState(addr.state ?? "") ?? collapseSpaces(addr.state ?? ""),
    pincode: sanitizePincode(addr.pincode ?? ""),
  };
}

/** True when the address can be handed to the courier as-is. */
export function isBookableAddress(addr: AddressInput): boolean {
  return Object.keys(validateAddress(addr)).length === 0;
}
