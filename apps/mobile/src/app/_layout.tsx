import "../global.css";
import "@/lib/nativewind-interop";

import { useEffect } from "react";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import {
  CormorantGaramond_400Regular,
  CormorantGaramond_500Medium,
  CormorantGaramond_500Medium_Italic,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_700Bold_Italic,
} from "@expo-google-fonts/cormorant-garamond";
import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
  Archivo_800ExtraBold,
} from "@expo-google-fonts/archivo";
import { Providers } from "@/lib/providers";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_500Medium,
    CormorantGaramond_500Medium_Italic,
    CormorantGaramond_600SemiBold,
    CormorantGaramond_700Bold_Italic,
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    Archivo_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <Providers>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)/sign-in" options={{ presentation: "modal" }} />
        <Stack.Screen name="our-story" />
        <Stack.Screen name="wishlist" />
        <Stack.Screen name="addresses" />
        <Stack.Screen name="product/[slug]" options={{ headerShown: true, title: "" }} />
        <Stack.Screen name="order/[orderId]" options={{ headerShown: true, title: "Order" }} />
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
