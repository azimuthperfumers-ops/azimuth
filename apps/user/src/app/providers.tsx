"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";

import { Toaster } from "@/components/ui/sonner";
import { CartProvider } from "@/hooks/use-cart";
import { SmoothScroll } from "@/components/smooth-scroll";
import { StorefrontTheme } from "@/components/storefront-theme";
import { getTrpcClient, trpc } from "@/lib/trpc";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() => getTrpcClient());

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <CartProvider>
            <StorefrontTheme />
            <SmoothScroll />
            {children}
            <Toaster />
          </CartProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </ThemeProvider>
  );
}
