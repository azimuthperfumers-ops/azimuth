import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, NativeModules, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Check, Lock, Plus, Tag, X } from "lucide-react-native";
import RazorpayCheckout from "react-native-razorpay";

// react-native-razorpay is a native module — it's only present in a real dev/
// production build, never in Expo Go. `RazorpayCheckout.open` is a plain JS
// static method that always exists on the class, so checking it tells us
// nothing; the actual native binding it calls into internally
// (NativeModules.RNRazorpayCheckout) is what's null when unlinked. Check that
// directly instead — it's the same object the package itself falls back to.
function isRazorpayLinked(): boolean {
  return !!NativeModules.RNRazorpayCheckout;
}

function razorpayMissingMessage(): string {
  const cmd = Platform.OS === "ios" ? "npx expo run:ios" : "npx expo run:android";
  return `Payments need a native ${Platform.OS === "ios" ? "iOS" : "Android"} build — Razorpay isn't available in Expo Go. Build and run with \`${cmd}\` (or an EAS development build), then try again.`;
}

function isNativeModuleNullError(err: unknown): boolean {
  // Different JS engines phrase this differently — Hermes: "Cannot read
  // properties of null (reading 'open')"; JSC: "Cannot read property 'open'
  // of null"; either way "open" plus a null/undefined-access complaint.
  const msg = (err as { message?: string })?.message ?? "";
  return /open/i.test(msg) && /null|undefined|not an object/i.test(msg);
}

import { trpc } from "@/lib/trpc";
import { useSession } from "@/hooks/use-session";
import { Colors, Fonts } from "@/constants/theme";
import {
  type AddressForm,
  AddressFormFields,
  EMPTY_ADDRESS_FORM,
  validateAddressForm,
} from "@/lib/address-form";

type SavedAddress = {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
  lat?: number | null;
  lng?: number | null;
};

function addressToForm(a: SavedAddress): AddressForm {
  return {
    label: a.label,
    fullName: a.fullName,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2 ?? "",
    city: a.city,
    state: a.state,
    pincode: a.pincode,
    isDefault: a.isDefault,
    lat: a.lat ?? undefined,
    lng: a.lng ?? undefined,
  };
}

