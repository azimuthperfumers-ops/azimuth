import { FlatList, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";

import { trpc } from "@/lib/trpc";
import { Fonts } from "@/constants/theme";

export default function CartScreen() {
  const router = useRouter();
  const { data: items = [], isLoading } = trpc.cart.list.useQuery();
  const settingsQuery = trpc.settings.get.useQuery(undefined, { staleTime: 10 * 60 * 1000 });
  const freeShippingAbove = settingsQuery.data?.freeShippingAboveInr ?? 999;
  const utils = trpc.useUtils();

  const updateQty = trpc.cart.updateQty.useMutation({
    onSuccess: () => utils.cart.list.invalidate(),
  });
  const remove = trpc.cart.remove.useMutation({
    onSuccess: () => utils.cart.list.invalidate(),
  });

  const activeItems = items.filter((i) => !i.isSaved);
  const subtotal = activeItems.reduce(
    (sum, item) => sum + (item.effectivePrice ?? Number(item.mrp)) * item.quantity,
    0,
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#faf8f5] items-center justify-center">
        <Text className="text-[10px] font-semibold tracking-[0.28em] text-[#888888] uppercase">
          Loading…
        </Text>
      </View>
    );
  }

  if (activeItems.length === 0) {
    return (
      <View className="flex-1 bg-[#faf8f5] items-center justify-center px-8">
        <Text className="text-[10px] font-semibold tracking-[0.36em] text-[#888888] uppercase mb-4">
          Cart
        </Text>
        <Text
          className="text-[32px] text-[#111111] text-center mb-3"
          style={{ fontFamily: Fonts.serifItalic }}
        >
          Your bag is empty
        </Text>
        <Text className="text-[14px] text-[#888888] text-center mb-10 leading-relaxed">
          Add a fragrance to your cart to begin.
        </Text>
        <Pressable
          className="h-11 px-10 items-center justify-center bg-[#111111] active:opacity-70"
          onPress={() => router.push("/shop")}
        >
          <Text className="text-white text-[10px] font-semibold tracking-[0.22em] uppercase">
            Browse Fragrances
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#faf8f5]">
      <FlatList
        data={activeItems}
        keyExtractor={(item) => item.variantId}
        ItemSeparatorComponent={() => <View className="h-px bg-[#e8e2da]" />}
        ListHeaderComponent={
          <View className="px-6 pt-4 pb-4 border-b border-[#e8e2da]">
            <Text className="text-[10px] font-semibold tracking-[0.28em] text-[#888888] uppercase">
              {activeItems.length} {activeItems.length === 1 ? "item" : "items"}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const linePrice = (item.effectivePrice ?? Number(item.mrp)) * item.quantity;
          return (
            <View className="flex-row px-5 py-5 gap-4">
              {/* Image */}
              <View
                className="w-20 h-24"
                style={{ backgroundColor: item.themeColor ?? "#e8e0d5" }}
              >
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} className="w-full h-full" contentFit="cover" />
                ) : null}
              </View>

              {/* Info */}
              <View className="flex-1">
                <Text
                  className="text-[16px] text-[#111111] leading-snug"
                  style={{ fontFamily: Fonts.serifItalic }}
                  numberOfLines={1}
                >
                  {item.productName}
                </Text>
                <Text className="text-[11px] tracking-[0.1em] text-[#888888] uppercase mt-0.5">
                  {item.sizeMl}ml
                </Text>

                <View className="flex-row items-center gap-3 mt-3">
                  <Pressable
                    className="w-8 h-8 border border-[#e8e2da] items-center justify-center active:bg-[#111111]"
                    onPress={() =>
                      item.quantity === 1
                        ? remove.mutate({ variantId: item.variantId })
                        : updateQty.mutate({ variantId: item.variantId, quantity: item.quantity - 1 })
                    }
                  >
                    <Text className="text-[#111111] text-base">{item.quantity === 1 ? "×" : "−"}</Text>
                  </Pressable>
                  <Text className="text-[14px] font-semibold text-[#111111] w-4 text-center">
                    {item.quantity}
                  </Text>
                  <Pressable
                    className="w-8 h-8 border border-[#e8e2da] items-center justify-center active:bg-[#111111]"
                    onPress={() =>
                      updateQty.mutate({ variantId: item.variantId, quantity: item.quantity + 1 })
                    }
                  >
                    <Text className="text-[#111111] text-base">+</Text>
                  </Pressable>
                </View>
              </View>

              {/* Price */}
              <View className="items-end justify-between">
                <Text className="text-[15px] font-semibold text-[#111111]">
                  ₹{linePrice.toLocaleString("en-IN")}
                </Text>
                <Pressable onPress={() => remove.mutate({ variantId: item.variantId })}>
                  <Text className="text-[11px] text-[#888888] underline">Remove</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />

      {/* Order summary + checkout */}
      <View className="px-6 pt-5 pb-8 border-t border-[#e8e2da]">
        <View className="flex-row justify-between mb-2">
          <Text className="text-[13px] text-[#888888]">Subtotal</Text>
          <Text className="text-[13px] text-[#888888]">₹{subtotal.toLocaleString("en-IN")}</Text>
        </View>
        <View className="flex-row justify-between mb-1">
          <Text className="text-[13px] text-[#888888]">Shipping</Text>
          <Text className="text-[13px] text-[#888888]">{subtotal >= freeShippingAbove ? "Free" : "₹99"}</Text>
        </View>
        <View className="h-px bg-[#e8e2da] my-4" />
        <View className="flex-row justify-between mb-6">
          <Text className="text-[15px] font-semibold text-[#111111]">Total</Text>
          <Text className="text-[18px] font-semibold text-[#111111]">
            ₹{(subtotal < freeShippingAbove ? subtotal + 99 : subtotal).toLocaleString("en-IN")}
          </Text>
        </View>
        {subtotal < freeShippingAbove && (
          <Text className="text-[11px] text-[#888888] text-center mb-4">
            Add ₹{(freeShippingAbove - subtotal).toLocaleString("en-IN")} more for free shipping
          </Text>
        )}
        <Pressable
          className="h-14 items-center justify-center bg-[#111111] active:opacity-70"
          onPress={() => router.push("/checkout")}
        >
          <Text className="text-white text-[11px] font-semibold tracking-[0.3em] uppercase">
            Proceed to Checkout
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
