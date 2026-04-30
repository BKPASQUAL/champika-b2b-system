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
  Coins,
  LucideIcon,
  Undo2,
  Gift,
  ClipboardCheck,
  CalendarDays,
  ScrollText,
  Printer,
} from "lucide-react";

interface WiremanNavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  description?: string;
}

interface WiremanNavSection {
  title?: string;
  items: WiremanNavItem[];
}

export const wiremanOfficeNavItems: WiremanNavSection[] = [
  {
    items: [
      {
        name: "Agency Dashboard",
        href: "/dashboard/office/wireman",
        icon: LayoutDashboard,
        description: "Wireman overview",
      },
    ],
  },
  {
    title: "Customer Finance",
    items: [
      {
        name: "Customers",
        href: "/dashboard/office/wireman/customers",
        icon: Users,
      },
      {
        name: "Bills / Invoice",
        href: "/dashboard/office/wireman/invoices",
        icon: Receipt,
      },
      {
        name: "Payments Recv",
        href: "/dashboard/office/wireman/payments",
        icon: Banknote,
      },
      {
        name: "Payment Entry",
        href: "/dashboard/office/wireman/payments/entry",
        icon: ClipboardCheck,
        description: "Record & settle customer invoices",
      },
      {
        name: "Due Alerts",
        href: "/dashboard/office/wireman/invoices/due",
        icon: AlertCircle,
      },
    ],
  },
  {
    title: "Suppliers",
    items: [
      {
        name: "Supplier List",
        href: "/dashboard/office/wireman/suppliers",
        icon: Factory,
      },
      // NEW LINK ADDED HERE
      {
        name: "Free Issue Claims",
        href: "/dashboard/office/wireman/claims",
        icon: Gift,
      },
      {
        name: "Purchases",
        href: "/dashboard/office/wireman/purchases",
        icon: FileText,
      },
      {
        name: "Payments Out",
        href: "/dashboard/office/wireman/suppliers/payments",
        icon: Banknote,
      },
    ],
  },
  {
    title: "Inventory",
    items: [
      {
        name: "Product Catalog",
        href: "/dashboard/office/wireman/products",
        icon: Package,
      },
      {
        name: "Stock Control",
        href: "/dashboard/office/wireman/inventory",
        icon: Layers,
      },
      {
        name: "Returns",
        href: "/dashboard/office/wireman/inventory/returns",
        icon: Undo2,
      },
    ],
  },
  {
    title: "Analytics & Finance",
    items: [
      {
        name: "Expenses",
        href: "/dashboard/office/wireman/expenses",
        icon: Coins,
      },
      {
        name: "Cheque Management",
        href: "/dashboard/office/wireman/cheques",
        icon: ScrollText,
        description: "Track pending, deposited and cleared cheques",
      },
      {
        name: "Cheque Calendar",
        href: "/dashboard/office/wireman/calendar",
        icon: CalendarDays,
        description: "View customer & supplier cheques by date",
      },
      {
        name: "Cheque Report",
        href: "/dashboard/office/wireman/cheques/report",
        icon: Printer,
        description: "Generate cheque date reports",
      },
    ],
  },
];
