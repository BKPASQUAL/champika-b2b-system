"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FileText, Loader2, Plus, RotateCcw, Search, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { webApi, rs } from "../../_components/api";
import { QUOTE_TONE } from "../tone";

type Item = { webProductId: string; name: string; image: string | null; qty: number; mrp: number | null; autoPrice: number | null; finalPrice: number; cost: number };
type Detail = {
  id: string;
  no: string;
  type: "cart" | "job";
  status: string;
  createdAt: string;
  validUntil: string | null;
  houseType: string | null;
  rooms: number | null;
  points: Record<string, number>;
  plans: { path: string; url: string }[];
  customerNote: string | null;
  staffNote: string | null;
  discount: number;
  order: { id: string; no: string } | null;
  customer: { id: string; name: string | null; email: string | null; phone: string | null; tier: "normal" | "trade" } | null;
  defaultValidDays: number;
  items: Item[];
};
type Hit = { id: string; name: string; image: string | null; brand: string | null; mrp: number; price: number; available: boolean; cost: number };

const POINT_LABEL: Record<string, string> = {
  lights: "Lights",
  switches: "Switches",
  sockets: "Sockets",
  fans: "Fans",
  ac: "A/C",
  waterHeater: "Water heaters",
  outdoorLights: "Outdoor lights",
  gate: "Gate / bell",
  floors: "Floors",
};

