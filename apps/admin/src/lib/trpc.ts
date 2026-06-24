import type { AppRouter } from "@azimuth/api";
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";

export const trpc = createTRPCReact<AppRouter>();

const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

export function getTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${serverUrl}/trpc`,
        fetch(url, options) {
          return fetch(url, { ...options, credentials: "include" });
        },
      }),
    ],
  });
}
