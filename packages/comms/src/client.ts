// Raw MSG91 HTTP helpers. All channels share the same authkey.

import { env } from "./env.js";

function authKey(): string {
  if (!env.MSG91_AUTH_KEY) throw new Error("MSG91_AUTH_KEY not set");
  return env.MSG91_AUTH_KEY;
}

export async function msg91Post(url: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authkey: authKey(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`MSG91 POST ${url} → ${res.status}: ${text}`);

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
