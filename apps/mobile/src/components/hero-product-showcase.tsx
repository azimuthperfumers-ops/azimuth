import { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, FlatList, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";

import { Colors, Fonts } from "@/constants/theme";
import type { HeroCopy } from "./hero-banner-carousel";

export type HeroProduct = {
  id: string;
  name: string;
  slug: string | null;
  themeColor: string | null;
  category?: { name: string } | null;
  images: { url?: string; isPrimary: boolean }[];
};

const SLIDE_MS = 4500;
const SCREEN_W = Dimensions.get("window").width;
const HERO_H = Math.min(Math.round(SCREEN_W * 1.3), 600);
const NEUTRAL = "#EDE3D0";

function primaryUrl(p: HeroProduct) {
  return (p.images.find((i) => i.isPrimary) ?? p.images[0])?.url;
}

/**
 * Image-forward hero for the home screen — mirrors the web landing hero.
 * Auto-cycles through the chosen hero products (falls back to featured), each
 * shown full-bleed on its own theme colour with an editorial copy overlay.
 */
export function HeroProductShowcase({ products, copy }: { products: HeroProduct[]; copy: HeroCopy }) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const listRef = useRef<FlatList<HeroProduct>>(null);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const goTo = useCallback(
    (next: number) => {
      if (products.length <= 1) return;
      const target = ((next % products.length) + products.length) % products.length;
      listRef.current?.scrollToOffset({ offset: target * SCREEN_W, animated: true });
      setIdx(target);
    },
    [products.length],
  );

  useEffect(() => {
    if (products.length <= 1) return;
    const t = setInterval(() => goTo(idxRef.current + 1), SLIDE_MS);
    return () => clearInterval(t);
  }, [products.length, goTo]);

  if (products.length === 0) return null;
  const active = products[Math.min(idx, products.length - 1)]!;

  return (
    <View style={{ width: SCREEN_W, height: HERO_H }}>
      <FlatList
        ref={listRef}
        data={products}
        keyExtractor={(p) => p.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
          if (page !== idxRef.current) setIdx(page);
        }}
        getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
        renderItem={({ item }) => (
          <View style={{ width: SCREEN_W, height: HERO_H, backgroundColor: item.themeColor ?? NEUTRAL }}>
            {primaryUrl(item) && (
              <Image source={{ uri: primaryUrl(item)! }} style={{ width: SCREEN_W, height: HERO_H }} contentFit="cover" transition={400} />
            )}
            <View className="absolute inset-0 bg-black/25" />
            <View className="absolute bottom-0 left-0 right-0 h-56 bg-black/35" />
          </View>
        )}
      />

      {/* Copy overlay */}
      <View className="absolute bottom-0 left-0 right-0 px-6 pb-9" pointerEvents="box-none">
        <Text className="text-[9px] font-semibold tracking-[0.32em] text-white/70 uppercase mb-2.5">
          Eau de Parfum · Small Batch
        </Text>
        <Text className="text-[36px] leading-[1.02] text-white" style={{ fontFamily: Fonts.serifMedium }}>
          {copy.line1}
          {"\n"}
          <Text style={{ fontFamily: Fonts.serifItalic }} className="text-white/90">
            {copy.italic}
          </Text>
        </Text>

        <Pressable
          className="mt-5 flex-row items-center gap-3"
          onPress={() => router.push(`/product/${active.slug ?? active.id}`)}
        >
          <View className="h-12 px-6 items-center justify-center bg-white active:opacity-80">
            <Text className="text-[10px] font-semibold tracking-[0.22em] text-black uppercase">Shop now</Text>
          </View>
          <View>
            <Text className="text-[8px] font-semibold tracking-[0.22em] uppercase" style={{ color: Colors.accent }}>
              {active.category?.name ?? "Signature"}
            </Text>
            <Text className="text-[15px] text-white" style={{ fontFamily: Fonts.serifMedium }}>
              {active.name}
            </Text>
          </View>
        </Pressable>

        {products.length > 1 && (
          <View className="mt-6 flex-row gap-1.5">
            {products.map((p, i) => (
              <Pressable key={p.id} onPress={() => goTo(i)} hitSlop={8}>
                <View className="h-[2px]" style={{ width: i === idx ? 34 : 18, backgroundColor: i === idx ? "#ffffff" : "rgba(255,255,255,0.4)" }} />
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
