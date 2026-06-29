import { useState, useEffect, useCallback } from "react";
import { authClient } from "@/lib/auth-client";

type Session = Awaited<ReturnType<typeof authClient.getSession>>["data"];

export function useSession() {
  const [session, setSession] = useState<Session>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await authClient.getSession();
    setSession(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { session, loading, refresh };
}
