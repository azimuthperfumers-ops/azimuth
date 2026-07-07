import { authClient } from "@/lib/auth-client";

export function useSession() {
  const { data: session, isPending: loading, refetch: refresh } = authClient.useSession();
  return { session, loading, refresh };
}
