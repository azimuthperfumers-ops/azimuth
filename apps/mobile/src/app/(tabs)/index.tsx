import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";

import { trpc } from "@/lib/trpc";
import { Ticker } from "@/components/ticker";
import { AppHeader } from "@/components/app-header";

const CONCENTRATION_SHORT: Record<string, string> = {
  edp: "EDP", edt: "EDT", parfum: "Parfum", cologne: "Cologne", attar: "Attar",
};

const VALUES = [
  { label: "SMALL BATCHES", sub: "Each run under 200 units" },
  { label: "NATURAL BASES", sub: "Resins, ouds & florals" },
  { label: "PAN-INDIA", sub: "Delivered to your door" },
  { label: "NO MIDDLEMEN", sub: "Direct from our lab" },
];

export default function HomeScreen() {
  const router = useRouter();
  const { data: products = [] } = trpc.catalog.listProducts.useQuery({ status: "active", limit: 12 });
  const { data: heroData } = trpc.content.getSection.useQuery({ section: "home_hero" });

  const hero = {
    line1: (heroData?.line1 as string | undefined) ?? "Scent,",
    line2: (heroData?.line2 as string | undefined) ?? "composed",
    italic: (heroData?.italic as string | undefined) ?? "like memory.",
    subtitle:
      (heroData?.subtitle as string | undefined) ??
      "Eaux de parfum blended in small batches — naturals, resins and time, until an accord becomes unmistakably yours.",
  };

  return (
    <ScrollView className="flex-1 bg-[#faf8f5]" bounces>
      <Ticker />
      <AppHeader />

      {/* ── Hero ── */}
      <View className="px-6 pt-12 pb-16 bg-[#faf8f5]">
        <Text className="text-[9.5px] font-semibold tracking-[0.36em] text-[#111111]/40 uppercase mb-6">
          Azimuth Perfumers · Est. 2019
        </Text>

        {/* Red line accent */}
        <View className="w-10 h-px bg-[#c0392b] mb-6" />

        <Text className="text-[52px] font-semibold leading-[1.0] tracking-tight text-[#111111]">
          {hero.line1}
        </Text>
        <Text className="text-[52px] font-semibold leading-[1.0] tracking-tight text-[#111111]">
          {hero.line2}
        </Text>
        <Text
          className="text-[64px] font-medium leading-[0.9] tracking-tight text-[#c0392b] -ml-0.5 mt-0.5"
          style={{ fontStyle: "italic" }}
        >
          {hero.italic}
        </Text>

        <Text className="mt-8 text-[14px] leading-[1.8] text-[#111111]/60 max-w-xs">
          {hero.subtitle}
        </Text>

        <View className="mt-8 flex-row items-center gap-5">
          <Pressable
            className="h-11 px-8 items-center justify-center bg-[#111111] active:opacity-70"
            onPress={() => router.push("/shop")}
          >
            <Text className="text-white text-[10px] font-semibold tracking-[0.22em] uppercase">
              Shop now
            </Text>
          </Pressable>
          <Pressable onPress={() => {}}>
            <Text className="text-[10.5px] font-semibold tracking-[0.18em] uppercase text-[#111111]/60">
              Our story →
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── Collection ── */}
      <View className="py-12">
        {/* Heading */}
        <View className="items-center mb-10 px-4">
          <Text className="text-[10px] font-semibold tracking-[0.36em] text-[#111111]/40 uppercase mb-2">
            Azimuth Perfumers
          </Text>
          <Text className="text-[36px] font-semibold tracking-[0.22em] text-[#111111] uppercase leading-tight">
            The
          </Text>
          <Text
            className="text-[56px] font-extrabold tracking-tight text-[#c0392b] uppercase leading-[0.88]"
            style={{ fontStyle: "italic" }}
          >
            Collection
          </Text>
        </View>

        {/* Horizontal product cards */}
        <FlatList
          horizontal
          data={products}
          keyExtractor={(p) => p.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}
          snapToInterval={312 + 16}
          decelerationRate="fast"
          renderItem={({ item: p }) => {
            const activeVariants = p.variants.filter((v) => v.status === "active");
            const image = p.images.find((i) => i.isPrimary) ?? p.images[0];
            const fromPrice = activeVariants.length > 0
              ? Math.min(...activeVariants.map((v) => v.effectivePrice ?? Number(v.mrp)))
              : null;
            const bg = p.themeColor ?? "#e8e0d5";
            const slug = p.slug ?? p.id;
            const isSingle = activeVariants.length === 1;

            return (
              <Pressable
                className="w-[312px] active:opacity-90"
                onPress={() => router.push(`/product/${slug}`)}
              >
                {/* Image */}
                <View className="aspect-[3/4] w-full overflow-hidden" style={{ backgroundColor: bg }}>
                  {image?.url ? (
                    <Image source={{ uri: image.url }} className="w-full h-full" contentFit="cover" />
                  ) : (
                    <View className="flex-1 items-end justify-end p-6">
                      <Text className="text-white/50 text-3xl font-medium" style={{ fontStyle: "italic" }}>
                        {p.name}
                      </Text>
                    </View>
                  )}

                  {/* Badges */}
                  {activeVariants.length > 1 && (
                    <View className="absolute bottom-3 left-3 bg-white/80 px-2.5 py-1">
                      <Text className="text-[9px] font-semibold tracking-[0.14em] text-[#111111] uppercase">
                        {activeVariants.length} sizes
                      </Text>
                    </View>
                  )}
                </View>

                {/* Color rule */}
                <View className="h-[2px] w-full" style={{ backgroundColor: bg }} />

                {/* Info */}
                <View className="pt-4 pb-3">
                  <Text className="text-[17.5px] font-medium tracking-tight text-[#111111]" style={{ fontStyle: "italic" }}>
                    {p.name}
                  </Text>
                  <View className="mt-1.5 flex-row items-center justify-between">
                    <Text className="text-[10.5px] tracking-[0.1em] text-[#111111]/50 uppercase">
                      {CONCENTRATION_SHORT[p.concentration] ?? p.concentration}
                      {p.category ? ` · ${p.category.name}` : ""}
                    </Text>
                    {fromPrice !== null && (
                      <Text className="text-[14px] font-semibold text-[#111111]">
                        ₹{Number(fromPrice).toLocaleString("en-IN")}
                      </Text>
                    )}
                  </View>
                </View>

                {/* CTA */}
                <Pressable
                  className="h-11 w-full items-center justify-center border border-[#e8e2da] active:bg-[#111111] active:border-[#111111]"
                  onPress={() => router.push(`/product/${slug}`)}
                >
                  <Text className="text-[11px] font-semibold tracking-[0.18em] text-[#111111] uppercase">
                    {isSingle ? "Add to Cart" : "Choose Size"}
                  </Text>
                </Pressable>
              </Pressable>
            );
          }}
        />

        {/* View all */}
        <View className="mt-12 items-center px-6">
          <Pressable
            className="h-11 px-10 items-center justify-center border border-[#111111] active:bg-[#111111]"
            onPress={() => router.push("/shop")}
          >
            <Text className="text-[10.5px] font-semibold tracking-[0.2em] text-[#111111] uppercase">
              View all fragrances
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── Brand statement ── */}
      <View className="bg-[#111111] py-16 px-6 items-center">
        <Text className="text-[11px] font-semibold tracking-[0.32em] text-white/50 uppercase mb-6">
          The Azimuth Way
        </Text>
        <Text
          className="text-[32px] font-medium leading-[1.1] text-white text-center max-w-xs"
          style={{ fontStyle: "italic" }}
        >
          {'"An accord becomes unmistakably yours."'}
        </Text>
      </View>

      {/* ── Values strip ── */}
      <View className="border-y border-[#e8e2da]">
        <View className="flex-row flex-wrap">
          {VALUES.map(({ label, sub }, i) => (
            <View
              key={label}
              className="w-1/2 py-8 px-4 items-center border-[#e8e2da]"
              style={{
                borderRightWidth: i % 2 === 0 ? 1 : 0,
                borderBottomWidth: i < 2 ? 1 : 0,
              }}
            >
              <Text className="text-[11px] font-semibold tracking-[0.18em] text-[#111111] uppercase text-center">
                {label}
              </Text>
              <Text className="mt-1.5 text-[12px] text-[#888888] text-center">{sub}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Footer ── */}
      <View className="px-6 py-12 border-t border-[#e8e2da]">
        <Text className="text-[22px] font-semibold tracking-[0.22em] text-[#111111]">AZIMUTH</Text>
        <Text className="text-[7.5px] tracking-[0.55em] text-[#888888] mb-5">PERFUMERS</Text>
        <Text className="text-[13px] leading-relaxed text-[#888888] mb-10 max-w-64">
          A house of slow perfumery. Composed in small batches, delivered pan-India.
        </Text>

        <View className="flex-row gap-12 mb-10">
          <View>
            <Text className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#111111] mb-4">Shop</Text>
            <Pressable onPress={() => router.push("/shop")}>
              <Text className="text-[13px] text-[#888888]">All fragrances</Text>
            </Pressable>
          </View>
          <View>
            <Text className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#111111] mb-4">Care</Text>
            <Pressable onPress={() => router.push("/support/index")}>
              <Text className="text-[13px] text-[#888888]">Contact us</Text>
            </Pressable>
          </View>
        </View>

        <Text className="text-[11px] text-[#bbb]">© 2026 Azimuth Perfumers</Text>
      </View>
    </ScrollView>
  );
}
