import { useState } from "react";
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Search } from "lucide-react-native";

import { trpc } from "@/lib/trpc";
import { Fonts } from "@/constants/theme";

const CONCENTRATION_SHORT: Record<string, string> = {
  edp: "EDP", edt: "EDT", parfum: "Parfum", cologne: "Cologne", attar: "Attar",
};

export default function ShopScreen() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState("All");
  const [query, setQuery] = useState("");

  const { data: products = [], isLoading } = trpc.catalog.listProducts.useQuery({
    status: "active",
    limit: 50,
  });
  const { data: categories = [] } = trpc.catalog.listCategories.useQuery();

  const filtered = products
    .filter((p) => activeCategory === "All" || p.category?.name === activeCategory)
    .filter((p) => !query.trim() || p.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <View className="flex-1 bg-[#F5F0E7]">
      {/* ── Page heading ── */}
      <View className="px-6 pt-10 pb-8 border-b border-[#E3DDD1] bg-[#F5F0E7]">
        <Text className="text-[10px] font-semibold tracking-[0.36em] text-[#1B1611]/40 uppercase mb-3">
          Azimuth Perfumers
        </Text>
        <View className="flex-row items-baseline gap-2">
          <Text className="text-[34px] font-semibold tracking-[0.18em] text-[#1B1611] uppercase">
            The
          </Text>
          <Text
            className="text-[44px] tracking-tight text-[#9A5B2B] uppercase leading-none"
            style={{ fontFamily: Fonts.serifBoldItalic }}
          >
            Collection
          </Text>
        </View>
        <Text className="mt-2 text-[13px] text-[#1B1611]/50 leading-relaxed">
          {products.length} fragrances · in stock
        </Text>
      </View>

      {/* ── Search ── */}
      <View className="px-6 pt-4 pb-4 bg-[#F5F0E7]">
        <View className="flex-row items-center gap-2.5 border border-[#E3DDD1] px-3.5 py-3">
          <Search size={14} color="#8A7A63" strokeWidth={1.6} />
          <TextInput
            className="flex-1 text-[13px] text-[#1B1611] p-0"
            placeholder="Rose, oud, amber…"
            placeholderTextColor="#8A7A63"
            value={query}
            onChangeText={setQuery}
          />
        </View>
      </View>

      {/* ── Category filter ── */}
      <View className="border-b border-[#E3DDD1] bg-[#F5F0E7]">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 0 }}
        >
          {["All", ...categories.map((c) => c.name)].map((cat) => {
            const active = cat === activeCategory;
            return (
              <Pressable
                key={cat}
                onPress={() => setActiveCategory(cat)}
                className="py-3 mr-1"
              >
                <View
                  className="px-4 py-2"
                  style={{
                    backgroundColor: active ? "#1B1611" : "transparent",
                    borderWidth: 1,
                    borderColor: active ? "#1B1611" : "#E3DDD1",
                  }}
                >
                  <Text
                    className="text-[10px] font-semibold tracking-[0.18em] uppercase"
                    style={{ color: active ? "#ffffff" : "#57493A" }}
                  >
                    {cat}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Product grid ── */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-[10px] font-semibold tracking-[0.28em] text-[#57493A] uppercase">
            Loading…
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 1, backgroundColor: "#E3DDD1" }}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: "#E3DDD1" }} />}
          contentContainerStyle={{ paddingBottom: 32 }}
          ListEmptyComponent={
            <View className="py-24 items-center">
              <Text className="text-[10px] font-semibold tracking-[0.28em] text-[#57493A] uppercase">
                No fragrances found
              </Text>
            </View>
          }
          renderItem={({ item: p }) => {
            const activeVariants = p.variants.filter((v) => v.status === "active");
            const defaultVariant = activeVariants.find((v) => v.isDefault) ?? activeVariants[0];
            const image = p.images.find((i) => i.isPrimary) ?? p.images[0];
            const fromPrice = activeVariants.length > 0
              ? Math.min(...activeVariants.map((v) => v.effectivePrice ?? Number(v.mrp)))
              : null;
            const bg = p.themeColor ?? "#e8e0d5";
            const slug = p.slug ?? p.id;
            const isSingle = activeVariants.length === 1;

            return (
              <Pressable
                className="flex-1 bg-[#F5F0E7] active:opacity-90"
                onPress={() => router.push(`/product/${slug}`)}
              >
                {/* Image box — square */}
                <View className="w-full aspect-square overflow-hidden" style={{ backgroundColor: bg }}>
                  {image?.url ? (
                    <Image source={{ uri: image.url }} className="w-full h-full" contentFit="cover" />
                  ) : (
                    <View className="flex-1 items-end justify-end p-3">
                      <Text
                        className="text-white/40 text-lg"
                        style={{ fontFamily: Fonts.serifItalic }}
                        numberOfLines={1}
                      >
                        {p.name}
                      </Text>
                    </View>
                  )}

                  {/* Sizes badge */}
                  {activeVariants.length > 1 && (
                    <View className="absolute bottom-2 left-2 bg-white/80 px-2 py-0.5">
                      <Text className="text-[8px] font-semibold tracking-[0.12em] text-[#1B1611] uppercase">
                        {activeVariants.length} sizes
                      </Text>
                    </View>
                  )}
                </View>

                {/* Color accent line */}
                <View className="h-[2px]" style={{ backgroundColor: bg }} />

                {/* Card body */}
                <View className="px-3 pt-3 pb-1">
                  <Text
                    className="text-[15px] tracking-tight text-[#1B1611] leading-snug"
                    style={{ fontFamily: Fonts.serifItalic }}
                    numberOfLines={1}
                  >
                    {p.name}
                  </Text>
                  <Text className="mt-0.5 text-[9.5px] tracking-[0.1em] text-[#57493A] uppercase" numberOfLines={1}>
                    {defaultVariant &&
                      (CONCENTRATION_SHORT[defaultVariant.concentration] ?? defaultVariant.concentration)}
                    {p.category ? ` · ${p.category.name}` : ""}
                  </Text>
                  {fromPrice !== null && (
                    <Text className="mt-1.5 text-[13.5px] font-semibold text-[#1B1611]">
                      ₹{Number(fromPrice).toLocaleString("en-IN")}
                    </Text>
                  )}
                </View>

                {/* CTA */}
                <Pressable
                  className="mx-3 mb-3 mt-2 h-9 items-center justify-center border border-[#E3DDD1] active:bg-[#1B1611] active:border-[#1B1611]"
                  onPress={() => router.push(`/product/${slug}`)}
                >
                  <Text className="text-[10px] font-semibold tracking-[0.18em] text-[#1B1611] uppercase">
                    {isSingle ? "Add to Cart" : "Choose Size"}
                  </Text>
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
