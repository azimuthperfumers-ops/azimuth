"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, ShoppingBag, X } from "lucide-react";

import { useCartCount } from "@/hooks/use-cart";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";

export function SiteHeader() {
  const rawCount = useCartCount();
  const [cartCount, setCartCount] = useState(0);
  useEffect(() => { setCartCount(rawCount); }, [rawCount]);
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: session } = authClient.useSession();
  const isLoggedIn = !!session?.user;
  const settingsQuery = trpc.settings.get.useQuery(undefined, { staleTime: 10 * 60 * 1000 });
  const freeShippingAbove = settingsQuery.data?.freeShippingAboveInr ?? 999;

  const TICKER_ITEMS = [
    "MINIATURES WITH EVERY PURCHASE",
    `FREE SHIPPING ABOVE ₹${freeShippingAbove}`,
    "PREMIUM NATURALS & RESINS",
    "PAN-INDIA DELIVERY",
    "HANDCRAFTED IN SMALL BATCHES",
  ];

  return (
    <div className="sticky top-0 z-50 bg-background">
      {/* Announcement ticker */}
      <div className="overflow-hidden bg-foreground py-2">
        <div className="ticker-track">
          {[0, 1].map((i) => (
            <span key={i} className="whitespace-nowrap text-[9.5px] md:text-[10.5px] font-semibold tracking-[0.18em] text-background uppercase px-8">
              {TICKER_ITEMS.map((item, idx) => (
                <span key={idx}>
                  {item}
                  <span className="mx-5 opacity-40">·</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* Main header */}
      <header className="border-b border-border bg-background">
        <div className="relative mx-auto flex h-[60px] md:h-[68px] max-w-[1400px] items-center justify-between px-4 md:px-8">

          {/* Left: hamburger (mobile) | nav (desktop) */}
          <div className="flex items-center gap-8">
            <button
              className="md:hidden text-foreground"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            <nav className="hidden md:flex items-center gap-8">
              <Link href="/shop" className="text-[11px] font-semibold tracking-[0.16em] text-foreground uppercase transition-opacity hover:opacity-60">
                Shop
              </Link>
              <Link href="/our-story" className="text-[11px] font-semibold tracking-[0.16em] text-foreground uppercase transition-opacity hover:opacity-60">
                Our Story
              </Link>
            </nav>
          </div>

          {/* Wordmark — centered absolutely */}
          <Link href="/" className="absolute left-1/2 -translate-x-1/2 flex items-start gap-2">
            <img src="/logo-icon.png" alt="" className="h-6 w-6 md:h-7 md:w-7" />
            <img src="/logo-wordmark.png" alt="Azimuth Perfumers" className="h-7 md:h-8 w-auto" />
            <sup className="mt-0.5 text-[9px] md:text-[10px] leading-none text-foreground">&trade;</sup>
          </Link>

          {/* Right: account (desktop) + sign-in (mobile, guest) + cart */}
          <div className="flex items-center gap-4 md:gap-6">
            <Link
              href={isLoggedIn ? "/account" : "/account?tab=info"}
              className="hidden md:block text-[11px] font-semibold tracking-[0.16em] text-foreground uppercase transition-opacity hover:opacity-60"
            >
              {isLoggedIn ? "Account" : "Sign in"}
            </Link>
            {!isLoggedIn && (
              <Link
                href="/account?tab=info"
                className="md:hidden text-[10px] font-semibold tracking-[0.16em] text-foreground uppercase transition-opacity hover:opacity-60"
              >
                Sign in
              </Link>
            )}
            <Link
              href="/cart"
              className="relative inline-flex items-center gap-2 border border-foreground px-3 md:px-4 py-2 text-[10px] font-semibold tracking-[0.18em] text-foreground uppercase transition-all hover:bg-foreground hover:text-background"
            >
              <ShoppingBag className="size-3.5" />
              <span className="hidden sm:inline">Cart</span>
              {cartCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile nav overlay */}
      {menuOpen && (
        <div className="md:hidden border-b border-border bg-background shadow-sm">
          <nav className="flex flex-col px-4">
            {[
              { href: "/shop", label: "Shop" },
              { href: "/our-story", label: "Our Story" },
              { href: "/account", label: isLoggedIn ? "Account" : "Sign in" },
            ].map(({ href, label }) => (
              <Link
                key={label}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="border-b border-border/40 py-4 text-[12px] font-semibold tracking-[0.18em] text-foreground uppercase"
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
