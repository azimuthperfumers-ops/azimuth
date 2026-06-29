import "../global.css";

import { Stack } from "expo-router";
import { Providers } from "@/lib/providers";

export default function RootLayout() {
  return (
    <Providers>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)/sign-in" options={{ presentation: "modal" }} />
        <Stack.Screen name="product/[slug]" options={{ headerShown: true, title: "" }} />
        <Stack.Screen name="order/[orderId]" options={{ headerShown: true, title: "Order" }} />
        <Stack.Screen
          name="cart"
          options={{ headerShown: true, title: "Cart", presentation: "modal" }}
        />
        <Stack.Screen name="checkout" options={{ headerShown: true, title: "Checkout" }} />
        <Stack.Screen name="support/index" options={{ headerShown: true, title: "Support" }} />
        <Stack.Screen
          name="support/[ticketId]"
          options={{ headerShown: true, title: "Ticket" }}
        />
      </Stack>
    </Providers>
  );
}
