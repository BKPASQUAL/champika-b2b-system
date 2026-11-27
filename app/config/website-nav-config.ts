// app/config/website-nav-config.ts
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Image as ImageIcon,
  ShoppingCart,
  FileText,
  Users,
  Percent,
  BarChart3,
  Settings,
  ExternalLink,
  Megaphone,
  Tags,
  Layers,
  Truck,
  ShieldCheck,
  Receipt,
  ClipboardList,
  LucideIcon,
} from "lucide-react";
import { WEB_SITE_PORTAL, type WebSite } from "@/app/config/business-constants";



interface WebsiteNavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  adminOnly?: boolean;
}

interface WebsiteNavSection {
  title?: string;
  items: WebsiteNavItem[];
}

/** Portal menu for one online shop (BK Wiring or Champika). */
export function websiteNavItemsFor(site: WebSite): WebsiteNavSection[] {
  const BASE = WEB_SITE_PORTAL[site];
  const shopName = site === "champika" ? "Champika" : "BK Wiring";
  return [
  {
    items: [
      { name: "Website Dashboard", href: BASE, icon: LayoutDashboard },
      { name: "View Shop", href: site === "champika" ? "/champika" : "/shop", icon: ExternalLink },
    ],
  },
  {
    title: "Catalog",
    items: [
      { name: "Website Products", href: `${BASE}/products`, icon: Package },
      { name: "Categories", href: `${BASE}/categories`, icon: FolderTree },
      { name: "Product Families", href: `${BASE}/families`, icon: Layers },
      { name: "Brands", href: `${BASE}/brands`, icon: Tags },
      { name: "Suppliers", href: `${BASE}/suppliers`, icon: Truck },
      { name: "Warranty Types", href: `${BASE}/warranties`, icon: ShieldCheck },
      { name: "Banners", href: `${BASE}/banners`, icon: ImageIcon },
      { name: "Home Promo Strip", href: `${BASE}/promo-strip`, icon: Megaphone },
    ],
  },
  {
    title: "Sales",
    items: [
      { name: "Website Orders", href: `${BASE}/orders`, icon: ShoppingCart },
      { name: `${shopName} Quotations`, href: `${BASE}/office-quotations`, icon: FileText },
      { name: `${shopName} Invoices`, href: `${BASE}/office-invoices`, icon: Receipt },
      { name: "Online Quote Requests", href: `${BASE}/quotations`, icon: ClipboardList },
      { name: "Customers", href: `${BASE}/customers`, icon: Users },
    ],
  },
  {
    title: "Pricing",
    items: [{ name: "Price Rules", href: `${BASE}/pricing`, icon: Percent }],
  },
  {
    title: "Reports",
    items: [{ name: "Sales & Profit", href: `${BASE}/reports`, icon: BarChart3 }],
  },
  {
    title: "Settings",
    items: [{ name: "Shop Settings", href: `${BASE}/settings`, icon: Settings }],
  },
  ];
}

export const websiteNavItems = websiteNavItemsFor("bk");
