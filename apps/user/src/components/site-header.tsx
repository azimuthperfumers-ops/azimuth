"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
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

export function SiteHeader() {
  const rawCount = useCartCount();
  const [cartCount, setCartCount] = useState(0);
  useEffect(() => setCartCount(rawCount), [rawCount]);
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: session } = authClient.useSession();
  const isLoggedIn = !!session?.user;
  const settingsQuery = trpc.settings.get.useQuery(undefined, { staleTime: 10 * 60 * 1000 });
  const freeShippingAbove = settingsQuery.data?.freeShippingAboveInr ?? 999;

  const tickerItems = [...TICKER_ITEMS, `Free shipping above ₹${freeShippingAbove}`];

  return (
    <div className="sticky top-0 z-50">
      {/* Announcement ticker */}
      <div className="h-[40px] overflow-hidden bg-foreground text-background">
        <div className="ticker-track h-full items-center">
          {[0, 1].map((row) => (
            <div
              key={row}
              className="flex items-center gap-14 pr-14 text-[13px] tracking-[0.22em] uppercase whitespace-nowrap"
            >
              {tickerItems.map((item, i) => (
                <span key={i} className="flex items-center gap-14">
                  {item}
                  <span className="text-primary/80">·</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Nav */}
      <header className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-border bg-background/92 px-5 py-[22px] backdrop-blur-md md:px-12">
        <nav className="flex items-center gap-8 text-[12px] font-medium tracking-[0.18em] uppercase">
          <button
            className="text-foreground sm:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <Link href="/shop" className="hidden text-foreground transition-colors hover:text-primary sm:inline">
            Shop
          </Link>
          <Link href="/our-story" className="hidden text-foreground transition-colors hover:text-primary sm:inline">
            Our Story
          </Link>
        </nav>

        <Link href="/" className="flex items-center justify-center gap-2.5" aria-label="Azimuth Perfumers — home">
          <Image
            src="/logo-icon.png"
            alt=""
            width={1010}
            height={1019}
            priority
            className="h-14 w-auto"
          />
          <div className="relative">
            <Image
              src="/logo-wordmark.png"
              alt="Azimuth Perfumers"
              width={1642}
              height={362}
              priority
              className="h-9 w-auto"
            />
            <span className="absolute -right-2.5 -top-1 text-[8px] leading-none text-foreground">
              &trade;
            </span>
          </div>
        </Link>

        <div className="flex items-center justify-end gap-6 text-[12px] font-medium tracking-[0.18em] uppercase">
          <Link
            href={isLoggedIn ? "/account" : "/account?tab=info"}
            className="hidden text-foreground transition-colors hover:text-primary sm:inline"
          >
            {isLoggedIn ? "Account" : "Sign in"}
          </Link>
          <Link
            href="/cart"
            className="relative flex items-center gap-2 border border-foreground px-4 py-2.5 text-foreground transition-colors hover:bg-foreground hover:text-background"
          >
            <ShoppingBag className="size-3.5" />
            <span className="hidden sm:inline">Cart</span>
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Mobile nav overlay */}
      {menuOpen && (
        <div className="border-b border-border bg-background sm:hidden">
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
                className="border-b border-border py-4 text-[12px] font-semibold tracking-[0.18em] text-foreground uppercase"
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
