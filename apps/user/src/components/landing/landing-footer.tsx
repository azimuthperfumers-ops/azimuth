import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="bg-[#1B1611] px-5 pt-16 pb-10 text-[#EFE6D6] md:px-12">
      <div className="mx-auto flex max-w-[1400px] flex-wrap justify-between gap-10">
        <div>
          <div className="font-heading text-[24px] font-semibold tracking-[0.32em]">AZIMUTH</div>
          <div className="mt-1 text-[9px] tracking-[0.5em] text-[#B0793F] uppercase">
            Perfumers · Est. 2019
          </div>
        </div>
        <nav className="flex gap-10 text-[12px] tracking-[0.18em] uppercase">
          <Link href="/shop" className="text-[#EFE6D6] transition-colors hover:text-[#B0793F]">
            Shop
          </Link>
          <Link href="/our-story" className="text-[#EFE6D6] transition-colors hover:text-[#B0793F]">
            Our Story
          </Link>
          <a href="#quiz" className="text-[#EFE6D6] transition-colors hover:text-[#B0793F]">
            Find your scent
          </a>
        </nav>
      </div>
      <div className="mx-auto mt-12 flex max-w-[1400px] flex-wrap justify-between gap-4 border-t border-[#EFE6D6]/15 pt-6 text-[11px] tracking-[0.14em] text-[#8A7A63]">
        <span>© 2026 Azimuth Perfumers. All rights reserved.</span>
        <span>Handcrafted in small batches · Pan-India delivery</span>
      </div>
    </footer>
  );
}
