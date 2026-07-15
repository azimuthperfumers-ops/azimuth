"use client";

import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { trpc } from "@/lib/trpc";
import { emailSignInSchema } from "@/lib/validation";

export function SignInCard() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteCode, setInviteCode] = useState("");

  const verifyInvite = trpc.adminAuth.verifyInviteForGoogle.useMutation({
    onSuccess: ({ token }) => {
      setShowInviteDialog(false);
      setInviteCode("");
      authClient.signIn.social({
        provider: "google",
        callbackURL: window.location.origin + "/?gat=" + token,
      });
    },
    onError: (err) => toast.error(err.message),
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    const parsed = emailSignInSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form and try again");
      return;
    }

    setPending(true);
    const { error } = await authClient.signIn.email({ email, password });
    setPending(false);

    if (error) {
      toast.error(authErrorMessage(error));
    }
  }

  function handleInviteSubmit(e: FormEvent) {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    verifyInvite.mutate({ inviteCode: inviteCode.trim() });
  }

  return (
    <>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Azimuth Perfumers admin</CardTitle>
          <CardDescription>Sign in with an admin account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setShowInviteDialog(true)}
          >
            Continue with Google
          </Button>
          <div className="flex items-center gap-2">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Enter invite code</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInviteSubmit} className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label htmlFor="google-invite">Invite code</Label>
              <Input
                id="google-invite"
                type="password"
                autoComplete="off"
                placeholder="••••••••"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={verifyInvite.isPending}>
              {verifyInvite.isPending ? "Verifying…" : "Continue with Google"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
