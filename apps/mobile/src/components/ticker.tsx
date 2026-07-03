import { useEffect, useMemo, useRef } from "react";
import { Animated, Text, View } from "react-native";

import { trpc } from "@/lib/trpc";

export function Ticker() {
  const x = useRef(new Animated.Value(0)).current;
  const settingsQuery = trpc.settings.get.useQuery(undefined, { staleTime: 10 * 60 * 1000 });
  const freeShippingAbove = settingsQuery.data?.freeShippingAboveInr ?? 999;

  const { CONTENT, SINGLE_WIDTH } = useMemo(() => {
    const items = [
      "MINIATURES WITH EVERY PURCHASE",
      `FREE SHIPPING ABOVE ₹${freeShippingAbove}`,
      "PREMIUM NATURALS & RESINS",
      "PAN-INDIA DELIVERY",
      "HANDCRAFTED IN SMALL BATCHES",
    ];
    const fullText = items.map((i) => `${i}  ·  `).join("");
    return {
      // doubled for seamless loop
      CONTENT: `${fullText}${fullText}`,
      // Approximate px width of one copy at font size 9.5
      SINGLE_WIDTH: fullText.length * 5.7,
    };
  }, [freeShippingAbove]);

  useEffect(() => {
    Animated.loop(
      Animated.timing(x, {
        toValue: -SINGLE_WIDTH,
        duration: 26000,
        useNativeDriver: true,
      }),
    ).start();
  }, [x, SINGLE_WIDTH]);

  return (
    <View className="overflow-hidden bg-[#111111] py-2">
      <Animated.Text
        style={{ transform: [{ translateX: x }] }}
        className="text-white text-[9.5px] tracking-[0.18em] font-semibold whitespace-nowrap"
        numberOfLines={1}
      >
        {CONTENT}
      </Animated.Text>
    </View>
  );
}