export default function QuotationEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [q, setQ] = useState<Detail | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [discount, setDiscount] = useState("0");
  const [validDays, setValidDays] = useState("14");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<"" | "save" | "send">("");

  const load = useCallback(
    () =>
      webApi<Detail>(`/api/website/quotes/${id}`)
        .then((d) => {
          setQ(d);
          setItems(d.items);
          setDiscount(String(d.discount || 0));
          setValidDays(String(d.defaultValidDays));
          setNote(d.staffNote || "");
        })
        .catch((e) => toast.error(e.message)),
    [id],
  );
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (search.trim().length < 2 || !q) return setHits([]);
    const t = setTimeout(() => {
      setSearching(true);
      webApi<Hit[]>(`/api/website/quotes/products?q=${encodeURIComponent(search.trim())}&tier=${q.customer?.tier || "normal"}`)
        .then(setHits)
        .catch((e) => toast.error(e.message))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [search, q]);

  if (!q)
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );

  const locked = ["Accepted", "Rejected"].includes(q.status);
  const subtotal = items.reduce((s, i) => s + i.finalPrice * i.qty, 0);
  const disc = Math.min(subtotal, Math.max(0, Number(discount) || 0));
  const total = subtotal - disc;
  const cost = items.reduce((s, i) => s + i.cost * i.qty, 0);
  const margin = total - cost;

  const update = (idx: number, patch: Partial<Item>) => setItems((list) => list.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const add = (h: Hit) => {
    setItems((list) => {
      const at = list.findIndex((x) => x.webProductId === h.id);
      if (at >= 0) return list.map((x, i) => (i === at ? { ...x, qty: x.qty + 1 } : x));
      return [...list, { webProductId: h.id, name: h.name, image: h.image, qty: 1, mrp: h.mrp, autoPrice: h.price, finalPrice: h.price, cost: h.cost }];
    });
    setSearch("");
    setHits([]);
  };

  const save = async (send: boolean) => {
    if (send && !items.length) return toast.error("Add at least one item.");
    if (send && !confirm(`Send ${q.no} to ${q.customer?.name || "the customer"} for ${rs(total)}?`)) return;
    setBusy(send ? "send" : "save");
    try {
      await webApi(`/api/website/quotes/${id}`, {
        method: "POST",
        json: {
          items: items.map((i) => ({ webProductId: i.webProductId, qty: i.qty, finalPrice: i.finalPrice })),
          discount: disc,
          validDays: Number(validDays) || 14,
          staffNote: note || null,
          send,
        },
      });
      toast.success(send ? "Quotation sent — the customer can now accept it" : "Saved");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy("");
    }
  };

  const points = Object.entries(q.points || {}).filter(([, v]) => Number(v) > 0);

  return (
    <div className="space-y-5 pb-16">
      <Link href="/dashboard/office/website/quotations" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Quotations
      </Link>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{q.no}</h1>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${QUOTE_TONE[q.status] || "bg-muted"}`}>{q.status}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {q.type === "job" ? "House job request" : "Cart quotation"} · {new Date(q.createdAt).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" })}
              {q.validUntil && q.status === "Sent" && ` · valid until ${q.validUntil}`}
            </p>
            {q.order && (
              <Link href={`/dashboard/office/website/orders/${q.order.id}`} className="text-sm font-semibold text-teal-700 hover:underline">
                Became order {q.order.no} →
              </Link>
            )}
          </div>
          {q.customer && (
            <div className="text-right text-sm">
              <div className="font-semibold">
                {q.customer.name}
                {q.customer.tier === "trade" && <span className="ml-1.5 rounded bg-teal-100 px-1.5 text-[10px] font-bold text-teal-800">TRADE PRICES</span>}
              </div>
              <div className="text-muted-foreground">{q.customer.phone || q.customer.email}</div>
            </div>
          )}
        </div>
      </Card>

      {q.type === "job" && (
        <Card className="space-y-3 p-5 text-sm">
          <h2 className="font-semibold">What the customer asked for</h2>
          <div className="flex flex-wrap gap-2">
            {q.houseType && <span className="rounded-full bg-muted px-3 py-1 font-medium">{q.houseType}</span>}
            {q.rooms != null && <span className="rounded-full bg-muted px-3 py-1">{q.rooms} rooms</span>}
            {points.map(([k, v]) => (
              <span key={k} className="rounded-full bg-muted px-3 py-1">
                {POINT_LABEL[k] || k}: <b>{v}</b>
              </span>
            ))}
          </div>
          {q.customerNote && <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-900">“{q.customerNote}”</p>}
          {q.plans.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {q.plans.map((p) =>
                p.path.toLowerCase().endsWith(".pdf") ? (
                  <a key={p.path} href={p.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border px-3 py-2 hover:bg-muted">
                    <FileText className="h-4 w-4" /> Plan (PDF)
                  </a>
                ) : (
                  <a key={p.path} href={p.url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="Plan" className="h-32 rounded-lg border object-cover" />
                  </a>
                ),
              )}
            </div>
          )}
        </Card>
      )}
      {q.type === "cart" && q.customerNote && <Card className="p-5 text-sm">“{q.customerNote}”</Card>}

      {/* Items editor */}
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
          <h2 className="font-semibold">Items</h2>
          {!locked && (
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Add product… e.g. 1/113, switch" className="pl-9" />
              {(hits.length > 0 || searching) && (
                <div className="absolute right-0 z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border bg-background shadow-xl">
                  {searching && <div className="p-3 text-sm text-muted-foreground">Searching…</div>}
                  {hits.map((h) => (
                    <button key={h.id} onClick={() => add(h)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted">
                      <span className="h-9 w-9 shrink-0 overflow-hidden rounded border bg-muted">
                        {h.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={h.image} alt="" className="h-full w-full object-contain" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 text-sm">{h.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {rs(h.price)} · cost {rs(h.cost)}
                          {!h.available && " · switched off"}
                        </span>
                      </span>
                      <Plus className="h-4 w-4 text-teal-700" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        {items.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">No items yet. Search above to add products — prices fill in from your Price Rules.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-2 py-2 text-right">Qty</th>
                  <th className="px-2 py-2 text-right">MRP</th>
                  <th className="px-2 py-2 text-right">Price</th>
                  <th className="px-2 py-2 text-right">Line</th>
                  <th className="px-2 py-2 text-right">Margin</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((it, idx) => {
                  const m = (it.finalPrice - it.cost) * it.qty;
                  return (
                    <tr key={it.webProductId}>
                      <td className="px-4 py-2">
                        <div className="line-clamp-2 max-w-md">{it.name}</div>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Input
                          type="number"
                          min={1}
                          disabled={locked}
                          value={it.qty}
                          onChange={(e) => update(idx, { qty: Math.max(1, Number(e.target.value) || 1) })}
                          className="ml-auto h-8 w-20 text-right"
                        />
                      </td>
                      <td className="px-2 py-2 text-right text-muted-foreground">{it.mrp ? rs(it.mrp) : "—"}</td>
                      <td className="px-2 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            type="number"
                            min={0}
                            disabled={locked}
                            value={it.finalPrice}
                            onChange={(e) => update(idx, { finalPrice: Math.max(0, Number(e.target.value) || 0) })}
                            className={`h-8 w-28 text-right ${it.finalPrice < it.cost ? "border-red-400 text-red-600" : ""}`}
                          />
                          {!locked && it.autoPrice != null && it.finalPrice !== it.autoPrice && (
                            <button title={`Back to rule price ${rs(it.autoPrice)}`} onClick={() => update(idx, { finalPrice: it.autoPrice! })} className="text-muted-foreground hover:text-foreground">
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right font-semibold">{rs(it.finalPrice * it.qty)}</td>
                      <td className={`px-2 py-2 text-right text-xs ${m < 0 ? "font-semibold text-red-600" : "text-green-700"}`}>{rs(m)}</td>
                      <td className="px-2 py-2 text-right">
                        {!locked && (
                          <button onClick={() => setItems((l) => l.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-red-600" aria-label="Remove">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card className="space-y-3 p-5">
          <h2 className="font-semibold">Note to the office (not shown to customer)</h2>
          <Textarea value={note} disabled={locked} onChange={(e) => setNote(e.target.value)} className="min-h-24" />
        </Card>
        <Card className="space-y-3 p-5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{rs(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Extra discount (Rs)</span>
            <Input type="number" min={0} disabled={locked} value={discount} onChange={(e) => setDiscount(e.target.value)} className="h-8 w-28 text-right" />
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-bold">
            <span>Total</span>
            <span>{rs(total)}</span>
          </div>
          <div className={`flex justify-between text-xs ${margin < 0 ? "font-semibold text-red-600" : "text-green-700"}`}>
            <span>Margin (cost {rs(cost)})</span>
            <span>
              {rs(margin)}
              {total > 0 && ` · ${Math.round((margin / total) * 100)}%`}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Valid for (days)</span>
            <Input type="number" min={1} max={90} disabled={locked} value={validDays} onChange={(e) => setValidDays(e.target.value)} className="h-8 w-20 text-right" />
          </div>
          {!locked && (
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" disabled={!!busy} onClick={() => save(false)}>
                {busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />} Save
              </Button>
              <Button className="flex-1 bg-teal-600 hover:bg-teal-700" disabled={!!busy || !items.length} onClick={() => save(true)}>
                {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {q.status === "Sent" ? "Re-send" : "Send"}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
