import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";

import { trpc } from "@/lib/trpc";
import { Colors, Fonts } from "@/constants/theme";

const DEFAULT_ORIGIN_BLOCKQUOTE =
  "An azimuth is a bearing — a precise angle from true north. We chose that name because every fragrance we build is a direction, not a decoration.";
const DEFAULT_PULLQUOTE =
  "Most fragrance is built to please everyone and so pleases no one deeply. We build to please the one person who has been looking for exactly this.";

const STATS = [
  { value: "40", label: "Bottles per batch" },
  { value: "6", label: "Fragrances" },
  { value: "18", label: "Months to mature" },
  { value: "100%", label: "Naturals & resins" },
];

export default function OurStoryScreen() {
  const router = useRouter();
  const { data } = trpc.content.getSection.useQuery({ section: "our_story" });

  const originBlockquote = (data?.originBlockquote as string | undefined) ?? DEFAULT_ORIGIN_BLOCKQUOTE;
  const pullquote = (data?.pullquote as string | undefined) ?? DEFAULT_PULLQUOTE;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: Colors.background }} edges={["top", "bottom"]}>
      {/* ── Header ── */}
      <View className="flex-row items-center justify-center px-5 py-3.5 relative">
        <Pressable onPress={() => router.back()} className="absolute left-5 p-1">
          <ChevronLeft size={20} color={Colors.ink} strokeWidth={1.8} />
        </Pressable>
        <Text
          className="text-[15px] tracking-[0.24em] font-semibold"
          style={{ color: Colors.ink }}
        >
          AZIMUTH
        </Text>
      </View>

      <ScrollView bounces contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ── Masthead ── */}
        <View className="px-6 pt-4">
          <Text
            className="text-[10px] font-semibold tracking-[0.28em] uppercase mb-2.5"
            style={{ color: Colors.inkMuted }}
          >
            Our Story · Est. 2019
          </Text>
          <Text
            className="text-[38px] leading-[1] tracking-tight"
            style={{ fontFamily: Fonts.serifMedium, color: Colors.ink }}
          >
            A house of{"\n"}
            <Text style={{ fontFamily: Fonts.serifItalic, color: Colors.accent }}>slow</Text> perfumery.
          </Text>
        </View>

        {/* ── Portrait block ── */}
        <View
          className="mx-6 mt-5 h-[190px] items-start justify-end p-3.5"
          style={{ backgroundColor: "#b8a682" }}
        >
          <Text className="text-[9px] tracking-[0.14em]" style={{ color: Colors.background }}>
            // FOUNDER PORTRAIT · JODHPUR STUDIO
          </Text>
        </View>

        {/* ── Intro ── */}
        <View className="px-6 pt-6">
          <Text
            className="text-[17px] leading-[1.5]"
            style={{ fontFamily: Fonts.serif, color: "#2a2418" }}
          >
            {originBlockquote}
          </Text>

          {/* Stat grid */}
          <View className="flex-row flex-wrap mt-6 -mx-2">
            {STATS.map((s) => (
              <View key={s.label} className="w-1/2 px-2 mb-5">
                <Text
                  className="text-[30px]"
                  style={{ fontFamily: Fonts.serifMedium, color: Colors.accent }}
                >
                  {s.value}
                </Text>
                <Text
                  className="mt-0.5 text-[9px] tracking-[0.16em] uppercase"
                  style={{ color: Colors.inkMuted }}
                >
                  {s.label}
                </Text>
              </View>
            ))}
          </View>

          {/* Pullquote */}
          <View className="pt-5 border-t" style={{ borderColor: Colors.border }}>
            <Text
              className="text-[18px] leading-[1.4]"
              style={{ fontFamily: Fonts.serifItalic, color: Colors.ink }}
            >
              &ldquo;{pullquote}&rdquo;
            </Text>
            <Text
              className="mt-2.5 text-[9px] tracking-[0.16em] uppercase"
              style={{ color: Colors.inkMuted }}
            >
              — Founder, Azimuth Perfumers
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
