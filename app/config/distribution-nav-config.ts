// app/config/distribution-nav-config.ts
import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardCheck,
  Package,
  Loader2,
  Box,
  Send,
  LucideIcon,
  Clock,
  Briefcase,
  Receipt,
  Banknote,
  AlertCircle,
  Factory,
  FileText,
  Layers,
  Undo2, // Added Icon for Returns
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
        name: "Dashboard",
        href: "/dashboard/office/distribution",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: "Order Workflow",
    items: [
      {
        name: "All Orders",
        href: "/dashboard/office/distribution/orders",
        icon: ShoppingCart,
      },
      {
        name: "1. Pending",
        href: "/dashboard/office/distribution/orders/pending",
        icon: Clock,
      },
      {
        name: "2. Processing",
        href: "/dashboard/office/distribution/orders/processing",
        icon: Loader2,
      },
      {
        name: "3. Checking",
        href: "/dashboard/office/distribution/orders/checking",
        icon: ClipboardCheck,
      },
      {
        name: "4. Loading",
        href: "/dashboard/office/distribution/orders/loading",
        icon: Box,
      },
      {
        name: "5. Dispatched",
        href: "/dashboard/office/distribution/orders/loading/active",
        icon: Send,
      },
    ],
  },
  {
    title: "Customer Finance",
    items: [
      {
        name: "Customers",
        href: "/dashboard/office/distribution/customers",
        icon: Briefcase,
      },
      {
        name: "Bills / Invoice",
        href: "/dashboard/office/distribution/invoices",
        icon: Receipt,
      },
      {
        name: "Payments Recv",
        href: "/dashboard/office/distribution/payments",
        icon: Banknote,
      },
      {
        name: "Due Alerts",
        href: "/dashboard/office/distribution/invoices/due",
        icon: AlertCircle,
      },
    ],
  },
  {
    title: "Suppliers",
    items: [
      {
        name: "Supplier List",
        href: "/dashboard/office/distribution/suppliers",
        icon: Factory,
      },
      {
        name: "Purchases",
        href: "/dashboard/office/distribution/purchases",
        icon: FileText,
      },
      {
        name: "Payments Out",
        href: "/dashboard/office/distribution/suppliers/payments",
        icon: Banknote,
      },
    ],
  },
  {
    title: "Inventory",
    items: [
      {
        name: "Product Catalog",
        href: "/dashboard/office/distribution/products",
        icon: Package,
      },
      {
        name: "Stock Control",
        href: "/dashboard/office/distribution/inventory",
        icon: Layers,
      },
      {
        name: "Returns",
        href: "/dashboard/office/distribution/inventory/returns",
        icon: Undo2,
      },
    ],
  },
];
