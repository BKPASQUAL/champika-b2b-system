// app/config/order-workflow-nav.ts
// "Order Workflow" sidebar section for agency office portals (Orange, Sierra).
// Same steps as Distribution; the pages filter to the portal's own orders.
import {
  ShoppingCart,
  Clock,
  CheckCircle2,
  Loader2,
  ClipboardCheck,
  Box,
  Send,
  AlertCircle,
  LucideIcon,
} from "lucide-react";

export interface OrderWorkflowNavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  adminOnly?: boolean;
}

export function buildOrderWorkflowNav(basePath: string): {
  title: string;
  items: OrderWorkflowNavItem[];
} {
  return {
    title: "Order Workflow",
    items: [
      { name: "All Orders", href: `${basePath}/orders`, icon: ShoppingCart, adminOnly: true },
      { name: "1. Pending", href: `${basePath}/orders/pending`, icon: Clock },
      { name: "2. Approved", href: `${basePath}/orders/approved`, icon: CheckCircle2 },
      { name: "3. Processing", href: `${basePath}/orders/processing`, icon: Loader2 },
      { name: "4. Checking", href: `${basePath}/orders/checking`, icon: ClipboardCheck },
      { name: "5. Loading", href: `${basePath}/orders/loading`, icon: Box },
      { name: "6. Dispatched", href: `${basePath}/orders/loading/active`, icon: Send },
      {
        name: "7. Cancel Requests",
        href: `${basePath}/orders/cancel-requests`,
        icon: AlertCircle,
        adminOnly: true,
      },
    ],
  };
}
