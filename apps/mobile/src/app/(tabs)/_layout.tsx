import { Text, View } from "react-native";
import { Tabs, useRouter } from "expo-router";

import { useSession } from "@/hooks/use-session";

function TabIcon({ label, active }: { label: string; active: boolean }) {
  return (
    <View className="items-center pt-1">
      <Text
        className="text-[8.5px] font-semibold tracking-[0.22em] uppercase"
        style={{ color: active ? "#111111" : "#bbbbbb" }}
      >
        {label}
      </Text>
      {active && <View className="w-3 h-[1.5px] bg-[#c0392b] mt-1" />}
    </View>
  );
}

export default function TabsLayout() {
  const router = useRouter();
  const { session } = useSession();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: "#faf8f5",
          borderTopColor: "#e8e2da",
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
          tabBarIcon: ({ focused }) => <TabIcon label="Home" active={focused} />,
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: "Shop",
          tabBarIcon: ({ focused }) => <TabIcon label="Shop" active={focused} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ focused }) => <TabIcon label="Orders" active={focused} />,
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
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ focused }) => <TabIcon label="Account" active={focused} />,
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
  );
}
