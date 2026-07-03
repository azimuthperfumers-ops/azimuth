import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { trpc } from "@/lib/trpc";
import { Fonts } from "@/constants/theme";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  picked_up: "Picked Up",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "#888888",
  confirmed: "#111111",
  picked_up: "#111111",
  out_for_delivery: "#c0392b",
  delivered: "#2d6a4f",
  refunded: "#888888",
  cancelled: "#888888",
};

export default function OrdersScreen() {
  const router = useRouter();
  const { data, isLoading } = trpc.order.list.useQuery();

  return (
    <SafeAreaView className="flex-1 bg-[#faf8f5]" edges={["top"]}>
      {/* Header */}
      <View className="px-6 pt-8 pb-6 border-b border-[#e8e2da]">
        <Text className="text-[10px] font-semibold tracking-[0.36em] text-[#888888] uppercase mb-2">
          Azimuth Perfumers
        </Text>
        <Text className="text-[30px] font-semibold tracking-[0.08em] text-[#111111] uppercase">
          My Orders
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-[10px] font-semibold tracking-[0.28em] text-[#888888] uppercase">
            Loading…
          </Text>
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View className="h-px bg-[#e8e2da]" />}
          ListEmptyComponent={
            <View className="py-24 items-center px-8">
              <Text
                className="text-[26px] text-[#111111] text-center mb-4"
                style={{ fontFamily: Fonts.serifItalic }}
              >
                No orders yet
              </Text>
              <Text className="text-[13px] text-[#888888] text-center mb-8">
                Place your first order and it will appear here.
              </Text>
              <Pressable
                className="h-11 px-8 items-center justify-center bg-[#111111] active:opacity-70"
                onPress={() => router.push("/shop")}
              >
                <Text className="text-white text-[10px] font-semibold tracking-[0.22em] uppercase">
                  Shop Now
                </Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              className="px-6 py-5 active:bg-[#f0ede8]"
              onPress={() => router.push(`/order/${item.id}`)}
            >
              <View className="flex-row items-start justify-between mb-2">
                <View>
                  <Text className="text-[10.5px] font-semibold tracking-[0.12em] text-[#888888] uppercase">
                    #{item.orderNumber}
                  </Text>
                  <Text className="text-[12px] text-[#888888] mt-0.5">
                    {new Date(item.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </Text>
                </View>
                <View
                  className="px-3 py-1"
                  style={{ borderWidth: 1, borderColor: STATUS_COLOR[item.status] ?? "#888888" }}
                >
                  <Text
                    className="text-[9px] font-semibold tracking-[0.16em] uppercase"
                    style={{ color: STATUS_COLOR[item.status] ?? "#888888" }}
                  >
                    {STATUS_LABEL[item.status] ?? item.status}
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center justify-between mt-1">
                <Text className="text-[17px] font-semibold text-[#111111]">
                  ₹{Number(item.total).toLocaleString("en-IN")}
                </Text>
                <Text className="text-[12px] text-[#888888]">View details →</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
