import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

import { trpc } from "@/lib/trpc";
import { Fonts } from "@/constants/theme";

const CONCENTRATION_LABEL: Record<string, string> = {
  edp: "Eau de Parfum", edt: "Eau de Toilette", parfum: "Parfum",
  cologne: "Cologne", attar: "Attar",
};

const NOTE_POSITION_LABEL: Record<string, string> = {
  top: "Top", mid: "Heart", base: "Base",
};

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

export default function ProductDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const { data: product, isLoading } = trpc.catalog.getProductBySlug.useQuery({ slug });
  const addToCart = trpc.cart.upsert.useMutation({
    onSuccess: () => router.push("/cart"),
  });

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
  const primaryImage = product.images.find((i) => i.isPrimary) ?? product.images[0];

  return (
    <SafeAreaView className="flex-1 bg-[#faf8f5]" edges={["bottom"]}>
      <ScrollView bounces>
        {/* ── Hero image ── */}
        <View className="aspect-[3/4] w-full" style={{ backgroundColor: bg }}>
          {primaryImage?.url ? (
            <Image source={{ uri: primaryImage.url }} className="w-full h-full" contentFit="cover" />
          ) : (
            <View className="flex-1 items-end justify-end p-8">
              <Text
                className="text-white/40 text-4xl"
                style={{ fontFamily: Fonts.serifMedium }}
              >
                {product.name}
              </Text>
            </View>
          )}
        </View>

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

          {/* Size selector */}
          {activeVariants.length > 1 && (
            <View className="mb-8">
              <Text className="text-[10px] font-semibold tracking-[0.24em] text-[#111111] uppercase mb-4">
                Size
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {product.variants.filter((v) => v.status === "active").map((v) => {
                  const selected = (selectedVariantId ?? activeVariant?.id) === v.id;
                  const vPrice = v.effectivePrice ?? Number(v.mrp ?? 0);
                  return (
                    <Pressable
                      key={v.id}
                      onPress={() => setSelectedVariantId(v.id)}
                      className="border px-5 py-3"
                      style={{
                        borderColor: selected ? "#111111" : "#e8e2da",
                        backgroundColor: selected ? "#111111" : "transparent",
                      }}
                    >
                      <Text
                        className="text-[12px] font-semibold tracking-[0.1em]"
                        style={{ color: selected ? "#ffffff" : "#111111" }}
                      >
                        {v.sizeMl}ml
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
      <View className="px-6 pb-8 pt-4 border-t border-[#e8e2da] bg-[#faf8f5]">
        <Pressable
          className="h-14 items-center justify-center bg-[#111111] active:opacity-70"
          style={{ opacity: !activeVariant || addToCart.isPending ? 0.4 : 1 }}
          disabled={!activeVariant || addToCart.isPending}
          onPress={() =>
            activeVariant && addToCart.mutate({ variantId: activeVariant.id, quantity: 1 })
          }
        >
          <Text className="text-white text-[11px] font-semibold tracking-[0.3em] uppercase">
            {addToCart.isPending ? "Adding…" : "Add to Cart"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
