"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { usePermissions } from "@/hooks/use-permissions";
import { firstAccessiblePath } from "@/lib/nav";
import { trpc } from "@/lib/trpc";

export default function Home() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { can } = usePermissions();
  const attempted = useRef(false);

  // Google owner-registration returns here with ?gat=<token>; consume it to
  // elevate the freshly-created Google account to owner.
  const completeGoogleOwner = trpc.ownerAuth.completeGoogleOwner.useMutation({
    onSuccess: () => router.replace(firstAccessiblePath(can)),
    onError: async (err) => {
      toast.error(err.message);
      await authClient.signOut();
      router.replace("/login");
    },
  });

  useEffect(() => {
    if (isPending) return;

    const gat = new URLSearchParams(window.location.search).get("gat");

    // Owner-via-Google callback: the account was just created but isn't staff yet.
    if (gat) {
      if (!session) {
        router.replace("/login");
        return;
      }
      if (session.user.role === "admin") {
        router.replace(firstAccessiblePath(can));
        return;
      }
      if (!attempted.current) {
        attempted.current = true;
        completeGoogleOwner.mutate({ token: gat });
      }
      return;
    }

    if (session?.user.role === "admin") {
      // Land on the first section this role can see (cataloging has no dashboard).
      router.replace(firstAccessiblePath(can));
    } else if (session) {
      // Signed in (e.g. via Google) but not a staff account.
      authClient.signOut().then(() => {
        toast.error("This account does not have admin access.");
        router.replace("/login");
      });
    } else {
      router.replace("/login");
    }
  }, [isPending, session, router, can, completeGoogleOwner]);

  return null;
}
