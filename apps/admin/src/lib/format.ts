export function formatInr(value: string | number) {
  return `₹${Number(value).toFixed(2)}`;
}
