"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, RefreshCw, Search, AlertTriangle, Scale } from "lucide-react";
import { toast } from "sonner";
import { BUSINESS_NAMES } from "@/app/config/business-constants";

// ─── Formatting ─────────────────────────────────────────────────────────────
const money = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money0 = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString("en-LK", { maximumFractionDigits: 0 });
const pct = (n: number | null | undefined) => `${(Number(n) || 0).toFixed(1)}%`;
const qty = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString("en-LK", { maximumFractionDigits: 2 });
const tone = (n: number) => (n < 0 ? "text-rose-600" : "text-emerald-600");

const iso = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

function rangeFor(period: string): { from: string; to: string } {
  const now = new Date();
  switch (period) {
    case "last-month":
      return {
        from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: iso(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    case "last-3-months":
      return { from: iso(new Date(now.getFullYear(), now.getMonth() - 2, 1)), to: iso(now) };
    case "this-year":
      return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(now) };
    case "this-month":
    default:
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
  }
}

function downloadCSV(name: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = "﻿" + [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// Rows for the business-by-business statement (one column per business)
type BizRow = {
  key: string;
  label: string;
  bold?: boolean;
  sign?: "-" | "+" | "±";
  kind?: "money" | "pct" | "qty";
  calc?: (b: any) => number;
};
const BUSINESS_ROWS: BizRow[] = [
  { key: "paidQty", label: "Paid qty", kind: "qty" },
  { key: "freeQty", label: "Free qty given", kind: "qty" },
  { key: "grossSales", label: "Sales (paid qty × selling rate)" },
  { key: "allDiscounts", label: "Line + extra + cash discounts", sign: "-",
    calc: (b) => b.lineDiscount + b.extraDiscount + b.cashDiscount },
  { key: "actualSales", label: "Net sales", bold: true },
  { key: "bookCost", label: "Cost of paid units (bill rate)" },
  { key: "supplierExtraDiscount", label: "Supplier extra discount", sign: "-" },
  { key: "supplierFreeBenefit", label: "Supplier free items", sign: "-" },
  { key: "batchDifference", label: "Stock batch difference", sign: "±" },
  { key: "actualCostPaid", label: "Actual cost of paid units", bold: true },
  { key: "freeIssueCost", label: "Free issues given to customers", sign: "+" },
  { key: "freeClaimQty", label: "Supplier free claim qty", kind: "qty" },
  { key: "supplierFreeClaims", label: "Supplier free claims received", sign: "-" },
  { key: "supplierMonthlyClaims", label: "Supplier monthly claim discount", sign: "-" },
  { key: "actualCost", label: "Total actual cost", bold: true },
  { key: "sellingRate", label: "Avg selling rate" },
  { key: "actualSellingRate", label: "Avg actual selling rate" },
  { key: "knownCostRate", label: "Avg known cost rate" },
  { key: "actualCostRate", label: "Avg actual cost rate" },
  { key: "bookProfit", label: "Book profit", bold: true },
  { key: "actualProfit", label: "Actual profit", bold: true },
  { key: "bookMargin", label: "Book margin", kind: "pct" },
  { key: "actualMargin", label: "Actual margin", kind: "pct" },
];

// ─── Small UI pieces ────────────────────────────────────────────────────────
function Kpi({ label, value, sub, valueClass }: { label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-bold mt-1 tabular-nums ${valueClass || ""}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  book,
  actual,
  bold,
  sign,
  hint,
}: {
  label: string;
  book?: number | null;
  actual?: number | null;
  bold?: boolean;
  sign?: "-" | "+" | "±";
  hint?: string;
}) {
  const cell = (v?: number | null) => {
    if (v === null || v === undefined) return <span className="text-muted-foreground">—</span>;
    if (sign === "±") return <>{v > 0 ? "+ " : v < 0 ? "- " : ""}{money(Math.abs(v))}</>;
    return (
      <>
        {sign && v !== 0 ? `${sign} ` : ""}
        {money(v)}
      </>
    );
  };
  return (
    <TableRow className={bold ? "bg-muted/40 font-semibold" : ""}>
      <TableCell>
        {label}
        {hint && <div className="text-[11px] text-muted-foreground font-normal">{hint}</div>}
      </TableCell>
      <TableCell className="text-right tabular-nums">{cell(book)}</TableCell>
      <TableCell className="text-right tabular-nums">{cell(actual)}</TableCell>
    </TableRow>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function ActualProfitReportPage() {
  const [period, setPeriod] = useState("this-month");
  const [from, setFrom] = useState(rangeFor("this-month").from);
  const [to, setTo] = useState(rangeFor("this-month").to);
  const [businessId, setBusinessId] = useState("all");
  const [excludeInternal, setExcludeInternal] = useState(true);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const [search, setSearch] = useState("");
  const [lossOnly, setLossOnly] = useState(false);

  const applyPeriod = (p: string) => {
    setPeriod(p);
    if (p !== "custom") {
      const r = rangeFor(p);
      setFrom(r.from);
      setTo(r.to);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        from,
        to,
        businessId,
        excludeInternal: String(excludeInternal),
      });
      const res = await fetch(`/api/reports/actual-profit?${qs}`);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Failed to load report");
      setData(json);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, businessId, excludeInternal]);

  const s = data?.summary;

  const matches = (text: string) => !search.trim() || text.toLowerCase().includes(search.toLowerCase().trim());

  const products = useMemo(
    () =>
      (data?.products || []).filter(
        (p: any) => matches(`${p.name} ${p.sku} ${p.supplier}`) && (!lossOnly || p.actualProfit < 0),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, search, lossOnly],
  );
  const invoices = useMemo(
    () =>
      (data?.invoices || []).filter(
        (i: any) => matches(`${i.invoiceNo} ${i.customer}`) && (!lossOnly || i.actualProfit < 0),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, search, lossOnly],
  );
  const suppliers = useMemo(
    () => (data?.suppliers || []).filter((x: any) => matches(x.name) && (!lossOnly || x.actualProfit < 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, search, lossOnly],
  );
  const purchases = useMemo(
    () =>
      (data?.purchases?.rows || []).filter((r: any) =>
        matches(`${r.product} ${r.supplier} ${r.invoiceNo} ${r.purchaseId}`),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, search],
  );

  const businesses = useMemo(
    () => (data?.businesses || []).filter((b: any) => matches(b.name) && (!lossOnly || b.actualProfit < 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, search, lossOnly],
  );

  const exportBusinesses = () =>
    downloadCSV(
      `Actual_Profit_Businesses_${from}_to_${to}.csv`,
      ["Item", ...businesses.map((b: any) => b.name)],
      BUSINESS_ROWS.map((r) => [
        r.label,
        ...businesses.map((b: any) => {
          const v = r.calc ? r.calc(b) : b[r.key];
          return r.kind === "pct" ? v.toFixed(1) : r.kind === "qty" ? v : v.toFixed(2);
        }),
      ]),
    );

  const exportProducts = () =>
    downloadCSV(
      `Actual_Profit_Products_${from}_to_${to}.csv`,
      [
        "Product", "SKU", "Supplier", "Paid Qty", "Free Qty",
        "Known Cost Rate", "Actual Cost Rate", "Selling Rate", "Actual Selling Rate",
        "Gross Sales", "Discounts", "Actual Sales", "Book Cost", "Supplier Extra Discount", "Supplier Free Items",
        "Batch Difference", "Monthly Claim Discount", "Actual Cost", "Free Issue Cost",
        "Book Profit", "Actual Profit", "Gap", "Book Margin %", "Actual Margin %",
      ],
      products.map((p: any) => [
        p.name, p.sku, p.supplier, p.paidQty, p.freeQty,
        p.knownCostRate.toFixed(2), p.actualCostRate.toFixed(2), p.sellingRate.toFixed(2), p.actualSellingRate.toFixed(2),
        p.grossSales.toFixed(2), (p.lineDiscount + p.extraDiscount + p.cashDiscount).toFixed(2), p.actualSales.toFixed(2),
        p.bookCost.toFixed(2), p.supplierExtraDiscount.toFixed(2), p.supplierFreeBenefit.toFixed(2),
        p.batchDifference.toFixed(2), p.supplierMonthlyClaims.toFixed(2), p.actualCost.toFixed(2), p.freeIssueCost.toFixed(2),
        p.bookProfit.toFixed(2), p.actualProfit.toFixed(2), p.profitGap.toFixed(2),
        p.bookMargin.toFixed(1), p.actualMargin.toFixed(1),
      ]),
    );

  const exportInvoices = () =>
    downloadCSV(
      `Actual_Profit_Invoices_${from}_to_${to}.csv`,
      ["Invoice", "Date", "Customer", "Paid Qty", "Free Qty", "Gross Sales", "Discounts", "Actual Sales",
        "Book Cost", "Actual Cost", "Book Profit", "Actual Profit", "Gap", "Actual Margin %"],
      invoices.map((i: any) => [
        i.invoiceNo, i.date, i.customer, i.paidQty, i.freeQty, i.grossSales.toFixed(2),
        (i.lineDiscount + i.extraDiscount + i.cashDiscount).toFixed(2), i.actualSales.toFixed(2),
        i.bookCost.toFixed(2), i.actualCost.toFixed(2), i.bookProfit.toFixed(2), i.actualProfit.toFixed(2),
        i.profitGap.toFixed(2), i.actualMargin.toFixed(1),
      ]),
    );

  const exportPurchases = () =>
    downloadCSV(
      `Purchase_Actual_Cost_${from}_to_${to}.csv`,
      ["Date", "PO", "Supplier Invoice", "Supplier", "Product", "Paid Qty", "Free Qty", "Bill Rate",
        "Line Disc %", "Known Cost Rate", "Bill Value", "Extra Discount", "Net Value", "Actual Cost Rate", "Saving / Unit", "Saving %"],
      purchases.map((r: any) => [
        r.date, r.purchaseId, r.invoiceNo, r.supplier, r.product, r.paidQty, r.freeQty, r.billRate.toFixed(2),
        r.lineDiscountPercent, r.knownRate.toFixed(2), r.billValue.toFixed(2), r.extraDiscount.toFixed(2),
        r.netValue.toFixed(2), r.actualRate.toFixed(2), r.saving.toFixed(2), r.savingPercent.toFixed(1),
      ]),
    );

  const pt = data?.purchases?.totals;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Scale className="h-7 w-7 text-primary" /> Actual Profit Report
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            Book profit uses the bill cost and the selling rate. Actual profit also counts extra and cash
            discounts, supplier discounts, and free issues (free units are spread over the paid units to
            get the real per-unit rate).
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Select value={period} onValueChange={applyPeriod}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="this-month">This month</SelectItem>
              <SelectItem value="last-month">Last month</SelectItem>
              <SelectItem value="last-3-months">Last 3 months</SelectItem>
              <SelectItem value="this-year">This year</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={from} className="w-[150px]"
            onChange={(e) => { setPeriod("custom"); setFrom(e.target.value); }} />
          <Input type="date" value={to} className="w-[150px]"
            onChange={(e) => { setPeriod("custom"); setTo(e.target.value); }} />
          <Select value={businessId} onValueChange={setBusinessId}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All businesses</SelectItem>
              {Object.entries(BUSINESS_NAMES).map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm h-9 px-2">
            <Switch checked={excludeInternal} onCheckedChange={setExcludeInternal} />
            Exclude internal (Champika Hardware)
          </label>
          <Button variant="outline" size="icon" onClick={load} disabled={loading} title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <div className="py-24 text-center text-muted-foreground">Calculating actual profit…</div>
      ) : !s ? (
        <div className="py-24 text-center text-muted-foreground">No data.</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Kpi label="Book profit" value={`LKR ${money0(s.bookProfit)}`} sub={`Margin ${pct(s.bookMargin)}`}
              valueClass={tone(s.bookProfit)} />
            <Kpi label="Actual profit" value={`LKR ${money0(s.actualProfit)}`} sub={`Margin ${pct(s.actualMargin)}`}
              valueClass={tone(s.actualProfit)} />
            <Kpi label="Difference" value={`LKR ${money0(s.profitGap)}`}
              sub="Book profit minus actual profit" valueClass={s.profitGap > 0 ? "text-amber-600" : "text-emerald-600"} />
            <Kpi label="Free issues given" value={`LKR ${money0(s.freeIssueCost)}`}
              sub={`${qty(s.freeQty)} units · supplier free claims LKR ${money0(s.supplierFreeClaims)}`} />
            <Kpi label="Loss lines" value={String(s.lossLines)}
              sub={`${s.hiddenLossLines} look profitable on book`}
              valueClass={s.lossLines > 0 ? "text-rose-600" : ""} />
          </div>

          {/* Book vs Actual statement */}
          <div className="grid lg:grid-cols-5 gap-4">
            <Card className="lg:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Book vs actual</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead></TableHead>
                      <TableHead className="text-right">Book</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <Row label="Sales (paid qty × selling rate)" book={s.grossSales} actual={s.grossSales} />
                    <Row label="Line discounts" book={null} actual={s.lineDiscount} sign="-" />
                    <Row label="Invoice extra discounts" book={null} actual={s.extraDiscount} sign="-" />
                    <Row label="Cash discounts" book={null} actual={s.cashDiscount} sign="-" />
                    <Row label="Net sales" book={s.grossSales} actual={s.actualSales} bold />
                    <Row label="Cost of paid units (supplier bill rate)" book={s.bookCost} actual={s.bookCost}
                      hint="Paid qty × known cost from the supplier bill" />
                    <Row label="Supplier extra discount" book={null} actual={s.supplierExtraDiscount} sign="-"
                      hint="Bill extra discount, shared over the items on that bill" />
                    <Row label="Supplier free items (on the bill)" book={null} actual={s.supplierFreeBenefit} sign="-"
                      hint="Free units on a normal bill, spread over paid units → lower cost per unit" />
                    <Row label="Stock batch difference" book={null} actual={s.batchDifference} sign="±"
                      hint="FIFO: older/newer stock sold at a different cost than the latest bill" />
                    <Row label="Actual cost of paid units" book={s.bookCost} actual={s.actualCostPaid} bold />
                    <Row label="Cost of free issues given to customers" book={null} actual={s.freeIssueCost} sign="+"
                      hint={`${qty(s.freeQty)} free units × actual cost`} />
                    <Row label="Supplier free claims received" book={null} actual={s.supplierFreeClaims} sign="-"
                      hint={`${qty(s.freeClaimQty)} free units received from suppliers (free-claim purchases) × actual cost`} />
                    <Row label="Supplier monthly claim discount" book={null} actual={s.supplierMonthlyClaims} sign="-"
                      hint={`${s.monthlyClaimCount || 0} claim bill(s) — already taken off the sold items' actual cost`} />
                    <Row label="Total cost" book={s.bookCost} actual={s.actualCost} bold />
                    <TableRow className="font-bold text-base">
                      <TableCell>Profit</TableCell>
                      <TableCell className={`text-right tabular-nums ${tone(s.bookProfit)}`}>{money(s.bookProfit)}</TableCell>
                      <TableCell className={`text-right tabular-nums ${tone(s.actualProfit)}`}>{money(s.actualProfit)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Margin</TableCell>
                      <TableCell className="text-right tabular-nums">{pct(s.bookMargin)}</TableCell>
                      <TableCell className="text-right tabular-nums">{pct(s.actualMargin)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Average per-unit rates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Selling rate</p>
                    <p className="text-lg font-semibold tabular-nums">{money(s.sellingRate)}</p>
                  </div>
                  <div className="rounded-md border p-3 border-primary/40">
                    <p className="text-xs text-muted-foreground">Actual selling rate</p>
                    <p className="text-lg font-semibold tabular-nums">{money(s.actualSellingRate)}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Known cost rate</p>
                    <p className="text-lg font-semibold tabular-nums">{money(s.knownCostRate)}</p>
                  </div>
                  <div className="rounded-md border p-3 border-primary/40">
                    <p className="text-xs text-muted-foreground">Actual cost rate</p>
                    <p className="text-lg font-semibold tabular-nums">{money(s.actualCostRate)}</p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground space-y-1 border-t pt-3">
                  <p><b>Actual selling rate</b> = net sales ÷ (paid + free qty)</p>
                  <p><b>Actual cost rate</b> = FIFO cost after supplier extra discount, spread over paid + free qty</p>
                  <p>{s.invoiceCount} invoices · {qty(s.paidQty)} paid units · {qty(s.freeQty)} free units</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detail tabs */}
          <Tabs defaultValue="businesses">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <TabsList>
                <TabsTrigger value="businesses">Businesses</TabsTrigger>
                <TabsTrigger value="products">Products</TabsTrigger>
                <TabsTrigger value="invoices">Invoices</TabsTrigger>
                <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
                <TabsTrigger value="purchases">Purchase costs</TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 w-[220px]" />
                </div>
                <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                  <Switch checked={lossOnly} onCheckedChange={setLossOnly} /> Losses only
                </label>
              </div>
            </div>

            {/* Businesses */}
            <TabsContent value="businesses">
              <Card>
                <CardContent className="p-0">
                  <div className="flex justify-end p-2">
                    <Button size="sm" variant="outline" onClick={exportBusinesses}>
                      <Download className="h-4 w-4 mr-1" /> CSV
                    </Button>
                  </div>
                  {businesses.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No businesses</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[230px]"></TableHead>
                            {businesses.map((b: any) => (
                              <TableHead key={b.id} className="text-right min-w-[150px]">
                                <div className="font-semibold text-foreground">{b.name}</div>
                                <div className="text-[11px] font-normal">{b.invoiceCount} invoices</div>
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {BUSINESS_ROWS.map((r) => (
                            <TableRow key={r.key} className={r.bold ? "bg-muted/40 font-semibold" : ""}>
                              <TableCell>{r.label}</TableCell>
                              {businesses.map((b: any) => {
                                const v = r.calc ? r.calc(b) : b[r.key];
                                const isProfit = r.key.endsWith("Profit");
                                let text: string;
                                if (r.kind === "pct") text = pct(v);
                                else if (r.kind === "qty") text = qty(v);
                                else if (r.sign === "±") text = `${v > 0 ? "+ " : v < 0 ? "- " : ""}${money(Math.abs(v))}`;
                                else text = `${r.sign && v ? r.sign + " " : ""}${money(v)}`;
                                return (
                                  <TableCell key={b.id}
                                    className={`text-right tabular-nums ${isProfit || r.kind === "pct" ? tone(v) : ""}`}>
                                    {text}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Products */}
            <TabsContent value="products">
              <Card>
                <CardContent className="p-0">
                  <div className="flex justify-end p-2">
                    <Button size="sm" variant="outline" onClick={exportProducts}>
                      <Download className="h-4 w-4 mr-1" /> CSV
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Paid</TableHead>
                          <TableHead className="text-right">Free</TableHead>
                          <TableHead className="text-right">Known cost</TableHead>
                          <TableHead className="text-right">Actual cost</TableHead>
                          <TableHead className="text-right">Selling rate</TableHead>
                          <TableHead className="text-right">Actual selling</TableHead>
                          <TableHead className="text-right">Book profit</TableHead>
                          <TableHead className="text-right">Actual profit</TableHead>
                          <TableHead className="text-right">Margin (book / actual)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.length === 0 && (
                          <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No products</TableCell></TableRow>
                        )}
                        {products.map((p: any) => {
                          const hidden = p.bookProfit > 0 && p.actualProfit < 0;
                          return (
                            <TableRow key={p.id} className={p.actualProfit < 0 ? "bg-rose-50/60 dark:bg-rose-950/20" : ""}>
                              <TableCell className="max-w-[280px]">
                                <div className="font-medium truncate" title={p.name}>{p.name}</div>
                                <div className="text-[11px] text-muted-foreground">
                                  {p.supplier || "—"}{p.sku ? ` · ${p.sku}` : ""}
                                  {hidden && (
                                    <Badge variant="outline" className="ml-2 text-[10px] border-amber-400 text-amber-700">
                                      <AlertTriangle className="h-3 w-3 mr-1" /> hidden loss
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{qty(p.paidQty)}</TableCell>
                              <TableCell className="text-right tabular-nums">{p.freeQty ? qty(p.freeQty) : "—"}</TableCell>
                              <TableCell className="text-right tabular-nums">{money(p.knownCostRate)}</TableCell>
                              <TableCell className="text-right tabular-nums font-medium">{money(p.actualCostRate)}</TableCell>
                              <TableCell className="text-right tabular-nums">{money(p.sellingRate)}</TableCell>
                              <TableCell className="text-right tabular-nums font-medium">{money(p.actualSellingRate)}</TableCell>
                              <TableCell className={`text-right tabular-nums ${tone(p.bookProfit)}`}>{money(p.bookProfit)}</TableCell>
                              <TableCell className={`text-right tabular-nums font-semibold ${tone(p.actualProfit)}`}>{money(p.actualProfit)}</TableCell>
                              <TableCell className="text-right tabular-nums text-xs">
                                {pct(p.bookMargin)} / <span className={tone(p.actualMargin)}>{pct(p.actualMargin)}</span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Invoices */}
            <TabsContent value="invoices">
              <Card>
                <CardContent className="p-0">
                  <div className="flex justify-end p-2">
                    <Button size="sm" variant="outline" onClick={exportInvoices}>
                      <Download className="h-4 w-4 mr-1" /> CSV
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead className="text-right">Paid / Free</TableHead>
                          <TableHead className="text-right">Sales</TableHead>
                          <TableHead className="text-right">Discounts</TableHead>
                          <TableHead className="text-right">Net sales</TableHead>
                          <TableHead className="text-right">Actual cost</TableHead>
                          <TableHead className="text-right">Book profit</TableHead>
                          <TableHead className="text-right">Actual profit</TableHead>
                          <TableHead className="text-right">Actual margin</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.length === 0 && (
                          <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No invoices</TableCell></TableRow>
                        )}
                        {invoices.map((i: any) => (
                          <TableRow key={i.orderId} className={i.actualProfit < 0 ? "bg-rose-50/60 dark:bg-rose-950/20" : ""}>
                            <TableCell>
                              <div className="font-medium">{i.invoiceNo}</div>
                              <div className="text-[11px] text-muted-foreground">{i.date}</div>
                            </TableCell>
                            <TableCell className="max-w-[220px]">
                              <div className="truncate" title={i.customer}>{i.customer}</div>
                              <div className="text-[11px] text-muted-foreground truncate">{i.business}</div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{qty(i.paidQty)} / {qty(i.freeQty)}</TableCell>
                            <TableCell className="text-right tabular-nums">{money(i.grossSales)}</TableCell>
                            <TableCell className="text-right tabular-nums">{money(i.lineDiscount + i.extraDiscount + i.cashDiscount)}</TableCell>
                            <TableCell className="text-right tabular-nums">{money(i.actualSales)}</TableCell>
                            <TableCell className="text-right tabular-nums">{money(i.actualCost)}</TableCell>
                            <TableCell className={`text-right tabular-nums ${tone(i.bookProfit)}`}>{money(i.bookProfit)}</TableCell>
                            <TableCell className={`text-right tabular-nums font-semibold ${tone(i.actualProfit)}`}>{money(i.actualProfit)}</TableCell>
                            <TableCell className={`text-right tabular-nums ${tone(i.actualMargin)}`}>{pct(i.actualMargin)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Suppliers */}
            <TabsContent value="suppliers">
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Supplier</TableHead>
                        <TableHead className="text-right">Paid / Free</TableHead>
                        <TableHead className="text-right">Net sales</TableHead>
                        <TableHead className="text-right">Book cost</TableHead>
                        <TableHead className="text-right">Actual cost</TableHead>
                        <TableHead className="text-right">Free issue cost</TableHead>
                        <TableHead className="text-right">Book profit</TableHead>
                        <TableHead className="text-right">Actual profit</TableHead>
                        <TableHead className="text-right">Margin (book / actual)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suppliers.map((x: any) => (
                        <TableRow key={x.name}>
                          <TableCell className="font-medium">{x.name}</TableCell>
                          <TableCell className="text-right tabular-nums">{qty(x.paidQty)} / {qty(x.freeQty)}</TableCell>
                          <TableCell className="text-right tabular-nums">{money(x.actualSales)}</TableCell>
                          <TableCell className="text-right tabular-nums">{money(x.bookCost)}</TableCell>
                          <TableCell className="text-right tabular-nums">{money(x.actualCost)}</TableCell>
                          <TableCell className="text-right tabular-nums">{money(x.freeIssueCost)}</TableCell>
                          <TableCell className={`text-right tabular-nums ${tone(x.bookProfit)}`}>{money(x.bookProfit)}</TableCell>
                          <TableCell className={`text-right tabular-nums font-semibold ${tone(x.actualProfit)}`}>{money(x.actualProfit)}</TableCell>
                          <TableCell className="text-right tabular-nums text-xs">
                            {pct(x.bookMargin)} / <span className={tone(x.actualMargin)}>{pct(x.actualMargin)}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Purchase costs */}
            <TabsContent value="purchases">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Purchase cost: known rate vs actual rate</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Stock bought in this period. Actual rate = (bill value − extra discount) ÷ (paid + free qty).
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  {pt && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 px-4 pb-3 text-sm">
                      <div><p className="text-xs text-muted-foreground">Bill value</p><p className="font-semibold tabular-nums">{money(pt.billValue)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Extra discounts</p><p className="font-semibold tabular-nums">{money(pt.extraDiscount)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Net paid</p><p className="font-semibold tabular-nums">{money(pt.netValue)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Free units on bills</p><p className="font-semibold tabular-nums">{qty(pt.freeQty)} <span className="text-xs font-normal text-muted-foreground">({money(pt.freeValue)})</span></p></div>
                      <div><p className="text-xs text-muted-foreground">Free claims received</p><p className="font-semibold tabular-nums text-emerald-600">{qty(pt.freeClaimQty)} units · {money(pt.freeClaimValue)}</p></div>
                    </div>
                  )}
                  <div className="flex justify-end px-2 pb-2">
                    <Button size="sm" variant="outline" onClick={exportPurchases}>
                      <Download className="h-4 w-4 mr-1" /> CSV
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date / PO</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Paid / Free</TableHead>
                          <TableHead className="text-right">Bill rate</TableHead>
                          <TableHead className="text-right">Known cost</TableHead>
                          <TableHead className="text-right">Extra disc.</TableHead>
                          <TableHead className="text-right">Actual cost</TableHead>
                          <TableHead className="text-right">Saving / unit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {purchases.length === 0 && (
                          <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No purchases in this period</TableCell></TableRow>
                        )}
                        {purchases.map((r: any) => (
                          <TableRow key={r.id}>
                            <TableCell>
                              <div className="font-medium">{r.date}</div>
                              <div className="text-[11px] text-muted-foreground">{r.purchaseId} · {r.supplier}</div>
                            </TableCell>
                            <TableCell className="max-w-[260px]">
                              <div className="truncate" title={r.product}>{r.product}</div>
                              {r.isFreeClaim && (
                                <Badge variant="outline" className="text-[10px] border-emerald-400 text-emerald-700">
                                  Free claim · worth {money(r.claimValue)}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{qty(r.paidQty)} / {qty(r.freeQty)}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {money(r.billRate)}
                              {r.lineDiscountPercent ? <div className="text-[11px] text-muted-foreground">−{r.lineDiscountPercent}%</div> : null}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{money(r.knownRate)}</TableCell>
                            <TableCell className="text-right tabular-nums">{r.extraDiscount ? money(r.extraDiscount) : "—"}</TableCell>
                            <TableCell className="text-right tabular-nums font-semibold">{money(r.actualRate)}</TableCell>
                            <TableCell className="text-right tabular-nums text-emerald-600">
                              {money(r.saving)} <span className="text-[11px]">({pct(r.savingPercent)})</span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
