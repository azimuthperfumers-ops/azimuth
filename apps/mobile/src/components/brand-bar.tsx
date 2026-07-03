import { Image, Text, View } from "react-native";

import { Colors } from "@/constants/theme";

export function BrandBar() {
  return (
    <View
      className="flex-row items-center justify-center h-11 border-b"
      style={{ backgroundColor: Colors.background, borderColor: Colors.border }}
    >
      <View className="flex-row items-start gap-1.5">
        <Image source={require("@/assets/images/logo-icon.png")} style={{ height: 18, width: 18 }} resizeMode="contain" />
        <Image source={require("@/assets/images/logo-wordmark.png")} style={{ height: 21, width: 21 * (1642 / 362) }} resizeMode="contain" />
        <Text className="text-[7px] leading-none" style={{ color: Colors.ink }}>&trade;</Text>
      </View>
    </View>
  );
}
