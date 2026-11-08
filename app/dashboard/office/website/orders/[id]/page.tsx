"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  Package,
  Phone,
  Printer,
  Truck,
  User,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { webApi, rs } from "../../_components/api";
import { OrderStatusBadge, PaymentBadge } from "../badges";

type Detail = {
  id: string;
  no: string;
  createdAt: string;
  status: string;
  nextStatuses: string[];
  paymentMethod: "COD" | "BANK" | "CARD";
  paymentStatus: string;
  slipUrl: string | null;
  slipIsPdf: boolean;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  costTotal: number | null;
  customerNote: string | null;
  staffNote: string | null;
  delivery: { name: string; phone: string; address: Record<string, string> };
  customer: { id: string; name: string | null; email: string | null; phone: string | null; tier: string; since: string; orderCount: number } | null;
  invoice: { id: string; no: string; total: number; paid: number; status: string } | null;
  stock: { productId: string; name: string; need: number; inStock: number; short: boolean }[] | null;
  items: { id: string; sku: string | null; name: string; slug: string | null; image: string | null; qty: number; unitPrice: number; mrp: number | null; lineTotal: number }[];
};

const STEP_LABEL: Record<string, string> = { Packed: "Mark packed", Dispatched: "Mark on the way", Delivered: "Mark delivered" };

