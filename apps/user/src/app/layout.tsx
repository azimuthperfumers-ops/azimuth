import type { Metadata } from "next";
import "./globals.css";

import { Providers } from "./providers";
import {
  Archivo,
  Cormorant_Garamond,
  EB_Garamond,
  Inter,
  Jost,
  Playfair_Display,
} from "next/font/google";
import { cn } from "@/lib/utils";

// Default families (mapped to --font-sans / --font-serif that the theme uses).
const sans = Archivo({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans" });
const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
});

// Candidate families the admin content playground can switch to at runtime.
// Each exposes its own CSS variable; StorefrontTheme re-points --font-sans /
// --font-serif at the chosen one.
const archivo = Archivo({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-archivo" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter" });
const jost = Jost({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-jost" });
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
});
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
});
const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-eb-garamond",
});

export const metadata: Metadata = {
  title: "Azimuth Perfumers",
  description: "Azimuth Perfumers storefront",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "font-sans",
        sans.variable,
        serif.variable,
        archivo.variable,
        inter.variable,
        jost.variable,
        cormorant.variable,
        playfair.variable,
        ebGaramond.variable,
      )}
      suppressHydrationWarning
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
