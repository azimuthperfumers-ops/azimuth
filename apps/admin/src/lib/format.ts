export function formatInr(value: string | number) {
  return `₹${Number(value).toFixed(2)}`;
}

/**
 * The customer-facing form of a user id: "#620E03FZ". Account ids are long
 * random strings nobody can read out over a phone call, so the UI shows the
 * first 8 characters — enough to be unique in a store this size, and the search
 * on the Users list matches it as a prefix of the real id.
 */
export function shortUserId(id: string) {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

/**
 * A proof-of-delivery image to render, or null.
 *
 * Shiprocket's `pod` field often carries the availability word ("Available")
 * instead of a link, and orders delivered before that was caught have the word
 * stored in the column. Rendering it gives a broken image whose src resolves
 * against the current page — clicking it walked to /orders/Available. Only an
 * absolute http(s) URL is an image; anything else is treated as no POD.
 */
export function podImageSrc(value: string | null | undefined): string | null {
  const url = (value ?? "").trim();
  return /^https?:\/\//i.test(url) ? url : null;
}
