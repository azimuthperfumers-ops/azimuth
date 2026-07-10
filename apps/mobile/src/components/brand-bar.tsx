import { View } from "react-native";

import { Colors } from "@/constants/theme";
import { Logo } from "@/components/logo";

export function BrandBar() {
  return (
    <View
      className="flex-row items-center justify-center h-11 border-b"
      style={{ backgroundColor: Colors.background, borderColor: Colors.border }}
    >
      <Logo size={21} />
    </View>
  );
}
