import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import type { NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Heart } from "lucide-react-native";

import { trpc } from "@/lib/trpc";
import { useSession } from "@/hooks/use-session";
import { Colors, Fonts } from "@/constants/theme";

const CONCENTRATION_LABEL: Record<string, string> = {
  edp: "Eau de Parfum", edt: "Eau de Toilette", parfum: "Parfum",
  cologne: "Cologne", attar: "Attar",
};

const CONCENTRATION_SHORT: Record<string, string> = {
  edp: "EDP", edt: "EDT", parfum: "Parfum", cologne: "Cologne", attar: "Attar",
};

const NOTE_POSITION_LABEL: Record<string, string> = {
  top: "Top", mid: "Heart", base: "Base",
};

const AUTO_SCROLL_MS = 13000;

function DotRating({ value, max }: { value: number; max: number }) {
  return (
    <View className="flex-row gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <View
          key={i}
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: i < value ? "#111111" : "#e8e2da" }}
        />
      ))}
    </View>
  );
}

function ImageCarousel({
  images, bg, productName,
}: {
  images: { url: string }[];
  bg: string;
  productName: string;
}) {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const indexRef = useRef(0);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length < 2) return;
    const timer = setInterval(() => {
      const next = (indexRef.current + 1) % images.length;
      indexRef.current = next;
      setIndex(next);
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
    }, AUTO_SCROLL_MS);
    return () => clearInterval(timer);
  }, [images.length, width]);

  function onMomentumEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    indexRef.current = next;
    setIndex(next);
  }

  if (images.length === 0) {
    return (
      <View className="aspect-[3/4] w-full items-end justify-end p-8" style={{ backgroundColor: bg }}>
        <Text className="text-white/40 text-4xl" style={{ fontFamily: Fonts.serifMedium }}>
          {productName}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ position: "relative" }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
      >
        {images.map((img, i) => (
          <Image
            key={i}
            source={{ uri: img.url }}
            style={{ width, aspectRatio: 3 / 4 }}
            contentFit="cover"
          />
        ))}
      </ScrollView>

      {images.length > 1 && (
        <View className="absolute bottom-3 left-0 right-0 flex-row items-center justify-center gap-1.5">
          {images.map((_, i) => (
            <View
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: i === index ? "#fff" : "rgba(255,255,255,0.4)" }}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export default function ProductDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { session } = useSession();
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const { data: product, isLoading } = trpc.catalog.getProductBySlug.useQuery({ slug });
  const utils = trpc.useUtils();
  const [justAdded, setJustAdded] = useState(false);
  const addToCart = trpc.cart.upsert.useMutation({
    onSuccess: async () => {
      await utils.cart.list.invalidate();
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1800);
    },
  });

  const { data: wishlist } = trpc.userData.listWishlist.useQuery(undefined, { enabled: !!session });
  const wishlistItem = wishlist?.find((w) => w.productId === product?.id);
  const addWishlist = trpc.userData.addToWishlist.useMutation({
    onSuccess: () => utils.userData.listWishlist.invalidate(),
  });
  const removeWishlist = trpc.userData.removeFromWishlist.useMutation({
    onSuccess: () => utils.userData.listWishlist.invalidate(),
  });

  function toggleWishlist() {
    if (!session) {
      router.push("/(auth)/sign-in");
      return;
    }
    if (wishlistItem) {
      removeWishlist.mutate({ id: wishlistItem.id });
    } else if (product) {
      addWishlist.mutate({ productId: product.id });
    }
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#faf8f5]">
        <Text className="text-[10px] font-semibold tracking-[0.28em] text-[#888888] uppercase">Loading…</Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View className="flex-1 items-center justify-center bg-[#faf8f5]">
        <Text className="text-[10px] font-semibold tracking-[0.28em] text-[#888888] uppercase">Not found</Text>
      </View>
    );
  }

  const activeVariants = product.variants.filter((v) => v.status === "active");
  const activeVariant =
    product.variants.find((v) => v.id === selectedVariantId) ??
    product.variants.find((v) => v.isDefault) ??
    product.variants[0];

  const price = activeVariant
    ? (activeVariant.effectivePrice ?? Number(activeVariant.mrp ?? 0))
    : null;

  const mrp = activeVariant ? Number(activeVariant.mrp ?? 0) : null;
  const hasDiscount = price !== null && mrp !== null && price < mrp;
  const bg = product.themeColor ?? "#e8e0d5";
  const galleryImages = product.images
    .slice()
    .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))
    .filter((i): i is typeof i & { url: string } => !!i.url);

  return (
    <SafeAreaView className="flex-1 bg-[#faf8f5]" edges={["bottom"]}>
      <ScrollView bounces>
        {/* ── Hero image carousel ── */}
        <ImageCarousel images={galleryImages} bg={bg} productName={product.name} />

        {/* Color rule */}
        <View className="h-[3px] w-full" style={{ backgroundColor: bg }} />

        {/* ── Product info ── */}
        <View className="px-6 pt-8 pb-6">
          {/* Category + concentration */}
          <Text className="text-[10px] font-semibold tracking-[0.28em] text-[#888888] uppercase mb-1">
            {activeVariant &&
              (CONCENTRATION_LABEL[activeVariant.concentration] ?? activeVariant.concentration)}
            {product.category ? ` · ${product.category.name}` : ""}
          </Text>

          {/* Name */}
          <Text
            className="text-[38px] leading-none tracking-tight text-[#111111] mb-4"
            style={{ fontFamily: Fonts.serifItalic }}
          >
            {product.name}
          </Text>

          {/* Price */}
          <View className="flex-row items-baseline gap-3 mb-8">
            <Text className="text-[26px] font-semibold text-[#111111]">
              ₹{price?.toLocaleString("en-IN") ?? "—"}
            </Text>
            {hasDiscount && (
              <Text className="text-[15px] text-[#888888] line-through">
                ₹{mrp?.toLocaleString("en-IN")}
              </Text>
            )}
          </View>

          {/* Description */}
          {product.description && (
            <Text className="text-[14px] leading-[1.9] text-[#555555] mb-8">
              {product.description}
            </Text>
          )}

          {/* Divider */}
          <View className="h-px bg-[#e8e2da] mb-8" />

          {/* Variant selector */}
          {activeVariants.length > 1 && (
            <View className="mb-8">
              <Text className="text-[10px] font-semibold tracking-[0.24em] text-[#111111] uppercase mb-4">
                Variant
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {product.variants.filter((v) => v.status === "active").map((v) => {
                  const selected = (selectedVariantId ?? activeVariant?.id) === v.id;
                  const vPrice = v.effectivePrice ?? Number(v.mrp ?? 0);
                  const concentration = CONCENTRATION_SHORT[v.concentration] ?? v.concentration;
                  return (
                    <Pressable
                      key={v.id}
                      onPress={() => setSelectedVariantId(v.id)}
                      className="border px-5 py-3"
                      style={{
                        borderColor: selected ? Colors.accent : "#e8e2da",
                        backgroundColor: selected ? Colors.accent : "transparent",
                      }}
                    >
                      <Text
                        className="text-[12px] font-semibold tracking-[0.1em]"
                        style={{ color: selected ? "#ffffff" : "#111111" }}
                      >
                        {concentration} · {v.sizeMl}ml
                      </Text>
                      <Text
                        className="text-[11px] mt-0.5"
                        style={{ color: selected ? "#ffffff" : "#888888" }}
                      >
                        ₹{vPrice.toLocaleString("en-IN")}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Ratings */}
          {(product.longevityRating || product.sillageRating) && (
            <View className="mb-8 gap-4">
              {!!product.longevityRating && (
                <View className="flex-row items-center justify-between">
                  <Text className="text-[10px] font-semibold tracking-[0.24em] text-[#111111] uppercase">
                    Longevity
                  </Text>
                  <DotRating value={product.longevityRating} max={10} />
                </View>
              )}
              {!!product.sillageRating && (
                <View className="flex-row items-center justify-between">
                  <Text className="text-[10px] font-semibold tracking-[0.24em] text-[#111111] uppercase">
                    Sillage
                  </Text>
                  <DotRating value={product.sillageRating} max={5} />
                </View>
              )}
            </View>
          )}

          {/* Notes */}
          {product.notes.length > 0 && (
            <View className="mb-8 gap-4">
              {(["top", "mid", "base"] as const).map((position) => {
                const positionNotes = product.notes.filter((n) => n.notePosition === position);
                if (positionNotes.length === 0) return null;
                return (
                  <View key={position}>
                    <Text className="text-[10px] font-semibold tracking-[0.24em] text-[#111111] uppercase mb-2">
                      {NOTE_POSITION_LABEL[position]}
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {positionNotes.map((n) => (
                        <View
                          key={n.id}
                          className="px-3 py-1.5 rounded-full border border-[#e8e2da] bg-[#f0ede8]"
                        >
                          <Text className="text-[12px] text-[#555555]">{n.note.name}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Sticky CTA ── */}
      <View className="flex-row items-center gap-3 px-6 pb-8 pt-4 border-t border-[#e8e2da] bg-[#faf8f5]">
        <View>
          <Text
            className="text-[20px] leading-none"
            style={{ fontFamily: Fonts.serifMedium, color: "#111111" }}
          >
            ₹{price?.toLocaleString("en-IN") ?? "—"}
          </Text>
          <Text className="mt-1 text-[8px] tracking-[0.14em] text-[#8a8175] uppercase">
            Incl. of all taxes
          </Text>
        </View>
        <Pressable
          className="flex-1 h-14 items-center justify-center bg-[#111111] active:opacity-70"
          style={{ opacity: !activeVariant || addToCart.isPending ? 0.4 : 1 }}
          disabled={!activeVariant || addToCart.isPending}
          onPress={() =>
            activeVariant && addToCart.mutate({ variantId: activeVariant.id, quantity: 1 })
          }
        >
          <Text className="text-white text-[11px] font-semibold tracking-[0.3em] uppercase">
            {addToCart.isPending ? "Adding…" : justAdded ? "Added ✓" : "Add to Cart"}
          </Text>
        </Pressable>
        <Pressable
          onPress={toggleWishlist}
          className="w-14 h-14 items-center justify-center border border-[#e8e2da] active:opacity-70"
        >
          <Heart
            size={18}
            color={wishlistItem ? Colors.accent : "#111111"}
            fill={wishlistItem ? Colors.accent : "transparent"}
            strokeWidth={1.6}
          />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
