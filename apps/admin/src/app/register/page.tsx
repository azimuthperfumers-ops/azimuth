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
import { trpc } from "@/lib/trpc";

export default function RegisterOwnerPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);

  // Already signed in as staff → no need to register.
  useEffect(() => {
    if (!isPending && session?.user.role === "admin") router.replace("/");
  }, [isPending, session, router]);

  const register = trpc.ownerAuth.registerOwner.useMutation({
    onError: (err) => {
      toast.error(err.message);
      setPending(false);
    },
    onSuccess: async () => {
      // Sign the new owner in (email is pre-verified) and hand off to the landing
      // redirect, which routes by role.
      const { error } = await authClient.signIn.email({ email, password });
      setPending(false);
      if (error) {
        toast.success("Owner account created — please sign in.");
        router.replace("/login");
      } else {
        router.replace("/");
      }
    },
  });

  const verifyForGoogle = trpc.ownerAuth.verifyCodeForGoogle.useMutation({
    onError: (err) => toast.error(err.message),
    onSuccess: ({ token }) => {
      // Carry the one-time token through OAuth; the landing page consumes it.
      authClient.signIn.social({
        provider: "google",
        callbackURL: `${window.location.origin}/?gat=${token}`,
      });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name || !email || !password || !code) {
      toast.error("All fields, including the owner code, are required.");
      return;
    }
    setPending(true);
    register.mutate({ name, email, password, inviteCode: code.trim() });
  }

  function onGoogle() {
    if (!code.trim()) {
      toast.error("Enter the owner code first.");
      return;
    }
    verifyForGoogle.mutate({ inviteCode: code.trim() });
  }

  if (isPending) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="flex items-start justify-center gap-2.5">
            <img src="/logo-icon.png" alt="" className="h-8 w-8 dark:invert" />
            <img src="/logo-azimuth-text.png" alt="Azimuth" className="h-6 w-auto dark:invert" />
            <sup className="mt-0.5 text-[10px] leading-none text-foreground">&trade;</sup>
          </div>
          <p className="mt-1 text-[9px] font-semibold tracking-[0.5em] text-muted-foreground uppercase">
            Perfumers · Admin
          </p>
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Owner setup</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create an owner account with the owner code. Other staff are added from the Staff page.
          </p>
        </div>

        <div className="space-y-4">
          {/* Owner code — required for both email and Google. */}
          <div className="space-y-1.5">
            <Label htmlFor="code">Owner code</Label>
            <Input
              id="code"
              type="password"
              autoComplete="off"
              placeholder="From your ADMIN_INVITE_CODE"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>

          <Button type="button" variant="outline" className="w-full" onClick={onGoogle} disabled={verifyForGoogle.isPending}>
            {verifyForGoogle.isPending ? "Verifying…" : "Continue with Google"}
          </Button>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or with email</span>
            <Separator className="flex-1" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Creating…" : "Create owner account"}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-foreground underline underline-offset-2">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
