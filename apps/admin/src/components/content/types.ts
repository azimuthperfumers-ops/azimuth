// Shapes + defaults for every editable content section. Defaults mirror the
// storefront fallbacks so the preview matches an un-customised site.

export type ThemeTokens = {
  background: string;
  surface: string;
  ink: string;
  inkMuted: string;
  border: string;
  accent: string;
  accentInk: string;
  fontHeading: string;
  fontBody: string;
};

export const THEME_DEFAULTS: ThemeTokens = {
  background: "#F5F0E7",
  surface: "#FAF6EE",
  ink: "#1B1611",
  inkMuted: "#57493A",
  border: "#E3DDD1",
  accent: "#9A5B2B",
  accentInk: "#FFF8EC",
  fontHeading: "cormorant",
  fontBody: "archivo",
};

export const THEME_COLOR_FIELDS: { key: keyof ThemeTokens; label: string; hint: string }[] = [
  { key: "background", label: "Background", hint: "Page base colour" },
  { key: "surface", label: "Surface", hint: "Cards / raised panels" },
  { key: "ink", label: "Ink", hint: "Primary text" },
  { key: "inkMuted", label: "Muted ink", hint: "Secondary text" },
  { key: "border", label: "Border", hint: "Hairlines & dividers" },
  { key: "accent", label: "Accent", hint: "Links, prices, highlights" },
  { key: "accentInk", label: "Accent text", hint: "Text on accent fills" },
];

export type HomeHero = { line1: string; italic: string; subtitle: string; productIds: string[] };
export const HOME_HERO_DEFAULTS: HomeHero = {
  line1: "Worn close.",
  italic: "Remembered longer.",
  subtitle:
    "Fragrances composed by hand from naturals, resins and time — blended in batches so small, every bottle still smells like the room it was made in.",
  productIds: [],
};

export type ShopCover = { heading: string; subheading: string };
export const SHOP_COVER_DEFAULTS: ShopCover = {
  heading: "The Collection",
  subheading: "Every Azimuth fragrance, currently live in the catalog.",
};

/**
 * One stored section, two very different pages read it.
 *
 * The first six fields are the web Our Story page, block for block — see
 * apps/user/src/app/our-story/page.tsx. Anything editable there is here, and
 * nothing here is invented: the preview and the live page render the same copy
 * in the same order.
 *
 * The last two belong to the phone app (apps/mobile/src/app/our-story.tsx),
 * which tells the story through a different layout — a stat grid and a founder
 * pullquote that the web page has no equivalent of. They keep their original
 * keys so copy already saved against them survives untouched.
 */
export type OurStory = {
  eyebrow: string;
  titleLine1: string;
  titleItalic: string;
  statement: string;
  body: string;
  closingLine: string;
  originBlockquote: string;
  pullquote: string;
};

export const OUR_STORY_DEFAULTS: OurStory = {
  eyebrow: "Azimuth Perfumers — Est. 2019",
  titleLine1: "Our",
  titleItalic: "Story.",
  // Rendered one line per newline — the page breaks it deliberately.
  statement: ["A perfume is not what you wear.", "It’s what you leave behind."].join("\n"),
  body: [
    "We founded this house to capture moments too fleeting for photographs. The trace of someone’s hair as they turn. The warmth of sand after sunset. The way rain smells different at 3am.",
    "Each composition begins as a feeling, then becomes a formula. We source rare absolutes, age our blends like fine wine, and hand-finish every bottle. Because true luxury isn’t logo or price. It’s the quiet confidence of being unforgettable.",
  ].join("\n\n"),
  closingLine: "This is our craft. Your signature awaits.",
  originBlockquote:
    "An azimuth is a bearing — a precise angle from true north. We chose that name because every fragrance we build is a direction, not a decoration.",
  pullquote:
    "Most fragrance is built to please everyone and so pleases no one deeply. We build to please the one person who has been looking for exactly this.",
};

/** Paragraph split shared by the preview and the storefront page. */
export function splitParagraphs(body: string): string[] {
  return body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
}

/** Line split for copy whose line breaks are part of the design. */
export function splitLines(text: string): string[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

// Landing imagery — the real ingredient/mood photos drifting in the landing
// "small batch" CTA. Bundled webp defaults live in the storefront; leaving this
// empty falls back to them. Uploading here overrides the whole set.
export type IngredientImage = { url: string; label: string };
export type LandingImagery = { ingredients: IngredientImage[] };
export const LANDING_IMAGERY_DEFAULTS: LandingImagery = {
  ingredients: [
    { url: "/ingredients/amber.webp", label: "Amber" },
    { url: "/ingredients/rose.webp", label: "Rose" },
    { url: "/ingredients/citrus.webp", label: "Citrus" },
    { url: "/ingredients/patchouli.webp", label: "Patchouli" },
    { url: "/ingredients/lavender.webp", label: "Lavender" },
    { url: "/ingredients/smoke.webp", label: "Smoke" },
    { url: "/ingredients/strawberry.webp", label: "Berry" },
    { url: "/ingredients/jasmine.webp", label: "Jasmine" },
    { url: "/ingredients/cedar.webp", label: "Cedarwood" },
    { url: "/ingredients/marine.webp", label: "Marine" },
    { url: "/ingredients/candy.webp", label: "Sweet" },
  ],
};

export type Surface = "theme" | "home" | "shop" | "story" | "featured" | "landing" | "banners";
