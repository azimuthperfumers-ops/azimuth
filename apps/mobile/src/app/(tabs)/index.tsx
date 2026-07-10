import { Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ChevronDown } from "lucide-react-native";

import { HeroBannerCarousel, type HeroCopy } from "@/components/hero-banner-carousel";
import { HeroProductShowcase } from "@/components/hero-product-showcase";
import { trpc } from "@/lib/trpc";
import { Colors, Fonts } from "@/constants/theme";

const CONCENTRATION_SHORT: Record<string, string> = {
  edp: "EDP", edt: "EDT", parfum: "Parfum", cologne: "Cologne", attar: "Attar",
};

const NEUTRAL_FALLBACK = "#EDE3D0";

const CRAFT_STEPS = [
  {
    step: "01",
    title: "Sourcing",
    body: "Naturals first — resins, ouds and florals bought whole from growers we know.",
  },
  {
    step: "02",
    title: "Maceration",
    body: "Every blend rests for weeks, not days, until the accord settles into itself.",
  },
  {
    step: "03",
    title: "Bottling",
    body: "Filled, labelled and sealed by hand in runs under 200 units.",
  },
];

const VALUES = [
  { label: "Small Batches", sub: "Each run under 200 units" },
  { label: "Natural Bases", sub: "Resins, ouds & florals" },
  { label: "Pan-India", sub: "Delivered to your door" },
  { label: "No Middlemen", sub: "Direct from our lab" },
];

function ProductThumb({ url, name }: { url: string | undefined; name: string }) {
  if (url) {
    return <Image source={{ uri: url }} className="w-full h-full" contentFit="cover" />;
  }
  return (
    <View className="flex-1 items-end justify-end p-3" style={{ backgroundColor: NEUTRAL_FALLBACK }}>
      <Text
        numberOfLines={1}
        className="text-[#8A7A63] text-[9px] tracking-[1px] uppercase"
        style={{ fontFamily: "monospace" }}
      >
        {name}
      </Text>
    </View>
  );
}

