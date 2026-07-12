"use client";

import { LandingHero } from "@/components/landing/landing-hero";
import { NotesMarquee } from "@/components/landing/notes-marquee";
import { MoodSection } from "@/components/landing/mood-section";
import { CollectionSection } from "@/components/landing/collection-section";
import { QuoteBand } from "@/components/landing/quote-band";
import { CraftSection } from "@/components/landing/craft-section";
import { MiniaturesCta } from "@/components/landing/miniatures-cta";
import { ReviewsSection } from "@/components/landing/reviews-section";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { trpc } from "@/lib/trpc";

export default function HomePage() {
  const products = trpc.catalog.listProducts.useQuery({ status: "active", limit: 24 });
  const categories = trpc.catalog.listCategories.useQuery();
  const heroContent = trpc.content.getSection.useQuery({ section: "home_hero" });

  // Featured products float to the front of the landing collection + signature.
  const productRows = (products.data ?? [])
    .slice()
    .sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
  const signature = productRows.find((p) => p.isFeatured) ?? productRows[0];

  // Hero carousel: admin-chosen product ids (ordered); fall back to the signature.
  const heroIds = (heroContent.data?.productIds as string[] | undefined) ?? [];
  const byId = new Map(productRows.map((p) => [p.id, p]));
  const heroProducts = heroIds.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p);
  const heroList = heroProducts.length > 0 ? heroProducts : signature ? [signature] : [];

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
        <LandingHero copy={heroCopy} products={heroList} isLoading={products.isLoading} />
        <NotesMarquee />
        <MoodSection categories={categories.data ?? []} />
        <CollectionSection products={productRows} isLoading={products.isLoading} />
        <QuoteBand />
        <CraftSection />
        <MiniaturesCta />
        <ReviewsSection />
      </main>
      <SiteFooter />
    </>
  );
}
