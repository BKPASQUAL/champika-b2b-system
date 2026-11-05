"use client";

// Profit per item for one invoice. Shown to admin only, when the invoice is opened
// from Business Analytics. Same formula as the Actual Profit report:
//   sales  = line total − share of invoice extra discount − share of cash discount
//   cost   = (paid + free qty) × saved FIFO cost per unit
//   profit = sales − cost

import { useEffect, useState } from "react";
import { TrendingUp, AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const money = (v: number) => v.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (profit: number, sales: number) => (sales > 0 ? (profit / sales) * 100 : 0);

export function InvoiceProfitCard({ invoiceId, hasReturns }: { invoiceId: string; hasReturns?: boolean }) {
  // Loads its own copy of the invoice with the saved costs (the page's copy has none)
  const [invoice, setInvoice] = useState<any>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(`/api/invoices/${invoiceId}?withCost=1`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => alive && setInvoice(d))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [invoiceId]);

  if (!invoice) {
    return (
      <Card className="shadow-sm border-l-4 border-l-emerald-500">
        <CardContent className="py-6 flex items-center gap-2 text-sm text-muted-foreground">
          {error ? (
            "Could not load profit for this invoice."
          ) : (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Loading profit…
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  const items: any[] = invoice?.items || [];
  const subtotal = items.reduce((s, i) => s + (Number(i.total) || 0), 0);
  const invoiceDiscount = (Number(invoice?.extraDiscountAmount) || 0) + (Number(invoice?.cashDiscountAmount) || 0);

  const rows = items.map((i) => {
    const qty = (Number(i.quantity) || 0) + (Number(i.freeQuantity) || 0);
    const lineTotal = Number(i.total) || 0;
    const sales = lineTotal - (subtotal > 0 ? (lineTotal / subtotal) * invoiceDiscount : 0);
    const unitCost = i.actualUnitCost != null ? Number(i.actualUnitCost) : null;
    const cost = unitCost != null ? qty * unitCost : null;
    const profit = cost != null ? sales - cost : null;
    return { ...i, qty, sales, unitCost, cost, profit };
  });

  const known = rows.filter((r) => r.cost != null);
  const totalSales = rows.reduce((s, r) => s + r.sales, 0);
  const totalCost = known.reduce((s, r) => s + (r.cost as number), 0);
  const totalProfit = known.reduce((s, r) => s + (r.profit as number), 0);
  const knownSales = known.reduce((s, r) => s + r.sales, 0);
  const missing = rows.length - known.length;

  return (
    <Card className="shadow-sm overflow-hidden border-l-4 border-l-emerald-500">
      <CardHeader className="bg-emerald-50/40 border-b py-4">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" /> Profit by Item
          </CardTitle>
          <Badge variant="outline" className="font-normal">Admin only</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-100 border-b">
          {[
            { label: "Sales (after discounts)", value: `LKR ${money(totalSales)}`, cls: "text-slate-800" },
            { label: "Cost", value: `LKR ${money(totalCost)}`, cls: "text-slate-800" },
            {
              label: "Profit",
              value: `LKR ${money(totalProfit)}`,
              cls: totalProfit < 0 ? "text-red-600" : "text-emerald-700",
            },
            {
              label: "Margin",
              value: `${pct(totalProfit, knownSales).toFixed(1)}%`,
              cls: totalProfit < 0 ? "text-red-600" : "text-emerald-700",
            },
          ].map((s) => (
            <div key={s.label} className="bg-white px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{s.label}</p>
              <p className={cn("text-base font-bold font-mono mt-0.5", s.cls)}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="pl-6">Product</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Cost / Unit</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right pr-6">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className={cn(r.profit != null && r.profit < 0 && "bg-red-50/50")}>
                  <TableCell className="pl-6 py-3">
                    <p className="font-medium text-sm">{r.productName}</p>
                    <p className="text-xs font-mono text-muted-foreground">{r.sku}</p>
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {r.qty}
                    {Number(r.freeQuantity) > 0 && (
                      <span className="block text-[10px] text-muted-foreground">incl. {r.freeQuantity} free</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{money(r.sales)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {r.unitCost != null ? money(r.unitCost) : <span className="text-amber-600">No cost</span>}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{r.cost != null ? money(r.cost) : "-"}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono text-sm font-semibold",
                      r.profit == null ? "" : r.profit < 0 ? "text-red-600" : "text-emerald-700"
                    )}
                  >
                    {r.profit != null ? money(r.profit) : "-"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right pr-6 text-sm font-medium",
                      r.profit != null && r.profit < 0 ? "text-red-600" : "text-slate-700"
                    )}
                  >
                    {r.profit != null ? `${pct(r.profit, r.sales).toFixed(1)}%` : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="bg-slate-50/50">
              <TableRow>
                <TableCell className="pl-6 font-semibold">Total</TableCell>
                <TableCell className="text-center font-semibold">{rows.reduce((s, r) => s + r.qty, 0)}</TableCell>
                <TableCell className="text-right font-mono font-semibold">{money(totalSales)}</TableCell>
                <TableCell />
                <TableCell className="text-right font-mono font-semibold">{money(totalCost)}</TableCell>
                <TableCell
                  className={cn("text-right font-mono font-bold", totalProfit < 0 ? "text-red-600" : "text-emerald-700")}
                >
                  {money(totalProfit)}
                </TableCell>
                <TableCell className="text-right pr-6 font-semibold">{pct(totalProfit, knownSales).toFixed(1)}%</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        <div className="px-6 py-3 text-xs text-muted-foreground space-y-1 border-t">
          <p>
            Sales are after item discounts and this invoice&apos;s share of the extra/cash discount. Cost is the FIFO
            cost saved on each line (free items included).
          </p>
          {missing > 0 && (
            <p className="flex items-center gap-1 text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5" /> {missing} item(s) have no saved cost and are left out of the totals.
            </p>
          )}
          {hasReturns && (
            <p className="flex items-center gap-1 text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5" /> This invoice has returns; they are not taken off here.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
