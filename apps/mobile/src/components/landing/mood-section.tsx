import { Dimensions, Pressable, ScrollView, Text, View } from "react-native";
import { Image, type ImageProps } from "expo-image";
import { useRouter } from "expo-router";

import { Colors, Fonts } from "@/constants/theme";
import { Postmark } from "./marginalia";

const SCREEN_W = Dimensions.get("window").width;
const CARD_W = Math.round(SCREEN_W * 0.78);
const GAP = 14;
const CREAM = "#FAF6EE";

type Mood = {
  numeral: string;
  color: string;
  eyebrow: string;
  title: string;
  desc: string;
  category: string;
  photo: ImageProps["source"];
};

const MOODS: Mood[] = [
  {
    numeral: "I",
    color: "#6E5B33",
    eyebrow: "Amber · Cedarwood · Citrus",
    title: "Golden Hour",
    desc: "Sun-warmed resins over dry cedar — the glow that lingers after the light has gone.",
    category: "Warm",
    photo: require("../../../assets/ingredients/amber.webp"),
  },
  {
    numeral: "II",
    color: "#A5675D",
    eyebrow: "Rose · Jasmine · Vanilla",
    title: "Petals & Skin",
    desc: "A blush of Indian rose and night jasmine, settled into a warm vanilla musk.",
    category: "Floral",
    photo: require("../../../assets/ingredients/rose.webp"),
  },
  {
    numeral: "III",
    color: "#262338",
    eyebrow: "Oud · Smoke · Patchouli",
    title: "After Dark",
    desc: "Smoke-cured oud over damp patchouli — the deepest end of the Azimuth bearing.",
    category: "Woody",
    photo: require("../../../assets/ingredients/smoke.webp"),
  },
];

function MoodCard({ mood }: { mood: Mood }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/shop")}
      style={{ width: CARD_W, backgroundColor: mood.color, borderRadius: 6, overflow: "hidden" }}
      className="active:opacity-95"
    >
      {/* ghost numeral bleeding off the top-right */}
      <Text
        style={{
          position: "absolute",
          top: -46,
          right: -8,
          fontFamily: Fonts.serifBoldItalic,
          fontSize: 190,
          color: CREAM,
          opacity: 0.09,
        }}
      >
        {mood.numeral}
      </Text>

      {/* postmark */}
      <View style={{ position: "absolute", top: 14, left: 14 }}>
        <Postmark size={62} color={CREAM} opacity={0.55} />
      </View>

      {/* stamp-framed photo — frame tilts anticlockwise, photo stays upright */}
      <View className="items-center pt-16 pb-5">
        <View style={{ backgroundColor: CREAM, padding: 9, transform: [{ rotate: "-3deg" }] }}>
          <View style={{ borderWidth: 1, borderColor: "rgba(0,0,0,0.06)" }}>
            <View style={{ transform: [{ rotate: "3deg" }] }}>
              <Image
                source={mood.photo}
                style={{ width: Math.round(CARD_W * 0.52), height: Math.round(CARD_W * 0.64) }}
                contentFit="cover"
                transition={300}
              />
            </View>
          </View>
        </View>
      </View>

      {/* copy */}
      <View className="px-6 pb-7">
        <Text style={{ color: CREAM, opacity: 0.7 }} className="text-[9px] font-semibold tracking-[0.22em] uppercase">
          {mood.eyebrow}
        </Text>
        <Text style={{ fontFamily: Fonts.serifItalic, color: CREAM }} className="mt-2 text-[32px] leading-none">
          {mood.title}
        </Text>
        <Text style={{ color: CREAM, opacity: 0.78 }} className="mt-3 text-[12.5px] leading-[1.55]">
          {mood.desc}
        </Text>
        <View className="mt-5 flex-row items-center gap-2">
          <Text style={{ color: CREAM }} className="text-[10px] font-semibold tracking-[0.18em] uppercase">
            Explore {mood.category}
          </Text>
          <Text style={{ color: CREAM }} className="text-[13px]">→</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function MoodSection() {
  return (
    <View className="mt-14">
      <View className="px-6 pb-5">
        <Text style={{ color: Colors.accent }} className="text-[10px] font-semibold tracking-[0.28em] uppercase">
          Find your bearing
        </Text>
        <Text
          style={{ fontFamily: Fonts.serifMedium, color: Colors.ink }}
          className="mt-1.5 text-[30px] leading-[1.05]"
        >
          Three ways to{" "}
          <Text style={{ fontFamily: Fonts.serifItalic, color: Colors.accent }}>wear Azimuth.</Text>
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_W + GAP}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 24, gap: GAP }}
      >
        {MOODS.map((mood) => (
          <MoodCard key={mood.numeral} mood={mood} />
        ))}
      </ScrollView>
    </View>
  );
}
