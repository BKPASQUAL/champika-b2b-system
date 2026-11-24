"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BUSINESS_IDS } from "@/app/config/business-constants";

type Row = {
  id: string;
  invoiceNo: string;
  date: string;
  customerName: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
};

const lkr = (n: number) => `LKR ${Number(n || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const statusTone =(s: string) =>
  s === "Paid" ? "bg-green-100 text-green-700 border-green-200" : s === "Partial" ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-red-100 text-red-700 border-red-200";

/** Invoices created from BK Wiring quotations (website business). */
export default function BkWiringInvoicesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = () => {
    setLoading(true);
    fetch(`/api/invoices?businessId=${BUSINESS_IDS.WEBSITE}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setRows(Array.isArray(d) ? d : d.invoices || d.data || []))
      .catch(() => toast.error("Failed to load invoices"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const s = q.toLowerCase();
  const shown = rows.filter((r) => !s || r.invoiceNo?.toLowerCase().includes(s) || r.customerName?.toLowerCase().includes(s));
  const due = rows.reduce((t, r) => t + Number(r.dueAmount || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">BK Wiring Invoices</h1>
          <p className="text-sm text-muted-foreground">Invoices created from BK Wiring quotations. Outstanding: <b>{lkr(due)}</b></p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => router.push("/dashboard/office/website/office-quotations/create")}>
            New Quotation
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search invoice no or customer…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <Card className="divide-y">
        {loading && <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        {!loading && shown.length === 0 && (
          <div className="p-10 text-center text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No invoices yet. Open a BK Wiring quotation and click “Convert to Bill”.
          </div>
        )}
        {shown.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => router.push(`/dashboard/office/website/office-invoices/${r.id}`)}
            className="w-full text-left flex items-center gap-3 p-3 hover:bg-muted/40"
          >
            <div className="flex-1 min-w-0">
              <p className="font-mono font-semibold text-sm">{r.invoiceNo}</p>
              <p className="text-xs text-muted-foreground truncate">{r.customerName} · {r.date ? new Date(r.date).toLocaleDateString("en-GB") : "-"}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-sm">{lkr(r.totalAmount)}</p>
              {Number(r.dueAmount) > 0 && <p className="text-xs text-red-600">Due {lkr(r.dueAmount)}</p>}
            </div>
            <Badge className={statusTone(r.status)}>{r.status}</Badge>
          </button>
        ))}
      </Card>
    </div>
  );
}
