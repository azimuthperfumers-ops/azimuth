"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

type Status = "verifying" | "success" | "error";

function VerifyEmailInner() {
  const params = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<Status>("verifying");
  const ran = useRef(false);

  useEffect(() => {
    // The token is single-use — guard against double-invocation in dev/StrictMode.
    if (ran.current) return;
    ran.current = true;

    if (!token) {
      setStatus("error");
      return;
    }

    (async () => {
      try {
        // Call the server ourselves (no callbackURL → it returns JSON, not a
        // redirect) so verification + auto-sign-in happen through our own page.
        const res = await fetch(
          `${SERVER_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`,
          { credentials: "include" },
        );
        const data = (await res.json().catch(() => null)) as { status?: boolean } | null;
        setStatus(res.ok && data?.status ? "success" : "error");
      } catch {
        setStatus("error");
      }
    })();
  }, [token]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      {status === "verifying" && (
        <>
          <Loader2 className="size-9 animate-spin text-muted-foreground/50" />
          <h1 className="mt-6 font-heading text-2xl font-medium">Verifying your email…</h1>
          <p className="mt-2 text-[13px] text-muted-foreground">Just a moment.</p>
        </>
      )}

      {status === "success" && (
        <>
          <CheckCircle2 className="size-10 text-green-600" />
          <h1 className="mt-6 font-heading text-3xl font-medium leading-tight">Email verified</h1>
          <p className="mt-3 text-[14px] text-muted-foreground leading-relaxed">
            Welcome to Azimuth Perfumers — your account is active and you&apos;re signed in.
          </p>
          <div className="mt-8 flex w-full flex-col gap-2.5 sm:flex-row sm:justify-center">
            <Link
              href="/account"
              className="border border-foreground bg-foreground px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-background transition-opacity hover:opacity-80"
            >
              Go to my account
            </Link>
            <Link
              href="/shop"
              className="border border-border px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground transition-colors hover:bg-muted"
            >
              Browse the collection
            </Link>
          </div>
        </>
      )}

      {status === "error" && (
        <>
          <XCircle className="size-10 text-primary" />
          <h1 className="mt-6 font-heading text-3xl font-medium leading-tight">Link expired</h1>
          <p className="mt-3 text-[14px] text-muted-foreground leading-relaxed">
            This verification link is invalid or has already been used. Sign in with your password
            and we&apos;ll send you a fresh one.
          </p>
          <div className="mt-8 flex w-full flex-col gap-2.5 sm:flex-row sm:justify-center">
            <Link
              href="/account"
              className="border border-foreground bg-foreground px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-background transition-opacity hover:opacity-80"
            >
              Go to sign in
            </Link>
            <Link
              href="/"
              className="border border-border px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground transition-colors hover:bg-muted"
            >
              Back to home
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Suspense fallback={null}>
          <VerifyEmailInner />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
