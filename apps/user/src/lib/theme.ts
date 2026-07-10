// Storefront theme tokens — persisted in the `theme` site_content section and
// edited from the admin content playground. Defaults mirror globals.css.

export type ThemeTokens = {
  background: string;
  surface: string;
  ink: string;
  inkMuted: string;
  border: string;
  accent: string;
  accentInk: string;
  fontHeading: string; // key into FONT_VARS
  fontBody: string; // key into FONT_VARS
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

// Maps a font key to the CSS variable set up by next/font in layout.tsx.
export const FONT_VARS: Record<string, string> = {
  cormorant: "var(--font-cormorant)",
  playfair: "var(--font-playfair)",
  "eb-garamond": "var(--font-eb-garamond)",
  archivo: "var(--font-archivo)",
  inter: "var(--font-inter)",
  jost: "var(--font-jost)",
};

/** Apply theme tokens to a root element as CSS-variable overrides. */
export function applyThemeVars(root: HTMLElement, t: Partial<ThemeTokens>) {
  const set = (name: string, val?: string) => val && root.style.setProperty(name, val);
  set("--background", t.background);
  set("--foreground", t.ink);
  set("--card", t.surface);
  set("--popover", t.surface);
  set("--primary", t.accent);
  set("--ring", t.accent);
  set("--sidebar-primary", t.accent);
  set("--primary-foreground", t.accentInk);
  set("--muted-foreground", t.inkMuted);
  set("--border", t.border);
  set("--input", t.border);
  if (t.fontHeading && FONT_VARS[t.fontHeading]) set("--font-serif", FONT_VARS[t.fontHeading]);
  if (t.fontBody && FONT_VARS[t.fontBody]) set("--font-sans", FONT_VARS[t.fontBody]);
}
