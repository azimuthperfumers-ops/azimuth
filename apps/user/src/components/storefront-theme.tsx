"use client";

import { useEffect } from "react";

import { trpc } from "@/lib/trpc";
import { applyThemeVars, type ThemeTokens } from "@/lib/theme";

/**
 * Reads the `theme` content section and applies it as CSS-variable overrides on
 * <html>, so admin colour/font edits re-skin the live storefront. Renders
 * nothing. Defaults live in globals.css, so before this resolves the site still
 * shows the base skin (no blank flash, just the default palette).
 */
export function StorefrontTheme() {
  const { data } = trpc.content.getSection.useQuery({ section: "theme" });

  useEffect(() => {
    if (!data || Object.keys(data).length === 0) return;
    applyThemeVars(document.documentElement, data as Partial<ThemeTokens>);
  }, [data]);

  return null;
}
