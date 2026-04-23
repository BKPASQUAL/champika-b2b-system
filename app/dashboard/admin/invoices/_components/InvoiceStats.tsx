import { Card, CardContent } from "@/components/ui/card";
import {
  Banknote,
  CalendarClock,
  AlertCircle,
  CheckCircle2,
  Clock,
  AlertOctagon,
} from "lucide-react";
import { Invoice } from "../types";

interface InvoiceStatsProps {
  invoices: Invoice[];
}

export function InvoiceStats({ invoices }: InvoiceStatsProps) {
  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const last30DaysRevenue = invoices
    .filter((inv) => new Date(inv.date) >= thirtyDaysAgo)
    .reduce((sum, inv) => sum + inv.totalAmount, 0);

  const totalDue = invoices.reduce((sum, inv) => sum + inv.dueAmount, 0);
  const paidCount = invoices.filter((inv) => inv.status === "Paid").length;
  const pendingCount = invoices.filter(
    (inv) => inv.status === "Unpaid" || inv.status === "Partial"
  ).length;
  const overdueCount = invoices.filter((inv) => inv.status === "Overdue").length;

  const stats = [
    {
      label: "Total Revenue",
      value: `LKR ${(totalRevenue / 1000000).toFixed(2)}M`,
      sub: "Lifetime sales",
      Icon: Banknote,
      iconBg: "bg-slate-100",
      iconColor: "text-slate-600",
      accent: "border-t-slate-400",
      valueColor: "text-slate-800",
    },
    {
      label: "Last 30 Days",
      value: `LKR ${(last30DaysRevenue / 100000).toFixed(2)}L`,
      sub: "Sales this month",
      Icon: CalendarClock,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      accent: "border-t-blue-500",
      valueColor: "text-blue-700",
    },
    {
      label: "Due Amount",
      value: `LKR ${(totalDue / 100000).toFixed(2)}L`,
      sub: "Outstanding",
      Icon: AlertCircle,
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      accent: "border-t-red-500",
      valueColor: "text-red-600",
    },
    {
      label: "Paid Invoices",
      value: String(paidCount),
      sub: "Fully settled",
      Icon: CheckCircle2,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      accent: "border-t-green-500",
      valueColor: "text-green-700",
    },
    {
      label: "Pending Bills",
      value: String(pendingCount),
      sub: "Unpaid & Partial",
      Icon: Clock,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      accent: "border-t-amber-500",
      valueColor: "text-amber-700",
    },
    {
      label: "Overdue Bills",
      value: String(overdueCount),
      sub: "Payment missed",
      Icon: AlertOctagon,
      iconBg: "bg-rose-100",
      iconColor: "text-rose-600",
      accent: "border-t-rose-500",
      valueColor: "text-rose-700",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
      {stats.map(({ label, value, sub, Icon, iconBg, iconColor, accent, valueColor }) => (
        <Card key={label} className={`border-t-4 ${accent} shadow-sm`}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] font-medium text-muted-foreground leading-tight">{label}</p>
              <div className={`p-1 rounded ${iconBg}`}>
                <Icon className={`w-3 h-3 ${iconColor}`} />
              </div>
            </div>
            <div className={`text-lg font-bold leading-none ${valueColor}`}>{value}</div>
            <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
