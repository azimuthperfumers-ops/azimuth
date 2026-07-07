import { FlatList, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, Heart } from "lucide-react-native";

import { trpc } from "@/lib/trpc";
import { Colors, Fonts } from "@/constants/theme";

const CONCENTRATION_SHORT: Record<string, string> = {
  edp: "EDP", edt: "EDT", parfum: "Parfum", cologne: "Cologne", attar: "Attar",
};

export default function WishlistScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: items = [], isLoading } = trpc.userData.listWishlist.useQuery();
  const remove = trpc.userData.removeFromWishlist.useMutation({
    onSuccess: () => utils.userData.listWishlist.invalidate(),
  });

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: Colors.background }} edges={["top", "bottom"]}>
      {/* Header */}
      <View className="flex-row items-center justify-center px-5 py-3.5 relative border-b" style={{ borderColor: Colors.border }}>
        <Pressable onPress={() => router.back()} className="absolute left-5 p-1">
          <ChevronLeft size={20} color={Colors.ink} strokeWidth={1.8} />
        </Pressable>
        <Text className="text-[15px] tracking-[0.16em] font-semibold uppercase" style={{ color: Colors.ink }}>
          Wishlist
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-[10px] font-semibold tracking-[0.28em] uppercase" style={{ color: Colors.inkMuted }}>
            Loading…
          </Text>
        </View>
      ) : items.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Heart size={28} color={Colors.inkMuted} strokeWidth={1.2} />
          <Text
            className="mt-4 text-[24px] text-center"
            style={{ fontFamily: Fonts.serifItalic, color: Colors.ink }}
          >
            Your wishlist is empty
          </Text>
          <Text className="mt-2 text-[13px] text-center leading-relaxed" style={{ color: Colors.inkMuted }}>
            Tap the heart on any fragrance to save it here.
          </Text>
          <Pressable
            className="mt-8 h-12 px-8 items-center justify-center bg-[#111111] active:opacity-70"
            onPress={() => router.push("/shop")}
          >
            <Text className="text-white text-[10.5px] font-semibold tracking-[0.2em] uppercase">
              Browse Fragrances
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 14, paddingHorizontal: 20 }}
          contentContainerStyle={{ paddingTop: 20, paddingBottom: 32, gap: 24 }}
          renderItem={({ item }) => {
            const product = item.product;
            if (!product) return null;
            const activeVariants = product.variants.filter((v) => v.status === "active");
            const defaultVariant = activeVariants.find((v) => v.isDefault) ?? activeVariants[0];
            const image = product.images.find((img) => img.isPrimary) ?? product.images[0];
            const price = defaultVariant ? (defaultVariant.effectivePrice ?? Number(defaultVariant.mrp)) : null;
            const bg = product.themeColor ?? "#e8e0d5";
            const slug = product.slug ?? product.id;

            return (
              <Pressable className="flex-1 active:opacity-90" onPress={() => router.push(`/product/${slug}`)}>
                <View className="w-full aspect-square overflow-hidden" style={{ backgroundColor: bg, position: "relative" }}>
                  {image?.url ? (
                    <Image source={{ uri: image.url }} className="w-full h-full" contentFit="cover" />
                  ) : null}
                  <Pressable
                    onPress={() => remove.mutate({ id: item.id })}
                    className="absolute top-2 right-2 w-7 h-7 items-center justify-center bg-white/85"
                  >
                    <Heart size={13} color="#c0392b" fill="#c0392b" strokeWidth={1.4} />
                  </Pressable>
                </View>
                <Text
                  numberOfLines={1}
                  className="mt-2 text-[15px]"
                  style={{ fontFamily: Fonts.serifItalic, color: Colors.ink }}
                >
                  {product.name}
                </Text>
                <Text className="mt-0.5 text-[9.5px] tracking-[0.1em] uppercase" style={{ color: Colors.inkMuted }} numberOfLines={1}>
                  {defaultVariant && (CONCENTRATION_SHORT[defaultVariant.concentration] ?? defaultVariant.concentration)}
                  {product.category ? ` · ${product.category.name}` : ""}
                </Text>
                {price !== null && (
                  <Text className="mt-1 text-[13px] font-semibold" style={{ color: Colors.ink }}>
                    ₹{Number(price).toLocaleString("en-IN")}
                  </Text>
                )}
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
