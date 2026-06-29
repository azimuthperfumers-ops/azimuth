import { createAuthClient } from "better-auth/client";
import { inferAdditionalFields, phoneNumberClient } from "better-auth/client/plugins";
import type { auth } from "@azimuth/auth";
import { getStoredToken, storeToken, clearToken } from "./session";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

async function mobileFetch(url: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> {
  const token = await getStoredToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(url, { ...init, headers });
  const newToken = res.headers.get("set-auth-token");
  if (newToken) await storeToken(newToken);
  return res;
}

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [inferAdditionalFields<typeof auth>(), phoneNumberClient()],
  fetchOptions: {
    customFetchImpl: mobileFetch as typeof fetch,
  },
});

export { clearToken as signOut };
