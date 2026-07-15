import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { useSession } from "@/hooks/use-session";
import { authClient } from "@/lib/auth-client";
import { Fonts } from "@/constants/theme";

const MENU = [
  { label: "Order History", sub: "Track and manage your orders", route: "/orders" as const },
  { label: "Wishlist", sub: "Fragrances you've saved", route: "/wishlist" as const },
  { label: "Addresses", sub: "Manage your delivery addresses", route: "/addresses" as const },
  { label: "Support", sub: "Get help with refunds, orders & more", route: "/support/index" as const },
] as const;

export default function AccountScreen() {
  const router = useRouter();
  const { session, refresh } = useSession();

  async function handleSignOut() {
    await authClient.signOut();
    await refresh();
  }

  if (!session) {
    return (
      <View className="flex-1 bg-[#F5F0E7]">
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-[10px] font-semibold tracking-[0.36em] text-[#57493A] uppercase mb-4">
            Azimuth Perfumers
          </Text>
          <Text
            className="text-[36px] text-[#1B1611] text-center leading-tight mb-3"
            style={{ fontFamily: Fonts.serifItalic }}
          >
            Welcome back
          </Text>
          <Text className="text-[14px] text-[#57493A] text-center mb-10 leading-relaxed">
            Sign in to view your orders, track deliveries, and manage your account.
          </Text>

          <Pressable
            className="h-14 w-full items-center justify-center bg-[#1B1611] active:opacity-70 mb-4"
            onPress={() => router.push("/(auth)/sign-in")}
          >
            <Text className="text-white text-[11px] font-semibold tracking-[0.3em] uppercase">
              Sign In
            </Text>
          </Pressable>

          <Text className="text-[12px] text-[#57493A] text-center">
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

  const memberSinceYear = new Date(session.user.createdAt).getFullYear();

  return (
    <View className="flex-1 bg-[#F5F0E7]">
      <ScrollView bounces>
        {/* Profile */}
        <View className="px-6 pt-8 pb-8 border-b border-[#E3DDD1]">
          <Text className="text-[10px] font-semibold tracking-[0.28em] uppercase mb-5" style={{ color: "#8A7A63" }}>
            Your Account
          </Text>
          <View className="flex-row items-center gap-4">
            <View className="w-14 h-14 bg-[#1B1611] items-center justify-center">
              <Text className="text-white text-[18px] font-semibold tracking-wider">{initials}</Text>
            </View>
            <View>
              <Text
                className="text-[22px] leading-none"
                style={{ fontFamily: Fonts.serifMedium, color: "#1B1611" }}
              >
                {session.user.name}
              </Text>
              <Text className="text-[10px] tracking-[0.14em] text-[#57493A] uppercase mt-1.5">
                Member since {memberSinceYear}
              </Text>
            </View>
          </View>
          {session.user.email ? (
            <Text className="text-[13px] text-[#57493A] mt-4">{session.user.email}</Text>
          ) : null}
        </View>

        {/* Menu */}
        <View className="mt-2">
          {MENU.map(({ label, sub, route }) => (
            <Pressable
              key={label}
              className="flex-row items-center justify-between px-6 py-5 border-b border-[#E3DDD1] active:bg-[#EDE3D0]"
              onPress={() => router.push(route)}
            >
              <View>
                <Text className="text-[15px] font-semibold text-[#1B1611]">{label}</Text>
                <Text className="text-[12px] text-[#57493A] mt-0.5">{sub}</Text>
              </View>
              <Text className="text-[#57493A] text-xl">›</Text>
            </Pressable>
          ))}
        </View>

        {/* Sign out */}
        <View className="px-6 mt-10 mb-12">
          <Pressable
            className="h-11 border border-[#E3DDD1] items-center justify-center active:bg-[#EDE3D0]"
            onPress={handleSignOut}
          >
            <Text className="text-[10.5px] font-semibold tracking-[0.22em] text-[#57493A] uppercase">
              Sign Out
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
