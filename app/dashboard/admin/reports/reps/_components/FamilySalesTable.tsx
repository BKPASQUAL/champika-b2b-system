"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowDown, ArrowUp, ArrowUpDown, Layers, Search } from "lucide-react";

export type FamilyRow = {
  family: string;
  category: string;
  subCategory: string | null;
  qty: number;
  sales: number;
  cost: number;
  profit: number;
  marginPct: number;
};

type SortKey = "family" | "qty" | "sales" | "cost" | "profit" | "marginPct";

const fmt = (n: number) =>
  n.toLocaleString("en-LK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const marginClass = (m: number) =>
  m < 0 ? "text-red-600" : m < 5 ? "text-amber-600" : "text-green-700";

/** Combine family rows from several reps into one list. */
export function mergeFamilyRows(lists: FamilyRow[][]): FamilyRow[] {
  const map: Record<string, FamilyRow> = {};
  lists.flat().forEach((f) => {
    const key = `${f.family}||${f.category}||${f.subCategory ?? ""}`;
    const e = (map[key] ||= { ...f, qty: 0, sales: 0, cost: 0, profit: 0, marginPct: 0 });
    e.qty += f.qty || 0;
    e.sales += f.sales || 0;
    e.cost += f.cost || 0;
    e.profit += f.profit || 0;
  });
  return Object.values(map)
    .map((e) => ({ ...e, marginPct: e.sales > 0 ? (e.profit / e.sales) * 100 : 0 }))
    .sort((a, b) => b.sales - a.sales);
}

export function FamilySalesTable({
  rows,
  title,
  bare = false,
}: {
  rows: FamilyRow[];
  title: string;
  /** true = no outer card (used inside a tab) */
  bare?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("sales");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const visible = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = q
      ? rows.filter(
          (r) =>
            r.family.toLowerCase().includes(q) ||
            r.category.toLowerCase().includes(q) ||
            (r.subCategory || "").toLowerCase().includes(q),
        )
      : rows;
    return [...list].sort((a, b) => {
      // "No Family" always last
      if (a.family === "No Family" && b.family !== "No Family") return 1;
      if (b.family === "No Family" && a.family !== "No Family") return -1;
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp =
        typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, search, sortKey, sortDir]);

  const totals = useMemo(() => {
    const t = visible.reduce(
      (s, r) => ({ qty: s.qty + r.qty, sales: s.sales + r.sales, cost: s.cost + r.cost, profit: s.profit + r.profit }),
      { qty: 0, sales: 0, cost: 0, profit: 0 },
    );
    return { ...t, marginPct: t.sales > 0 ? (t.profit / t.sales) * 100 : 0 };
  }, [visible]);

  const onSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir(k === "family" ? "asc" : "desc");
    }
  };
  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k ? (
      <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />
    ) : sortDir === "asc" ? (
      <ArrowUp className="w-3 h-3 ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1" />
    );
  const Head = ({ k, label, right = true }: { k: SortKey; label: string; right?: boolean }) => (
    <TableHead
      className={`font-semibold cursor-pointer select-none hover:bg-muted/60 ${right ? "text-right" : ""}`}
      onClick={() => onSort(k)}
    >
      <span className={`inline-flex items-center ${right ? "justify-end w-full" : ""}`}>
        {label} <SortIcon k={k} />
      </span>
    </TableHead>
  );

  const body = (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search family / category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-md border px-2 py-1">
            Sales <b>LKR {fmt(totals.sales)}</b>
          </span>
          <span className="rounded-md border px-2 py-1">
            Cost <b>LKR {fmt(totals.cost)}</b>
          </span>
          <span className={`rounded-md border px-2 py-1 ${marginClass(totals.marginPct)}`}>
            Profit <b>LKR {fmt(totals.profit)}</b> ({totals.marginPct.toFixed(1)}%)
          </span>
        </div>
      </div>

      {/* Mobile list */}
      <div className="sm:hidden divide-y border rounded-lg overflow-hidden bg-white">
        {visible.length === 0 ? (
          <p className="text-center py-8 text-sm text-muted-foreground">No product family sales found.</p>
        ) : (
          visible.map((r, i) => (
            <div key={i} className="p-3 space-y-2">
              <div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                  {r.family}
                </span>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {r.category}{r.subCategory ? ` › ${r.subCategory}` : ""}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-[10px] text-muted-foreground">Sales</p>
                  <p className="font-semibold">LKR {fmt(r.sales)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Cost</p>
                  <p className="font-medium">LKR {fmt(r.cost)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Profit</p>
                  <p className={`font-semibold ${marginClass(r.marginPct)}`}>
                    LKR {fmt(r.profit)} <span className="text-[10px]">({r.marginPct.toFixed(1)}%)</span>
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block border rounded-lg overflow-x-auto bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <Head k="family" label="Product Family" right={false} />
              <TableHead className="font-semibold">Category</TableHead>
              <Head k="qty" label="Qty Sold" />
              <Head k="sales" label="Sales" />
              <Head k="cost" label="Cost" />
              <Head k="profit" label="Profit" />
              <Head k="marginPct" label="Margin" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24 text-muted-foreground text-sm">
                  No product family sales found.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((r, i) => (
                <TableRow key={i} className="hover:bg-muted/30">
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.family === "No Family" ? "bg-gray-100 text-gray-500" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {r.family}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.category}
                    {r.subCategory && <span className="text-muted-foreground"> › {r.subCategory}</span>}
                  </TableCell>
                  <TableCell className="text-right text-xs font-mono">{fmt(r.qty)}</TableCell>
                  <TableCell className="text-right text-xs font-semibold">LKR {fmt(r.sales)}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">LKR {fmt(r.cost)}</TableCell>
                  <TableCell className={`text-right text-xs font-semibold ${marginClass(r.marginPct)}`}>
                    LKR {fmt(r.profit)}
                  </TableCell>
                  <TableCell className={`text-right text-xs font-medium ${marginClass(r.marginPct)}`}>
                    {r.marginPct.toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {visible.length > 0 && (
            <tfoot className="bg-amber-50 font-bold border-t-2 border-amber-200">
              <TableRow>
                <TableCell colSpan={2} className="text-xs">
                  Total ({visible.length} rows)
                </TableCell>
                <TableCell className="text-right text-xs font-mono">{fmt(totals.qty)}</TableCell>
                <TableCell className="text-right text-xs">LKR {fmt(totals.sales)}</TableCell>
                <TableCell className="text-right text-xs">LKR {fmt(totals.cost)}</TableCell>
                <TableCell className={`text-right text-xs ${marginClass(totals.marginPct)}`}>
                  LKR {fmt(totals.profit)}
                </TableCell>
                <TableCell className={`text-right text-xs ${marginClass(totals.marginPct)}`}>
                  {totals.marginPct.toFixed(1)}%
                </TableCell>
              </TableRow>
            </tfoot>
          )}
        </Table>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Sales are after invoice discounts and returns. Cost is the FIFO cost of the stock sold (free-issue items included).
      </p>
    </div>
  );

  if (bare) return body;
  return (
    <Card>
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Layers className="h-4 w-4 text-amber-600" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">{body}</CardContent>
    </Card>
  );
}
