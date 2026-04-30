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
  Undo2,
  ClipboardCheck,
  CalendarDays,
  ScrollText,
  Printer,
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
        name: "Payment Entry",
        href: "/dashboard/office/orange/payments/entry",
        icon: ClipboardCheck,
        description: "Record & settle customer invoices",
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
        href: "/dashboard/office/orange/purchases",
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
      {
        name: "Returns",
        href: "/dashboard/office/orange/inventory/returns",
        icon: Undo2,
      },
    ],
  },
  {
    title: "Analytics & Finance",
    items: [
      {
        name: "Expenses",
        href: "/dashboard/office/orange/expenses",
        icon: Coins,
      },
      {
        name: "Cheque Management",
        href: "/dashboard/office/orange/cheques",
        icon: ScrollText,
        description: "Track pending, deposited and cleared cheques",
      },
      {
        name: "Cheque Calendar",
        href: "/dashboard/office/orange/calendar",
        icon: CalendarDays,
        description: "View customer & supplier cheques by date",
      },
      {
        name: "Cheque Report",
        href: "/dashboard/office/orange/cheques/report",
        icon: Printer,
        description: "Generate cheque date reports",
      },
    ],
  },
];
