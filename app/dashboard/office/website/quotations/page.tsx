"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { webApi, rs } from "../_components/api";
import { QUOTE_TONE } from "./tone";

type Row = {
  id: string;
  no: string;
  type: "cart" | "job";
  status: string;
  title: string;
  items: number;
  total: number;
  validUntil: string | null;
  createdAt: string;
  customer: string;
  phone: string;
  tier: string;
};

const TABS = [
  { key: "open", label: "To price" },
  { key: "Sent", label: "Sent" },
  { key: "Accepted", label: "Accepted" },
  { key: "Rejected", label: "Declined" },
  { key: "all", label: "All" },
];

export default function WebsiteQuotationsPage() {
  const [tab, setTab] = useState("open");
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    webApi<{ quotes: Row[]; counts: Record<string, number> }>(`/api/website/quotes?status=${tab}`)
      .then((d) => {
        setRows(d.quotes);
        setCounts(d.counts);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [tab]);

  const n = (k: string) => (k === "open" ? (counts.Requested || 0) + (counts.Priced || 0) : k === "all" ? 0 : counts[k] || 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Quotations</h1>
        <p className="text-sm text-muted-foreground">Cart quotes arrive with prices filled in from your Price Rules. House jobs need items added. Adjust, then Send.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${tab === t.key ? "border-teal-600 bg-teal-600 text-white" : "bg-background hover:border-teal-400"}`}
          >
            {t.label}
            {!!n(t.key) && <span className={`ml-1.5 rounded-full px-1.5 text-xs ${tab === t.key ? "bg-white/20" : "bg-muted"}`}>{n(t.key)}</span>}
          </button>
        ))}
      </div>
      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !rows.length ? (
          <div className="flex flex-col items-center py-16 text-muted-foreground">
            <ClipboardList className="h-10 w-10 opacity-40" />
            <p className="mt-3">Nothing here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Quotation</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Request</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/office/website/quotations/${r.id}`} className="font-semibold text-teal-700 hover:underline">
                        {r.no}
                      </Link>
                      <div className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" })}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {r.customer} {r.tier === "trade" && <span className="ml-1 rounded bg-teal-100 px-1.5 text-[10px] font-bold text-teal-800">TRADE</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{r.phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      {r.type === "job" ? "🏠 " : "🛒 "}
                      {r.title}
                      <div className="text-xs text-muted-foreground">{r.items} items</div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{r.items ? rs(r.total) : "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${QUOTE_TONE[r.status] || "bg-muted"}`}>{r.status}</span>
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