function SectionEyebrow({ children }: { children: string }) {
  return (
    <Text
      className="text-[10px] font-semibold tracking-[0.28em] uppercase"
      style={{ color: Colors.inkMuted }}
    >
      {children}
    </Text>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { data: products = [] } = trpc.catalog.listProducts.useQuery({ status: "active", limit: 24 });
  const { data: banners = [] } = trpc.content.listBanners.useQuery({ page: "home" });
  const { data: heroContent } = trpc.content.getSection.useQuery({ section: "home_hero" });

  const copy: HeroCopy = {
    line1: (heroContent?.line1 as string | undefined) ?? "Worn close.",
    line2: (heroContent?.line2 as string | undefined) ?? "",
    italic: (heroContent?.italic as string | undefined) ?? "Remembered longer.",
    subtitle:
      (heroContent?.subtitle as string | undefined) ??
      "Fragrances composed by hand from naturals, resins and time — blended in batches so small, every bottle still smells like the room it was made in.",
  };

  const activeBanners = banners.filter((b) => b.active);

  // Featured products float to the front (parity with web landing).
  const ranked = products
    .slice()
    .sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
  const featured = ranked[0];
  const collection = ranked.slice(0, 8);

  // Hero carousel: admin-chosen product ids (ordered), else the featured-first list.
  const heroIds = (heroContent?.productIds as string[] | undefined) ?? [];
  const byId = new Map(products.map((p) => [p.id, p]));
  const chosen = heroIds.map((id) => byId.get(id)).filter((p): p is (typeof products)[number] => !!p);
  const heroProducts = chosen.length > 0 ? chosen : ranked.slice(0, 5);

  function priceOf(p: (typeof products)[number]) {
    const activeVariants = p.variants.filter((v) => v.status === "active");
    const defaultVariant = activeVariants.find((v) => v.isDefault) ?? activeVariants[0];
    const price = defaultVariant ? (defaultVariant.effectivePrice ?? Number(defaultVariant.mrp)) : null;
    const mrp = defaultVariant ? Number(defaultVariant.mrp) : null;
    return { defaultVariant, price, mrp, discount: price !== null && mrp !== null && price < mrp };
  }

  return (
    <ScrollView className="flex-1" style={{ backgroundColor: Colors.background }} bounces>
      {/* ── Hero: banners → product showcase → typographic fallback ── */}
      {activeBanners.length > 0 ? (
        <HeroBannerCarousel banners={banners} copy={copy} />
      ) : heroProducts.length > 0 ? (
        <HeroProductShowcase products={heroProducts} copy={copy} />
      ) : (
        <View className="px-6 pt-7 pb-2">
          <SectionEyebrow>Azimuth Perfumers · Est. 2019</SectionEyebrow>
          <Text
            className="mt-3 text-[54px] leading-[0.98] tracking-tight"
            style={{ fontFamily: Fonts.serifMedium, color: Colors.ink }}
          >
            {copy.line1}{"\n"}
            <Text style={{ fontFamily: Fonts.serifItalic, color: Colors.accent }}>{copy.italic}</Text>
          </Text>

          <Text className="mt-5 text-[13px] leading-[1.6]" style={{ color: Colors.inkMuted }}>
            {copy.subtitle}
          </Text>

          <Pressable
            className="mt-7 h-14 items-center justify-center bg-[#1B1611] active:opacity-70"
            onPress={() => router.push("/shop")}
          >
            <Text className="text-white text-[11px] font-semibold tracking-[0.25em] uppercase">
              Explore the Collection
            </Text>
          </Pressable>

          <View className="items-center mt-4">
            <ChevronDown size={16} color={Colors.accent} strokeWidth={1.6} />
          </View>
        </View>
      )}

      {/* ── The Collection ── */}
      {collection.length > 0 && (
        <View className="mt-10">
          <View className="px-6 flex-row items-end justify-between pb-4">
            <View>
              <SectionEyebrow>Azimuth Perfumers</SectionEyebrow>
              <Text
                className="mt-1 text-[30px] leading-none"
                style={{ fontFamily: Fonts.serifMedium, color: Colors.ink }}
              >
                The{" "}
                <Text style={{ fontFamily: Fonts.serifItalic, color: Colors.accent }}>Collection</Text>
              </Text>
            </View>
            <Pressable onPress={() => router.push("/shop")}>
              <Text
                className="text-[10px] font-semibold tracking-[0.14em] uppercase underline"
                style={{ color: Colors.ink }}
              >
                See all
              </Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={216}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}
          >
            {collection.map((p) => {
              const { price, defaultVariant } = priceOf(p);
              const image = p.images.find((img) => img.isPrimary) ?? p.images[0];
              const slug = p.slug ?? p.id;
              const bg = p.themeColor ?? NEUTRAL_FALLBACK;
              return (
                <Pressable
                  key={p.id}
                  className="w-[204px] active:opacity-85"
                  onPress={() => router.push(`/product/${slug}`)}
                >
                  <View className="w-full aspect-[3/4] overflow-hidden" style={{ backgroundColor: bg }}>
                    <ProductThumb url={image?.url} name={p.name} />
                  </View>
                  <View className="h-[2px]" style={{ backgroundColor: bg }} />
                  <Text
                    numberOfLines={1}
                    className="mt-2 text-[17px]"
                    style={{ fontFamily: Fonts.serifMedium, color: Colors.ink }}
                  >
                    {p.name}
                  </Text>
                  <View className="flex-row items-center justify-between mt-0.5">
                    <Text className="text-[9.5px] tracking-[0.1em] uppercase" style={{ color: Colors.inkMuted }}>
                      {defaultVariant &&
                        (CONCENTRATION_SHORT[defaultVariant.concentration] ?? defaultVariant.concentration)}
                    </Text>
                    <Text className="text-[13px] font-semibold" style={{ color: Colors.ink }}>
                      ₹{price !== null ? Number(price).toLocaleString("en-IN") : "—"}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}


      {/* ── Featured composition ── */}
      {featured && (() => {
        const { price, mrp, discount } = priceOf(featured);
        const image = featured.images.find((img) => img.isPrimary) ?? featured.images[0];
        const slug = featured.slug ?? featured.id;
        const variant = featured.variants.find((v) => v.isDefault) ?? featured.variants[0];
        return (
          <View className="mt-12 px-6">
            <Text
              className="text-[10px] font-semibold tracking-[0.28em] uppercase"
              style={{ color: Colors.accent }}
            >
              Featured composition
            </Text>
            <Pressable
              className="mt-4 flex-row active:opacity-90"
              style={{ backgroundColor: Colors.surface }}
              onPress={() => router.push(`/product/${slug}`)}
            >
              <View className="w-[45%] aspect-[3/4]" style={{ position: "relative" }}>
                {discount && (
                  <View className="absolute top-2.5 left-2.5 z-10 bg-[#F5F0E7] px-2 py-1">
                    <Text className="text-[8px] font-semibold tracking-[0.1em]" style={{ color: Colors.ink }}>
                      {Math.round((1 - price! / mrp!) * 100)}% OFF
                    </Text>
                  </View>
                )}
                <ProductThumb url={image?.url} name={featured.name} />
              </View>

              <View className="flex-1 p-4 justify-between">
                <View>
                  <Text className="text-[8.5px] font-semibold tracking-[0.14em] uppercase" style={{ color: Colors.inkMuted }}>
                    {variant && (CONCENTRATION_SHORT[variant.concentration] ?? variant.concentration)}
                    {featured.category ? ` · ${featured.category.name}` : ""}
                  </Text>
                  <Text
                    className="mt-1.5 text-[22px] leading-none"
                    style={{ fontFamily: Fonts.serifMedium, color: Colors.ink }}
                  >
                    {featured.name}
                  </Text>
                  {featured.description ? (
                    <Text
                      numberOfLines={3}
                      className="mt-2.5 text-[12px] leading-[1.35]"
                      style={{ fontFamily: Fonts.serifItalic, color: "#57493A" }}
                    >
                      {featured.description}
                    </Text>
                  ) : null}
                </View>
                <View className="flex-row items-center justify-between mt-3">
                  <Text className="text-[15px]" style={{ fontFamily: Fonts.serifMedium, color: Colors.ink }}>
                    ₹{price !== null ? Number(price).toLocaleString("en-IN") : "—"}
                  </Text>
                  <View className="bg-[#1B1611] px-3.5 py-2">
                    <Text className="text-white text-[9px] font-semibold tracking-[0.14em] uppercase">
                      Discover →
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          </View>
        );
      })()}

      {/* ── Brand statement ── */}
      <View className="mt-12 bg-[#1B1611] px-8 py-14 items-center">
        <Text className="text-[9.5px] font-semibold tracking-[0.3em] text-white/45 uppercase">
          The Azimuth way
        </Text>
        <Text
          className="mt-5 text-[27px] leading-[1.15] text-white text-center"
          style={{ fontFamily: Fonts.serifItalic }}
        >
          &quot;An accord becomes unmistakably yours.&quot;
        </Text>
      </View>

      {/* ── The craft ── */}
      <View className="px-6 py-12">
        <SectionEyebrow>The craft</SectionEyebrow>
        <Text
          className="mt-1 text-[30px] leading-[1.05]"
          style={{ fontFamily: Fonts.serifMedium, color: Colors.ink }}
        >
          Composed by hand,{" "}
          <Text style={{ fontFamily: Fonts.serifItalic, color: Colors.accent }}>in small batches.</Text>
        </Text>

        <View className="mt-6 border-t" style={{ borderColor: Colors.border }}>
          {CRAFT_STEPS.map(({ step, title, body }) => (
            <View
              key={step}
              className="flex-row gap-4 py-5 border-b"
              style={{ borderColor: Colors.border }}
            >
              <Text
                className="text-[20px] w-9"
                style={{ fontFamily: Fonts.serifItalic, color: Colors.accent }}
              >
                {step}
              </Text>
              <View className="flex-1">
                <Text
                  className="text-[11px] font-semibold tracking-[0.18em] uppercase"
                  style={{ color: Colors.ink }}
                >
                  {title}
                </Text>
                <Text className="mt-1.5 text-[12.5px] leading-[1.6]" style={{ color: "#57493A" }}>
                  {body}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <Pressable className="mt-6" onPress={() => router.push("/our-story")}>
          <Text
            className="text-[10px] font-semibold tracking-[0.18em] uppercase underline"
            style={{ color: Colors.ink }}
          >
            Read our story →
          </Text>
        </Pressable>
      </View>

      {/* ── Values ── */}
      <View className="border-t flex-row flex-wrap" style={{ borderColor: Colors.border }}>
        {VALUES.map(({ label, sub }, i) => (
          <View
            key={label}
            className="w-1/2 items-center px-4 py-7 border-b"
            style={{
              borderColor: Colors.border,
              borderRightWidth: i % 2 === 0 ? 1 : 0,
            }}
          >
            <Text
              className="text-[10px] font-semibold tracking-[0.16em] uppercase text-center"
              style={{ color: Colors.ink }}
            >
              {label}
            </Text>
            <Text className="mt-1 text-[11px] text-center" style={{ color: Colors.inkMuted }}>
              {sub}
            </Text>
          </View>
        ))}
      </View>

      {/* ── Footer ── */}
      <View className="px-6 pt-10 pb-12 items-center">
        <Text
          className="text-[13px] text-center"
          style={{ fontFamily: Fonts.serifItalic, color: Colors.inkMuted }}
        >
          Handcrafted in Ajmer · shipped pan-India
        </Text>
        <View className="flex-row gap-6 mt-3">
          <Pressable onPress={() => router.push("/our-story")}>
            <Text className="text-[9px] font-semibold tracking-[0.18em] uppercase" style={{ color: Colors.inkMuted }}>
              Our Story
            </Text>
          </Pressable>
          <Pressable onPress={() => router.push("/support/index")}>
            <Text className="text-[9px] font-semibold tracking-[0.18em] uppercase" style={{ color: Colors.inkMuted }}>
              Support
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
