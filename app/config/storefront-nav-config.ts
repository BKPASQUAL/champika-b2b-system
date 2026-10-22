// app/config/storefront-nav-config.ts
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  MessageSquare,
  AlertTriangle,
  Globe,
  FileText,
  LucideIcon,
  Tag,
  Truck,
} from "lucide-react";

interface StorefrontNavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  description?: string;
}

interface StorefrontNavSection {
  title?: string;
  items: StorefrontNavItem[];
}

export const storefrontOfficeNavItems: StorefrontNavSection[] = [
  {
    items: [
      {
        name: "Storefront Overview",
        href: "/dashboard/office/storefront",
        icon: LayoutDashboard,
        description: "Operations dashboard",
      },
    ],
  },
  {
    title: "Order Fulfillment",
    items: [
      {
        name: "Orders & Pipeline",
        href: "/dashboard/office/storefront/orders",
        icon: ShoppingCart,
        description: "Customer orders & tracking",
      },
    ],
  },
  {
    title: "Catalog & Pricing",
    items: [
      {
        name: "Products & Pricing",
        href: "/dashboard/office/storefront/products",
        icon: Package,
        description: "Online catalog & buffers",
      },
      {
        name: "Shortage Backlog",
        href: "/dashboard/office/storefront/backlog",
        icon: AlertTriangle,
        description: "Out-of-stock reorder",
      },
    ],
  },
  {
    title: "Customer Support",
    items: [
      {
        name: "Inquiries & Messages",
        href: "/dashboard/office/storefront/inquiries",
        icon: MessageSquare,
        description: "Visitor queries & alerts",
      },
      {
        name: "View Live Store",
        href: "/",
        icon: Globe,
        description: "Visit customer website",
      },
    ],
  },
];
