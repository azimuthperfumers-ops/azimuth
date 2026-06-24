"use client";

import { ProfileCard } from "@/components/profile-card";
import { SignInCard } from "@/components/sign-in-card";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";

export default function Home() {
  const { data: session, isPending } = authClient.useSession();
  const ping = trpc.health.ping.useQuery();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Azimuth Perfumers — admin</h1>
        <p className="text-sm text-muted-foreground">
          server: {ping.isLoading ? "checking..." : ping.data?.status ?? "unreachable"}
        </p>
      </div>
      {isPending ? null : session ? <ProfileCard user={session.user} /> : <SignInCard />}
    </main>
  );
}
