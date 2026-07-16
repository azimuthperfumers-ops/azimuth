import { useState } from "react";
import { ActivityIndicator, Alert, NativeModules, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import RazorpayCheckout from "react-native-razorpay";

import { useSession } from "@/hooks/use-session";
import { trpc } from "@/lib/trpc";
import { Fonts } from "@/constants/theme";

// react-native-razorpay is a native module — present only in a real dev/production
// build, never in Expo Go.
function isRazorpayLinked(): boolean {
  return !!NativeModules.RNRazorpayCheckout;
}
function razorpayMissingMessage(): string {
  const cmd = Platform.OS === "ios" ? "npx expo run:ios" : "npx expo run:android";
  return `Top-ups need a native build — Razorpay isn't available in Expo Go. Build with \`${cmd}\`, then try again.`;
}

const TXN_LABEL: Record<string, string> = {
  topup: "Top-up",
  order_payment: "Order payment",
  refund_credit: "Refund credit",
  reversal: "Reversal",
  adjustment: "Adjustment",
};

const rupee = (n: number) => `₹${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const QUICK = [500, 1000, 2000, 5000];

export default function WalletScreen() {
  const router = useRouter();
  const { session } = useSession();
  const utils = trpc.useUtils();

  const wallet = trpc.wallet.get.useQuery(undefined, { enabled: !!session });
  const txns = trpc.wallet.transactions.useQuery({ limit: 30, offset: 0 }, { enabled: !!session });
  const createTopup = trpc.wallet.createTopupOrder.useMutation();
  const verifyTopup = trpc.wallet.verifyTopup.useMutation();

  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const minTopup = wallet.data?.minTopup ?? 500;
  const balance = wallet.data?.balance ?? 0;
  const amountNum = Number(amount);
  const canTopup = Number.isFinite(amountNum) && amountNum >= minTopup && !busy;

  async function handleTopup() {
    if (!canTopup) return;
    if (!isRazorpayLinked()) {
      Alert.alert("Top-up unavailable", razorpayMissingMessage());
      return;
    }
    setBusy(true);
    try {
      const data = await createTopup.mutateAsync({ amountInr: Math.round(amountNum) });
      const r = await RazorpayCheckout.open({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "Azimuth Perfumers",
        description: "Wallet top-up",
        order_id: data.razorpayOrderId,
        prefill: { name: session?.user?.name ?? "", email: session?.user?.email ?? "" },
        theme: { color: "#1B1611" },
      });
      await verifyTopup.mutateAsync({
        topupId: data.topupId,
        razorpayOrderId: r.razorpay_order_id,
        razorpayPaymentId: r.razorpay_payment_id,
        razorpaySignature: r.razorpay_signature,
      });
      setAmount("");
      await Promise.all([utils.wallet.get.invalidate(), utils.wallet.transactions.invalidate()]);
      Alert.alert("Wallet topped up", `${rupee(Math.round(amountNum))} added to your wallet.`);
    } catch (err) {
      const msg = (err as { description?: string; message?: string })?.description ?? (err as { message?: string })?.message;
      if (msg && !/cancel/i.test(msg)) Alert.alert("Top-up failed", msg);
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <View className="flex-1 bg-[#F5F0E7] items-center justify-center px-8">
        <Text className="text-[10px] font-semibold tracking-[0.36em] text-[#57493A] uppercase mb-4">Azimuth Perfumers</Text>
        <Text className="text-[15px] text-[#57493A] text-center mb-6">Sign in to view your wallet.</Text>
        <Pressable className="h-12 items-center justify-center bg-[#1B1611] px-8" onPress={() => router.push("/(auth)/sign-in")}>
          <Text className="text-white text-[11px] font-semibold tracking-[0.28em] uppercase">Sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-[#F5F0E7]"
      contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
      refreshControl={
        <RefreshControl
          refreshing={wallet.isRefetching || txns.isRefetching}
          onRefresh={() => Promise.all([utils.wallet.get.invalidate(), utils.wallet.transactions.invalidate()])}
          tintColor="#9A5B2B"
        />
      }
    >
      {/* Balance */}
      <Text className="text-[11px] font-semibold tracking-[0.2em] text-[#57493A] uppercase mb-1">Azimuth</Text>
      <Text className="text-[32px] text-[#1B1611] mb-5" style={{ fontFamily: Fonts.serifItalic }}>Your Wallet</Text>

      <View className="rounded-2xl border border-[#E3DDD1] bg-[#EFE7D8] p-6 mb-8">
        <Text className="text-[10px] font-semibold tracking-[0.28em] text-[#9A5B2B] uppercase mb-2">Available balance</Text>
        <Text className="text-[44px] font-semibold text-[#1B1611]" style={{ letterSpacing: -1 }}>{rupee(balance)}</Text>
        <Text className="text-[11px] text-[#57493A] mt-3 leading-relaxed">
          Store credit — spendable at checkout. It can never be withdrawn or moved to a bank.
        </Text>
      </View>

      {/* Add money */}
      <Text className="text-[13px] font-semibold text-[#1B1611] uppercase tracking-[0.14em] mb-3">Add money</Text>
      <View className="flex-row items-center border-b-2 border-[#1B1611] mb-3">
        <Text className="text-[26px] text-[#57493A] pb-2 pr-1">₹</Text>
        <TextInput
          className="flex-1 text-[26px] text-[#1B1611] pb-2"
          keyboardType="number-pad"
          value={amount}
          onChangeText={setAmount}
          placeholder="0"
          placeholderTextColor="#8A7A63"
          selectionColor="#9A5B2B"
        />
      </View>
      <View className="flex-row gap-2 mb-4">
        {QUICK.map((v) => (
          <Pressable
            key={v}
            onPress={() => setAmount(String(v))}
            className={`rounded-full border px-3.5 py-1.5 ${amountNum === v ? "border-[#1B1611] bg-[#1B1611]" : "border-[#E3DDD1]"}`}
          >
            <Text className={`text-[12px] font-medium ${amountNum === v ? "text-white" : "text-[#57493A]"}`}>₹{v.toLocaleString("en-IN")}</Text>
          </Pressable>
        ))}
      </View>
      {amount.length > 0 && amountNum < minTopup && (
        <Text className="text-[11px] text-[#9A5B2B] mb-3">Minimum top-up is ₹{minTopup}.</Text>
      )}
      <Pressable
        className="h-13 items-center justify-center bg-[#9A5B2B] py-4 mb-8"
        style={{ opacity: canTopup ? 1 : 0.4 }}
        disabled={!canTopup}
        onPress={handleTopup}
      >
        {busy ? <ActivityIndicator color="white" /> : (
          <Text className="text-white text-[11px] font-semibold tracking-[0.2em] uppercase">Add money</Text>
        )}
      </Pressable>

      {/* Transactions */}
      <Text className="text-[13px] font-semibold text-[#1B1611] uppercase tracking-[0.14em] mb-3">Transactions</Text>
      {txns.isLoading ? (
        <Text className="text-[13px] text-[#57493A] py-6 text-center">Loading…</Text>
      ) : (txns.data?.items.length ?? 0) === 0 ? (
        <View className="rounded-xl border border-[#E3DDD1] bg-[#EFE7D8]/50 py-12 items-center">
          <Text className="text-[16px] text-[#1B1611]" style={{ fontFamily: Fonts.serifItalic }}>No activity yet</Text>
          <Text className="text-[13px] text-[#57493A] mt-1 text-center px-6">Add money above, or receive a refund straight to your wallet.</Text>
        </View>
      ) : (
        <View className="rounded-xl border border-[#E3DDD1] overflow-hidden">
          {txns.data!.items.map((t, i) => {
            const amt = Number(t.amount);
            const credit = amt >= 0;
            return (
              <View key={t.id} className={`flex-row items-center px-4 py-3.5 bg-[#F5F0E7] ${i > 0 ? "border-t border-[#E3DDD1]" : ""}`}>
                <View className="flex-1 pr-3">
                  <Text className="text-[14px] font-medium text-[#1B1611]">{TXN_LABEL[t.type] ?? t.type}</Text>
                  {!!t.note && <Text className="text-[11px] text-[#57493A]" numberOfLines={1}>{t.note}</Text>}
                  <Text className="text-[10px] text-[#8A7A63] mt-0.5">{new Date(t.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</Text>
                </View>
                <View className="items-end">
                  <Text className={`text-[15px] font-semibold ${credit ? "text-[#2d6a4f]" : "text-[#1B1611]"}`}>
                    {credit ? "+" : "−"}{rupee(amt)}
                  </Text>
                  <Text className="text-[10px] text-[#8A7A63]">Bal {rupee(Number(t.balanceAfter))}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
