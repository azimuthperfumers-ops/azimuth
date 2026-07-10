import {
  Archivo,
  Cormorant_Garamond,
  EB_Garamond,
  Inter,
  Jost,
  Playfair_Display,
} from "next/font/google";

// Candidate fonts loaded so the live preview can render font swaps faithfully.
const archivo = Archivo({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--cf-archivo" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--cf-inter" });
const jost = Jost({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--cf-jost" });
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--cf-cormorant",
});
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--cf-playfair",
});
const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--cf-eb-garamond",
});

// Attach to the preview container so its font variables resolve.
export const FONT_PREVIEW_CLASS = [archivo, inter, jost, cormorant, playfair, ebGaramond]
  .map((f) => f.variable)
  .join(" ");

export const FONT_VAR: Record<string, string> = {
  cormorant: "var(--cf-cormorant)",
  playfair: "var(--cf-playfair)",
  "eb-garamond": "var(--cf-eb-garamond)",
  archivo: "var(--cf-archivo)",
  inter: "var(--cf-inter)",
  jost: "var(--cf-jost)",
};

export const SERIF_FONTS = [
  { key: "cormorant", label: "Cormorant Garamond" },
  { key: "playfair", label: "Playfair Display" },
  { key: "eb-garamond", label: "EB Garamond" },
];

export const SANS_FONTS = [
  { key: "archivo", label: "Archivo" },
  { key: "inter", label: "Inter" },
  { key: "jost", label: "Jost" },
];
