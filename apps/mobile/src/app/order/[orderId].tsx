import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

import { trpc } from "@/lib/trpc";
import { Fonts } from "@/constants/theme";

const STATUS_STEPS = ["confirmed", "picked_up", "out_for_delivery", "delivered"] as const;

// Per-parcel status — packages in one order can be at different stages.
const PACKAGE_STATUS_LABEL: Record<string, string> = {
  pending: "Preparing",
  booked: "Ready to ship",
  picked_up: "Picked up by courier",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivery_attempted: "Delivery attempted",
  delivered: "Delivered",
  cancelled: "Cancelled",
  rto_initiated: "Returning to sender",
  rto_delivered: "Return complete",
  failed: "Preparing",
};

const STEP_LABEL: Record<string, string> = {
  confirmed: "Order Confirmed",
  picked_up: "Picked Up by Courier",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
};

// Tap-to-rate star row for a delivered product
function StarRow({
  value,
  disabled,
  onRate,
}: {
  value: number | null;
  disabled?: boolean;
  onRate: (rating: number) => void;
}) {
  return (
    <View className="flex-row items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} disabled={disabled} onPress={() => onRate(i)} hitSlop={6}>
          <Text className="text-[22px]" style={{ color: (value ?? 0) >= i ? "#1B1611" : "#C9BFAE" }}>
            {(value ?? 0) >= i ? "★" : "☆"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { data: order, isLoading } = trpc.order.get.useQuery({ orderId });

  const utils = trpc.useUtils();
  const { data: ratings } = trpc.rating.orderRatings.useQuery(
    { orderId },
    { enabled: order?.status === "delivered" },
  );
  const rateMut = trpc.rating.rate.useMutation({
    onSuccess: () => utils.rating.orderRatings.invalidate({ orderId }),
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F0E7]">
        <Text className="text-[10px] font-semibold tracking-[0.28em] text-[#57493A] uppercase">
          Loading…
        </Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F0E7]">
        <Text className="text-[10px] font-semibold tracking-[0.28em] text-[#57493A] uppercase">
          Order not found
        </Text>
      </View>
    );
  }

  const currentStep = STATUS_STEPS.indexOf(order.status as (typeof STATUS_STEPS)[number]);
  const isTerminal = order.status === "cancelled" || order.status === "payment_failed" || order.status === "refunded";
  const waybill = (order as { shiprocketAwb?: string | null }).shiprocketAwb
    ?? (order as { waybill?: string | null }).waybill;
  // Only parcels already handed to a courier can be tracked. Orders placed before
  // per-parcel shipping have none — those fall back to the order-level waybill.
  const trackedPackages = (order.shipments ?? []).filter((s) => s.waybill);

  return (
    <SafeAreaView className="flex-1 bg-[#F5F0E7]" edges={["bottom"]}>
      <ScrollView bounces contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ── Header ── */}
        <View className="px-6 pt-6 pb-6 border-b border-[#E3DDD1]">
          <Text className="text-[10.5px] font-semibold tracking-[0.2em] text-[#57493A] uppercase">
            #{order.orderNumber}
          </Text>
          <Text
            className="text-[38px] font-semibold text-[#1B1611] mt-1 leading-none"
          >
            ₹{Number(order.total).toLocaleString("en-IN")}
          </Text>
          <Text className="text-[12px] text-[#57493A] mt-1">
            Placed {new Date(order.createdAt).toLocaleDateString("en-IN", {
              day: "numeric", month: "long", year: "numeric",
            })}
          </Text>
        </View>

        {/* ── Status tracker ── */}
        {!isTerminal && (
          <View className="px-6 py-8 border-b border-[#E3DDD1]">
            <Text className="text-[10px] font-semibold tracking-[0.28em] text-[#1B1611] uppercase mb-6">
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
                        backgroundColor: isActive ? "#9A5B2B" : done ? "#1B1611" : "#E3DDD1",
                        borderWidth: isActive ? 2 : 0,
                        borderColor: "#9A5B2B",
                      }}
                    />
                    {i < STATUS_STEPS.length - 1 && (
                      <View
                        className="w-px mt-1"
                        style={{ height: 20, backgroundColor: done ? "#1B1611" : "#E3DDD1" }}
                      />
                    )}
                  </View>
                  <Text
                    className="text-[14px]"
                    style={{
                      color: done ? "#1B1611" : "#8A7A63",
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
          <View className="px-6 py-6 border-b border-[#E3DDD1]">
            <View
              className="px-4 py-3"
              style={{ borderWidth: 1, borderColor: order.status === "refunded" ? "#2d6a4f" : "#57493A" }}
            >
              <Text
                className="text-[10.5px] font-semibold tracking-[0.18em] uppercase text-center"
                style={{ color: order.status === "refunded" ? "#2d6a4f" : "#57493A" }}
              >
                {order.status === "refunded"
                  ? "Refund processed"
                  : order.status === "payment_failed"
                    ? "Payment failed"
                    : "Order cancelled"}
              </Text>
            </View>
          </View>
        )}

        {/* ── Tracking ──
            Each bottle ships in its own box, so an order can travel as several
            parcels with separate waybills and separate delivery dates. */}
        {trackedPackages.length > 0 ? (
          <View className="px-6 py-5 border-b border-[#E3DDD1]">
            <Text className="text-[10px] font-semibold tracking-[0.28em] text-[#57493A] uppercase mb-2">
              {trackedPackages.length > 1 ? `Tracking · ${trackedPackages.length} packages` : "Tracking"}
            </Text>

            {trackedPackages.length > 1 && (
              <Text className="text-[12px] text-[#57493A] mb-3 leading-[18px]">
                Your order ships as {trackedPackages.length} separate packages — they may arrive on different days.
              </Text>
            )}

            {trackedPackages.map((pkg, i) => (
              <View key={pkg.id} className={i > 0 ? "mt-4 pt-4 border-t border-[#E3DDD1]" : ""}>
                {trackedPackages.length > 1 && (
                  <Text className="text-[11px] font-semibold text-[#57493A] mb-1">
                    Package {pkg.packageNumber} · {pkg.productName} {pkg.sizeMl}ml
                  </Text>
                )}
                <Text className="text-[15px] font-semibold text-[#1B1611] tracking-widest">
                  {pkg.waybill}
                </Text>
                <Text className="text-[12px] text-[#57493A] mt-1">
                  {PACKAGE_STATUS_LABEL[pkg.status] ?? "In progress"}
                  {pkg.estimatedDeliveryDate ? ` · Expected ${pkg.estimatedDeliveryDate}` : ""}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          waybill && (
            <View className="px-6 py-5 border-b border-[#E3DDD1]">
              <Text className="text-[10px] font-semibold tracking-[0.28em] text-[#57493A] uppercase mb-2">
                Tracking
              </Text>
              <Text className="text-[15px] font-semibold text-[#1B1611] tracking-widest">
                {waybill}
              </Text>
            </View>
          )
        )}

        {/* ── Items ── */}
        <View className="px-6 pt-6">
          <Text className="text-[10px] font-semibold tracking-[0.28em] text-[#57493A] uppercase mb-4">
            Items
          </Text>
          {order.items.map((item, i) => (
            <View
              key={item.id}
              className="flex-row items-center gap-4 py-4"
              style={{
                borderTopWidth: i > 0 ? 1 : 0,
                borderColor: "#E3DDD1",
              }}
            >
              {/* Placeholder image box */}
              <View className="w-14 h-16 bg-[#E3DDD1]" />
              <View className="flex-1">
                <Text
                  className="text-[15px] text-[#1B1611] leading-snug"
                  style={{ fontFamily: Fonts.serifItalic }}
                  numberOfLines={2}
                >
                  {item.productName}
                </Text>
                <Text className="text-[11px] text-[#57493A] mt-0.5 uppercase tracking-wider">
                  {item.sizeMl}ml · qty {item.quantity}
                </Text>
              </View>
              <Text className="text-[15px] font-semibold text-[#1B1611]">
                ₹{Number(item.lineTotal).toLocaleString("en-IN")}
              </Text>
            </View>
          ))}
        </View>

        {/* ── GST invoice ── */}
        {order.gstInvoiceNumber && (
          <View className="px-6 pt-8">
            <Text className="text-[10px] font-semibold tracking-[0.28em] text-[#57493A] uppercase mb-3">
              GST invoice
            </Text>
            <View className="flex-row items-center justify-between">
              <Text className="font-mono text-[13px] text-[#1B1611]">{order.gstInvoiceNumber}</Text>
              {order.invoiceUrl ? (
                <Pressable
                  className="h-10 px-4 border border-[#1B1611] items-center justify-center active:opacity-70"
                  onPress={() => order.invoiceUrl && Linking.openURL(order.invoiceUrl)}
                >
                  <Text className="text-[10.5px] font-semibold tracking-[0.18em] text-[#1B1611] uppercase">
                    Download ↓
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}

        {/* ── Rate your purchase (delivered only) ── */}
        {order.status === "delivered" && ratings && ratings.products.length > 0 && (
          <View className="px-6 pt-8">
            <Text className="text-[10px] font-semibold tracking-[0.28em] text-[#57493A] uppercase mb-4">
              Rate your purchase
            </Text>
            {ratings.products.map((p, i) => (
              <View
                key={p.productId}
                className="flex-row items-center justify-between py-3"
                style={{ borderTopWidth: i > 0 ? 1 : 0, borderColor: "#E3DDD1" }}
              >
                <Text
                  className="text-[14px] text-[#1B1611] flex-1 pr-4"
                  style={{ fontFamily: Fonts.serifItalic }}
                  numberOfLines={1}
                >
                  {p.productName}
                </Text>
                <StarRow
                  value={p.myRating}
                  disabled={rateMut.isPending}
                  onRate={(rating) => rateMut.mutate({ productId: p.productId, orderId, rating })}
                />
              </View>
            ))}
          </View>
        )}

        {/* ── Support CTA ── */}
        <View className="px-6 mt-8">
          <Pressable
            className="h-11 border border-[#E3DDD1] items-center justify-center active:bg-[#EDE3D0]"
            onPress={() => router.push("/support/index")}
          >
            <Text className="text-[10.5px] font-semibold tracking-[0.18em] text-[#57493A] uppercase">
              Need help with this order?
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
