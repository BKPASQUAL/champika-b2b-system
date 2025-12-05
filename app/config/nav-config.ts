// app/config/nav-config.ts

import {
  LayoutDashboard,
  Users,
  Package,
  Layers,
  ShoppingCart,
  Truck,
  FileText,
  Settings,
  CreditCard,
  Briefcase,
  Landmark,
  Clock,
  Loader2,
  Box,
  ClipboardCheck,
  Receipt,
  Banknote,
  AlertCircle,
  Factory,
  ScrollText,
  Coins,
  LucideIcon,
  Store,
  Send,
} from "lucide-react";

export type UserRole = "admin" | "office" | "rep" | "delivery";

interface NavSection {
  title?: string;
  items: {
    name: string;
    href: string;
    icon: LucideIcon;
  }[];
}

export const roleNavItems: Record<UserRole, NavSection[]> = {
  admin: [
    {
      items: [
        { name: "Overview", href: "/dashboard/admin", icon: LayoutDashboard },
      ],
    },
    {
      title: "Order Workflow",
      items: [
        {
          name: "All Orders",
          href: "/dashboard/admin/orders",
          icon: ShoppingCart,
        },
        {
          name: "1. Pending",
          href: "/dashboard/admin/orders/pending",
          icon: Clock,
        },
        {
          name: "2. Processing",
          href: "/dashboard/admin/orders/processing",
          icon: Loader2,
        },
        {
          name: "3. Checking",
          href: "/dashboard/admin/orders/checking",
          icon: ClipboardCheck,
        },
        {
          name: "4. Loading",
          href: "/dashboard/admin/orders/loading",
          icon: Box,
        },
        {
          name: "5. Dispatched",
          href: "/dashboard/admin/orders/loading/active",
          icon: Send,
        },
      ],
    },
    {
      title: "Customer Finance",
      items: [
        {
          name: "Customers",
          href: "/dashboard/admin/customers",
          icon: Briefcase,
        },
        {
          name: "Bills / Invoice",
          href: "/dashboard/admin/invoices",
          icon: Receipt,
        },
        {
          name: "Payments Recv",
          href: "/dashboard/admin/payments",
          icon: Banknote,
        },
        {
          name: "Due Alerts",
          href: "/dashboard/admin/invoices/due",
          icon: AlertCircle,
        },
      ],
    },
    {
      title: "Suppliers",
      items: [
        {
          name: "Supplier List",
          href: "/dashboard/admin/suppliers",
          icon: Factory,
        },
        {
          name: "Purchases",
          href: "/dashboard/admin/purchases",
          icon: FileText,
        },
        {
          name: "Payments Out",
          href: "/dashboard/admin/suppliers/payments",
          icon: Banknote,
        },
      ],
    },
    {
      title: "Inventory",
      items: [
        {
          name: "Product Catalog",
          href: "/dashboard/admin/products",
          icon: Package,
        },
        // Ensure this item appears only ONCE here
        {
          name: "Stock Control",
          href: "/dashboard/admin/inventory",
          icon: Layers,
        },
      ],
    },
    {
      title: "Office Finance",
      items: [
        {
          name: "Bank Accounts",
          href: "/dashboard/admin/finance/accounts",
          icon: Landmark,
        },
        {
          name: "Cheque Registry",
          href: "/dashboard/admin/finance/checks",
          icon: ScrollText,
        },
        {
          name: "Expenses",
          href: "/dashboard/admin/finance/expenses",
          icon: Coins,
        },
      ],
    },
    {
      title: "System",
      items: [
        { name: "Users", href: "/dashboard/admin/users", icon: Users },
        { name: "Settings", href: "/dashboard/admin/settings", icon: Settings },
      ],
    },
  ],

  office: [
    {
      items: [
        { name: "Dashboard", href: "/dashboard/office", icon: LayoutDashboard },
      ],
    },
    {
      title: "Order Workflow",
      items: [
        {
          name: "All Orders",
          href: "/dashboard/office/orders",
          icon: ShoppingCart,
        },
        {
          name: "1. Pending",
          href: "/dashboard/office/orders/pending",
          icon: Clock,
        },
        {
          name: "2. Processing",
          href: "/dashboard/office/orders/processing",
          icon: Loader2,
        },
        {
          name: "3. Checking",
          href: "/dashboard/office/orders/checking",
          icon: ClipboardCheck,
        },
        {
          name: "4. Loading",
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
      title: "Customer Finance",
      items: [
        {
          name: "Customers",
          href: "/dashboard/office/customers",
          icon: Briefcase,
        },
        {
          name: "Bills / Invoice",
          href: "/dashboard/office/invoices",
          icon: Receipt,
        },
        {
          name: "Payments Recv",
          href: "/dashboard/office/payments",
          icon: Banknote,
        },
        {
          name: "Due Alerts",
          href: "/dashboard/office/invoices/due",
          icon: AlertCircle,
        },
      ],
    },
    {
      title: "Suppliers",
      items: [
        {
          name: "Supplier List",
          href: "/dashboard/office/suppliers",
          icon: Factory,
        },
        {
          name: "Purchases",
          href: "/dashboard/office/purchases",
          icon: FileText,
        },
        {
          name: "Payments Out",
          href: "/dashboard/office/suppliers/payments",
          icon: Banknote,
        },
      ],
    },
    {
      title: "Inventory",
      items: [
        {
          name: "Product Catalog",
          href: "/dashboard/office/products",
          icon: Package,
        },
        {
          name: "Stock Control",
          href: "/dashboard/office/inventory",
          icon: Layers,
        },
      ],
    },
  ],

  rep: [
    {
      items: [
        { name: "My Dashboard", href: "/dashboard/rep", icon: LayoutDashboard },
        {
          name: "New Order",
          href: "/dashboard/rep/orders/create",
          icon: ShoppingCart,
        },
        {
          name: "Product Catalog",
          href: "/dashboard/rep/products",
          icon: Store,
        },
        { name: "My Customers", href: "/dashboard/rep/customers", icon: Users },
        {
          name: "Due Invoices",
          href: "/dashboard/rep/invoices/due",
          icon: AlertCircle,
        },
        {
          name: "Commission",
          href: "/dashboard/rep/commission",
          icon: CreditCard,
        },
      ],
    },
  ],
  delivery: [
    {
      items: [
        { name: "My Loads", href: "/dashboard/delivery", icon: Truck },
        {
          name: "Active Route",
          href: "/dashboard/delivery/active",
          icon: FileText,
        },
      ],
    },
  ],
};
