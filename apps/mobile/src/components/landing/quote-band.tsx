import { Text, View } from "react-native";

import { Colors, Fonts } from "@/constants/theme";
import { CompassRose } from "./marginalia";

/**
 * Dark editorial quote band with the azimuth compass engraved behind it —
 * the mobile echo of the web landing's quote section.
 */
export function QuoteBand() {
  return (
    <View className="mt-14 items-center overflow-hidden px-8 py-16" style={{ backgroundColor: Colors.ink }}>
      {/* compass rose, centred behind the text */}
      <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
        <CompassRose size={360} color="#FAF6EE" opacity={0.09} />
      </View>

      <Text style={{ color: Colors.accent }} className="text-[22px]">
        ✳
      </Text>
      <Text style={{ color: "#FAF6EE", opacity: 0.75 }} className="mt-3 text-[9.5px] font-semibold tracking-[0.3em] uppercase">
        The Azimuth Way
      </Text>
      <Text
        style={{ fontFamily: Fonts.serifItalic, color: "#FAF6EE" }}
        className="mt-6 text-center text-[30px] leading-[1.2]"
      >
        &ldquo;An accord becomes{"\n"}unmistakably yours.&rdquo;
      </Text>

      <View className="mt-8 flex-row items-center gap-3">
        <View style={{ backgroundColor: "#FAF6EE", opacity: 0.35 }} className="h-px w-10" />
        <Text style={{ color: "#FAF6EE", opacity: 0.5 }} className="text-[8.5px] font-semibold tracking-[0.28em] uppercase">
          Bearing set · Batch sealed
        </Text>
        <View style={{ backgroundColor: "#FAF6EE", opacity: 0.35 }} className="h-px w-10" />
      </View>
    </View>
  );
}
