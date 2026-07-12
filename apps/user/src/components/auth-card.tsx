"use client";

import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { emailSignInSchema, emailSignUpSchema } from "@/lib/validation";
import { cn } from "@/lib/utils";

// ─── Shared primitives ────────────────────────────────────────────────────────

function Field({
  label,
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
}: {
  label: string;
  id: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full border bg-background px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none transition-colors",
          error ? "border-primary focus:border-primary" : "border-border focus:border-foreground",
        )}
      />
      {error && <p className="mt-1 text-[11px] text-primary">{error}</p>}
    </div>
  );
}

function SubmitBtn({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "w-full py-3.5 text-[11px] font-bold tracking-[0.22em] uppercase transition-opacity",
        pending ? "bg-foreground/50 text-background cursor-not-allowed" : "bg-foreground text-background hover:opacity-80",
      )}
    >
      {pending ? "Please wait…" : label}
    </button>
  );
}

// ─── Email form ───────────────────────────────────────────────────────────────

type View = "credentials" | "verify-email" | "forgot" | "reset";

function EmailAuthForm() {
  const [view, setView] = useState<View>("credentials");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function clearErr(key: string) {
    if (errors[key]) setErrors((p) => { const n = { ...p }; delete n[key]; return n; });
  }

  function toView(v: View) {
    setView(v);
    setOtp("");
    setErrors({});
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const schema = mode === "sign-up" ? emailSignUpSchema : emailSignInSchema;
    const parsed = schema.safeParse({ name, email, password });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !errs[key]) errs[key] = issue.message;
      }
      setErrors(errs);
      return;
    }
    setErrors({});
    setPending(true);
    const { error } =
      mode === "sign-up"
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password });
    setPending(false);
    if (!error) {
      if (mode === "sign-up") {
        // Account created but locked until the email is verified — OTP already sent
        toView("verify-email");
        toast.success("We've emailed you a verification code");
      }
      return;
    }
    // Unverified account — the server auto-sends a fresh OTP with this response
    if (error.status === 403 || error.code === "EMAIL_NOT_VERIFIED") {
      toView("verify-email");
      toast.info("Verify your email to continue — code sent");
      return;
    }
    toast.error(error.message ?? "Something went wrong");
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault();
    if (otp.trim().length !== 6) { setErrors({ otp: "Enter the 6-digit code" }); return; }
    setPending(true);
    const { error } = await authClient.emailOtp.verifyEmail({ email, otp: otp.trim() });
    setPending(false);
    if (error) { toast.error(error.message ?? "Invalid code"); return; }
    toast.success("Email verified — welcome!");
  }

  async function resendOtp(type: "email-verification" | "forget-password") {
    const { error } =
      type === "email-verification"
        ? await authClient.emailOtp.sendVerificationOtp({ email, type })
        : await authClient.forgetPassword.emailOtp({ email });
    if (error) toast.error(error.message ?? "Could not send code");
    else toast.success("Code sent");
  }

  async function onForgot(e: FormEvent) {
    e.preventDefault();
    if (!email) { setErrors({ email: "Enter your email" }); return; }
    setPending(true);
    const { error } = await authClient.forgetPassword.emailOtp({ email });
    setPending(false);
    if (error) { toast.error(error.message ?? "Could not send code"); return; }
    toView("reset");
    toast.success("Reset code sent to your email");
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (otp.trim().length !== 6) errs.otp = "Enter the 6-digit code";
    if (password.length < 8) errs.password = "Password must be at least 8 characters";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setPending(true);
    const { error } = await authClient.emailOtp.resetPassword({ email, otp: otp.trim(), password });
    setPending(false);
    if (error) { toast.error(error.message ?? "Could not reset password"); return; }
    setPassword("");
    setMode("sign-in");
    toView("credentials");
    toast.success("Password updated — sign in with your new password");
  }

  if (view === "verify-email") {
    return (
      <form onSubmit={onVerify} className="space-y-4">
        <p className="text-[13px] text-muted-foreground/70 leading-relaxed">
          Enter the 6-digit code we sent to <span className="text-foreground font-medium">{email}</span>
        </p>
        <Field label="Verification code" id="otp" value={otp} onChange={(v) => { setOtp(v); clearErr("otp"); }} placeholder="000000" error={errors.otp} />
        <SubmitBtn pending={pending} label="Verify email" />
        <div className="flex items-center justify-between text-[11px]">
          <button type="button" onClick={() => resendOtp("email-verification")} className="text-muted-foreground/60 hover:text-foreground transition-colors">
            Resend code
          </button>
          <button type="button" onClick={() => toView("credentials")} className="text-muted-foreground/60 hover:text-foreground transition-colors">
            Back
          </button>
        </div>
      </form>
    );
  }

  if (view === "forgot") {
    return (
      <form onSubmit={onForgot} className="space-y-4">
        <p className="text-[13px] text-muted-foreground/70 leading-relaxed">
          We&apos;ll email you a code to reset your password.
        </p>
        <Field label="Email" id="email" type="email" value={email} onChange={(v) => { setEmail(v); clearErr("email"); }} error={errors.email} />
        <SubmitBtn pending={pending} label="Send reset code" />
        <button type="button" onClick={() => toView("credentials")} className="w-full text-center text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors">
          Back to sign in
        </button>
      </form>
    );
  }

  if (view === "reset") {
    return (
      <form onSubmit={onReset} className="space-y-4">
        <p className="text-[13px] text-muted-foreground/70 leading-relaxed">
          Code sent to <span className="text-foreground font-medium">{email}</span>. Choose a new password.
        </p>
        <Field label="Reset code" id="otp" value={otp} onChange={(v) => { setOtp(v); clearErr("otp"); }} placeholder="000000" error={errors.otp} />
        <Field label="New password" id="new-password" type="password" value={password} onChange={(v) => { setPassword(v); clearErr("password"); }} error={errors.password} />
        <SubmitBtn pending={pending} label="Reset password" />
        <div className="flex items-center justify-between text-[11px]">
          <button type="button" onClick={() => resendOtp("forget-password")} className="text-muted-foreground/60 hover:text-foreground transition-colors">
            Resend code
          </button>
          <button type="button" onClick={() => toView("credentials")} className="text-muted-foreground/60 hover:text-foreground transition-colors">
            Back
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {mode === "sign-up" && (
        <Field label="Full name" id="name" value={name} onChange={(v) => { setName(v); clearErr("name"); }} error={errors.name} />
      )}
      <Field label="Email" id="email" type="email" value={email} onChange={(v) => { setEmail(v); clearErr("email"); }} error={errors.email} />
      <Field label="Password" id="password" type="password" value={password} onChange={(v) => { setPassword(v); clearErr("password"); }} error={errors.password} />
      {mode === "sign-in" && (
        <button type="button" onClick={() => toView("forgot")} className="block w-full text-right text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors -mt-2">
          Forgot password?
        </button>
      )}
      <SubmitBtn pending={pending} label={mode === "sign-up" ? "Create account" : "Sign in"} />
      <button
        type="button"
        onClick={() => { setMode(mode === "sign-up" ? "sign-in" : "sign-up"); setErrors({}); }}
        className="w-full text-center text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors"
      >
        {mode === "sign-up" ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
      </button>
    </form>
  );
}

// ─── Auth card ────────────────────────────────────────────────────────────────

export function AuthCard() {
  return (
    <div className="w-full max-w-[400px] border border-border bg-background px-8 py-10">
      {/* Header */}
      <div className="mb-8 text-center">
        <p className="text-[9px] font-semibold tracking-[0.55em] text-muted-foreground/50 uppercase mb-2">
          Azimuth Perfumers
        </p>
        <h2 className="font-heading text-[1.6rem] font-medium leading-tight tracking-tight text-foreground">
          Welcome back
        </h2>
        <p className="mt-1.5 text-[13px] text-muted-foreground/60">
          Sign in or create an account to continue
        </p>
      </div>

      {/* Google */}
      <button
        type="button"
        onClick={() => authClient.signIn.social({ provider: "google", callbackURL: window.location.origin + "/" })}
        className="flex w-full items-center justify-center gap-3 border border-border py-3 text-[11px] font-semibold tracking-[0.14em] uppercase text-foreground transition-colors hover:bg-muted"
      >
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </button>

      {/* Or divider */}
      <div className="my-6 flex items-center gap-4">
        <div className="flex-1 border-t border-border/50" />
        <span className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground/40 uppercase">or</span>
        <div className="flex-1 border-t border-border/50" />
      </div>

      {/* Email form */}
      <EmailAuthForm />
    </div>
  );
}
