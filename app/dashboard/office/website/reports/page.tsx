"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { webApi, rs } from "../_components/api";

type Breakdown = { name: string; revenue: number; cost: number; profit: number; qty?: number };
type Report = {
  from: string;
  to: string;
  totals: {
    orders: number;
    revenue: number;
    discount: number;
    deliveryFees: number;
    cost: number;
    profit: number;
    marginPct: number;
    avgOrder: number;
    allOrders: number;
    cancelled: number;
    waiting: number;
    newCustomers: number;
    fromQuotes: number;
  };
  statusCount: Record<string, number>;
  quoteCount: Record<string, number>;
  days: { date: string; revenue: number; profit: number; orders: number }[];
  byPayment: Record<string, { orders: number; amount: number }>;
  topProducts: Breakdown[];
  byCategory: Breakdown[];
  byBrand: Breakdown[];
  byDistrict: { name: string; orders: number; amount: number }[];
};

const dayLK = (d: Date) => new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const RANGES = [
  { key: "7", label: "7 days" },
  { key: "30", label: "30 days" },
  { key: "90", label: "90 days" },
  { key: "month", label: "This month" },
];

export default function WebsiteReportsPage() {
  const [from, setFrom] = useState(dayLK(new Date(Date.now() - 29 * 86400000)));
  const [to, setTo] = useState(dayLK(new Date()));
  const [r, setR] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    webApi<Report>(`/api/website/reports?from=${from}&to=${to}`)
      .then(setR)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [from, to]);

  const pick = (key: string) => {
    const now = new Date();
    if (key === "month") setFrom(dayLK(new Date(now.getFullYear(), now.getMonth(), 1, 12)));
    else setFrom(dayLK(new Date(Date.now() - (Number(key) - 1) * 86400000)));
    setTo(dayLK(now));
  };

  return (
    <div className="space-y-5 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Website Sales & Profit</h1>
          <p className="text-sm text-muted-foreground">Confirmed orders only. Profit uses the FIFO cost saved on each website invoice.</p>
        </div>
        {/* Filters: one row, above the charts */}
        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map((x) => (
            <button key={x.key} onClick={() => pick(x.key)} className="rounded-full border px-3 py-1.5 text-sm hover:border-teal-500">
              {x.label}
            </button>
          ))}
          <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" />
          <span className="text-muted-foreground">–</span>
          <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" />
        </div>
      </div>

      {loading || !r ? (
        <div className="flex justify-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Sales (goods)" value={rs(r.totals.revenue)} sub={`${r.totals.orders} orders · avg ${rs(r.totals.avgOrder)}`} />
            <Stat
              label="Profit"
              value={rs(r.totals.profit)}
              sub={`${r.totals.marginPct.toFixed(1)}% margin · cost ${rs(r.totals.cost)}`}
              tone={r.totals.profit < 0 ? "bad" : "good"}
            />
            <Stat label="Delivery fees" value={rs(r.totals.deliveryFees)} sub={r.totals.discount ? `Quote discounts ${rs(r.totals.discount)}` : "Not on invoices"} />
            <Stat
              label="Customers"
              value={String(r.totals.newCustomers)}
              sub={`new sign-ups · ${r.totals.fromQuotes} orders from quotes`}
            />
          </div>

          <Card className="p-5">
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">Daily sales</h2>
              <span className="text-xs text-muted-foreground">
                {r.totals.allOrders} orders placed · {r.totals.waiting} waiting to confirm · {r.totals.cancelled} cancelled
              </span>
            </div>
            <DailyBars days={r.days} />
          </Card>

          <div className="grid gap-5 xl:grid-cols-2">
            <Table title="Top products" rows={r.topProducts} showQty />
            <div className="space-y-5">
              <Table title="By category" rows={r.byCategory} />
              <Table title="By brand" rows={r.byBrand} />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <Card className="p-5">
              <h2 className="mb-3 font-semibold">Payment method</h2>
              <SimpleList rows={Object.entries(r.byPayment).map(([name, v]) => ({ name, a: `${v.orders} orders`, b: rs(v.amount) }))} />
            </Card>
            <Card className="p-5">
              <h2 className="mb-3 font-semibold">Top districts</h2>
              <SimpleList rows={r.byDistrict.map((d) => ({ name: d.name, a: `${d.orders} orders`, b: rs(d.amount) }))} />
            </Card>
            <Card className="p-5">
              <h2 className="mb-3 font-semibold">Quotations</h2>
              <SimpleList
                rows={["Requested", "Priced", "Sent", "Accepted", "Rejected"]
                  .filter((s) => r.quoteCount[s])
                  .map((s) => ({ name: s === "Rejected" ? "Declined" : s, a: "", b: String(r.quoteCount[s]) }))}
              />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "good" | "bad" }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${tone === "bad" ? "text-red-600" : ""}`}>{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
    </Card>
  );
}

/** Single-series bar chart: one teal hue, thin bars, 4px rounded tops, hover tooltip, recessive grid. */
function DailyBars({ days }: { days: Report["days"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = useMemo(() => Math.max(1, ...days.map((d) => d.revenue)), [days]);
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  const labelEvery = Math.ceil(days.length / 10);
  const h = hover != null ? days[hover] : null;

  if (!days.some((d) => d.revenue > 0)) return <p className="py-16 text-center text-sm text-muted-foreground">No confirmed sales in this period.</p>;

  return (
    <div className="relative">
      <div className="flex">
        {/* y axis */}
        <div className="flex h-56 w-16 shrink-0 flex-col justify-between pr-2 text-right text-[11px] tabular-nums text-muted-foreground">
          {[...ticks].reverse().map((t) => (
            <span key={t}>{t >= 1000 ? `${Math.round(t / 1000)}k` : t}</span>
          ))}
        </div>
        <div className="relative h-56 flex-1">
          {/* gridlines */}
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-dashed border-muted" style={{ bottom: `${(t / max) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
            {days.map((d, i) => (
              <div
                key={d.date}
                className="flex h-full flex-1 cursor-default items-end justify-center"
                onMouseEnter={() => setHover(i)}
                aria-label={`${d.date}: ${rs(d.revenue)}`}
              >
                <div
                  className={`w-full max-w-6 rounded-t-[4px] transition-colors ${hover === i ? "bg-teal-700" : "bg-teal-500"}`}
                  style={{ height: d.revenue > 0 ? `max(2px, ${(d.revenue / max) * 100}%)` : 0 }}
                />
              </div>
            ))}
          </div>
          {h && (
            <div
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg border bg-background px-3 py-2 text-xs shadow-lg"
              style={{ left: `${((hover! + 0.5) / days.length) * 100}%` }}
            >
              <div className="font-semibold">{new Date(`${h.date}T12:00:00`).toLocaleDateString("en-LK", { weekday: "short", day: "numeric", month: "short" })}</div>
              <div className="tabular-nums">Sales {rs(h.revenue)}</div>
              <div className="tabular-nums text-muted-foreground">
                Profit {rs(h.profit)} · {h.orders} order{h.orders === 1 ? "" : "s"}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* x axis */}
      <div className="ml-16 mt-1 flex text-[11px] text-muted-foreground">
        {days.map((d, i) => (
          <span key={d.date} className="flex-1 text-center">
            {i % labelEvery === 0 ? new Date(`${d.date}T12:00:00`).toLocaleDateString("en-LK", { day: "numeric", month: "short" }) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function Table({ title, rows, showQty }: { title: string; rows: Breakdown[]; showQty?: boolean }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b px-5 py-3 font-semibold">{title}</div>
      {!rows.length ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">No sales yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-2">Name</th>
              {showQty && <th className="px-2 py-2 text-right">Qty</th>}
              <th className="px-2 py-2 text-right">Sales</th>
              <th className="px-5 py-2 text-right">Profit</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((x) => (
              <tr key={x.name}>
                <td className="max-w-xs truncate px-5 py-2">{x.name}</td>
                {showQty && <td className="px-2 py-2 text-right tabular-nums">{x.qty}</td>}
                <td className="px-2 py-2 text-right tabular-nums">{rs(x.revenue)}</td>
                <td className={`px-5 py-2 text-right tabular-nums ${x.profit < 0 ? "text-red-600" : ""}`}>
                  {rs(x.profit)}
                  <span className="ml-1 text-xs text-muted-foreground">{x.revenue > 0 ? `${Math.round((x.profit / x.revenue) * 100)}%` : ""}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function SimpleList({ rows }: { rows: { name: string; a: string; b: string }[] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">Nothing yet.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((x) => (
        <li key={x.name} className="flex justify-between gap-3">
          <span>{x.name}</span>
          <span className="tabular-nums">
            {x.a && <span className="mr-2 text-xs text-muted-foreground">{x.a}</span>}
            <b>{x.b}</b>
          </span>
        </li>
      ))}
    </ul>
  );
}
