import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

import { trpc } from "@/lib/trpc";
import { Fonts } from "@/constants/theme";

const STATUS_STEPS = ["confirmed", "picked_up", "out_for_delivery", "delivered"] as const;

const STEP_LABEL: Record<string, string> = {
  confirmed: "Order Confirmed",
  picked_up: "Picked Up by Courier",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
};

export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { data: order, isLoading } = trpc.order.get.useQuery({ orderId });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#faf8f5]">
        <Text className="text-[10px] font-semibold tracking-[0.28em] text-[#888888] uppercase">
          Loading…
        </Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View className="flex-1 items-center justify-center bg-[#faf8f5]">
        <Text className="text-[10px] font-semibold tracking-[0.28em] text-[#888888] uppercase">
          Order not found
        </Text>
      </View>
    );
  }

  const currentStep = STATUS_STEPS.indexOf(order.status as (typeof STATUS_STEPS)[number]);
  const isTerminal = order.status === "cancelled" || order.status === "refunded";
  const waybill = (order as { shiprocketAwb?: string | null }).shiprocketAwb
    ?? (order as { delhiveryWaybill?: string | null }).delhiveryWaybill;

  return (
    <SafeAreaView className="flex-1 bg-[#faf8f5]" edges={["bottom"]}>
      <ScrollView bounces contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ── Header ── */}
        <View className="px-6 pt-6 pb-6 border-b border-[#e8e2da]">
          <Text className="text-[10.5px] font-semibold tracking-[0.2em] text-[#888888] uppercase">
            #{order.orderNumber}
          </Text>
          <Text
            className="text-[38px] font-semibold text-[#111111] mt-1 leading-none"
          >
            ₹{Number(order.total).toLocaleString("en-IN")}
          </Text>
          <Text className="text-[12px] text-[#888888] mt-1">
            Placed {new Date(order.createdAt).toLocaleDateString("en-IN", {
              day: "numeric", month: "long", year: "numeric",
            })}
          </Text>
        </View>

        {/* ── Status tracker ── */}
        {!isTerminal && (
          <View className="px-6 py-8 border-b border-[#e8e2da]">
            <Text className="text-[10px] font-semibold tracking-[0.28em] text-[#111111] uppercase mb-6">
              Delivery status
            </Text>
            {STATUS_STEPS.map((step, i) => {
              const done = currentStep >= i;
              const isActive = currentStep === i;
              return (
                <View key={step} className="flex-row items-start gap-4 mb-5 last:mb-0">
                  {/* Dot + line */}
                  <View className="items-center pt-0.5">
                    <View
                      className="w-3 h-3 rounded-full"
                      style={{
                        backgroundColor: isActive ? "#c0392b" : done ? "#111111" : "#e8e2da",
                        borderWidth: isActive ? 2 : 0,
                        borderColor: "#c0392b",
                      }}
                    />
                    {i < STATUS_STEPS.length - 1 && (
                      <View
                        className="w-px mt-1"
                        style={{ height: 20, backgroundColor: done ? "#111111" : "#e8e2da" }}
                      />
                    )}
                  </View>
                  <Text
                    className="text-[14px]"
                    style={{
                      color: done ? "#111111" : "#bbbbbb",
                      fontWeight: isActive ? "700" : "400",
                    }}
                  >
                    {STEP_LABEL[step]}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {isTerminal && (
          <View className="px-6 py-6 border-b border-[#e8e2da]">
            <View
              className="px-4 py-3"
              style={{ borderWidth: 1, borderColor: order.status === "refunded" ? "#2d6a4f" : "#888888" }}
            >
              <Text
                className="text-[10.5px] font-semibold tracking-[0.18em] uppercase text-center"
                style={{ color: order.status === "refunded" ? "#2d6a4f" : "#888888" }}
              >
                {order.status === "refunded" ? "Refund processed" : "Order cancelled"}
              </Text>
            </View>
          </View>
        )}

        {/* ── Tracking number ── */}
        {waybill && (
          <View className="px-6 py-5 border-b border-[#e8e2da]">
            <Text className="text-[10px] font-semibold tracking-[0.28em] text-[#888888] uppercase mb-2">
              Tracking
            </Text>
            <Text className="text-[15px] font-semibold text-[#111111] tracking-widest">
              {waybill}
            </Text>
          </View>
        )}

        {/* ── Items ── */}
        <View className="px-6 pt-6">
          <Text className="text-[10px] font-semibold tracking-[0.28em] text-[#888888] uppercase mb-4">
            Items
          </Text>
          {order.items.map((item, i) => (
            <View
              key={item.id}
              className="flex-row items-center gap-4 py-4"
              style={{
                borderTopWidth: i > 0 ? 1 : 0,
                borderColor: "#e8e2da",
              }}
            >
              {/* Placeholder image box */}
              <View className="w-14 h-16 bg-[#e8e2da]" />
              <View className="flex-1">
                <Text
                  className="text-[15px] text-[#111111] leading-snug"
                  style={{ fontFamily: Fonts.serifItalic }}
                  numberOfLines={2}
                >
                  {item.productName}
                </Text>
                <Text className="text-[11px] text-[#888888] mt-0.5 uppercase tracking-wider">
                  {item.sizeMl}ml · qty {item.quantity}
                </Text>
              </View>
              <Text className="text-[15px] font-semibold text-[#111111]">
                ₹{Number(item.lineTotal).toLocaleString("en-IN")}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Support CTA ── */}
        <View className="px-6 mt-8">
          <Pressable
            className="h-11 border border-[#e8e2da] items-center justify-center active:bg-[#f0ede8]"
            onPress={() => router.push("/support/index")}
          >
            <Text className="text-[10.5px] font-semibold tracking-[0.18em] text-[#888888] uppercase">
              Need help with this order?
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
