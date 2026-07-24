import {
  BarChart2,
  Boxes,
  Cpu,
  FlaskConical,
  LayoutDashboard,
  Package,
  Paintbrush,
  PercentCircle,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Tags,
  TicketIcon,
  Users,
  Wallet,
} from "lucide-react";
import type { Access, Resource } from "@azimuth/api/permissions";

export type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; resource: Resource };
export type NavGroup = { label: string; items: NavItem[] };

// Each item declares the resource it needs read access to. Drives sidebar
// visibility, the route guard, and the post-login landing page — one config.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, resource: "dashboard" },
      { href: "/analytics", label: "Analytics", icon: BarChart2, resource: "analytics" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/products", label: "Products", icon: Package, resource: "products" },
      { href: "/categories", label: "Categories", icon: Tags, resource: "categories" },
      { href: "/inventory", label: "Inventory", icon: Boxes, resource: "inventory" },
      { href: "/fragrance-notes", label: "Notes library", icon: FlaskConical, resource: "notes" },
    ],
  },
  {
    label: "Orders",
    items: [
      { href: "/orders", label: "Orders", icon: ShoppingBag, resource: "orders" },
      { href: "/jobs", label: "Job Queue", icon: Cpu, resource: "jobs" },
    ],
  },
  {
    label: "Promotions",
    items: [
      { href: "/discounts", label: "Discounts", icon: PercentCircle, resource: "discounts" },
      { href: "/coupons", label: "Coupons", icon: Tag, resource: "coupons" },
    ],
  },
  {
    label: "Customers",
    items: [
      { href: "/users", label: "Users", icon: Users, resource: "customers" },
      { href: "/wallets", label: "Wallets", icon: Wallet, resource: "wallets" },
    ],
  },
  {
    label: "Support",
    items: [{ href: "/support", label: "Tickets", icon: TicketIcon, resource: "tickets" }],
  },
  {
    label: "Config",
    items: [
      { href: "/content", label: "Content", icon: Paintbrush, resource: "content" },
      { href: "/settings", label: "Settings", icon: Settings, resource: "settings" },
      { href: "/staff", label: "Staff", icon: ShieldCheck, resource: "staff" },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

// First section (in sidebar order) this role can view — where login lands them.
// Falls back to /dashboard if somehow nothing is accessible.
export function firstAccessiblePath(can: (resource: Resource, access?: Access) => boolean): string {
  return NAV_ITEMS.find((item) => can(item.resource))?.href ?? "/dashboard";
}
