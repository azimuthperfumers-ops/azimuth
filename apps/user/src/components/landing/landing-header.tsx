"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, ShoppingBag, X } from "lucide-react";

import { useCartCount } from "@/hooks/use-cart";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";

const TICKER_ITEMS = [
  "Handcrafted in small batches",
  "Miniatures with every purchase",
  "Premium naturals & resins",
  "Pan-India delivery",
];

export function LandingHeader() {
  const rawCount = useCartCount();
  const [cartCount, setCartCount] = useState(0);
  useEffect(() => setCartCount(rawCount), [rawCount]);
  const { data: session } = authClient.useSession();
  const isLoggedIn = !!session?.user;
  const settingsQuery = trpc.settings.get.useQuery(undefined, { staleTime: 10 * 60 * 1000 });
  const freeShippingAbove = settingsQuery.data?.freeShippingAboveInr ?? 999;
  const [menuOpen, setMenuOpen] = useState(false);

  const tickerItems = [...TICKER_ITEMS, `Free shipping above ₹${freeShippingAbove}`];

  return (
    <div className="sticky top-0 z-50">
      {/* Announcement ticker */}
      <div className="h-[34px] overflow-hidden bg-[#1B1611] text-[#EFE6D6]">
        <div className="ticker-track">
          {[0, 1].map((row) => (
            <div
              key={row}
              className="flex gap-14 pr-14 text-[11px] tracking-[0.22em] uppercase whitespace-nowrap"
            >
              {tickerItems.map((item, i) => (
                <span key={i} className="flex items-center gap-14">
                  {item}
                  <span className="text-[#B0793F]">·</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Nav */}
      <header className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-[#1B1611]/8 bg-[#F5F0E7]/92 px-5 py-[22px] backdrop-blur-md md:px-12">
        <nav className="flex items-center gap-8 text-[12px] font-medium tracking-[0.18em] uppercase">
          <button
            className="text-[#1B1611] sm:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <Link href="/shop" className="hidden text-[#1B1611] transition-colors hover:text-[#9A5B2B] sm:inline">
            Shop
          </Link>
          <Link href="/our-story" className="hidden text-[#1B1611] transition-colors hover:text-[#9A5B2B] sm:inline">
            Our Story
          </Link>
        </nav>

        <Link href="/" className="text-center">
          <div className="font-heading text-[26px] font-semibold tracking-[0.32em] text-[#1B1611]">
            AZIMUTH
          </div>
          <div className="mt-0.5 text-[9px] tracking-[0.5em] text-[#8A7A63] uppercase">
            Perfumers
          </div>
        </Link>

        <div className="flex items-center justify-end gap-6 text-[12px] font-medium tracking-[0.18em] uppercase">
          <Link
            href={isLoggedIn ? "/account" : "/account?tab=info"}
            className="hidden text-[#1B1611] transition-colors hover:text-[#9A5B2B] sm:inline"
          >
            {isLoggedIn ? "Account" : "Sign in"}
          </Link>
          <Link
            href="/cart"
            className="relative flex items-center gap-2 border border-[#1B1611] px-4 py-2.5 text-[#1B1611] transition-colors hover:bg-[#1B1611] hover:text-[#EFE6D6]"
          >
            <ShoppingBag className="size-3.5" />
            <span className="hidden sm:inline">Cart</span>
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-[#9A5B2B] text-[8px] font-bold text-white">
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Mobile nav overlay */}
      {menuOpen && (
        <div className="border-b border-[#1B1611]/8 bg-[#F5F0E7] sm:hidden">
          <nav className="flex flex-col px-5">
            {[
              { href: "/shop", label: "Shop" },
              { href: "/our-story", label: "Our Story" },
              { href: isLoggedIn ? "/account" : "/account?tab=info", label: isLoggedIn ? "Account" : "Sign in" },
            ].map(({ href, label }) => (
              <Link
                key={label}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="border-b border-[#1B1611]/8 py-4 text-[12px] font-semibold tracking-[0.18em] text-[#1B1611] uppercase"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
