import { createAuthClient } from "better-auth/react";
import { emailOTPClient, inferAdditionalFields } from "better-auth/client/plugins";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import type { auth } from "@azimuth/auth";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    inferAdditionalFields<typeof auth>(),
    emailOTPClient(),
    expoClient({
      scheme: "azimuth",
      storagePrefix: "azimuth",
      storage: SecureStore,
    }),
  ],
});
