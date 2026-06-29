"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart2, Boxes, FlaskConical, LayoutDashboard, Package, Paintbrush, PercentCircle, Settings, ShoppingBag, Tag, Tags, TicketIcon, Users, Cpu } from "lucide-react";

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
          <div className="flex flex-col gap-1 px-5 py-5 border-b border-sidebar-border">
            <span className="font-heading text-[23px] font-semibold leading-none tracking-[0.2em] text-sidebar-foreground">
              AZIMUTH
            </span>
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
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-[12px] font-semibold leading-none text-sidebar-foreground">
                {session.user.name}
              </span>
              <span className="truncate text-[10.5px] leading-none text-sidebar-foreground/45">
                Studio admin
              </span>
            </div>
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
