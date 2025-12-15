// app/config/distribution-nav-config.ts
import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardCheck,
  Package,
  Truck,
  History,
  BarChart3,
  Loader2,
  Box,
  Send,
  LucideIcon,
  Clock,
  Warehouse,
} from "lucide-react";

interface DistNavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  description?: string;
}

interface DistNavSection {
  title?: string;
  items: DistNavItem[];
}

export const distributionNavItems: DistNavSection[] = [
  {
    items: [
      {
        name: "Distribution Dashboard",
        href: "/dashboard/office/distribution",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: "Order Fulfillment",
    items: [
      {
        name: "1. Pending Orders",
        href: "/dashboard/office/orders/pending",
        icon: Clock,
      },
      {
        name: "2. Processing",
        href: "/dashboard/office/orders/processing",
        icon: Loader2,
      },
      {
        name: "3. Final Checking",
        href: "/dashboard/office/orders/checking",
        icon: ClipboardCheck,
      },
      {
        name: "4. Loading Bay",
        href: "/dashboard/office/orders/loading",
        icon: Box,
      },
      {
        name: "5. Dispatched",
        href: "/dashboard/office/orders/loading/active",
        icon: Send,
      },
    ],
  },
  {
    title: "Logistics",
    items: [
      {
        name: "Active Loads",
        href: "/dashboard/office/distribution/loads/active",
        icon: Truck,
      },
      {
        name: "Load History",
        href: "/dashboard/office/distribution/loads/history",
        icon: History,
      },
    ],
  },
  {
    title: "Warehouse",
    items: [
      {
        name: "Main Inventory",
        href: "/dashboard/office/inventory",
        icon: Warehouse,
      },
      {
        name: "Stock Requests",
        href: "/dashboard/office/distribution/requests",
        icon: Package,
      },
    ],
  },
  {
    title: "Reports",
    items: [
      {
        name: "Dispatch Reports",
        href: "/dashboard/office/distribution/reports",
        icon: BarChart3,
      },
    ],
  },
];
