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
