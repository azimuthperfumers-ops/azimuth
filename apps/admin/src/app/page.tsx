"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

export default function Home() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (isPending) return;
    if (session?.user.role === "admin") {
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, [isPending, session, router]);

  return null;
}
