import { msg91Post } from "./client.js";

// MSG91 Flow/Template SMS — DLT-compliant for India.
// flowId = MSG91 Flow ID (create in MSG91 dashboard under SMS > Flows).
// vars   = template variable values, keys must match what you defined in the flow.
// mobile = 12-digit E.164 without +, e.g. "919876543210"

export async function sendSms(
  mobile: string,
  flowId: string,
  vars: Record<string, string>,
): Promise<void> {
  await msg91Post("https://control.msg91.com/api/v5/flow/", {
    flow_id: flowId,
    sender: process.env.MSG91_SENDER_ID ?? "AZIMUT",
    short_url: "0",
    mobiles: mobile,
    ...vars,
  });
}

// Normalise phone to MSG91 format: strip +, prefix 91 if missing leading country code
export function toMobile(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}
