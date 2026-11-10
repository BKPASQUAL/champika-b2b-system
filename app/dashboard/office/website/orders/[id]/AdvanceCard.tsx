"use client";

import { useState } from "react";
import { CheckCircle2, ExternalLink, FileText, Loader2, PackageSearch, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SHOP_URL } from "@/lib/shop-host";
import { whatsappLink } from "@/app/shop/_components/format";
import { rs } from "../../_components/api";

export type Advance = { amount: number; status: string; method: string | null; note: string | null; slipUrl: string | null; slipIsPdf: boolean };

/**
 * Advance for special-order items. Staff talk to the customer, agree an amount,
 * and set it here. The customer sees it on their order page (bank details +
 * slip upload). Staff then mark it received (bank slip checked, or cash at the shop).
 */
export function AdvanceCard({
  orderNo,
  total,
  phone,
  customerName,
  specialItems,
  advance,
  busy,
  act,
}: {
  orderNo: string;
  total: number;
  phone: string;
  customerName: string;
  specialItems: string[];
  advance: Advance;
  busy: string;
  act: (key: string, body: Record<string, unknown>, success: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState(advance.amount ? String(advance.amount) : "");
  const [note, setNote] = useState(advance.note || "");
  const paid = advance.status === "paid";
  const waiting = advance.status === "requested" || advance.status === "slip_uploaded";
  const amt = Number(amount) || 0;

  const orderLink = `${SHOP_URL}/account/orders/${encodeURIComponent(orderNo)}`;
  const wa = whatsappLink(
    phone,
    advance.amount > 0
      ? `Hi ${customerName}, about your order ${orderNo}: to order the special items from our supplier, please pay an advance of ${rs(advance.amount)}.${
          advance.note ? ` ${advance.note}` : ""
        }\nBank details and slip upload: ${orderLink}\nYou can also pay at our shop. Thank you!`
      : `Hi ${customerName}, thank you for your order ${orderNo}. Some items are special orders from our supplier — can we talk about an advance payment?`,
  );

  return (
    <Card className={`p-5 ${waiting ? "border-amber-300 bg-amber-50/50" : paid ? "border-green-300" : "border-amber-200"}`}>
      <h2 className="flex items-center gap-2 font-semibold">
        <PackageSearch className="h-4 w-4 text-amber-600" /> Special order · advance payment
      </h2>
      {specialItems.length > 0 && (
        <p className="mt-1 text-sm text-muted-foreground">
          Special order items: <b className="text-foreground">{specialItems.join(", ")}</b>
        </p>
      )}

      {paid ? (
        <p className="mt-3 flex items-center gap-2 font-medium text-green-700">
          <CheckCircle2 className="h-4 w-4" /> Advance received: {rs(advance.amount)} ({advance.method === "cash" ? "cash at shop" : "bank transfer"})
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm">
            1. Call or WhatsApp the customer and agree the advance. 2. Enter it here — the customer then sees it on their order page with
            our bank details. 3. Mark it received. The order can't be confirmed until then.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Advance (Rs)</label>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder={`max ${total.toLocaleString("en-LK")}`}
                className="w-36"
              />
            </div>
            <div className="min-w-48 flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Note for the customer (optional)</label>
              <Input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Items arrive in 5 days" />
            </div>
            <Button
              disabled={!!busy || !amt}
              onClick={() => act("advance", { action: "advance", amount: amt, note }, advance.amount ? "Advance updated" : "Advance asked")}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {busy === "advance" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              {advance.amount ? "Update advance" : "Ask for advance"}
            </Button>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer">
                <Button type="button" variant="outline" className="border-green-500 text-green-700 hover:bg-green-50">
                  WhatsApp customer
                </Button>
              </a>
            )}
          </div>

          {waiting && (
            <div className="mt-4 space-y-3 border-t pt-4 text-sm">
              <p>
                Asked: <b>{rs(advance.amount)}</b> ·{" "}
                {advance.status === "slip_uploaded" ? <b className="text-amber-700">slip uploaded — please check</b> : "waiting for the customer"}
              </p>
              {advance.slipUrl &&
                (advance.slipIsPdf ? (
                  <a href={advance.slipUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border px-4 py-3 hover:bg-muted">
                    <FileText className="h-5 w-5" /> Open advance slip (PDF) <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <a href={advance.slipUrl} target="_blank" rel="noreferrer" title="Open full size">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={advance.slipUrl} alt="Advance slip" className="max-h-64 rounded-lg border object-contain" />
                  </a>
                ))}
              <div className="flex flex-wrap gap-2">
                {advance.status === "slip_uploaded" && (
                  <>
                    <Button
                      size="sm"
                      disabled={!!busy}
                      onClick={() => act("advance-bank", { action: "advance-paid", method: "bank" }, "Advance received")}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Money received (bank)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!busy}
                      onClick={() => confirm("Reject this slip? The customer can upload a new one.") && act("advance-reject", { action: "advance-reject" }, "Slip rejected")}
                    >
                      Reject slip
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!busy}
                  onClick={() =>
                    confirm(`Record ${rs(advance.amount)} advance paid in cash at the shop?`) &&
                    act("advance-cash", { action: "advance-paid", method: "cash" }, "Advance received")
                  }
                >
                  Paid in cash at shop
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
