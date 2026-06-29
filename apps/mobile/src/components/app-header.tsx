import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";

export function AppHeader() {
  const router = useRouter();
  const { data: cartItems = [] } = trpc.cart.list.useQuery(undefined, {
    staleTime: 60_000,
  });
  const cartCount = cartItems.filter((i) => !i.isSaved).reduce((n, i) => n + i.quantity, 0);

  return (
    <View className="flex-row items-center justify-between h-[60px] px-4 border-b border-[#e8e2da] bg-[#faf8f5]">
      {/* Left spacer — mirrors cart button width */}
      <View style={{ width: 44 }} />

      {/* Wordmark centered */}
      <View className="items-center gap-[3px]">
        <Text className="text-[22px] font-semibold tracking-[0.28em] text-[#111111]">
          AZIMUTH
        </Text>
        <Text className="text-[7px] tracking-[0.6em] text-[#888888] pl-[0.6em]">
          PERFUMERS
        </Text>
      </View>

      {/* Cart button */}
      <Pressable
        onPress={() => router.push("/cart")}
        className="w-11 h-9 border border-[#111111] items-center justify-center active:bg-[#111111]"
      >
        <Text className="text-[9px] font-semibold tracking-[0.18em] text-[#111111]">
          {cartCount > 0 ? cartCount : "🛍"}
        </Text>
      </Pressable>
    </View>
  );
}
