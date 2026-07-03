import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { LogIn, Package, ShoppingBag, ShoppingCart, User } from "lucide-react-native";

import { trpc } from "@/lib/trpc";
import { useSession } from "@/hooks/use-session";
import { useCartCount } from "@/hooks/use-cart-count";
import { Colors, Fonts } from "@/constants/theme";

const CONCENTRATION_SHORT: Record<string, string> = {
  edp: "EDP", edt: "EDT", parfum: "Parfum", cologne: "Cologne", attar: "Attar",
};

const VALUES = [
  { label: "SMALL BATCHES", sub: "Each run under 200 units" },
  { label: "NATURAL BASES", sub: "Resins, ouds & florals" },
  { label: "PAN-INDIA", sub: "Delivered to your door" },
  { label: "NO MIDDLEMEN", sub: "Direct from our lab" },
];

function ActionTile({
  Icon,
  label,
  badge,
  onPress,
}: {
  Icon: typeof ShoppingBag;
  label: string;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <Pressable className="flex-1 items-center py-5 active:opacity-60" onPress={onPress}>
      <View className="relative">
        <View
          className="w-12 h-12 items-center justify-center rounded-full"
          style={{ backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border }}
        >
          <Icon size={18} color={Colors.ink} strokeWidth={1.75} />
        </View>
        {!!badge && (
          <View
            className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full items-center justify-center"
            style={{ backgroundColor: Colors.accent }}
          >
            <Text className="text-white text-[9px] font-bold">{badge}</Text>
          </View>
        )}
      </View>
      <Text
        className="mt-2 text-[9.5px] font-semibold tracking-[0.14em] uppercase"
        style={{ color: Colors.ink }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { session } = useSession();
  const cartCount = useCartCount();
  const { data: products = [] } = trpc.catalog.listProducts.useQuery({ status: "active", limit: 12 });

  return (
    <ScrollView className="flex-1" style={{ backgroundColor: Colors.background }} bounces>
      {/* ── Greeting ── */}
      <View className="px-6 pt-8 pb-2">
        <Text
          className="text-[11px] font-semibold tracking-[0.3em] uppercase"
          style={{ color: Colors.inkMuted }}
        >
          {session ? `Welcome back, ${session.user.name?.split(" ")[0] ?? ""}` : "Azimuth Perfumers"}
        </Text>
        <Text
          className="mt-1 text-[26px]"
          style={{ fontFamily: Fonts.serifMedium, color: Colors.ink }}
        >
          What are you looking for?
        </Text>
      </View>

      {/* ── Quick actions ── */}
      <View className="flex-row px-4 mt-4 mb-2">
        <ActionTile Icon={ShoppingBag} label="Shop" onPress={() => router.push("/shop")} />
        <ActionTile Icon={ShoppingCart} label="Cart" badge={cartCount} onPress={() => router.push("/cart")} />
        {session ? (
          <>
            <ActionTile Icon={User} label="Account" onPress={() => router.push("/account")} />
            <ActionTile Icon={Package} label="Orders" onPress={() => router.push("/orders")} />
          </>
        ) : (
          <ActionTile Icon={LogIn} label="Sign In" onPress={() => router.push("/(auth)/sign-in")} />
        )}
      </View>

      {/* ── Collection ── */}
      <View className="py-10">
        {/* Heading */}
        <View className="items-center mb-8 px-4">
          <Text
            className="text-[10px] font-semibold tracking-[0.36em] uppercase mb-2"
            style={{ color: Colors.inkMuted }}
          >
            Azimuth Perfumers
          </Text>
          <Text
            className="text-[34px] leading-[1.05]"
            style={{ fontFamily: Fonts.serifSemiBold, color: Colors.ink }}
          >
            The Collection
          </Text>
        </View>

        {/* Horizontal product cards */}
        <FlatList
          horizontal
          data={products}
          keyExtractor={(p) => p.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}
          snapToInterval={312 + 16}
          decelerationRate="fast"
          renderItem={({ item: p }) => {
            const activeVariants = p.variants.filter((v) => v.status === "active");
            const defaultVariant = activeVariants.find((v) => v.isDefault) ?? activeVariants[0];
            const image = p.images.find((i) => i.isPrimary) ?? p.images[0];
            const fromPrice = activeVariants.length > 0
              ? Math.min(...activeVariants.map((v) => v.effectivePrice ?? Number(v.mrp)))
              : null;
            const bg = p.themeColor ?? "#e8e0d5";
            const slug = p.slug ?? p.id;
            const isSingle = activeVariants.length === 1;

            return (
              <Pressable
                className="w-[312px] active:opacity-90"
                onPress={() => router.push(`/product/${slug}`)}
              >
                {/* Image */}
                <View className="aspect-[3/4] w-full overflow-hidden" style={{ backgroundColor: bg }}>
                  {image?.url ? (
                    <Image source={{ uri: image.url }} className="w-full h-full" contentFit="cover" />
                  ) : (
                    <View className="flex-1 items-end justify-end p-6">
                      <Text
                        className="text-white/50 text-3xl"
                        style={{ fontFamily: Fonts.serifMedium }}
                      >
                        {p.name}
                      </Text>
                    </View>
                  )}

                  {/* Badges */}
                  {activeVariants.length > 1 && (
                    <View className="absolute bottom-3 left-3 bg-white/80 px-2.5 py-1">
                      <Text className="text-[9px] font-semibold tracking-[0.14em] text-[#111111] uppercase">
                        {activeVariants.length} sizes
                      </Text>
                    </View>
                  )}
                </View>

                {/* Color rule */}
                <View className="h-[2px] w-full" style={{ backgroundColor: bg }} />

                {/* Info */}
                <View className="pt-4 pb-3">
                  <Text
                    className="text-[17.5px] tracking-tight"
                    style={{ fontFamily: Fonts.serifMedium, color: Colors.ink }}
                  >
                    {p.name}
                  </Text>
                  <View className="mt-1.5 flex-row items-center justify-between">
                    <Text className="text-[10.5px] tracking-[0.1em] text-[#111111]/50 uppercase">
                      {defaultVariant &&
                        (CONCENTRATION_SHORT[defaultVariant.concentration] ?? defaultVariant.concentration)}
                      {p.category ? ` · ${p.category.name}` : ""}
                    </Text>
                    {fromPrice !== null && (
                      <Text className="text-[14px] font-semibold text-[#111111]">
                        ₹{Number(fromPrice).toLocaleString("en-IN")}
                      </Text>
                    )}
                  </View>
                </View>

                {/* CTA */}
                <Pressable
                  className="h-11 w-full items-center justify-center border border-[#e8e2da] active:bg-[#111111] active:border-[#111111]"
                  onPress={() => router.push(`/product/${slug}`)}
                >
                  <Text className="text-[11px] font-semibold tracking-[0.18em] text-[#111111] uppercase">
                    {isSingle ? "Add to Cart" : "Choose Size"}
                  </Text>
                </Pressable>
              </Pressable>
            );
          }}
        />

        {/* View all */}
        <View className="mt-10 items-center px-6">
          <Pressable
            className="h-11 px-10 items-center justify-center border border-[#111111] active:bg-[#111111]"
            onPress={() => router.push("/shop")}
          >
            <Text className="text-[10.5px] font-semibold tracking-[0.2em] text-[#111111] uppercase">
              View all fragrances
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── Values strip ── */}
      <View className="border-y border-[#e8e2da]">
        <View className="flex-row flex-wrap">
          {VALUES.map(({ label, sub }, i) => (
            <View
              key={label}
              className="w-1/2 py-8 px-4 items-center border-[#e8e2da]"
              style={{
                borderRightWidth: i % 2 === 0 ? 1 : 0,
                borderBottomWidth: i < 2 ? 1 : 0,
              }}
            >
              <Text className="text-[11px] font-semibold tracking-[0.18em] text-[#111111] uppercase text-center">
                {label}
              </Text>
              <Text className="mt-1.5 text-[12px] text-[#888888] text-center">{sub}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Footer ── */}
      <View className="px-6 py-12 border-t border-[#e8e2da]">
        <View className="flex-row items-start gap-2 mb-5">
          <Image source={require("@/assets/images/logo-icon.png")} className="h-6 w-6" contentFit="contain" />
          <Image source={require("@/assets/images/logo-wordmark.png")} style={{ height: 28, width: 28 * (1642 / 362) }} contentFit="contain" />
          <Text className="text-[9px] leading-none text-[#111111]">&trade;</Text>
        </View>
        <Text className="text-[13px] leading-relaxed text-[#888888] mb-10 max-w-64">
          A house of slow perfumery. Composed in small batches, delivered pan-India.
        </Text>

        <View className="flex-row gap-12 mb-10">
          <View>
            <Text className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#111111] mb-4">Shop</Text>
            <Pressable onPress={() => router.push("/shop")}>
              <Text className="text-[13px] text-[#888888]">All fragrances</Text>
            </Pressable>
          </View>
          <View>
            <Text className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#111111] mb-4">Care</Text>
            <Pressable onPress={() => router.push("/support/index")}>
              <Text className="text-[13px] text-[#888888]">Contact us</Text>
            </Pressable>
          </View>
        </View>

        <Text className="text-[11px] text-[#bbb]">© 2026 Azimuth Perfumers</Text>
      </View>
    </ScrollView>
  );
}
