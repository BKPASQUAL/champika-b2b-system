import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  Truck,
  FileText,
  Settings,
  ClipboardList,
  CreditCard,
} from "lucide-react";

export type UserRole = "admin" | "office" | "rep" | "delivery";

export const roleNavItems = {
  admin: [
    { name: "Overview", href: "/dashboard/admin", icon: LayoutDashboard },
    { name: "Suppliers", href: "/dashboard/admin/suppliers", icon: Users },
    { name: "Products", href: "/dashboard/admin/products", icon: Package },
    { name: "Orders", href: "/dashboard/admin/orders", icon: ShoppingCart },
    { name: "Finance", href: "/dashboard/admin/finance", icon: CreditCard },
    { name: "Settings", href: "/dashboard/admin/settings", icon: Settings },
  ],
  office: [
    { name: "Office Board", href: "/dashboard/office", icon: LayoutDashboard },
    {
      name: "Process Orders",
      href: "/dashboard/office/orders",
      icon: ShoppingCart,
    },
    { name: "Invoices", href: "/dashboard/office/invoices", icon: FileText },
    { name: "Customers", href: "/dashboard/office/customers", icon: Users },
  ],
  rep: [
    { name: "My Dashboard", href: "/dashboard/rep", icon: LayoutDashboard },
    {
      name: "New Order",
      href: "/dashboard/rep/orders/create",
      icon: ShoppingCart,
    },
    { name: "My Customers", href: "/dashboard/rep/customers", icon: Users },
    { name: "Commission", href: "/dashboard/rep/commission", icon: CreditCard },
  ],
  delivery: [
    { name: "My Loads", href: "/dashboard/delivery", icon: Truck },
    {
      name: "Active Route",
      href: "/dashboard/delivery/active",
      icon: ClipboardList,
    },
    { name: "History", href: "/dashboard/delivery/history", icon: FileText },
  ],
};
