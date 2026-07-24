"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { usePermissions } from "@/hooks/use-permissions";
import { firstAccessiblePath } from "@/lib/nav";

export default function Home() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { can } = usePermissions();

  useEffect(() => {
    if (isPending) return;

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
  }, [isPending, session, router, can]);

  return null;
}
