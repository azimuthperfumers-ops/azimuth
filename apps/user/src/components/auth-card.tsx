"use client";

import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { authClient } from "@/lib/auth-client";
import { emailSignInSchema, emailSignUpSchema, otpCodeSchema, phoneNumberSchema } from "@/lib/validation";
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

function EmailAuthForm() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function clearErr(key: string) {
    if (errors[key]) setErrors((p) => { const n = { ...p }; delete n[key]; return n; });
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
    if (error) toast.error(error.message ?? "Something went wrong");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {mode === "sign-up" && (
        <Field label="Full name" id="name" value={name} onChange={(v) => { setName(v); clearErr("name"); }} error={errors.name} />
      )}
      <Field label="Email" id="email" type="email" value={email} onChange={(v) => { setEmail(v); clearErr("email"); }} error={errors.email} />
      <Field label="Password" id="password" type="password" value={password} onChange={(v) => { setPassword(v); clearErr("password"); }} error={errors.password} />
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

// ─── Phone / OTP form ────────────────────────────────────────────────────────

function PhoneAuthForm() {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [codeError, setCodeError] = useState("");

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    const parsed = phoneNumberSchema.safeParse({ phoneNumber });
    if (!parsed.success) {
      setPhoneError(parsed.error.issues[0]?.message ?? "Enter a valid phone number");
      return;
    }
    setPhoneError("");
    setPending(true);
    const { error } = await authClient.phoneNumber.sendOtp({ phoneNumber });
    setPending(false);
    if (error) { toast.error(error.message ?? "Could not send code"); return; }
    toast.success("Code sent");
    setStep("code");
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    const parsed = otpCodeSchema.safeParse({ code });
    if (!parsed.success) {
      setCodeError(parsed.error.issues[0]?.message ?? "Enter the 6-digit code");
      return;
    }
    setCodeError("");
    setPending(true);
    const { error } = await authClient.phoneNumber.verify({ phoneNumber, code });
    setPending(false);
    if (error) toast.error(error.message ?? "Invalid code");
  }

  if (step === "phone") {
    return (
      <form onSubmit={sendCode} className="space-y-4">
        <Field
          label="Phone number" id="phone" type="tel"
          value={phoneNumber}
          onChange={(v) => { setPhoneNumber(v); setPhoneError(""); }}
          placeholder="+91 98765 43210"
          error={phoneError}
        />
        <SubmitBtn pending={pending} label="Send code" />
      </form>
    );
  }

  return (
    <form onSubmit={verifyCode} className="space-y-5">
      <div className="space-y-2">
        <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
          Code sent to {phoneNumber}
        </p>
        <InputOTP maxLength={6} value={code} onChange={(v) => { setCode(v); setCodeError(""); }}>
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
        {codeError && <p className="mt-1 text-[11px] text-primary">{codeError}</p>}
      </div>
      <SubmitBtn pending={pending} label="Verify" />
      <button type="button" onClick={() => setStep("phone")} className="w-full text-center text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors">
        Use a different number
      </button>
    </form>
  );
}

// ─── Auth card ────────────────────────────────────────────────────────────────

export function AuthCard() {
  const [tab, setTab] = useState<"email" | "phone">("email");

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

      {/* Tab switcher */}
      <div className="mb-6 flex border-b border-border">
        {(["email", "phone"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 pb-3 text-[10.5px] font-semibold tracking-[0.16em] uppercase transition-colors",
              tab === t
                ? "border-b-2 border-foreground text-foreground -mb-px"
                : "text-muted-foreground/50 hover:text-foreground",
            )}
          >
            {t === "email" ? "Email" : "Phone"}
          </button>
        ))}
      </div>

      {/* Forms */}
      {tab === "email" ? <EmailAuthForm /> : <PhoneAuthForm />}
    </div>
  );
}
