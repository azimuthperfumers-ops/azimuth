import { Dimensions, ScrollView, Text, View } from "react-native";

import { Colors, Fonts } from "@/constants/theme";
import { VerifiedTick } from "./marginalia";

const SCREEN_W = Dimensions.get("window").width;
const CARD_W = Math.round(SCREEN_W * 0.74);
const GAP = 14;
const CREAM = "#FAF6EE";

type Review = { body: string; name: string; city: string; color: string; rotate: string };

const REVIEWS: Review[] = [
  {
    body: "Wore it to a wedding and three people stopped me to ask. It softens through the day into something that feels like skin.",
    name: "Megha R.",
    city: "Delhi",
    color: "#2E2C42",
    rotate: "-1.6deg",
  },
  {
    body: "I've bought a lot of niche oud. This is the first that smells resinous and real, not like a candle. Batch number on the box is a nice touch.",
    name: "Arjun S.",
    city: "Mumbai",
    color: "#1B1611",
    rotate: "1.2deg",
  },
  {
    body: "The rose one is unreal — warm, a little dirty, never sweet. Ordered a second bottle before the first ran out.",
    name: "Ishita K.",
    city: "Bengaluru",
    color: "#9A5B2B",
    rotate: "-0.8deg",
  },
];

function ReviewCard({ review }: { review: Review }) {
  return (
    <View
      style={{
        width: CARD_W,
        backgroundColor: review.color,
        borderRadius: 6,
        transform: [{ rotate: review.rotate }],
      }}
      className="px-6 pt-4 pb-6"
    >
      <Text style={{ fontFamily: Fonts.serifBoldItalic, color: CREAM, opacity: 0.35 }} className="text-[52px] leading-[0.6]">
        &ldquo;
      </Text>
      <Text style={{ fontFamily: Fonts.serifItalic, color: CREAM }} className="mt-1 text-[17px] leading-[1.4]">
        {review.body}
      </Text>
      <View className="mt-5 flex-row items-center gap-2">
        <VerifiedTick size={13} color={CREAM} />
        <Text style={{ color: CREAM, opacity: 0.85 }} className="text-[9px] font-semibold tracking-[0.14em] uppercase">
          Verified buyer
        </Text>
      </View>
      <Text style={{ color: CREAM }} className="mt-2 text-[13px] font-semibold tracking-[0.06em]">
        {review.name}
        <Text style={{ opacity: 0.6 }} className="font-normal">  ·  {review.city}</Text>
      </Text>
    </View>
  );
}

export function ReviewsStrip() {
  return (
    <View className="mt-14" style={{ backgroundColor: Colors.background }}>
      <View className="px-6 pb-6">
        <Text style={{ color: Colors.accent }} className="text-[10px] font-semibold tracking-[0.28em] uppercase">
          Word of mouth
        </Text>
        <Text
          style={{ fontFamily: Fonts.serifMedium, color: Colors.ink }}
          className="mt-1.5 text-[30px] leading-[1.05]"
        >
          Worn. Remembered.{" "}
          <Text style={{ fontFamily: Fonts.serifItalic, color: Colors.accent }}>Written in.</Text>
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_W + GAP}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 24, gap: GAP, paddingVertical: 10 }}
      >
        {REVIEWS.map((review) => (
          <ReviewCard key={review.name} review={review} />
        ))}
      </ScrollView>
    </View>
  );
}
