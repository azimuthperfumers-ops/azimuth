import type { AppRouter } from "@azimuth/api";
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { authClient } from "./auth-client";

export const trpc = createTRPCReact<AppRouter>();

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

export function createTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${API_URL}/trpc`,
        headers() {
          const cookie = authClient.getCookie();
          return cookie ? { Cookie: cookie } : {};
        },
      }),
    ],
  });
}
