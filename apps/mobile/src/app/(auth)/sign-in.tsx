import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { authClient } from "@/lib/auth-client";

type Step = "phone" | "otp";

export default function SignInScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendOtp() {
    setError(null);
    setLoading(true);
    const { error: err } = await authClient.phoneNumber.sendOtp({ phoneNumber: `+91${phone}` });
    setLoading(false);
    if (err) { setError(err.message ?? "Failed to send OTP"); return; }
    setStep("otp");
  }

  async function handleVerifyOtp() {
    setError(null);
    setLoading(true);
    const { data, error: err } = await authClient.phoneNumber.verify({
      phoneNumber: `+91${phone}`,
      code: otp,
    });
    setLoading(false);
    if (err || !data) { setError(err?.message ?? "Invalid OTP"); return; }
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
          className="text-[40px] font-medium leading-none tracking-tight text-[#111111] mb-2"
          style={{ fontStyle: "italic" }}
        >
          {step === "phone" ? "Sign in" : "Verify"}
        </Text>
        <Text className="text-[14px] text-[#888888] mb-10 leading-relaxed">
          {step === "phone"
            ? "Enter your mobile number — we'll send an OTP."
            : `OTP sent to +91 ${phone}. Enter it below.`}
        </Text>

        {step === "phone" ? (
          <>
            {/* Phone input */}
            <View className="border-b-2 border-[#111111] flex-row items-center mb-10 pb-2">
              <Text className="text-[18px] font-semibold text-[#888888] mr-3">+91</Text>
              <TextInput
                className="flex-1 text-[22px] font-semibold text-[#111111] tracking-widest"
                placeholder="XXXXXXXXXX"
                placeholderTextColor="#d0ccc6"
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
                autoFocus
                selectionColor="#c0392b"
              />
            </View>

            <Pressable
              className="h-14 items-center justify-center bg-[#111111] active:opacity-70"
              style={{ opacity: phone.length < 10 || loading ? 0.4 : 1 }}
              disabled={phone.length < 10 || loading}
              onPress={handleSendOtp}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-[11px] font-semibold tracking-[0.3em] uppercase">
                  Send OTP
                </Text>
              )}
            </Pressable>
          </>
        ) : (
          <>
            {/* OTP input */}
            <TextInput
              className="border-b-2 border-[#111111] text-[36px] font-semibold text-[#111111] text-center tracking-[0.5em] pb-2 mb-10"
              placeholder="······"
              placeholderTextColor="#d0ccc6"
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
              autoFocus
              selectionColor="#c0392b"
            />

            <Pressable
              className="h-14 items-center justify-center bg-[#111111] active:opacity-70 mb-4"
              style={{ opacity: otp.length < 4 || loading ? 0.4 : 1 }}
              disabled={otp.length < 4 || loading}
              onPress={handleVerifyOtp}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-[11px] font-semibold tracking-[0.3em] uppercase">
                  Verify OTP
                </Text>
              )}
            </Pressable>

            <Pressable
              className="h-11 items-center justify-center border border-[#e8e2da]"
              onPress={() => { setStep("phone"); setOtp(""); setError(null); }}
            >
              <Text className="text-[10.5px] font-semibold tracking-[0.18em] text-[#888888] uppercase">
                Change number
              </Text>
            </Pressable>
          </>
        )}

        {error && (
          <View className="mt-5 px-4 py-3 border border-[#c0392b]/30 bg-[#c0392b]/5">
            <Text className="text-[12.5px] text-[#c0392b] text-center">{error}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
