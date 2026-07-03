import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { useSession } from "@/hooks/use-session";
import { authClient } from "@/lib/auth-client";
import { clearToken } from "@/lib/session";

const MENU = [
  { label: "Order History", sub: "Track and manage your orders", route: "/orders" as const },
  { label: "Support", sub: "Get help with returns, refunds & more", route: "/support/index" as const },
] as const;

export default function AccountScreen() {
  const router = useRouter();
  const { session, refresh } = useSession();

  async function handleSignOut() {
    await authClient.signOut();
    await clearToken();
    await refresh();
  }

  if (!session) {
    return (
      <View className="flex-1 bg-[#faf8f5]">
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-[10px] font-semibold tracking-[0.36em] text-[#888888] uppercase mb-4">
            Azimuth Perfumers
          </Text>
          <Text
            className="text-[36px] font-medium text-[#111111] text-center leading-tight mb-3"
            style={{ fontStyle: "italic" }}
          >
            Welcome back
          </Text>
          <Text className="text-[14px] text-[#888888] text-center mb-10 leading-relaxed">
            Sign in to view your orders, track deliveries, and manage your account.
          </Text>

          <Pressable
            className="h-14 w-full items-center justify-center bg-[#111111] active:opacity-70 mb-4"
            onPress={() => router.push("/(auth)/sign-in")}
          >
            <Text className="text-white text-[11px] font-semibold tracking-[0.3em] uppercase">
              Sign In
            </Text>
          </Pressable>

          <Text className="text-[12px] text-[#888888] text-center">
            New here? Create an account at sign-in.
          </Text>
        </View>
      </View>
    );
  }

  const initials = session.user.name
    ?.split(" ")
    .map((n: string) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() ?? "A";

  return (
    <View className="flex-1 bg-[#faf8f5]">
      <ScrollView bounces>
        {/* Header */}
        <View className="px-6 pt-8 pb-6 border-b border-[#e8e2da]">
          <Text className="text-[10px] font-semibold tracking-[0.36em] text-[#888888] uppercase mb-2">
            Azimuth Perfumers
          </Text>
          <Text className="text-[30px] font-semibold tracking-[0.08em] text-[#111111] uppercase">
            Account
          </Text>
        </View>

        {/* Profile */}
        <View className="px-6 py-8 border-b border-[#e8e2da] flex-row items-center gap-5">
          {/* Avatar */}
          <View className="w-14 h-14 bg-[#111111] items-center justify-center">
            <Text className="text-white text-[18px] font-semibold tracking-wider">{initials}</Text>
          </View>
          <View>
            <Text className="text-[17px] font-semibold text-[#111111]">{session.user.name}</Text>
            {session.user.email ? (
              <Text className="text-[13px] text-[#888888] mt-0.5">{session.user.email}</Text>
            ) : null}
            {(session.user as { phoneNumber?: string }).phoneNumber ? (
              <Text className="text-[13px] text-[#888888] mt-0.5">
                {(session.user as { phoneNumber?: string }).phoneNumber}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Menu */}
        <View className="mt-2">
          {MENU.map(({ label, sub, route }) => (
            <Pressable
              key={label}
              className="flex-row items-center justify-between px-6 py-5 border-b border-[#e8e2da] active:bg-[#f0ede8]"
              onPress={() => router.push(route)}
            >
              <View>
                <Text className="text-[15px] font-semibold text-[#111111]">{label}</Text>
                <Text className="text-[12px] text-[#888888] mt-0.5">{sub}</Text>
              </View>
              <Text className="text-[#888888] text-xl">›</Text>
            </Pressable>
          ))}
        </View>

        {/* Sign out */}
        <View className="px-6 mt-10 mb-12">
          <Pressable
            className="h-11 border border-[#e8e2da] items-center justify-center active:bg-[#f0ede8]"
            onPress={handleSignOut}
          >
            <Text className="text-[10.5px] font-semibold tracking-[0.22em] text-[#888888] uppercase">
              Sign Out
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
