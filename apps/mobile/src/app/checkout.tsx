import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Phase 4: wire Razorpay RN SDK + address selection + order creation
export default function CheckoutScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text className="text-xs tracking-[0.3em] uppercase text-gray-400 mb-2">Checkout</Text>
        <Text className="text-xl text-gray-900 mb-8" style={{ fontFamily: "serif" }}>
          Complete your order
        </Text>

        {/* Address selection — Phase 4 */}
        <View className="border border-gray-100 p-4 mb-4">
          <Text className="text-xs uppercase tracking-widest text-gray-400 mb-2">
            Delivery Address
          </Text>
          <Text className="text-sm text-gray-300 italic">Select or add an address…</Text>
        </View>

        {/* Order summary — Phase 4 */}
        <View className="border border-gray-100 p-4 mb-8">
          <Text className="text-xs uppercase tracking-widest text-gray-400 mb-2">
            Order Summary
          </Text>
          <Text className="text-sm text-gray-300 italic">Loading cart…</Text>
        </View>

        {/* Pay button — Phase 4: triggers Razorpay */}
        <View className="bg-gray-100 py-4 items-center">
          <Text className="text-xs tracking-[0.3em] uppercase text-gray-400">
            Pay with Razorpay
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
