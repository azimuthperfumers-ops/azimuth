import type { Metadata } from "next";
import "./globals.css";

import { Providers } from "./providers";
import { Cormorant_Garamond, Hanken_Grotesk } from "next/font/google";
import { cn } from "@/lib/utils";

const sans = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-sans" });
const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
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
      className={cn("font-sans", sans.variable, serif.variable)}
      suppressHydrationWarning
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
