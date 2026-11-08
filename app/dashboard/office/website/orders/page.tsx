"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Receipt, Search, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { webApi, rs } from "../_components/api";
import { OrderStatusBadge, PaymentBadge } from "./badges";

type Row = {
  id: string;
  no: string;
  createdAt: string;
  status: string;
  paymentMethod: "COD" | "BANK" | "CARD";
  paymentStatus: string;
  total: number;
  name: string;
  phone: string;
  city: string;
  district: string;
  items: number;
  hasInvoice: boolean;
};

const TABS = [
  { key: "open", label: "To do" },
  { key: "New", label: "New" },
  { key: "Confirmed", label: "Confirmed" },
  { key: "Packed", label: "Packed" },
  { key: "Dispatched", label: "On the way" },
  { key: "Delivered", label: "Delivered" },
  { key: "Cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
];

export default function WebsiteOrdersPage() {
  const [tab, setTab] = useState("open");
  const [slipsOnly, setSlipsOnly] = useState(false);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      const p = new URLSearchParams({ status: slipsOnly ? "all" : tab });
      if (slipsOnly) p.set("payment", "slip");
      if (q.trim()) p.set("q", q.trim());
      webApi<{ orders: Row[]; counts: Record<string, number> }>(`/api/website/orders?${p}`)
        .then((d) => {
          setRows(d.orders);
          setCounts(d.counts);
        })
        .catch((e) => toast.error(e.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [tab, q, slipsOnly]);

  const openCount = (counts.New || 0) + (counts.Confirmed || 0) + (counts.Packed || 0) + (counts.Dispatched || 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Website Orders</h1>
          <p className="text-sm text-muted-foreground">Confirm an order to create its invoice (stock leaves the Main Warehouse).</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order no, name or phone" className="pl-9" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const n = t.key === "open" ? openCount : t.key === "all" ? undefined : counts[t.key];
          const on = !slipsOnly && tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => {
                setSlipsOnly(false);
                setTab(t.key);
              }}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                on ? "border-teal-600 bg-teal-600 text-white" : "bg-background hover:border-teal-400"
              }`}
            >
              {t.label}
              {!!n && <span className={`ml-1.5 rounded-full px-1.5 text-xs ${on ? "bg-white/20" : "bg-muted"}`}>{n}</span>}
            </button>
          );
        })}
        <button
          onClick={() => setSlipsOnly((s) => !s)}
          className={`ml-auto flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
            slipsOnly ? "border-amber-500 bg-amber-500 text-white" : "border-amber-300 text-amber-700 hover:bg-amber-50"
          }`}
        >
          <Receipt className="h-4 w-4" /> Slips to check
          {!!counts.slips && <span className={`rounded-full px-1.5 text-xs ${slipsOnly ? "bg-white/20" : "bg-amber-100"}`}>{counts.slips}</span>}
        </button>
      </div>

      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center text-muted-foreground">
            <ShoppingCart className="h-10 w-10 opacity-40" />
            <p className="mt-3 font-medium text-foreground">No orders here</p>
            <p className="text-sm">New online orders will show up in “To do”.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Deliver to</th>
                  <th className="px-4 py-3 text-right">Items</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/office/website/orders/${r.id}`} className="font-semibold text-teal-700 hover:underline">
                        {r.no}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {new Date(r.createdAt).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.city}
                      {r.district && <div className="text-xs">{r.district}</div>}
                    </td>
                    <td className="px-4 py-3 text-right">{r.items}</td>
                    <td className="px-4 py-3 text-right font-semibold">{rs(r.total)}</td>
                    <td className="px-4 py-3">
                      <PaymentBadge method={r.paymentMethod} status={r.paymentStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
