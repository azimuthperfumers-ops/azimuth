import { Image, Text, View } from "react-native";

import { Colors } from "@/constants/theme";

// Source of truth for the Azimuth brand lockup. Aspect ratios come from the
// raw asset dimensions so the images never distort at any size.
const ICON = require("@/assets/images/logo-icon.png"); // 1010 x 1019 — compass mark
const WORDMARK = require("@/assets/images/logo-wordmark.png"); // 1642 x 362 — AZIMUTH / PERFUMERS

const ICON_ASPECT = 1010 / 1019;
const WORDMARK_ASPECT = 1642 / 362;

type LogoProps = {
  /** Wordmark height in px. Compass and gap scale from it. Defaults to the header size. */
  size?: number;
  /** Show the ™ glyph after the wordmark (on by default, matching the header). */
  showTrademark?: boolean;
};

/**
 * The Azimuth brand mark: compass icon + wordmark, in one horizontal lockup.
 * Proportions mirror the app header (icon ≈ 0.857× the wordmark, gap ≈ 0.286×),
 * so it reads identically whether it's a tiny header or a large screen title.
 */
export function Logo({ size = 21, showTrademark = true }: LogoProps) {
  const iconHeight = size * (18 / 21);
  const gap = size * (6 / 21);

  return (
    <View className="flex-row items-start" style={{ gap }}>
      <Image
        source={ICON}
        style={{ height: iconHeight, width: iconHeight * ICON_ASPECT }}
        resizeMode="contain"
      />
      <Image
        source={WORDMARK}
        style={{ height: size, width: size * WORDMARK_ASPECT }}
        resizeMode="contain"
      />
      {showTrademark ? (
        <Text style={{ color: Colors.ink, fontSize: size / 3, lineHeight: size / 3 }}>&trade;</Text>
      ) : null}
    </View>
  );
}
