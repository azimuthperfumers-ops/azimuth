import { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";

const ITEMS = [
  "MINIATURES WITH EVERY PURCHASE",
  "FREE SHIPPING ABOVE ₹999",
  "PREMIUM NATURALS & RESINS",
  "PAN-INDIA DELIVERY",
  "HANDCRAFTED IN SMALL BATCHES",
];

const FULL_TEXT = ITEMS.map((i) => `${i}  ·  `).join("");
const CONTENT = `${FULL_TEXT}${FULL_TEXT}`; // doubled for seamless loop

// Approximate px width of one copy at font size 9.5
const SINGLE_WIDTH = FULL_TEXT.length * 5.7;

export function Ticker() {
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(x, {
        toValue: -SINGLE_WIDTH,
        duration: 26000,
        useNativeDriver: true,
      }),
    ).start();
  }, [x]);

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
