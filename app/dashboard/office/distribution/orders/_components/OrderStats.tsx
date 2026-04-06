// app/dashboard/office/distribution/orders/_components/OrderStats.tsx

import { Card, CardContent } from "@/components/ui/card";
import {
  ShoppingCart,
  Clock,
  Loader2,
  ClipboardCheck,
  Truck,
  MapPin,
} from "lucide-react";
import { Order } from "../types";

interface OrderStatsProps {
  orders: Order[];
}

export function OrderStats({ orders }: OrderStatsProps) {
  const totalOrders = orders.length;
  const pendingCount = orders.filter((o) => o.status === "Pending").length;
  const processingCount = orders.filter((o) => o.status === "Processing").length;
  const checkingCount = orders.filter((o) => o.status === "Checking").length;
  const loadingCount = orders.filter((o) => o.status === "Loading").length;
  const inTransitCount = orders.filter((o) => o.status === "In Transit").length;

  const stats = [
    {
      label: "Total Orders",
      value: totalOrders,
      sub: "All active orders",
      icon: ShoppingCart,
      iconBg: "bg-slate-100 text-slate-600",
      border: "",
      valueColor: "text-foreground",
    },
    {
      label: "Pending",
      value: pendingCount,
      sub: "Needs approval",
      icon: Clock,
      iconBg: "bg-yellow-100 text-yellow-600",
      border: "border-l-4 border-l-yellow-400",
      valueColor: "text-yellow-600",
    },
    {
      label: "Processing",
      value: processingCount,
      sub: "Picking items",
      icon: Loader2,
      iconBg: "bg-blue-100 text-blue-600",
      border: "border-l-4 border-l-blue-400",
      valueColor: "text-blue-600",
    },
    {
      label: "Checking",
      value: checkingCount,
      sub: "Quality control",
      icon: ClipboardCheck,
      iconBg: "bg-purple-100 text-purple-600",
      border: "border-l-4 border-l-purple-400",
      valueColor: "text-purple-600",
    },
    {
      label: "Loading",
      value: loadingCount,
      sub: "Ready to ship",
      icon: Truck,
      iconBg: "bg-green-100 text-green-600",
      border: "border-l-4 border-l-green-400",
      valueColor: "text-green-600",
    },
    {
      label: "In Transit",
      value: inTransitCount,
      sub: "On the way",
      icon: MapPin,
      iconBg: "bg-orange-100 text-orange-600",
      border: "border-l-4 border-l-orange-400",
      valueColor: "text-orange-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {stats.map(({ label, value, sub, icon: Icon, iconBg, border, valueColor }) => (
        <Card key={label} className={`${border} transition-shadow hover:shadow-md`}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground truncate pr-1">
                {label}
              </span>
              <div className={`rounded-md p-1.5 shrink-0 ${iconBg}`}>
                <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </div>
            </div>
            <div className={`text-2xl font-bold leading-none ${valueColor}`}>
              {value}
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">{sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
