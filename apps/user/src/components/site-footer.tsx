import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] gap-8 md:gap-12 px-4 md:px-8 py-12 md:py-16">
        {/* Brand */}
        <div>
          <div className="font-heading text-[22px] font-semibold leading-none tracking-[0.22em] text-foreground">
            AZIMUTH
          </div>
          <div className="mt-1.5 mb-6 text-[7.5px] leading-none tracking-[0.55em] text-muted-foreground">
            PERFUMERS
          </div>
          <p className="max-w-64 text-[13px] leading-relaxed text-muted-foreground">
            A house of slow perfumery. Composed in small batches, delivered pan-India.
          </p>
        </div>

        {/* Shop */}
        <div>
          <h5 className="mb-5 text-[10px] font-semibold tracking-[0.2em] uppercase text-foreground">Shop</h5>
          <ul className="space-y-3 text-[13px] text-muted-foreground">
            <li><Link href="/shop" className="transition-colors hover:text-foreground">All fragrances</Link></li>
            <li><span className="cursor-default">Discovery sets</span></li>
            <li><span className="cursor-default">Gift cards</span></li>
          </ul>
        </div>

        {/* Maison */}
        <div>
          <h5 className="mb-5 text-[10px] font-semibold tracking-[0.2em] uppercase text-foreground">Maison</h5>
          <ul className="space-y-3 text-[13px] text-muted-foreground">
            <li><Link href="/our-story" className="transition-colors hover:text-foreground">Our Story</Link></li>
            <li><span className="cursor-default">Ingredients</span></li>
            <li><span className="cursor-default">Stores</span></li>
          </ul>
        </div>

        {/* Care */}
        <div>
          <h5 className="mb-5 text-[10px] font-semibold tracking-[0.2em] uppercase text-foreground">Care</h5>
          <ul className="space-y-3 text-[13px] text-muted-foreground">
            <li><span className="cursor-default">Contact us</span></li>
            <li><span className="cursor-default">Shipping & Returns</span></li>
            <li><span className="cursor-default">FAQ</span></li>
          </ul>
        </div>
      </div>

      <div className="mx-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between max-w-[1400px] border-t border-border px-4 md:px-8 py-5">
        <span className="text-[11px] text-muted-foreground">© 2026 Azimuth Perfumers. All rights reserved.</span>
        <span className="text-[11px] tracking-[0.06em] text-muted-foreground">Privacy · Terms</span>
      </div>
    </footer>
  );
}
