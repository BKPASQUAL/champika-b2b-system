// app/config/sierra-nav-config.ts
import {
  LayoutDashboard,
  Users,
  FileText,
  Receipt,
  Banknote,
  AlertCircle,
  Factory,
  Package,
  Layers,
  LucideIcon,
  Undo2,
  ClipboardCheck,
  Coins,
} from "lucide-react";

interface SierraNavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  description?: string;
}

interface SierraNavSection {
  title?: string;
  items: SierraNavItem[];
}

export const sierraOfficeNavItems: SierraNavSection[] = [
  {
    items: [
      {
        name: "Sierra Dashboard",
        href: "/dashboard/office/sierra",
        icon: LayoutDashboard,
        description: "Sierra Agency overview",
      },
    ],
  },
  {
    title: "Customer Finance",
    items: [
      {
        name: "Customers",
        href: "/dashboard/office/sierra/customers",
        icon: Users,
      },
      {
        name: "Bills / Invoice",
        href: "/dashboard/office/sierra/invoices",
        icon: Receipt,
      },
      {
        name: "Payments Recv",
        href: "/dashboard/office/sierra/payments",
        icon: Banknote,
      },
      {
        name: "Payment Entry",
        href: "/dashboard/office/sierra/payments/entry",
        icon: ClipboardCheck,
        description: "Record & settle customer invoices",
      },
      {
        name: "Due Alerts",
        href: "/dashboard/office/sierra/invoices/due",
        icon: AlertCircle,
      },
    ],
  },
  {
    title: "Suppliers",
    items: [
      {
        name: "Supplier List",
        href: "/dashboard/office/sierra/suppliers",
        icon: Factory,
      },
      {
        name: "Purchases",
        href: "/dashboard/office/sierra/purchases",
        icon: FileText,
      },
      {
        name: "Payments Out",
        href: "/dashboard/office/sierra/suppliers/payments",
        icon: Banknote,
      },
    ],
  },
  {
    title: "Inventory",
    items: [
      {
        name: "Product Catalog",
        href: "/dashboard/office/sierra/products",
        icon: Package,
      },
      {
        name: "Stock Control",
        href: "/dashboard/office/sierra/inventory",
        icon: Layers,
      },
      {
        name: "Returns",
        href: "/dashboard/office/sierra/inventory/returns",
        icon: Undo2,
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        name: "Expenses",
        href: "/dashboard/office/sierra/expenses",
        icon: Coins,
      },
    ],
  },
];
