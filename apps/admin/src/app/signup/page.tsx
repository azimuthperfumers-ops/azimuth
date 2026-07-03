"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";

export default function SignupPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  const [showGoogleDialog, setShowGoogleDialog] = useState(false);
  const [googleInviteCode, setGoogleInviteCode] = useState("");

  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailInviteCode, setEmailInviteCode] = useState("");

  const verifyInviteForGoogle = trpc.adminAuth.verifyInviteForGoogle.useMutation({
    onSuccess: ({ token }) => {
      setShowGoogleDialog(false);
      setGoogleInviteCode("");
      authClient.signIn.social({
        provider: "google",
        callbackURL: window.location.origin + "/?gat=" + token,
      });
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (!isPending && session?.user.role === "admin") {
      router.replace("/dashboard");
    }
  }, [isPending, session, router]);

  const signUp = trpc.adminAuth.signUp.useMutation({
    onSuccess: async () => {
      setSigningIn(true);
      const { error } = await authClient.signIn.email({ email, password });
      setSigningIn(false);
      if (error) toast.error("Account created but sign-in failed. Go to login page.");
    },
    onError: (err) => toast.error(err.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) { toast.error("Passwords do not match"); return; }
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setShowEmailDialog(true);
  }

  function onEmailInviteSubmit(e: FormEvent) {
    e.preventDefault();
    if (!emailInviteCode.trim()) return;
    setShowEmailDialog(false);
    signUp.mutate({ name, email, password, inviteCode: emailInviteCode.trim() });
    setEmailInviteCode("");
  }

  if (isPending) return null;

  const pending = signUp.isPending || signingIn;

  return (
    <div className="flex min-h-screen">
      {/* Left — brand panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-foreground text-background p-14">
        <div>
          <div className="flex items-start gap-2.5">
            <img src="/logo-icon.png" alt="" className="h-8 w-8 invert dark:invert-0" />
            <img src="/logo-azimuth-text.png" alt="Azimuth" className="h-6 w-auto invert dark:invert-0" />
            <sup className="mt-0.5 text-[10px] leading-none text-background">&trade;</sup>
          </div>
          <p className="mt-1 text-[9px] font-semibold tracking-[0.5em] text-background/40 uppercase">
            Perfumers · Admin
          </p>
        </div>
        <div className="space-y-3">
          <p className="text-[11px] tracking-[0.25em] text-background/30 uppercase">Invite-only administrator access</p>
          <p className="text-sm text-background/50 leading-relaxed max-w-xs">
            Admin accounts are restricted. You must have an invite code from an existing administrator to register.
          </p>
        </div>
        <p className="text-[10px] text-background/20 tracking-widest uppercase">
          Azimuth Perfumers © {new Date().getFullYear()}
        </p>
      </div>

      {/* Right — form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 bg-background overflow-y-auto">
        {/* Mobile wordmark */}
        <div className="mb-10 text-center lg:hidden">
          <div className="flex items-start justify-center gap-2.5">
            <img src="/logo-icon.png" alt="" className="h-8 w-8 dark:invert" />
            <img src="/logo-azimuth-text.png" alt="Azimuth" className="h-6 w-auto dark:invert" />
            <sup className="mt-0.5 text-[10px] leading-none text-foreground">&trade;</sup>
          </div>
          <p className="mt-1 text-[9px] font-semibold tracking-[0.5em] text-muted-foreground uppercase">
            Perfumers · Admin
          </p>
        </div>

        <div className="w-full max-w-sm space-y-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Register admin account</h1>
            <p className="mt-1 text-sm text-muted-foreground">You need an invite code from an existing administrator.</p>
          </div>

          <div className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setShowGoogleDialog(true)}
            >
              Continue with Google
            </Button>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">or register with email</span>
              <Separator className="flex-1" />
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Creating account…" : "Create account"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="text-foreground underline underline-offset-2">Sign in</Link>
              </p>
            </form>
          </div>
        </div>
      </div>

      {/* Email signup invite dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Enter invite code</DialogTitle>
          </DialogHeader>
          <form onSubmit={onEmailInviteSubmit} className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label htmlFor="email-invite">Invite code</Label>
              <Input
                id="email-invite"
                type="password"
                autoComplete="off"
                placeholder="••••••••"
                value={emailInviteCode}
                onChange={(e) => setEmailInviteCode(e.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Creating account…" : "Create account"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Google signup invite dialog */}
      <Dialog open={showGoogleDialog} onOpenChange={setShowGoogleDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Enter invite code</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!googleInviteCode.trim()) return;
              verifyInviteForGoogle.mutate({ inviteCode: googleInviteCode.trim() });
            }}
            className="space-y-4 pt-1"
          >
            <div className="space-y-2">
              <Label htmlFor="google-invite">Invite code</Label>
              <Input
                id="google-invite"
                type="password"
                autoComplete="off"
                placeholder="••••••••"
                value={googleInviteCode}
                onChange={(e) => setGoogleInviteCode(e.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={verifyInviteForGoogle.isPending}>
              {verifyInviteForGoogle.isPending ? "Verifying…" : "Continue with Google"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
