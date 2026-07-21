import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";

import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { Fonts } from "@/constants/theme";
import { Logo } from "@/components/logo";

type Mode = "sign-in" | "sign-up";
type AuthView = "credentials" | "check-email" | "forgot" | "reset";

// After the customer taps the verification link (opens in browser), the server
// verifies and redirects here — deep-links back into the app.
const VERIFY_CALLBACK = "azimuth://";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function GoogleIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </Svg>
  );
}

export default function SignInScreen() {
  const router = useRouter();
  const [view, setView] = useState<AuthView>("credentials");
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const emailValid = EMAIL_RE.test(email);
  const passwordValid = password.length >= 8;
  const nameValid = mode === "sign-in" || name.trim().length > 0;
  const canSubmit = emailValid && passwordValid && nameValid && !loading;

  function toView(v: AuthView) {
    setView(v);
    setOtp("");
    setError(null);
    setNotice(null);
  }

  async function handleSubmit() {
    setError(null);
    if (!emailValid) { setError("Enter a valid email address"); return; }
    if (!passwordValid) { setError("Password must be at least 8 characters"); return; }
    if (!nameValid) { setError("Name is required"); return; }

    setLoading(true);
    const { error: err } =
      mode === "sign-up"
        ? await authClient.signUp.email({ email, password, name, callbackURL: VERIFY_CALLBACK })
        : await authClient.signIn.email({ email, password });
    setLoading(false);
    if (!err) {
      if (mode === "sign-up") {
        // Locked until email verified — server has emailed a verification link
        toView("check-email");
        setNotice("We've emailed you a verification link. Tap it to activate your account.");
        return;
      }
      // Password verified + account active — confirm, then close the sheet.
      Alert.alert("Signed in", "Welcome back to Azimuth Perfumers.", [
        { text: "OK", onPress: () => router.back() },
      ]);
      return;
    }
    // Unverified account — the sign-in attempt above already made the SERVER
    // re-send the verification link (gated behind a valid password). The client
    // never asks the server to send mail directly.
    if (err.status === 403 || err.code === "EMAIL_NOT_VERIFIED") {
      toView("check-email");
      setNotice("Please verify your email — we've re-sent the link.");
      return;
    }
    Alert.alert("Couldn't sign in", authErrorMessage(err, "Check your email and password and try again."));
  }

  async function handleResendReset() {
    setError(null);
    const { error: err } = await authClient.forgetPassword.emailOtp({ email });
    if (err) { Alert.alert("Could not send code", authErrorMessage(err, "Please try again.")); return; }
    setNotice("Code sent.");
  }

  async function handleForgot() {
    setError(null);
    if (!emailValid) { setError("Enter a valid email address"); return; }
    setLoading(true);
    const { error: err } = await authClient.forgetPassword.emailOtp({ email });
    setLoading(false);
    if (err) { Alert.alert("Could not send code", authErrorMessage(err, "Please try again.")); return; }
    toView("reset");
    setNotice("Reset code sent to your email.");
  }

  async function handleReset() {
    setError(null);
    if (otp.trim().length !== 6) { setError("Enter the 6-digit code"); return; }
    if (!passwordValid) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    const { error: err } = await authClient.emailOtp.resetPassword({ email, otp: otp.trim(), password });
    setLoading(false);
    if (err) { Alert.alert("Could not reset password", authErrorMessage(err, "Check the code and try again.")); return; }
    setPassword("");
    setMode("sign-in");
    toView("credentials");
    Alert.alert("Password updated", "Sign in with your new password.");
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    const { error: err } = await authClient.signIn.social({ provider: "google" });
    setGoogleLoading(false);
    if (err) { Alert.alert("Google sign-in failed", authErrorMessage(err, "Please try again.")); return; }
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F5F0E7]" edges={["top", "bottom"]}>
      {/* Handle bar */}
      <View className="w-10 h-1 rounded-full bg-[#E3DDD1] self-center mt-3 mb-2" />

      {/* Close */}
      <View className="flex-row justify-end px-5 mb-2">
        <Pressable onPress={() => router.back()} className="p-2">
          <Text className="text-[22px] text-[#57493A]">×</Text>
        </Pressable>
      </View>

      <View className="px-8 pt-2">
        {/* Brand */}
        <Logo size={20} showTrademark={false} />

        {/* Accent line */}
        <View className="w-8 h-px bg-[#9A5B2B] mt-4 mb-5" />

        {/* Heading */}
        <Text
          className="text-[40px] leading-none tracking-tight text-[#1B1611] mb-2"
          style={{ fontFamily: Fonts.serifItalic }}
        >
          {view === "check-email" ? "Check your email"
            : view === "forgot" ? "Forgot password"
            : view === "reset" ? "Reset password"
            : mode === "sign-in" ? "Sign in" : "Create account"}
        </Text>
        <Text className="text-[14px] text-[#57493A] mb-8 leading-relaxed">
          {view === "check-email" ? `We've sent a verification link to ${email}. Tap it to activate your account, then return here to sign in.`
            : view === "forgot" ? "We'll email you a code to reset your password."
            : view === "reset" ? `Code sent to ${email}. Choose a new password.`
            : mode === "sign-in" ? "Welcome back to Azimuth Perfumers." : "Join us for slow perfumery, composed in small batches."}
        </Text>

        {view === "check-email" && (
          <>
            <Text className="text-[12px] text-[#57493A]/70 mb-4 leading-relaxed">
              Didn&apos;t get it? Sign in again with your password — we&apos;ll re-send the link.
            </Text>
            <Pressable className="h-11 justify-center" onPress={() => toView("credentials")}>
              <Text className="text-[11px] text-[#57493A] tracking-wide">Back to sign in</Text>
            </Pressable>
          </>
        )}

        {view === "forgot" && (
          <>
            <View className="mb-8">
              <Text className="text-[10px] font-semibold tracking-[0.18em] text-[#57493A] uppercase mb-2">
                Email
              </Text>
              <TextInput
                className="border-b-2 border-[#1B1611] text-[16px] text-[#1B1611] pb-2"
                placeholder="you@example.com"
                placeholderTextColor="#8A7A63"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                selectionColor="#9A5B2B"
              />
            </View>
            <Pressable
              className="h-14 items-center justify-center bg-[#1B1611] active:opacity-70 mb-4"
              style={{ opacity: emailValid && !loading ? 1 : 0.4 }}
              disabled={!emailValid || loading}
              onPress={handleForgot}
            >
              {loading ? <ActivityIndicator color="white" /> : (
                <Text className="text-white text-[11px] font-semibold tracking-[0.3em] uppercase">Send reset code</Text>
              )}
            </Pressable>
            <Pressable className="h-11 items-center justify-center" onPress={() => toView("credentials")}>
              <Text className="text-[11px] text-[#57493A] tracking-wide">Back to sign in</Text>
            </Pressable>
          </>
        )}

        {view === "reset" && (
          <>
            <View className="mb-5">
              <Text className="text-[10px] font-semibold tracking-[0.18em] text-[#57493A] uppercase mb-2">
                Reset code
              </Text>
              <TextInput
                className="border-b-2 border-[#1B1611] text-[16px] text-[#1B1611] pb-2"
                placeholder="000000"
                placeholderTextColor="#8A7A63"
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={setOtp}
                selectionColor="#9A5B2B"
              />
            </View>
            <View className="mb-8">
              <Text className="text-[10px] font-semibold tracking-[0.18em] text-[#57493A] uppercase mb-2">
                New password
              </Text>
              <TextInput
                className="border-b-2 border-[#1B1611] text-[16px] text-[#1B1611] pb-2"
                placeholder="••••••••"
                placeholderTextColor="#8A7A63"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                selectionColor="#9A5B2B"
              />
            </View>
            <Pressable
              className="h-14 items-center justify-center bg-[#1B1611] active:opacity-70 mb-4"
              style={{ opacity: otp.trim().length === 6 && passwordValid && !loading ? 1 : 0.4 }}
              disabled={otp.trim().length !== 6 || !passwordValid || loading}
              onPress={handleReset}
            >
              {loading ? <ActivityIndicator color="white" /> : (
                <Text className="text-white text-[11px] font-semibold tracking-[0.3em] uppercase">Reset password</Text>
              )}
            </Pressable>
            <View className="flex-row justify-between">
              <Pressable className="h-11 justify-center" onPress={handleResendReset}>
                <Text className="text-[11px] text-[#57493A] tracking-wide">Resend code</Text>
              </Pressable>
              <Pressable className="h-11 justify-center" onPress={() => toView("credentials")}>
                <Text className="text-[11px] text-[#57493A] tracking-wide">Back</Text>
              </Pressable>
            </View>
          </>
        )}

        {view === "credentials" && (
        <>
        {/* Google */}
        <Pressable
          className="h-14 flex-row items-center justify-center gap-3 border border-[#E3DDD1] active:opacity-70 mb-4"
          style={{ opacity: googleLoading ? 0.5 : 1 }}
          disabled={googleLoading}
          onPress={handleGoogle}
        >
          {googleLoading ? (
            <ActivityIndicator color="#1B1611" />
          ) : (
            <>
              <GoogleIcon />
              <Text className="text-[11px] font-semibold tracking-[0.18em] text-[#1B1611] uppercase">
                Continue with Google
              </Text>
            </>
          )}
        </Pressable>

        {/* Divider */}
        <View className="flex-row items-center gap-3 mb-6">
          <View className="flex-1 h-px bg-[#E3DDD1]" />
          <Text className="text-[10px] font-semibold tracking-[0.2em] text-[#57493A]/60 uppercase">or</Text>
          <View className="flex-1 h-px bg-[#E3DDD1]" />
        </View>

        {mode === "sign-up" && (
          <View className="mb-5">
            <Text className="text-[10px] font-semibold tracking-[0.18em] text-[#57493A] uppercase mb-2">
              Full name
            </Text>
            <TextInput
              className="border-b-2 border-[#1B1611] text-[16px] text-[#1B1611] pb-2"
              placeholder="Your name"
              placeholderTextColor="#8A7A63"
              value={name}
              onChangeText={setName}
              selectionColor="#9A5B2B"
            />
          </View>
        )}

        <View className="mb-5">
          <Text className="text-[10px] font-semibold tracking-[0.18em] text-[#57493A] uppercase mb-2">
            Email
          </Text>
          <TextInput
            className="border-b-2 border-[#1B1611] text-[16px] text-[#1B1611] pb-2"
            placeholder="you@example.com"
            placeholderTextColor="#8A7A63"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            selectionColor="#9A5B2B"
          />
        </View>

        <View className="mb-8">
          <Text className="text-[10px] font-semibold tracking-[0.18em] text-[#57493A] uppercase mb-2">
            Password
          </Text>
          <TextInput
            className="border-b-2 border-[#1B1611] text-[16px] text-[#1B1611] pb-2"
            placeholder="••••••••"
            placeholderTextColor="#8A7A63"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            selectionColor="#9A5B2B"
          />
        </View>

        <Pressable
          className="h-14 items-center justify-center bg-[#1B1611] active:opacity-70 mb-4"
          style={{ opacity: canSubmit ? 1 : 0.4 }}
          disabled={!canSubmit}
          onPress={handleSubmit}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-[11px] font-semibold tracking-[0.3em] uppercase">
              {mode === "sign-in" ? "Sign in" : "Create account"}
            </Text>
          )}
        </Pressable>

        <Pressable
          className="h-11 items-center justify-center"
          onPress={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setError(null); }}
        >
          <Text className="text-[11px] text-[#57493A] tracking-wide">
            {mode === "sign-in" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </Text>
        </Pressable>

        {mode === "sign-in" && (
          <Pressable className="h-11 items-center justify-center" onPress={() => toView("forgot")}>
            <Text className="text-[11px] text-[#57493A] tracking-wide underline">Forgot password?</Text>
          </Pressable>
        )}
        </>
        )}

        {notice && !error && (
          <View className="mt-3 px-4 py-3 border border-[#57493A]/20 bg-[#57493A]/5">
            <Text className="text-[12.5px] text-[#57493A] text-center">{notice}</Text>
          </View>
        )}

        {error && (
          <View className="mt-3 px-4 py-3 border border-[#9A5B2B]/30 bg-[#9A5B2B]/5">
            <Text className="text-[12.5px] text-[#9A5B2B] text-center">{error}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