export default function WebsiteOrderPage() {
  const { id } = useParams<{ id: string }>();
  const [o, setO] = useState<Detail | null>(null);
  const [busy, setBusy] = useState<string>("");
  const [note, setNote] = useState("");

  const load = useCallback(() => webApi<Detail>(`/api/website/orders/${id}`).then(setO).catch((e) => toast.error(e.message)), [id]);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (key: string, body: Record<string, unknown>, success: string) => {
    setBusy(key);
    try {
      await webApi(`/api/website/orders/${id}`, { method: "POST", json: body });
      toast.success(success);
      await load();
    } catch (e: any) {
      toast.error(e.message, { duration: 8000 });
    } finally {
      setBusy("");
    }
  };

  if (!o)
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );

  const short = o.stock?.filter((s) => s.short) || [];
  const profit = o.costTotal != null ? o.subtotal - o.discount - o.costTotal : null;
  const a = o.delivery.address || {};

  return (
    <div className="space-y-5 pb-16">
      <Link href="/dashboard/office/website/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Website orders
      </Link>

      {/* Header + main actions */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{o.no}</h1>
              <OrderStatusBadge status={o.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              Placed {new Date(o.createdAt).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" })}
            </p>
            {o.invoice && (
              <Link href={`/invoice/${o.invoice.id}`} target="_blank" className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:underline">
                <Printer className="h-4 w-4" /> Invoice {o.invoice.no} · {o.invoice.status}
              </Link>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{rs(o.total)}</div>
            <PaymentBadge method={o.paymentMethod} status={o.paymentStatus} />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
          {o.status === "New" && (
            <Button
              disabled={!!busy || short.length > 0}
              onClick={() => act("confirm", { action: "confirm" }, "Order confirmed and invoice created")}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {busy === "confirm" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Confirm & create invoice
            </Button>
          )}
          {o.status === "New" && short.length > 0 && (
            <Button
              variant="outline"
              disabled={!!busy}
              onClick={() => {
                if (confirm("Some items are short in the Main Warehouse. Stock will go below zero. Confirm anyway?"))
                  act("confirm", { action: "confirm", force: true }, "Order confirmed and invoice created");
              }}
            >
              Confirm anyway
            </Button>
          )}
          {o.nextStatuses
            .filter((s) => s in STEP_LABEL)
            .map((s, i) => (
              <Button
                key={s}
                variant={i === 0 ? "default" : "outline"}
                disabled={!!busy}
                onClick={() => {
                  if (s === "Delivered" && o.paymentMethod === "COD" && !confirm(`Mark delivered? This records ${rs(o.invoice?.total ?? o.total)} cash as collected.`)) return;
                  act(s, { action: "status", status: s }, `Marked ${s === "Dispatched" ? "on the way" : s.toLowerCase()}`);
                }}
                className={i === 0 ? "bg-teal-600 hover:bg-teal-700" : ""}
              >
                {busy === s ? <Loader2 className="h-4 w-4 animate-spin" /> : s === "Delivered" ? <CheckCircle2 className="h-4 w-4" /> : s === "Dispatched" ? <Truck className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                {STEP_LABEL[s]}
              </Button>
            ))}
          {o.nextStatuses.includes("Cancelled") && (
            <Button
              variant="ghost"
              className="ml-auto text-red-600 hover:bg-red-50 hover:text-red-700"
              disabled={!!busy}
              onClick={() => {
                const reason = prompt(
                  o.invoice
                    ? `Cancel ${o.no}? The invoice ${o.invoice.no} will be cancelled and stock returned to the Main Warehouse (admins only).\n\nReason:`
                    : `Cancel ${o.no}?\n\nReason (the customer sees the order as cancelled):`,
                );
                if (reason !== null) act("cancel", { action: "cancel", reason }, "Order cancelled");
              }}
            >
              {busy === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Cancel order
            </Button>
          )}
        </div>
        {o.status === "New" && (
          <p className="mt-3 text-xs text-muted-foreground">
            Call the customer to confirm first. Confirming creates a WB invoice, takes stock from the Main Warehouse and uses FIFO cost.
          </p>
        )}
      </Card>

      {/* Stock check before confirming */}
      {o.stock && (
        <Card className={`p-5 ${short.length ? "border-amber-300 bg-amber-50/50" : ""}`}>
          <h2 className="flex items-center gap-2 font-semibold">
            {short.length ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
            Main Warehouse stock {short.length ? `— ${short.length} item(s) short` : "— all available"}
          </h2>
          <ul className="mt-3 space-y-1 text-sm">
            {o.stock.map((s) => (
              <li key={s.productId} className="flex justify-between gap-4">
                <span className="truncate">{s.name}</span>
                <span className={s.short ? "font-semibold text-amber-700" : "text-muted-foreground"}>
                  need {s.need} · have {s.inStock}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Bank slip */}
      {o.paymentMethod === "BANK" && (
        <Card className="p-5">
          <h2 className="font-semibold">Bank transfer</h2>
          {o.slipUrl ? (
            <div className="mt-3 flex flex-wrap items-start gap-4">
              {o.slipIsPdf ? (
                <a href={o.slipUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm hover:bg-muted">
                  <FileText className="h-5 w-5" /> Open slip (PDF) <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <a href={o.slipUrl} target="_blank" rel="noreferrer" title="Open full size">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={o.slipUrl} alt="Payment slip" className="max-h-72 rounded-lg border object-contain" />
                </a>
              )}
              <div className="space-y-2 text-sm">
                <p>
                  Check that <b>{rs(o.total)}</b> reached your account with reference <b>{o.no}</b>.
                </p>
                {o.paymentStatus !== "verified" && (
                  <div className="flex gap-2">
                    <Button size="sm" disabled={!!busy} onClick={() => act("verify", { action: "verify", ok: true }, "Payment confirmed")} className="bg-green-600 hover:bg-green-700">
                      {busy === "verify" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Money received
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!busy}
                      onClick={() => confirm("Reject this slip? The customer can upload a new one.") && act("reject", { action: "verify", ok: false }, "Slip rejected")}
                    >
                      Reject slip
                    </Button>
                  </div>
                )}
                {o.paymentStatus === "verified" && <p className="font-medium text-green-700">✓ Payment confirmed</p>}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {o.paymentStatus === "verified" ? "✓ Payment confirmed." : "No slip uploaded yet. The customer sees our bank details on their order page."}
            </p>
          )}
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        {/* Items */}
        <Card className="overflow-hidden p-0">
          <div className="border-b px-5 py-3 font-semibold">Items</div>
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {o.items.map((i) => (
                <tr key={i.id}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                        {i.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={i.image} alt="" className="h-full w-full object-contain" />
                        )}
                      </span>
                      <div>
                        <div className="font-medium">{i.name}</div>
                        {i.sku && <div className="text-xs text-muted-foreground">{i.sku}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-muted-foreground">
                    {i.qty} × {rs(i.unitPrice)}
                    {i.mrp && i.mrp > i.unitPrice && <div className="text-xs line-through">{rs(i.mrp)}</div>}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-right font-semibold">{rs(i.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="space-y-1.5 border-t px-5 py-4 text-sm">
            <Row label="Subtotal" value={rs(o.subtotal)} />
            {o.discount > 0 && <Row label="Discount" value={`− ${rs(o.discount)}`} />}
            <Row label="Delivery fee" value={o.deliveryFee ? rs(o.deliveryFee) : "Free"} />
            <div className="flex justify-between border-t pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd>{rs(o.total)}</dd>
            </div>
            {profit != null && (
              <div className="flex justify-between pt-1 text-xs text-muted-foreground">
                <dt>{o.invoice ? "Cost (FIFO, from invoice)" : "Cost (estimate)"} · profit on goods</dt>
                <dd className={profit < 0 ? "font-semibold text-red-600" : "font-semibold text-green-700"}>
                  {rs(o.costTotal)} · {rs(profit)}
                </dd>
              </div>
            )}
          </dl>
        </Card>

        <div className="space-y-5">
          <Card className="space-y-2 p-5 text-sm">
            <h2 className="font-semibold">Deliver to</h2>
            <p className="flex items-center gap-2 font-medium">
              <User className="h-4 w-4 text-muted-foreground" /> {o.delivery.name}
            </p>
            <a href={`tel:${o.delivery.phone}`} className="flex items-center gap-2 text-teal-700 hover:underline">
              <Phone className="h-4 w-4" /> {o.delivery.phone}
            </a>
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              {[a.line1, a.line2, a.city, a.district && `${a.district} District`].filter(Boolean).join(", ")}
            </p>
            {o.customerNote && <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-900">“{o.customerNote}”</p>}
          </Card>

          {o.customer && (
            <Card className="space-y-1 p-5 text-sm">
              <h2 className="font-semibold">Customer</h2>
              <p>{o.customer.name || "—"}</p>
              <p className="text-muted-foreground">{o.customer.email}</p>
              {o.customer.phone && <p className="text-muted-foreground">{o.customer.phone}</p>}
              <p className="pt-1 text-xs text-muted-foreground">
                {o.customer.orderCount} order(s) · {o.customer.tier === "trade" ? "Trade customer" : "Normal customer"} · since{" "}
                {new Date(o.customer.since).toLocaleDateString("en-LK", { dateStyle: "medium" })}
              </p>
            </Card>
          )}

          <Card className="space-y-3 p-5 text-sm">
            <h2 className="font-semibold">Staff notes & history</h2>
            {o.staffNote ? (
              <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap font-sans text-xs text-muted-foreground">{o.staffNote}</pre>
            ) : (
              <p className="text-xs text-muted-foreground">Nothing yet.</p>
            )}
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (only staff see this)" className="min-h-16" />
            <Button
              size="sm"
              variant="outline"
              disabled={!note.trim() || !!busy}
              onClick={() => act("note", { action: "note", text: note }, "Note added").then(() => setNote(""))}
            >
              Add note
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
