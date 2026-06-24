"use client";

import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";
import { emailSignInSchema, emailSignUpSchema, otpCodeSchema, phoneNumberSchema } from "@/lib/validation";

function GoogleButton() {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/" })}
    >
      Continue with Google
    </Button>
  );
}

function EmailAuthForm() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    const schema = mode === "sign-up" ? emailSignUpSchema : emailSignInSchema;
    const parsed = schema.safeParse({ name, email, password });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form and try again");
      return;
    }

    setPending(true);
    const { error } =
      mode === "sign-up"
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password });
    setPending(false);

    if (error) {
      toast.error(error.message ?? "Something went wrong");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {mode === "sign-up" && (
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      )}
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
        {mode === "sign-up" ? "Sign up" : "Sign in"}
      </Button>
      <button
        type="button"
        className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        onClick={() => setMode(mode === "sign-up" ? "sign-in" : "sign-up")}
      >
        {mode === "sign-up" ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
      </button>
    </form>
  );
}

function PhoneAuthForm() {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);

  async function sendCode(e: FormEvent) {
    e.preventDefault();

    const parsed = phoneNumberSchema.safeParse({ phoneNumber });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Enter a valid phone number");
      return;
    }

    setPending(true);
    const { error } = await authClient.phoneNumber.sendOtp({ phoneNumber });
    setPending(false);

    if (error) {
      toast.error(error.message ?? "Could not send code");
      return;
    }

    toast.success("Code sent");
    setStep("code");
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();

    const parsed = otpCodeSchema.safeParse({ code });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Enter the 6-digit code");
      return;
    }

    setPending(true);
    const { error } = await authClient.phoneNumber.verify({ phoneNumber, code });
    setPending(false);

    if (error) {
      toast.error(error.message ?? "Invalid code");
    }
  }

  if (step === "phone") {
    return (
      <form onSubmit={sendCode} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone number</Label>
          <Input
            id="phone"
            placeholder="+1 555 555 5555"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          Send code
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={verifyCode} className="space-y-4">
      <div className="space-y-2">
        <Label>Enter the code sent to {phoneNumber}</Label>
        <InputOTP maxLength={6} value={code} onChange={setCode}>
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        Verify
      </Button>
      <button
        type="button"
        className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        onClick={() => setStep("phone")}
      >
        Use a different number
      </button>
    </form>
  );
}

export function AuthCard() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Welcome to Azimuth Perfumers</CardTitle>
        <CardDescription>Sign in or create an account to continue</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <GoogleButton />
        <div className="flex items-center gap-2">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div>
        <Tabs defaultValue="email">
          <TabsList className="w-full">
            <TabsTrigger value="email" className="flex-1">
              Email
            </TabsTrigger>
            <TabsTrigger value="phone" className="flex-1">
              Phone
            </TabsTrigger>
          </TabsList>
          <TabsContent value="email" className="pt-4">
            <EmailAuthForm />
          </TabsContent>
          <TabsContent value="phone" className="pt-4">
            <PhoneAuthForm />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
