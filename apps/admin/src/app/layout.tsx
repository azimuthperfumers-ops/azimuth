import type { Metadata } from "next";
import "./globals.css";

import { Providers } from "./providers";
import { Cormorant_Garamond, Hanken_Grotesk } from "next/font/google";
import { cn } from "@/lib/utils";

const sans = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-sans" });
const serif = Cormorant_Garamond({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "Azimuth Perfumers — admin",
  description: "Azimuth Perfumers admin dashboard",
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
