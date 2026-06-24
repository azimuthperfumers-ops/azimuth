import type { auth } from "@azimuth/auth";
import { inferAdditionalFields, phoneNumberClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000",
  plugins: [inferAdditionalFields<typeof auth>(), phoneNumberClient()],
});
