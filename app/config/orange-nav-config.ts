// app/config/orange-nav-config.ts
import {
  LayoutDashboard,
  Users,
  Briefcase,
  FileText,
  Receipt,
  Banknote,
  AlertCircle,
  Factory,
  ShoppingCart,
  Package,
  Layers,
  BarChart3,
  Coins,
  LucideIcon,
  Truck,
} from "lucide-react";

interface OrangeNavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  description?: string;
}

interface OrangeNavSection {
  title?: string;
  items: OrangeNavItem[];
}

export const orangeOfficeNavItems: OrangeNavSection[] = [
  {
    items: [
      {
        name: "Agency Dashboard",
        href: "/dashboard/office/orange",
        icon: LayoutDashboard,
        description: "Distribution overview",
      },
    ],
  },
  {
    title: "Customer Finance",
    items: [
      {
        name: "Customers",
        href: "/dashboard/office/orange/customers",
        icon: Users,
      },
      {
        name: "Bills / Invoice",
        href: "/dashboard/office/orange/invoices",
        icon: Receipt,
      },
      {
        name: "Payments Recv",
        href: "/dashboard/office/orange/payments",
        icon: Banknote,
      },
      {
        name: "Due Alerts",
        href: "/dashboard/office/orange/invoices/due",
        icon: AlertCircle,
      },
    ],
  },
  {
    title: "Suppliers",
    items: [
      {
        name: "Supplier List",
        href: "/dashboard/office/orange/suppliers",
        icon: Factory,
      },
      {
        name: "Purchases",
        href: "/dashboard/office/orange/purchases", // Or /purchases
        icon: FileText,
      },
      {
        name: "Payments Out",
        href: "/dashboard/office/orange/suppliers/payments",
        icon: Banknote,
      },
    ],
  },
  {
    title: "Inventory",
    items: [
      {
        name: "Product Catalog",
        href: "/dashboard/office/orange/products",
        icon: Package,
      },
      {
        name: "Stock Control",
        href: "/dashboard/office/orange/inventory",
        icon: Layers,
      },
    ],
  },
  {
    title: "Analytics & Finance",
    items: [
      {
        name: "Profit & Reports",
        href: "/dashboard/office/orange/reports",
        icon: BarChart3,
      },
      {
        name: "Expenses",
        href: "/dashboard/office/orange/expenses",
        icon: Coins,
      },
    ],
  },
];