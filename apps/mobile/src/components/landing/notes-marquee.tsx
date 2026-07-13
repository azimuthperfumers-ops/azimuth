import { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";

import { Colors, Fonts } from "@/constants/theme";

const NOTES = [
  "Amber", "Oud", "Rose", "Cedar", "Vetiver", "Bergamot",
  "Incense", "Saffron", "Musk", "Sandalwood", "Jasmine", "Patchouli",
];

/**
 * A slow horizontal river of scent notes — big italic serif, ✳ separators.
 * Mirrors the web landing's notes marquee. Uses core Animated (native driver)
 * for a lightweight, always-running loop.
 */
export function NotesMarquee() {
  const x = useRef(new Animated.Value(0)).current;

  // One copy of the text, doubled for a seamless wrap.
  const single = NOTES.map((n) => `${n}   ✳   `).join("");
  const content = `${single}${single}`;
  const singleWidth = single.length * 10.5; // approx px at 25px serif italic

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(x, {
        toValue: -singleWidth,
        duration: 32000,
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [x, singleWidth]);

  return (
    <View
      className="overflow-hidden py-5 border-y"
      style={{ backgroundColor: Colors.surface, borderColor: Colors.border }}
    >
      <Animated.Text
        numberOfLines={1}
        style={{
          transform: [{ translateX: x }],
          includeFontPadding: false,
          fontFamily: Fonts.serifItalic,
          fontSize: 25,
          color: Colors.ink,
        }}
      >
        {content}
      </Animated.Text>
    </View>
  );
}
