import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Tabs, useRouter } from "expo-router";
import { House, ShoppingBag, ShoppingCart, User } from "lucide-react-native";

import { useSession } from "@/hooks/use-session";
import { useCartCount } from "@/hooks/use-cart-count";
import { Colors } from "@/constants/theme";
import { Ticker } from "@/components/ticker";
import { BrandBar } from "@/components/brand-bar";

function TabIcon({
  Icon,
  active,
  badge,
}: {
  Icon: typeof House;
  active: boolean;
  badge?: number;
}) {
  return (
    <View className="items-center pt-1">
      <View className="relative">
        <Icon size={20} color={active ? Colors.ink : "#bbbbbb"} strokeWidth={1.75} />
        {!!badge && (
          <View
            className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] px-1 rounded-full items-center justify-center"
            style={{ backgroundColor: Colors.accent }}
          >
            <Text className="text-white text-[8px] font-bold">{badge}</Text>
          </View>
        )}
      </View>
      {active && <View className="w-3 h-[1.5px] mt-1.5" style={{ backgroundColor: Colors.accent }} />}
    </View>
  );
}

export default function TabsLayout() {
  const router = useRouter();
  const { session } = useSession();
  const cartCount = useCartCount();

  return (
    <View className="flex-1" style={{ backgroundColor: Colors.background }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: Colors.background }}>
        <Ticker />
        <BrandBar />
      </SafeAreaView>

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: {
            backgroundColor: Colors.background,
            borderTopColor: Colors.border,
            borderTopWidth: 1,
            height: 64,
            paddingBottom: 8,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ focused }) => <TabIcon Icon={House} active={focused} />,
          }}
        />
        <Tabs.Screen
          name="shop"
          options={{
            title: "Shop",
            tabBarIcon: ({ focused }) => <TabIcon Icon={ShoppingBag} active={focused} />,
          }}
        />
        <Tabs.Screen
          name="cart"
          options={{
            title: "Cart",
            tabBarIcon: ({ focused }) => <TabIcon Icon={ShoppingCart} active={focused} badge={cartCount} />,
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            title: "Account",
            tabBarIcon: ({ focused }) => <TabIcon Icon={User} active={focused} />,
          }}
          listeners={{
            tabPress: (e) => {
              if (!session) {
                e.preventDefault();
                router.push("/(auth)/sign-in");
              }
            },
          }}
        />
      </Tabs>
    </View>
  );
}
