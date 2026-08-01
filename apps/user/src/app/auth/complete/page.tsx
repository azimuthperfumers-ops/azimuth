"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { STAFF_ACCOUNT_MESSAGE, canUseStorefront, type AccountLike } from "@/lib/account-access";

/**
 * Where Google sends people back to.
 *
 * The email form can inspect its own sign-in result; a social login can't — it
 * leaves the site and returns with a cookie already set. So the storefront's
 * account rule is applied here instead, on the one navigation that follows a
 * sign-in, rather than by a guard watching every page.
 *
 * That distinction matters: the session cookie is set on the API domain and is
 * shared with the admin panel, so signing out is not a local act. Only someone
 * who just tried to sign in here gets signed out — staff who merely browse the
 * shop keep the admin session they already had.
 */
function AuthCompleteInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: session, isPending } = authClient.useSession();
  const [rejected, setRejected] = useState(false);
  const handled = useRef(false);

  // Same-site relative paths only — an absolute URL here would be an open redirect.
  const raw = params.get("next");
  const next = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/account";

  useEffect(() => {
    if (isPending || handled.current) return;

    // No session: the sign-in was abandoned or failed — back to the shop.
    if (!session?.user) {
      handled.current = true;
      router.replace("/");
      return;
    }

    handled.current = true;
    if (canUseStorefront(session.user as AccountLike)) {
      router.replace(next);
      return;
    }
    void authClient.signOut().finally(() => setRejected(true));
  }, [isPending, session, next, router]);

  if (rejected) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
          Signed out
        </p>
        <p className="mt-3 text-[15px] text-foreground">{STAFF_ACCOUNT_MESSAGE}</p>
        <Link
          href="/"
          className="mt-8 border border-foreground px-6 py-2.5 text-[11px] font-semibold tracking-[0.18em] uppercase transition-colors hover:bg-foreground hover:text-background"
        >
          Back to the shop
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <p className="text-[13px] text-muted-foreground">Signing you in…</p>
    </div>
  );
}

export default function AuthCompletePage() {
  return (
    <Suspense fallback={null}>
      <AuthCompleteInner />
    </Suspense>
  );
}
