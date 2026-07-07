import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";

import { authClient } from "@/lib/auth-client";
import { Fonts } from "@/constants/theme";

type Mode = "sign-in" | "sign-up";

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
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = EMAIL_RE.test(email);
  const passwordValid = password.length >= 8;
  const nameValid = mode === "sign-in" || name.trim().length > 0;
  const canSubmit = emailValid && passwordValid && nameValid && !loading;

  async function handleSubmit() {
    setError(null);
    if (!emailValid) { setError("Enter a valid email address"); return; }
    if (!passwordValid) { setError("Password must be at least 8 characters"); return; }
    if (!nameValid) { setError("Name is required"); return; }

    setLoading(true);
    const { error: err } =
      mode === "sign-up"
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password });
    setLoading(false);
    if (err) { setError(err.message ?? "Something went wrong"); return; }
    router.back();
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    const { error: err } = await authClient.signIn.social({ provider: "google" });
    setGoogleLoading(false);
    if (err) { setError(err.message ?? "Google sign-in failed"); return; }
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-[#faf8f5]" edges={["top", "bottom"]}>
      {/* Handle bar */}
      <View className="w-10 h-1 rounded-full bg-[#e8e2da] self-center mt-3 mb-2" />

      {/* Close */}
      <View className="flex-row justify-end px-5 mb-2">
        <Pressable onPress={() => router.back()} className="p-2">
          <Text className="text-[22px] text-[#888888]">×</Text>
        </Pressable>
      </View>

      <View className="px-8 pt-2">
        {/* Brand */}
        <Text className="text-[10px] font-semibold tracking-[0.38em] text-[#888888] uppercase mb-1">
          Azimuth Perfumers
        </Text>

        {/* Red accent line */}
        <View className="w-8 h-px bg-[#c0392b] mb-5" />

        {/* Heading */}
        <Text
          className="text-[40px] leading-none tracking-tight text-[#111111] mb-2"
          style={{ fontFamily: Fonts.serifItalic }}
        >
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </Text>
        <Text className="text-[14px] text-[#888888] mb-8 leading-relaxed">
          {mode === "sign-in" ? "Welcome back to Azimuth Perfumers." : "Join us for slow perfumery, composed in small batches."}
        </Text>

        {/* Google */}
        <Pressable
          className="h-14 flex-row items-center justify-center gap-3 border border-[#e8e2da] active:opacity-70 mb-4"
          style={{ opacity: googleLoading ? 0.5 : 1 }}
          disabled={googleLoading}
          onPress={handleGoogle}
        >
          {googleLoading ? (
            <ActivityIndicator color="#111111" />
          ) : (
            <>
              <GoogleIcon />
              <Text className="text-[11px] font-semibold tracking-[0.18em] text-[#111111] uppercase">
                Continue with Google
              </Text>
            </>
          )}
        </Pressable>

        {/* Divider */}
        <View className="flex-row items-center gap-3 mb-6">
          <View className="flex-1 h-px bg-[#e8e2da]" />
          <Text className="text-[10px] font-semibold tracking-[0.2em] text-[#888888]/60 uppercase">or</Text>
          <View className="flex-1 h-px bg-[#e8e2da]" />
        </View>

        {mode === "sign-up" && (
          <View className="mb-5">
            <Text className="text-[10px] font-semibold tracking-[0.18em] text-[#888888] uppercase mb-2">
              Full name
            </Text>
            <TextInput
              className="border-b-2 border-[#111111] text-[16px] text-[#111111] pb-2"
              placeholder="Your name"
              placeholderTextColor="#d0ccc6"
              value={name}
              onChangeText={setName}
              selectionColor="#c0392b"
            />
          </View>
        )}

        <View className="mb-5">
          <Text className="text-[10px] font-semibold tracking-[0.18em] text-[#888888] uppercase mb-2">
            Email
          </Text>
          <TextInput
            className="border-b-2 border-[#111111] text-[16px] text-[#111111] pb-2"
            placeholder="you@example.com"
            placeholderTextColor="#d0ccc6"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            selectionColor="#c0392b"
          />
        </View>

        <View className="mb-8">
          <Text className="text-[10px] font-semibold tracking-[0.18em] text-[#888888] uppercase mb-2">
            Password
          </Text>
          <TextInput
            className="border-b-2 border-[#111111] text-[16px] text-[#111111] pb-2"
            placeholder="••••••••"
            placeholderTextColor="#d0ccc6"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            selectionColor="#c0392b"
          />
        </View>

        <Pressable
          className="h-14 items-center justify-center bg-[#111111] active:opacity-70 mb-4"
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
          <Text className="text-[11px] text-[#888888] tracking-wide">
            {mode === "sign-in" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </Text>
        </Pressable>

        {error && (
          <View className="mt-3 px-4 py-3 border border-[#c0392b]/30 bg-[#c0392b]/5">
            <Text className="text-[12.5px] text-[#c0392b] text-center">{error}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
