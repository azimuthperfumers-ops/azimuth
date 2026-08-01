export function formatInr(value: string | number) {
  return `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/**
 * The customer's account handle: "#620E03FZ". Real account ids are long random
 * strings; this is the first 8 characters, the same form the admin sees and
 * searches by, so quoting it in a support ticket finds the right person.
 */
export function shortUserId(id: string) {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(date: string | Date) {
  return new Date(date).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
