import Image from "next/image";
import Link from "next/link";

import { LEGAL_LINKS } from "@/content/legal";

export function SiteFooter() {
  return (
    <footer className="bg-foreground text-background">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-8 px-4 py-12 sm:grid-cols-2 md:gap-12 md:px-8 md:py-16 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
        {/* Brand */}
        <div>
          <div className="flex items-center gap-2.5">
            {/* black source assets → white on dark footer */}
            <Image src="/logo-icon.png" alt="" width={1010} height={1019} className="h-10 w-auto brightness-0 invert" />
            <Image src="/logo-wordmark.png" alt="Azimuth Perfumers" width={1642} height={362} className="h-6 w-auto brightness-0 invert" />
          </div>
          <p className="mt-6 max-w-64 text-[13px] leading-relaxed text-background/60">
            A house of slow perfumery. Composed in small batches, delivered pan-India.
          </p>
        </div>

        {/* Shop */}
        <div>
          <h5 className="mb-5 text-[10px] font-semibold tracking-[0.2em] text-background uppercase">Shop</h5>
          <ul className="space-y-3 text-[13px] text-background/60">
            <li><Link href="/shop" className="transition-colors hover:text-primary">All fragrances</Link></li>
            <li><Link href="/#quiz" className="transition-colors hover:text-primary">Find your scent</Link></li>
          </ul>
        </div>

        {/* Maison */}
        <div>
          <h5 className="mb-5 text-[10px] font-semibold tracking-[0.2em] text-background uppercase">Maison</h5>
          <ul className="space-y-3 text-[13px] text-background/60">
            <li><Link href="/our-story" className="transition-colors hover:text-primary">Our Story</Link></li>
            <li><span className="cursor-default">Stores</span></li>
          </ul>
        </div>

        {/* Care */}
        <div>
          <h5 className="mb-5 text-[10px] font-semibold tracking-[0.2em] text-background uppercase">Care</h5>
          <ul className="space-y-3 text-[13px] text-background/60">
            <li><Link href="/contact" className="transition-colors hover:text-primary">Contact us</Link></li>
            <li><Link href="/support" className="transition-colors hover:text-primary">Support</Link></li>
          </ul>
        </div>

        {/* Legal */}
        <div>
          <h5 className="mb-5 text-[10px] font-semibold tracking-[0.2em] text-background uppercase">Legal</h5>
          <ul className="space-y-3 text-[13px] text-background/60">
            {LEGAL_LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className="transition-colors hover:text-primary">{label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1400px] flex-col gap-2 border-t border-background/15 px-4 py-5 sm:flex-row sm:items-center sm:justify-between md:px-8">
        <span className="text-[11px] text-background/50">© 2026 Azimuth Perfumers. All rights reserved.</span>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] tracking-[0.06em] text-background/50">
          {LEGAL_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className="transition-colors hover:text-primary">{label}</Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
