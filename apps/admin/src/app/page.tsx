"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";

export default function Home() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const attempted = useRef(false);

  const completeGoogleSignup = trpc.adminAuth.completeGoogleSignup.useMutation({
    onSuccess: () => router.replace("/dashboard"),
    onError: async (err) => {
      toast.error(err.message);
      await authClient.signOut();
      router.replace("/login");
    },
  });

  useEffect(() => {
    if (isPending) return;

    const gat = new URLSearchParams(window.location.search).get("gat");

    if (gat) {
      if (!session) {
        router.replace("/login");
        return;
      }
      if (session.user.role === "admin") {
        router.replace("/dashboard");
        return;
      }
      if (!attempted.current) {
        attempted.current = true;
        completeGoogleSignup.mutate({ token: gat });
      }
      return;
    }

    if (session?.user.role === "admin") {
      router.replace("/dashboard");
    } else if (session) {
      // Signed in via Google on the login page but not an admin account
      authClient.signOut().then(() => {
        toast.error("This account does not have admin access.");
        router.replace("/login");
      });
    } else {
      router.replace("/login");
    }
  }, [isPending, session, router, completeGoogleSignup]);

  return null;
}