function formatInr(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

// ─── Saved address card ───────────────────────────────────────────────────────

function AddressCard({ address, selected, onSelect }: {
  address: SavedAddress;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      onPress={onSelect}
      className="p-4 border mb-3"
      style={{ borderColor: selected ? Colors.ink : Colors.border, position: "relative" }}
    >
      {selected && (
        <View className="absolute right-3 top-3 w-4 h-4 items-center justify-center rounded-full" style={{ backgroundColor: Colors.ink }}>
          <Check size={10} color="#fff" strokeWidth={2.5} />
        </View>
      )}
      {address.isDefault && (
        <Text className="text-[9px] font-semibold tracking-[0.14em] uppercase mb-1" style={{ color: Colors.inkMuted }}>
          Default
        </Text>
      )}
      <Text className="text-[10px] font-semibold tracking-[0.12em] uppercase mb-1" style={{ color: Colors.inkMuted }}>
        {address.label}
      </Text>
      <Text className="text-[14px] font-semibold" style={{ color: Colors.ink }}>{address.fullName}</Text>
      <Text className="text-[12px] mt-0.5 leading-relaxed" style={{ color: Colors.inkMuted }}>
        {address.line1}{address.line2 ? `, ${address.line2}` : ""}{"\n"}
        {address.city}, {address.state} — {address.pincode}{"\n"}
        {address.phone}
      </Text>
    </Pressable>
  );
}

// ─── Coupon modal ─────────────────────────────────────────────────────────────

function CouponModal({
  visible, onClose, subtotal, onApplied,
}: {
  visible: boolean;
  onClose: () => void;
  subtotal: number;
  onApplied: (code: string, couponId: string, discount: number, minCartValue: number) => void;
}) {
  const { session } = useSession();
  const utils = trpc.useUtils();
  const { data: coupons = [] } = trpc.coupon.listActive.useQuery(undefined, { enabled: visible });
  const [input, setInput] = useState("");
  const [applying, setApplying] = useState(false);

  async function apply(code?: string) {
    const finalCode = (code ?? input).trim().toUpperCase();
    if (!finalCode) return;
    setApplying(true);
    try {
      const data = await utils.client.coupon.validate.query({
        code: finalCode,
        cartTotal: subtotal,
        userId: session?.user.id,
      });
      onApplied(data.code, data.couponId, data.discountAmount, data.minCartValue);
      setInput("");
      onClose();
    } catch (err) {
      Alert.alert("Invalid coupon", (err as { message?: string })?.message ?? "Couldn't apply this code.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
        <View className="p-5" style={{ backgroundColor: Colors.background }}>
          <View className="flex-row items-center justify-between mb-5">
            <Text className="text-[13px] font-semibold tracking-[0.16em] uppercase" style={{ color: Colors.ink }}>
              Coupon code
            </Text>
            <Pressable onPress={onClose} className="p-1">
              <X size={16} color={Colors.inkMuted} />
            </Pressable>
          </View>

          <View className="flex-row mb-5">
            <TextInput
              autoCapitalize="characters"
              value={input}
              onChangeText={(v) => setInput(v.toUpperCase())}
              placeholder="ENTER CODE"
              placeholderTextColor="#d0ccc6"
              className="flex-1 border px-4 text-[12px] font-semibold tracking-[0.16em] uppercase"
              style={{ borderColor: Colors.border, color: Colors.ink, height: 48 }}
            />
            <Pressable
              onPress={() => apply()}
              disabled={applying || !input.trim()}
              className="items-center justify-center px-5"
              style={{ backgroundColor: input.trim() && !applying ? Colors.ink : "#e8e2da", height: 48 }}
            >
              {applying ? <ActivityIndicator size="small" color="#fff" /> : (
                <Text className="text-[10px] font-semibold tracking-[0.2em] uppercase" style={{ color: input.trim() ? "#fff" : Colors.inkMuted }}>
                  Apply
                </Text>
              )}
            </Pressable>
          </View>

          {coupons.length > 0 && (
            <View>
              <Text className="text-[10px] font-semibold tracking-[0.18em] uppercase mb-2" style={{ color: Colors.inkMuted }}>
                Available offers
              </Text>
              <ScrollView style={{ maxHeight: 260 }}>
                {coupons.map((c) => {
                  const minCart = Number(c.minCartValue);
                  const eligible = subtotal >= minCart;
                  const val = Number(c.value);
                  const valueText = c.type === "percentage" ? `${val.toFixed(0)}% off` : `${formatInr(val)} off`;
                  return (
                    <Pressable
                      key={c.id}
                      disabled={!eligible}
                      onPress={() => apply(c.code)}
                      className="flex-row items-center justify-between px-3.5 py-3 mb-2 border"
                      style={{
                        borderColor: eligible ? Colors.accent : Colors.border,
                        backgroundColor: eligible ? `${Colors.accent}0d` : "transparent",
                        opacity: eligible ? 1 : 0.5,
                      }}
                    >
                      <View className="flex-1 pr-2">
                        <Text
                          className="text-[11px] font-semibold tracking-[0.14em] uppercase"
                          style={{ color: eligible ? Colors.accent : Colors.inkMuted }}
                        >
                          {c.code}
                        </Text>
                        {!eligible ? (
                          <Text className="text-[9px] mt-0.5" style={{ color: Colors.inkMuted }}>
                            Add {formatInr(minCart - subtotal)} more
                          </Text>
                        ) : c.description ? (
                          <Text numberOfLines={1} className="text-[10px] mt-0.5" style={{ color: Colors.inkMuted }}>
                            {c.description}
                          </Text>
                        ) : null}
                      </View>
                      <Text className="text-[12px] font-bold" style={{ color: eligible ? Colors.accent : Colors.inkMuted }}>
                        {valueText}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CheckoutScreen() {
  const router = useRouter();
  const { session, loading: sessionLoading } = useSession();
  const utils = trpc.useUtils();

  const { data: cartItems = [], isLoading: cartLoading } = trpc.cart.list.useQuery(undefined, { enabled: !!session });
  const { data: savedAddresses = [], isLoading: loadingAddresses } = trpc.userData.listAddresses.useQuery(undefined, { enabled: !!session });
  const settingsQuery = trpc.settings.get.useQuery(undefined, { staleTime: 10 * 60 * 1000 });
  const freeShippingAbove = settingsQuery.data?.freeShippingAboveInr ?? 999;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState<AddressForm>({ ...EMPTY_ADDRESS_FORM });
  const [newFormErrors, setNewFormErrors] = useState<Partial<Record<keyof AddressForm, string>>>({});
  const [saveToAccount, setSaveToAccount] = useState(false);

  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [couponId, setCouponId] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState<number | null>(null);
  const [couponModalOpen, setCouponModalOpen] = useState(false);

  const [paying, setPaying] = useState(false);
  const payingRef = useRef(false);

  const addAddressMut = trpc.userData.addAddress.useMutation();
  const createOrder = trpc.order.create.useMutation();
  const createRazorpayOrder = trpc.payment.createRazorpayOrder.useMutation();
  const verifyPayment = trpc.payment.verifyAndConfirmPayment.useMutation();

  const activeItems = cartItems.filter((i) => !i.isSaved);
  const subtotal = activeItems.reduce((sum, i) => sum + (i.effectivePrice ?? Number(i.mrp)) * i.quantity, 0);
  const discount = couponDiscount ?? 0;

  useEffect(() => {
    if (loadingAddresses) return;
    if (savedAddresses.length === 0) {
      setShowNewForm(true);
      return;
    }
    const def = savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0];
    if (def) setSelectedId(def.id);
  }, [savedAddresses, loadingAddresses]);

  useEffect(() => {
    if (session?.user?.name) {
      setNewForm((prev) => ({ ...prev, fullName: prev.fullName || session.user.name || "" }));
    }
  }, [session]);

  const currentPincode = useMemo(() => {
    if (showNewForm) return newForm.pincode;
    return savedAddresses.find((a) => a.id === selectedId)?.pincode ?? "";
  }, [showNewForm, newForm.pincode, savedAddresses, selectedId]);

  const shippingQuery = trpc.order.estimateShipping.useQuery(
    {
      pincode: currentPincode,
      subtotal,
      items: activeItems.map((i) => ({ variantId: i.variantId, sizeMl: i.sizeMl ?? 0, quantity: i.quantity })),
    },
    { enabled: !!session && currentPincode.length === 6 && activeItems.length > 0 },
  );
  const shippingRate = shippingQuery.data?.available ? shippingQuery.data.chargeInr : null;
  const shippingLoading = currentPincode.length === 6 && shippingQuery.isLoading;
  const shippingForOrder = shippingRate ?? 0;
  const total = Math.max(0, subtotal - discount) + shippingForOrder;
  const needsPincode = currentPincode.length < 6;

  function changeNewForm<K extends keyof AddressForm>(key: K, value: AddressForm[K]) {
    setNewForm((prev) => ({ ...prev, [key]: value }));
    if (newFormErrors[key]) setNewFormErrors((p) => { const n = { ...p }; delete n[key]; return n; });
  }

  function resolveAddress(): AddressForm | null {
    if (showNewForm) return newForm;
    const saved = savedAddresses.find((a) => a.id === selectedId);
    return saved ? addressToForm(saved) : null;
  }

  async function handlePay() {
    const addr = resolveAddress();
    if (!addr) {
      Alert.alert("Select a delivery address");
      return;
    }

    if (showNewForm) {
      const errs = validateAddressForm(addr);
      if (Object.keys(errs).length > 0) {
        setNewFormErrors(errs);
        return;
      }
    }

    if (activeItems.length === 0) {
      Alert.alert("Your cart is empty");
      return;
    }
    if (shippingLoading) {
      Alert.alert("Calculating shipping cost, please wait…");
      return;
    }
    if (currentPincode.length === 6 && shippingQuery.isSuccess && !shippingQuery.data?.available) {
      Alert.alert("Delivery not available", "This pincode isn't serviceable yet.");
      return;
    }

    // Fail before creating an order/Razorpay-order server-side if the native
    // module can't open a checkout sheet anyway — avoids stray pending_payment
    // orders with no way to ever complete them.
    if (!isRazorpayLinked()) {
      Alert.alert("Payments unavailable", razorpayMissingMessage());
      return;
    }

    setPaying(true);
    payingRef.current = true;
    try {
      if (showNewForm && saveToAccount) {
        await addAddressMut.mutateAsync({
          label: addr.label,
          fullName: addr.fullName.trim(),
          phone: addr.phone.trim(),
          line1: addr.line1.trim(),
          line2: addr.line2.trim() || undefined,
          city: addr.city.trim(),
          state: addr.state.trim(),
          pincode: addr.pincode.trim(),
          isDefault: savedAddresses.length === 0,
          lat: addr.lat,
          lng: addr.lng,
        });
        await utils.userData.listAddresses.invalidate();
      }

      const order = await createOrder.mutateAsync({
        shippingAddress: {
          fullName: addr.fullName.trim(),
          phone: addr.phone.trim(),
          line1: addr.line1.trim(),
          line2: addr.line2.trim() || null,
          city: addr.city.trim(),
          state: addr.state.trim(),
          pincode: addr.pincode.trim(),
          lat: addr.lat ?? null,
          lng: addr.lng ?? null,
        },
        items: activeItems.map((item) => ({
          variantId: item.variantId,
          productName: item.productName ?? "",
          variantSku: item.sku ?? "",
          sizeMl: item.sizeMl ?? 0,
          unitPrice: item.effectivePrice ?? Number(item.mrp),
          mrp: Number(item.mrp),
          quantity: item.quantity,
          imageUrl: item.imageUrl ?? null,
        })),
        subtotal,
        discountAmount: discount,
        shippingCharge: shippingForOrder,
        taxAmount: 0,
        total,
        couponId,
        couponCode,
      });

      const rzpData = await createRazorpayOrder.mutateAsync({ orderId: order.id });

      const rzpResult = await RazorpayCheckout.open({
        key: rzpData.keyId,
        amount: rzpData.amount,
        currency: rzpData.currency,
        name: "Azimuth Perfumers",
        description: `Order ${rzpData.orderNumber}`,
        order_id: rzpData.razorpayOrderId,
        prefill: {
          name: addr.fullName.trim(),
          contact: addr.phone.trim(),
          email: session?.user?.email ?? "",
        },
        theme: { color: "#0a0a0a" },
      });

      await verifyPayment.mutateAsync({
        orderId: order.id,
        razorpayOrderId: rzpResult.razorpay_order_id,
        razorpayPaymentId: rzpResult.razorpay_payment_id,
        razorpaySignature: rzpResult.razorpay_signature,
      });

      await utils.order.list.invalidate();
      await utils.cart.list.invalidate();
      Alert.alert("Payment successful", "Redirecting to your orders…", [
        { text: "OK", onPress: () => router.replace("/orders") },
      ]);
    } catch (err) {
      if (isNativeModuleNullError(err)) {
        Alert.alert("Payments unavailable", razorpayMissingMessage());
        return;
      }
      const msg = (err as { description?: string; message?: string })?.description
        ?? (err as { message?: string })?.message;
      if (msg && !/cancel/i.test(msg)) {
        Alert.alert("Payment failed", msg);
      }
    } finally {
      setPaying(false);
      payingRef.current = false;
    }
  }

  if (sessionLoading) return null;

  if (!session) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center px-8" style={{ backgroundColor: Colors.background }}>
        <Text className="text-[14px] text-center mb-6" style={{ color: Colors.inkMuted }}>
          Sign in to continue checkout.
        </Text>
        <Pressable
          className="h-14 px-10 items-center justify-center bg-[#111111] active:opacity-70"
          onPress={() => router.push("/(auth)/sign-in")}
        >
          <Text className="text-white text-[11px] font-semibold tracking-[0.3em] uppercase">Sign In</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const blocked = paying || shippingLoading || needsPincode || cartLoading || activeItems.length === 0;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: Colors.background }} edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text className="text-[10px] font-semibold tracking-[0.26em] uppercase mb-1" style={{ color: Colors.inkMuted }}>
          Checkout
        </Text>
        <Text className="text-[30px] mb-6" style={{ fontFamily: Fonts.serifMedium, color: Colors.ink }}>
          Almost there
        </Text>

        {/* Delivery address */}
        <Text className="text-[10.5px] font-semibold tracking-[0.2em] uppercase mb-3" style={{ color: Colors.inkMuted }}>
          Delivery address
        </Text>

        {loadingAddresses ? (
          <View className="h-24 mb-3" style={{ backgroundColor: "#f0ede8" }} />
        ) : (
          <>
            {savedAddresses.map((addr) => (
              <AddressCard
                key={addr.id}
                address={addr}
                selected={selectedId === addr.id && !showNewForm}
                onSelect={() => { setSelectedId(addr.id); setShowNewForm(false); }}
              />
            ))}

            <Pressable
              onPress={() => { setShowNewForm(true); setSelectedId(null); }}
              className="flex-row items-center gap-2.5 px-4 py-3.5 mb-4 border border-dashed"
              style={{ borderColor: showNewForm ? Colors.ink : Colors.border }}
            >
              <Plus size={14} color={showNewForm ? Colors.ink : Colors.inkMuted} strokeWidth={1.6} />
              <Text
                className="text-[11px] font-semibold tracking-[0.14em] uppercase"
                style={{ color: showNewForm ? Colors.ink : Colors.inkMuted }}
              >
                {savedAddresses.length === 0 ? "Enter delivery address" : "Use a different address"}
              </Text>
            </Pressable>

            {showNewForm && (
              <View className="p-5 border mb-2" style={{ borderColor: Colors.border }}>
                <AddressFormFields
                  form={newForm}
                  errors={newFormErrors}
                  onChange={changeNewForm}
                  onLocated={(lat, lng) => setNewForm((prev) => ({ ...prev, lat, lng }))}
                />
                <Pressable
                  onPress={() => setSaveToAccount(!saveToAccount)}
                  className="flex-row items-center gap-2.5"
                >
                  <View
                    className="w-4 h-4 items-center justify-center"
                    style={{ borderWidth: 1.5, borderColor: Colors.ink, backgroundColor: saveToAccount ? Colors.ink : "transparent" }}
                  >
                    {saveToAccount && <View className="w-2 h-2 bg-white" />}
                  </View>
                  <Text className="text-[12.5px]" style={{ color: Colors.inkMuted }}>Save this address to my account</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        {/* Coupon */}
        <Text className="text-[10.5px] font-semibold tracking-[0.2em] uppercase mt-7 mb-3" style={{ color: Colors.inkMuted }}>
          Coupon
        </Text>
        {couponCode && couponDiscount !== null ? (
          <View
            className="flex-row items-center justify-between px-4 py-3 border mb-2"
            style={{ borderColor: Colors.accent, backgroundColor: `${Colors.accent}0d` }}
          >
            <View className="flex-row items-center gap-2">
              <Tag size={13} color={Colors.accent} />
              <Text className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: Colors.accent }}>
                {couponCode}
              </Text>
              <Text className="text-[11px]" style={{ color: Colors.inkMuted }}>
                · {formatInr(couponDiscount)} off
              </Text>
            </View>
            <Pressable onPress={() => { setCouponCode(null); setCouponId(null); setCouponDiscount(null); }}>
              <X size={14} color={Colors.inkMuted} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setCouponModalOpen(true)}
            className="flex-row items-center gap-2.5 px-4 py-3 border mb-2"
            style={{ borderColor: Colors.border }}
          >
            <Tag size={13} color={Colors.inkMuted} />
            <Text className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: Colors.inkMuted }}>
              Apply coupon or promo code
            </Text>
          </Pressable>
        )}

        {/* Order summary */}
        <Text className="text-[10.5px] font-semibold tracking-[0.2em] uppercase mt-7 mb-3" style={{ color: Colors.inkMuted }}>
          Order summary
        </Text>
        <View className="border p-5" style={{ borderColor: Colors.border }}>
          <View className="flex-row justify-between mb-2.5">
            <Text className="text-[13px]" style={{ color: Colors.inkMuted }}>Subtotal</Text>
            <Text className="text-[13px] font-medium" style={{ color: Colors.ink }}>{formatInr(subtotal)}</Text>
          </View>
          {discount > 0 && couponCode && (
            <View className="flex-row justify-between mb-2.5">
              <Text className="text-[13px]" style={{ color: Colors.accent }}>{couponCode}</Text>
              <Text className="text-[13px] font-medium" style={{ color: Colors.accent }}>−{formatInr(discount)}</Text>
            </View>
          )}
          <View className="flex-row justify-between mb-2.5">
            <Text className="text-[13px]" style={{ color: Colors.inkMuted }}>Shipping</Text>
            <Text className="text-[13px]" style={{ color: Colors.inkMuted }}>
              {subtotal >= freeShippingAbove ? "Free"
                : needsPincode ? "Enter pincode"
                : shippingLoading ? "Calculating…"
                : shippingRate === null ? "Not available"
                : formatInr(shippingRate)}
            </Text>
          </View>
          <View className="h-px my-3" style={{ backgroundColor: Colors.border }} />
          <View className="flex-row justify-between items-baseline">
            <Text className="text-[15px] font-semibold" style={{ color: Colors.ink }}>Total</Text>
            <Text className="text-[20px] font-bold" style={{ color: Colors.ink }}>
              {shippingLoading || needsPincode ? "—" : formatInr(total)}
            </Text>
          </View>
        </View>

        {/* Pay button */}
        <Pressable
          onPress={handlePay}
          disabled={blocked}
          className="h-14 items-center justify-center mt-6"
          style={{ backgroundColor: blocked ? "#e8e2da" : Colors.ink }}
        >
          {paying ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-[11px] font-bold tracking-[0.26em] uppercase" style={{ color: blocked ? "#999" : "#fff" }}>
              {shippingLoading ? "Calculating shipping…" : `Pay ${shippingLoading || needsPincode ? "—" : formatInr(total)}`}
            </Text>
          )}
        </Pressable>
        <View className="flex-row items-center justify-center gap-1.5 mt-3">
          <Lock size={11} color={Colors.inkMuted} />
          <Text className="text-[10px]" style={{ color: Colors.inkMuted }}>
            Secured by Razorpay · GST invoice included
          </Text>
        </View>
      </ScrollView>

      <CouponModal
        visible={couponModalOpen}
        onClose={() => setCouponModalOpen(false)}
        subtotal={subtotal}
        onApplied={(code, id, disc) => { setCouponCode(code); setCouponId(id); setCouponDiscount(disc); }}
      />
    </SafeAreaView>
  );
}
