import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import type { NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Heart } from "lucide-react-native";

import { trpc } from "@/lib/trpc";
import { useSession } from "@/hooks/use-session";
import { Colors, Fonts } from "@/constants/theme";
import { ProductOffers } from "@/components/product-offers";

// Rating under the product name — hidden when real mode has zero ratings
function ProductRatingLine({ productId }: { productId: string }) {
  const { data } = trpc.rating.forProducts.useQuery(
    { productIds: [productId] },
    { staleTime: 5 * 60 * 1000 },
  );
  const rating = data?.[productId];
  if (!rating) return null;
  return (
    <View className="flex-row items-center gap-2 mb-4">
      <Text className="text-[15px] text-[#1B1611]">
        {"★".repeat(Math.round(rating.rating))}
        <Text style={{ color: "#C9BFAE" }}>{"☆".repeat(5 - Math.round(rating.rating))}</Text>
      </Text>
      <Text className="text-[12px] font-semibold text-[#1B1611]">{rating.rating.toFixed(1)}</Text>
      <Text className="text-[11px] text-[#57493A]">({rating.count})</Text>
    </View>
  );
}

const CONCENTRATION_LABEL: Record<string, string> = {
  edp: "Eau de Parfum", edt: "Eau de Toilette", parfum: "Parfum",
  cologne: "Cologne", attar: "Attar",
};

const CONCENTRATION_SHORT: Record<string, string> = {
  edp: "EDP", edt: "EDT", parfum: "Parfum", cologne: "Cologne", attar: "Attar",
};

const NOTE_POSITION_LABEL: Record<string, string> = {
  top: "Top", mid: "Heart", base: "Base",
};

const AUTO_SCROLL_MS = 13000;

function DotRating({ value, max }: { value: number; max: number }) {
  return (
    <View className="flex-row gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <View
          key={i}
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: i < value ? "#1B1611" : "#E3DDD1" }}
        />
      ))}
    </View>
  );
}

