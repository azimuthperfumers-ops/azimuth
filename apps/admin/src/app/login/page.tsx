"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!isPending && session?.user.role === "admin") {
      router.replace("/dashboard");
    }
  }, [isPending, session, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Email and password required");
      return;
    }
    setPending(true);
    const { error } = await authClient.signIn.email({ email, password });
    setPending(false);
    if (error) {
      toast.error(error.message ?? "Sign in failed");
    } else if (session?.user.role !== "admin") {
      // Signed in but not an admin — sign out and block
      await authClient.signOut();
      toast.error("This account does not have admin access.");
    }
  }

  if (isPending) return null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <p className="font-heading text-3xl font-semibold tracking-[0.18em]">AZIMUTH</p>
          <p className="mt-1 text-[10px] font-semibold tracking-[0.35em] text-muted-foreground uppercase">
            Perfumers · Admin
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sign in</CardTitle>
            <CardDescription className="text-xs">Admin accounts only</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => authClient.signIn.social({ provider: "google", callbackURL: window.location.origin + "/dashboard" })}
            >
              Continue with Google
            </Button>
            <div className="flex items-center gap-2">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">or</span>
              <Separator className="flex-1" />
            </div>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Signing in…" : "Sign in"}
              </Button>
            </form>
            <p className="text-center text-xs text-muted-foreground">
              Need an account?{" "}
              <Link href="/signup" className="text-foreground underline underline-offset-2">
                Register with invite code
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
