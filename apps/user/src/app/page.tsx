"use client";

import { LandingHero } from "@/components/landing/landing-hero";
import { MoodSection } from "@/components/landing/mood-section";
import { CollectionSection } from "@/components/landing/collection-section";
import { QuoteBand } from "@/components/landing/quote-band";
import { CraftSection } from "@/components/landing/craft-section";
import { MiniaturesCta } from "@/components/landing/miniatures-cta";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { trpc } from "@/lib/trpc";

export default function HomePage() {
  const products = trpc.catalog.listProducts.useQuery({ status: "active", limit: 24 });
  const categories = trpc.catalog.listCategories.useQuery();
  const heroContent = trpc.content.getSection.useQuery({ section: "home_hero" });

  const productRows = products.data ?? [];
  const signature = productRows.find((p) => p.isFeatured) ?? productRows[0];

  const heroCopy = {
    line1: (heroContent.data?.line1 as string | undefined) ?? "Worn close.",
    italic: (heroContent.data?.italic as string | undefined) ?? "Remembered longer.",
    subtitle:
      (heroContent.data?.subtitle as string | undefined) ??
      "Fragrances composed by hand from naturals, resins and time — blended in batches so small, every bottle still smells like the room it was made in.",
  };

  return (
    <>
      <SiteHeader />
      <main>
        <LandingHero copy={heroCopy} signature={signature} isLoading={products.isLoading} />
        <MoodSection categories={categories.data ?? []} />
        <CollectionSection products={productRows} isLoading={products.isLoading} />
        <QuoteBand />
        <CraftSection />
        <MiniaturesCta />
      </main>
      <SiteFooter />
    </>
  );
}
