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

export type OurStory = {
  headerSubtitle: string;
  originBlockquote: string;
  originBody: string;
  pullquote: string;
  founderBody: string;
};

export const OUR_STORY_DEFAULTS: OurStory = {
  headerSubtitle:
    "We make perfume the slow way. No shortcuts, no synthetic proxies pretending to be naturals. Only raw materials with stories, blended until something true emerges.",
  originBlockquote:
    "An azimuth is a bearing — a precise angle from true north. We chose that name because every fragrance we build is a direction, not a decoration.",
  originBody: [
    "Azimuth Perfumers began in a single room in 2019 — a rented space, secondhand glassware, and a notebook filled with the kind of obsessive notes that either become something great or remain quietly embarrassing.",
    "We make our accords entirely in India, from materials sourced directly from Indian farmers and distillers. Each batch is under two hundred units. Nothing is rushed.",
    "The result is a house of slow perfumery — uncompromising, small, and stubbornly itself.",
  ].join("\n\n"),
  pullquote:
    "Most fragrance is built to please everyone and so pleases no one deeply. We build to please the one person who has been looking for exactly this.",
  founderBody: [
    "I have been asked many times why we don't scale. Why we cap batches. Why we refuse to move to a larger facility and simply make more.",
    "When you wear an Azimuth fragrance, I want you to know that a human being paid close attention to it. Not a machine, not a process, not an algorithm.",
  ].join("\n\n"),
};

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
