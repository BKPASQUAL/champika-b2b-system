"use client";

import { useEffect, useState } from "react";
import { Ban, CheckCircle2, Loader2, Search, ShieldCheck, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { webApi, rs } from "../_components/api";

type Customer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  tier: "normal" | "trade";
  tradeStatus: "none" | "pending" | "approved" | "rejected";
  businessName: string | null;
  regNo: string | null;
  blocked: boolean;
  provider: string | null;
  createdAt: string;
  city: string;
  orders: number;
  spent: number;
};

export default function WebsiteCustomersPage() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const load = () => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (pendingOnly) p.set("trade", "pending");
    return webApi<Customer[]>(`/api/website/customers?${p}`)
      .then(setRows)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, pendingOnly]);

  const act = async (c: Customer, action: string, msg: string) => {
    setBusy(c.id + action);
    try {
      await webApi("/api/website/customers", { method: "PATCH", json: { id: c.id, action } });
      toast.success(msg);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy("");
    }
  };

  const pending = rows.filter((r) => r.tradeStatus === "pending").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Website Customers</h1>
          <p className="text-sm text-muted-foreground">Approved trade customers (electricians, contractors) see Trade prices after logging in.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={pendingOnly ? "default" : "outline"} onClick={() => setPendingOnly((p) => !p)} className={pendingOnly ? "bg-amber-500 hover:bg-amber-600" : ""}>
            <ShieldCheck className="h-4 w-4" /> Trade requests{pending && !pendingOnly ? ` (${pending})` : ""}
          </Button>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email or phone" className="pl-9" />
          </div>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-muted-foreground">
            <Users className="h-10 w-10 opacity-40" />
            <p className="mt-3">No customers found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Phone / city</th>
                  <th className="px-4 py-3 text-right">Orders</th>
                  <th className="px-4 py-3 text-right">Spent</th>
                  <th className="px-4 py-3">Price level</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((c) => (
                  <tr key={c.id} className={c.blocked ? "opacity-50" : ""}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{c.name || "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.email} · {c.provider === "google" ? "Google" : "Email"} · joined {new Date(c.createdAt).toLocaleDateString("en-LK", { dateStyle: "medium" })}
                      </div>
                      {c.tradeStatus === "pending" && (
                        <div className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">
                          Trade request: <b>{c.businessName || "—"}</b>
                          {c.regNo && ` · NIC/Reg ${c.regNo}`}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.phone || "—"}
                      {c.city && <div className="text-xs">{c.city}</div>}
                    </td>
                    <td className="px-4 py-3 text-right">{c.orders}</td>
                    <td className="px-4 py-3 text-right font-medium">{rs(c.spent)}</td>
                    <td className="px-4 py-3">
                      {c.blocked ? (
                        <span className="text-xs font-semibold text-red-600">Blocked</span>
                      ) : c.tier === "trade" ? (
                        <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-800">Trade</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Normal{c.tradeStatus === "rejected" ? " (trade rejected)" : ""}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {c.tradeStatus === "pending" && (
                          <>
                            <Button size="sm" className="bg-teal-600 hover:bg-teal-700" disabled={!!busy} onClick={() => act(c, "approve_trade", "Trade prices switched on")}>
                              <CheckCircle2 className="h-4 w-4" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act(c, "reject_trade", "Trade request rejected")}>
                              <XCircle className="h-4 w-4" /> Reject
                            </Button>
                          </>
                        )}
                        {c.tradeStatus !== "pending" && c.tier !== "trade" && !c.blocked && (
                          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act(c, "approve_trade", "Trade prices switched on")}>
                            Make trade
                          </Button>
                        )}
                        {c.tier === "trade" && (
                          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act(c, "make_normal", "Back to normal prices")}>
                            Make normal
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className={c.blocked ? "" : "text-red-600 hover:bg-red-50"}
                          disabled={!!busy}
                          onClick={() =>
                            (c.blocked || confirm(`Block ${c.name || c.email}? They won't be able to log in to the shop.`)) &&
                            act(c, c.blocked ? "unblock" : "block", c.blocked ? "Unblocked" : "Blocked")
                          }
                        >
                          <Ban className="h-4 w-4" /> {c.blocked ? "Unblock" : "Block"}
                        </Button>
                      </div>
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
