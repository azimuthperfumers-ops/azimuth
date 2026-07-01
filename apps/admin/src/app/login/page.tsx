"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
    const { data, error } = await authClient.signIn.email({ email, password });
    setPending(false);
    if (error) {
      toast.error(error.message ?? "Sign in failed");
    } else if ((data?.user as { role?: string })?.role !== "admin") {
      await authClient.signOut();
      toast.error("This account does not have admin access.");
    }
  }

  if (isPending) return null;

  return (
    <div className="flex min-h-screen">
      {/* Left — brand panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-foreground text-background p-14">
        <div>
          <p className="font-heading text-3xl font-semibold tracking-[0.22em]">AZIMUTH</p>
          <p className="mt-1 text-[9px] font-semibold tracking-[0.5em] text-background/40 uppercase">
            Perfumers · Admin
          </p>
        </div>
        <div className="space-y-3">
          <p className="text-[11px] tracking-[0.25em] text-background/30 uppercase">Studio operations console</p>
          <p className="text-sm text-background/50 leading-relaxed max-w-xs">
            Manage orders, inventory, logistics, and store configuration from a single place.
          </p>
        </div>
        <p className="text-[10px] text-background/20 tracking-widest uppercase">
          Azimuth Perfumers © {new Date().getFullYear()}
        </p>
      </div>

      {/* Right — form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 bg-background">
        {/* Mobile wordmark */}
        <div className="mb-10 text-center lg:hidden">
          <p className="font-heading text-3xl font-semibold tracking-[0.22em]">AZIMUTH</p>
          <p className="mt-1 text-[9px] font-semibold tracking-[0.5em] text-muted-foreground uppercase">
            Perfumers · Admin
          </p>
        </div>

        <div className="w-full max-w-sm space-y-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">Admin accounts only</p>
          </div>

          <div className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => authClient.signIn.social({ provider: "google", callbackURL: window.location.origin + "/" })}
            >
              Continue with Google
            </Button>

            <div className="flex items-center gap-3">
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
          </div>
        </div>
      </div>
    </div>
  );
}
