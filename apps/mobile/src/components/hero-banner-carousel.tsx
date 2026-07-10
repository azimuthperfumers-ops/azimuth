import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Pressable,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";

import { Fonts } from "@/constants/theme";

type Banner = {
  id: string;
  imageUrl: string;
  alt: string;
  active: boolean;
};

export type HeroCopy = {
  line1: string;
  line2: string;
  italic: string;
  subtitle: string;
};

const SLIDE_MS = 5000;
const SCREEN_W = Dimensions.get("window").width;
const HERO_H = Math.min(Math.round(SCREEN_W * 1.25), 560);

export function HeroBannerCarousel({ banners, copy }: { banners: Banner[]; copy: HeroCopy }) {
  const router = useRouter();
  const slides = banners.filter((b) => b.active);
  const [idx, setIdx] = useState(0);
  const listRef = useRef<FlatList<Banner>>(null);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const goTo = useCallback(
    (next: number) => {
      if (slides.length <= 1) return;
      const target = ((next % slides.length) + slides.length) % slides.length;
      listRef.current?.scrollToOffset({ offset: target * SCREEN_W, animated: true });
      setIdx(target);
    },
    [slides.length],
  );

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => goTo(idxRef.current + 1), SLIDE_MS);
    return () => clearInterval(t);
  }, [slides.length, goTo]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (page !== idxRef.current) setIdx(page);
  };

  if (slides.length === 0) return null;

  return (
    <View style={{ width: SCREEN_W, height: HERO_H }} className="bg-[#1B1611]">
      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(b) => b.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
        renderItem={({ item }) => (
          <View style={{ width: SCREEN_W, height: HERO_H }}>
            <Image
              source={{ uri: item.imageUrl }}
              style={{ width: SCREEN_W, height: HERO_H }}
              contentFit="cover"
              transition={400}
            />
            {/* Scrim for copy legibility */}
            <View className="absolute inset-0 bg-black/30" />
            <View className="absolute bottom-0 left-0 right-0 h-40 bg-black/25" />
          </View>
        )}
      />

      {/* Copy overlay */}
      <View className="absolute bottom-0 left-0 right-0 px-6 pb-9" pointerEvents="box-none">
        <Text className="text-[9px] font-semibold tracking-[0.32em] text-white/60 uppercase mb-2.5">
          Azimuth Perfumers · Est. 2019
        </Text>
        <Text
          className="text-[34px] leading-[1.02] text-white"
          style={{ fontFamily: Fonts.serifMedium }}
        >
          {copy.line1} {copy.line2}{" "}
          <Text style={{ fontFamily: Fonts.serifItalic }} className="text-white/90">
            {copy.italic}
          </Text>
        </Text>
        <Pressable
          className="mt-5 h-12 w-44 items-center justify-center bg-white active:opacity-80"
          onPress={() => router.push("/shop")}
        >
          <Text className="text-[10px] font-semibold tracking-[0.22em] text-black uppercase">
            Shop now
          </Text>
        </Pressable>

        {/* Progress bars */}
        {slides.length > 1 && (
          <View className="mt-6 flex-row gap-1.5">
            {slides.map((b, i) => (
              <Pressable key={b.id} onPress={() => goTo(i)} hitSlop={8}>
                <View
                  className="h-[2px] w-9"
                  style={{ backgroundColor: i === idx ? "#ffffff" : "rgba(255,255,255,0.35)" }}
                />
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
