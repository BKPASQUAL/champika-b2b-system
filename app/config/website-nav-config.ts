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
  LucideIcon,
} from "lucide-react";

const BASE = "/dashboard/office/website";

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

export const websiteNavItems: WebsiteNavSection[] = [
  {
    items: [
      { name: "Website Dashboard", href: BASE, icon: LayoutDashboard },
      { name: "View Shop", href: "/shop", icon: ExternalLink },
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
      { name: "Banners", href: `${BASE}/banners`, icon: ImageIcon },
      { name: "Home Promo Strip", href: `${BASE}/promo-strip`, icon: Megaphone },
    ],
  },
  {
    title: "Sales",
    items: [
      { name: "Website Orders", href: `${BASE}/orders`, icon: ShoppingCart },
      { name: "Quotations", href: `${BASE}/quotations`, icon: FileText },
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
