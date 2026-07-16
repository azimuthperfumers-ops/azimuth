"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart2, Boxes, FlaskConical, LayoutDashboard, LogOut, Package, Paintbrush, PercentCircle, Settings, ShoppingBag, Tag, Tags, TicketIcon, Users, Cpu, Wallet } from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";

// Which nav item shows which pending-work count. `urgent` renders red (needs
// action now); otherwise amber (worth a look).
const BADGE_KEY: Record<string, { key: "tickets" | "orders" | "jobs" | "inventory"; urgent: boolean }> = {
  "/support": { key: "tickets", urgent: true },
  "/orders": { key: "orders", urgent: false },
  "/jobs": { key: "jobs", urgent: true },
  "/inventory": { key: "inventory", urgent: false },
};

function NavBadge({ count, urgent }: { count: number; urgent: boolean }) {
  if (count <= 0) return null;
  return (
    <span
      className={`ml-auto flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white tabular-nums ${
        urgent ? "bg-red-600" : "bg-amber-500"
      }`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/analytics", label: "Analytics", icon: BarChart2 },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/products", label: "Products", icon: Package },
      { href: "/categories", label: "Categories", icon: Tags },
      { href: "/inventory", label: "Inventory", icon: Boxes },
      { href: "/fragrance-notes", label: "Notes library", icon: FlaskConical },
    ],
  },
  {
    label: "Orders",
    items: [
      { href: "/orders", label: "Orders", icon: ShoppingBag },
      { href: "/jobs", label: "Job Queue", icon: Cpu },
    ],
  },
  {
    label: "Promotions",
    items: [
      { href: "/discounts", label: "Discounts", icon: PercentCircle },
      { href: "/coupons", label: "Coupons", icon: Tag },
    ],
  },
  {
    label: "Customers",
    items: [
      { href: "/users", label: "Users", icon: Users },
      { href: "/wallets", label: "Wallets", icon: Wallet },
    ],
  },
  {
    label: "Support",
    items: [
      { href: "/support", label: "Tickets", icon: TicketIcon },
    ],
  },
  {
    label: "Config",
    items: [
      { href: "/content", label: "Content", icon: Paintbrush },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

function getSidebarDefaultOpen(): boolean {
  if (typeof document === "undefined") return true;
  const match = document.cookie.match(/(?:^|;\s*)sidebar_state=([^;]*)/);
  return match ? match[1] !== "false" : true;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();
  const [sidebarDefaultOpen] = useState(getSidebarDefaultOpen);
  const isAdmin = session?.user.role === "admin";

  // Pending-work counts for the nav badges. Kept cheap: 2-min poll, 1-min
  // staleTime (focus/nav inside that window reuses the cached result), and the
  // server caches the query in Redis for 30s anyway.
  const badges = trpc.analytics.sidebarBadges.useQuery(undefined, {
    enabled: isAdmin,
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!isPending && !isAdmin) {
      router.replace("/login");
    }
  }, [isPending, isAdmin, router]);

  if (isPending || !isAdmin) {
    return null;
  }

  return (
    <SidebarProvider defaultOpen={sidebarDefaultOpen}>
      <Sidebar>
        {/* Brand header */}
        <SidebarHeader>
          <div className="flex flex-col gap-1.5 px-5 py-5 border-b border-sidebar-border">
            <div className="flex items-start gap-1.5">
              <img src="/logo-icon.png" alt="" className="size-6 dark:invert" />
              <img src="/logo-azimuth-text.png" alt="Azimuth" className="h-4 w-auto dark:invert" />
              <sup className="mt-0.5 text-[7px] leading-none text-sidebar-foreground">&trade;</sup>
            </div>
            <span className="text-[7.5px] font-semibold leading-none tracking-[0.38em] text-sidebar-foreground/40 uppercase">
              Perfumers · Admin
            </span>
          </div>
        </SidebarHeader>

        {/* Navigation */}
        <SidebarContent className="px-2 pt-3">
          {NAV_GROUPS.map((group) => (
            <SidebarGroup key={group.label} className="py-1">
              <SidebarGroupLabel className="mb-1 px-2 text-[9.5px] font-semibold tracking-[0.22em] uppercase text-sidebar-foreground/35">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname.startsWith(item.href)}
                        className="rounded-[var(--radius)] h-8"
                      >
                        <Link href={item.href}>
                          <item.icon className="size-[15px]" />
                          <span className="text-[12.5px] font-medium tracking-[0.02em]">
                            {item.label}
                          </span>
                          {BADGE_KEY[item.href] && badges.data && (
                            <NavBadge
                              count={badges.data[BADGE_KEY[item.href].key]}
                              urgent={BADGE_KEY[item.href].urgent}
                            />
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        {/* User footer */}
        <SidebarFooter>
          <div className="flex items-center gap-3 border-t border-sidebar-border px-4 py-3">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary text-[10px] font-bold text-primary-foreground">
              {initials(session.user.name || session.user.email)}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[12px] font-semibold leading-none text-sidebar-foreground">
                {session.user.name}
              </span>
              <span className="truncate text-[10.5px] leading-none text-sidebar-foreground/45">
                Studio admin
              </span>
            </div>
            <button
              onClick={() => authClient.signOut()}
              className="shrink-0 text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
              title="Sign out"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex h-12 items-center gap-3 border-b border-border bg-background/95 px-6 backdrop-blur-sm">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
          <Separator orientation="vertical" className="h-3.5 opacity-20" />
          <ModeToggle />
        </header>
        <main className="flex-1 px-8 pt-7 pb-16">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
