// app/config/retail-nav-config.ts
/**
 * Retail Business Navigation Configuration
 * Special navigation items for Office Staff assigned to Retail Business
 */

import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  Wallet,
  FileText,
  Store,
  BarChart3,
  LucideIcon,
  DollarSign,
  ClipboardList,
  PackageCheck,
} from "lucide-react";

interface RetailNavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  description?: string;
}

interface RetailNavSection {
  title?: string;
  items: RetailNavItem[];
}

/**
 * Navigation items specifically for Retail Business Office Staff
 */
export const retailOfficeNavItems: RetailNavSection[] = [
  {
    items: [
      {
        name: "Retail Dashboard",
        href: "/dashboard/office/retail",
        icon: LayoutDashboard,
        description: "Overview of retail operations",
      },
    ],
  },
  {
    title: "Sales & Orders",
    items: [
      // {
      //   name: "Retail Orders",
      //   href: "/dashboard/office/retail/orders",
      //   icon: ShoppingCart,
      //   description: "Manage retail customer orders",
      // },
      {
        name: "Walk-in Sales",
        href: "/dashboard/office/retail/walkin-sales",
        icon: Store,
        description: "Quick POS for walk-in customers",
      },
      {
        name: "Invoices",
        href: "/dashboard/office/retail/invoices",
        icon: FileText,
        description: "Retail invoices and billing",
      },
    ],
  },
  {
    title: "Customers",
    items: [
      {
        name: "Retail Customers",
        href: "/dashboard/office/retail/customers",
        icon: Users,
        description: "Retail customer management",
      }
    ],
  },
  {
    title: "Inventory",
    items: [
      {
        name: "Retail Stock",
        href: "/dashboard/office/retail/stock",
        icon: Package,
        description: "Retail location inventory",
      },
      // {
      //   name: "Stock Requests",
      //   href: "/dashboard/office/retail/stock-requests",
      //   icon: PackageCheck,
      //   description: "Request stock from main warehouse",
      // },
    ],
  },
  {
    title: "Reports",
    items: [
      {
        name: "Sales Reports",
        href: "/dashboard/office/retail/reports/sales",
        icon: TrendingUp,
        description: "Daily/weekly sales analytics",
      },
      {
        name: "Revenue Reports",
        href: "/dashboard/office/retail/reports/revenue",
        icon: DollarSign,
        description: "Revenue and profit analysis",
      },
      {
        name: "Inventory Reports",
        href: "/dashboard/office/retail/reports/inventory",
        icon: BarChart3,
        description: "Stock movement and levels",
      },
    ],
  },
];

/**
 * Check if a user should see retail navigation
 */
export function shouldShowRetailNav(
  businessName: string | null,
  role: string
): boolean {
  if (role !== "office") return false;
  if (!businessName) return false;

  const lowerBusinessName = businessName.toLowerCase();
  return (
    lowerBusinessName.includes("retail") ||
    lowerBusinessName.includes("champika hardware")
  );
}