function ImageCarousel({
  images, bg, productName,
}: {
  images: { url: string }[];
  bg: string;
  productName: string;
}) {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const indexRef = useRef(0);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length < 2) return;
    const timer = setInterval(() => {
      const next = (indexRef.current + 1) % images.length;
      indexRef.current = next;
      setIndex(next);
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
    }, AUTO_SCROLL_MS);
    return () => clearInterval(timer);
  }, [images.length, width]);

  function onMomentumEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    indexRef.current = next;
    setIndex(next);
  }

  if (images.length === 0) {
    return (
      <View className="aspect-[3/4] w-full items-end justify-end p-8" style={{ backgroundColor: bg }}>
        <Text className="text-white/40 text-4xl" style={{ fontFamily: Fonts.serifMedium }}>
          {productName}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ position: "relative" }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
      >
        {images.map((img, i) => (
          <Image
            key={i}
            source={{ uri: img.url }}
            style={{ width, aspectRatio: 3 / 4 }}
            contentFit="cover"
          />
        ))}
      </ScrollView>

      {images.length > 1 && (
        <View className="absolute bottom-3 left-0 right-0 flex-row items-center justify-center gap-1.5">
          {images.map((_, i) => (
            <View
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: i === index ? "#fff" : "rgba(255,255,255,0.4)" }}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export default function ProductDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { session } = useSession();
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const { data: product, isLoading } = trpc.catalog.getProductBySlug.useQuery({ slug });
  const utils = trpc.useUtils();
  const [justAdded, setJustAdded] = useState(false);
  const addToCart = trpc.cart.upsert.useMutation({
    onSuccess: async () => {
      await utils.cart.list.invalidate();
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1800);
    },
    onError: (err) => Alert.alert("Couldn't add to cart", err.message),
  });

  function handleAddToCart() {
    if (!session) {
      router.push("/(auth)/sign-in");
      return;
    }
    if (activeVariant) addToCart.mutate({ variantId: activeVariant.id, quantity: 1 });
  }

  const { data: wishlist } = trpc.userData.listWishlist.useQuery(undefined, { enabled: !!session });
  const wishlistItem = wishlist?.find((w) => w.productId === product?.id);
  const addWishlist = trpc.userData.addToWishlist.useMutation({
    onSuccess: () => utils.userData.listWishlist.invalidate(),
  });
  const removeWishlist = trpc.userData.removeFromWishlist.useMutation({
    onSuccess: () => utils.userData.listWishlist.invalidate(),
  });

  function toggleWishlist() {
    if (!session) {
      router.push("/(auth)/sign-in");
      return;
    }
    if (wishlistItem) {
      removeWishlist.mutate({ id: wishlistItem.id });
    } else if (product) {
      addWishlist.mutate({ productId: product.id });
    }
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F0E7]">
        <Text className="text-[10px] font-semibold tracking-[0.28em] text-[#57493A] uppercase">Loading…</Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F0E7]">
        <Text className="text-[10px] font-semibold tracking-[0.28em] text-[#57493A] uppercase">Not found</Text>
      </View>
    );
  }

  const activeVariants = product.variants.filter((v) => v.status === "active");
  const activeVariant =
    product.variants.find((v) => v.id === selectedVariantId) ??
    product.variants.find((v) => v.isDefault) ??
    product.variants[0];

  const price = activeVariant
    ? (activeVariant.effectivePrice ?? Number(activeVariant.mrp ?? 0))
    : null;

  const mrp = activeVariant ? Number(activeVariant.mrp ?? 0) : null;
  const hasDiscount = price !== null && mrp !== null && price < mrp;
  const bg = product.themeColor ?? "#e8e0d5";
  // Order: primary first, then the secondary image, then the rest.
  const imgRank = (i: { isPrimary: boolean; isSecondary: boolean }) =>
    i.isPrimary ? 0 : i.isSecondary ? 1 : 2;
  const galleryImages = product.images
    .slice()
    .sort((a, b) => imgRank(a) - imgRank(b))
    .filter((i): i is typeof i & { url: string } => !!i.url);

  // Two-step variant selection — concentration first, then size (matches web).
  const stockOf = (v: { stockCached?: number | null }) => v.stockCached ?? null;
  const concentrations = [...new Set(activeVariants.map((v) => v.concentration))];
  const sizesForConcentration = activeVariant
    ? activeVariants.filter((v) => v.concentration === activeVariant.concentration)
    : [];
  const activeStock = activeVariant ? stockOf(activeVariant) : null;

  function pickConcentration(concentration: string) {
    const inConcentration = activeVariants.filter((v) => v.concentration === concentration);
    const match =
      inConcentration.find((v) => v.sizeMl === activeVariant?.sizeMl) ??
      inConcentration.find((v) => v.isDefault) ??
      inConcentration[0];
    if (match) setSelectedVariantId(match.id);
  }
  function pickSize(sizeMl: number) {
    const match = sizesForConcentration.find((v) => v.sizeMl === sizeMl);
    if (match) setSelectedVariantId(match.id);
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F5F0E7]" edges={["bottom"]}>
      <ScrollView bounces>
        {/* ── Hero image carousel ── */}
        <ImageCarousel images={galleryImages} bg={bg} productName={product.name} />

        {/* Color rule */}
        <View className="h-[3px] w-full" style={{ backgroundColor: bg }} />

        {/* ── Product info ── */}
        <View className="px-6 pt-8 pb-6">
          {/* Category + concentration */}
          <Text className="text-[10px] font-semibold tracking-[0.28em] text-[#57493A] uppercase mb-1">
            {activeVariant &&
              (CONCENTRATION_LABEL[activeVariant.concentration] ?? activeVariant.concentration)}
            {product.category ? ` · ${product.category.name}` : ""}
          </Text>

          {/* Name */}
          <Text
            className="text-[38px] leading-none tracking-tight text-[#1B1611] mb-4"
            style={{ fontFamily: Fonts.serifItalic }}
          >
            {product.name}
          </Text>

          <ProductRatingLine productId={product.id} />

          {/* Price */}
          <View className="flex-row items-baseline gap-3 mb-8">
            <Text className="text-[26px] font-semibold text-[#1B1611]">
              ₹{price?.toLocaleString("en-IN") ?? "—"}
            </Text>
            {hasDiscount && (
              <Text className="text-[15px] text-[#57493A] line-through">
                ₹{mrp?.toLocaleString("en-IN")}
              </Text>
            )}
          </View>

          {/* Offers & coupons */}
          {price !== null && <ProductOffers price={price} />}

          {/* Description */}
          {product.description && (
            <Text className="text-[14px] leading-[1.9] text-[#57493A] mb-8">
              {product.description}
            </Text>
          )}

          {/* Divider */}
          <View className="h-px bg-[#E3DDD1] mb-8" />

          {/* Concentration selector */}
          {concentrations.length > 1 && (
            <View className="mb-6">
              <Text className="text-[10px] font-semibold tracking-[0.24em] text-[#1B1611] uppercase mb-4">
                Concentration
                {activeVariant ? (
                  <Text className="tracking-normal text-[#57493A]">
                    {`   ${CONCENTRATION_LABEL[activeVariant.concentration] ?? activeVariant.concentration}`}
                  </Text>
                ) : null}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {concentrations.map((c) => {
                  const selected = activeVariant?.concentration === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => pickConcentration(c)}
                      className="border px-5 py-3"
                      style={{
                        borderColor: selected ? Colors.accent : "#E3DDD1",
                        backgroundColor: selected ? Colors.accent : "transparent",
                      }}
                    >
                      <Text
                        className="text-[12px] font-semibold tracking-[0.1em]"
                        style={{ color: selected ? "#ffffff" : "#1B1611" }}
                      >
                        {CONCENTRATION_SHORT[c] ?? c}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Size selector */}
          {sizesForConcentration.length > 0 && (
            <View className="mb-6">
              <Text className="text-[10px] font-semibold tracking-[0.24em] text-[#1B1611] uppercase mb-4">
                Size
                {activeVariant ? (
                  <Text className="tracking-normal text-[#57493A]">{`   ${activeVariant.sizeMl}ml`}</Text>
                ) : null}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {sizesForConcentration.map((v) => {
                  const selected = (selectedVariantId ?? activeVariant?.id) === v.id;
                  const outOfStock = stockOf(v) === 0;
                  const vPrice = v.effectivePrice ?? Number(v.mrp ?? 0);
                  return (
                    <Pressable
                      key={v.id}
                      onPress={() => !outOfStock && pickSize(v.sizeMl)}
                      disabled={outOfStock}
                      className="border px-5 py-3"
                      style={{
                        borderColor: selected ? Colors.accent : "#E3DDD1",
                        backgroundColor: selected ? Colors.accent : "transparent",
                        opacity: outOfStock ? 0.4 : 1,
                      }}
                    >
                      <Text
                        className="text-[12px] font-semibold tracking-[0.1em]"
                        style={{
                          color: selected ? "#ffffff" : "#1B1611",
                          textDecorationLine: outOfStock ? "line-through" : "none",
                        }}
                      >
                        {v.sizeMl}ml
                      </Text>
                      <Text
                        className="text-[11px] mt-0.5"
                        style={{ color: selected ? "#ffffff" : "#57493A" }}
                      >
                        {outOfStock ? "Sold out" : `₹${vPrice.toLocaleString("en-IN")}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Stock notice */}
          {activeStock !== null && activeStock > 0 && activeStock <= 5 && (
            <Text
              className="mb-8 text-[11px] font-semibold tracking-[0.1em] uppercase"
              style={{ color: Colors.accent }}
            >
              Only {activeStock} left in stock
            </Text>
          )}

          {/* Ratings */}
          {(product.longevityRating || product.sillageRating) && (
            <View className="mb-8 gap-4">
              {!!product.longevityRating && (
                <View className="flex-row items-center justify-between">
                  <Text className="text-[10px] font-semibold tracking-[0.24em] text-[#1B1611] uppercase">
                    Longevity
                  </Text>
                  <DotRating value={product.longevityRating} max={10} />
                </View>
              )}
              {!!product.sillageRating && (
                <View className="flex-row items-center justify-between">
                  <Text className="text-[10px] font-semibold tracking-[0.24em] text-[#1B1611] uppercase">
                    Sillage
                  </Text>
                  <DotRating value={product.sillageRating} max={5} />
                </View>
              )}
            </View>
          )}

          {/* Notes */}
          {product.notes.length > 0 && (
            <View className="mb-8 gap-4">
              {(["top", "mid", "base"] as const).map((position) => {
                const positionNotes = product.notes.filter((n) => n.notePosition === position);
                if (positionNotes.length === 0) return null;
                return (
                  <View key={position}>
                    <Text className="text-[10px] font-semibold tracking-[0.24em] text-[#1B1611] uppercase mb-2">
                      {NOTE_POSITION_LABEL[position]}
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {positionNotes.map((n) => (
                        <View
                          key={n.id}
                          className="px-3 py-1.5 rounded-full border border-[#E3DDD1] bg-[#EDE3D0]"
                        >
                          <Text className="text-[12px] text-[#57493A]">{n.note.name}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Sticky CTA ── */}
      <View className="flex-row items-center gap-3 px-6 pb-8 pt-4 border-t border-[#E3DDD1] bg-[#F5F0E7]">
        <View>
          <Text
            className="text-[20px] leading-none"
            style={{ fontFamily: Fonts.serifMedium, color: "#1B1611" }}
          >
            ₹{price?.toLocaleString("en-IN") ?? "—"}
          </Text>
          <Text className="mt-1 text-[8px] tracking-[0.14em] text-[#8A7A63] uppercase">
            Incl. of all taxes
          </Text>
        </View>
        <Pressable
          className="flex-1 h-14 items-center justify-center bg-[#1B1611] active:opacity-70"
          style={{ opacity: !activeVariant || addToCart.isPending ? 0.4 : 1 }}
          disabled={!activeVariant || addToCart.isPending}
          onPress={handleAddToCart}
        >
          <Text className="text-white text-[11px] font-semibold tracking-[0.3em] uppercase">
            {addToCart.isPending ? "Adding…" : justAdded ? "Added ✓" : "Add to Cart"}
          </Text>
        </Pressable>
        <Pressable
          onPress={toggleWishlist}
          className="w-14 h-14 items-center justify-center border border-[#E3DDD1] active:opacity-70"
        >
          <Heart
            size={18}
            color={wishlistItem ? Colors.accent : "#1B1611"}
            fill={wishlistItem ? Colors.accent : "transparent"}
            strokeWidth={1.6}
          />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
