"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Plus, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BUSINESS_IDS } from "@/app/config/business-constants";

const BUSINESS_ID = BUSINESS_IDS.ORANGE_AGENCY;

const money = (n: number) =>
  (Number(n) || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MonthlyClaimsPage() {
  const [loading, setLoading] = useState(true);
  const [claims, setClaims] = useState<any[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/supplier-claim-bills?businessId=${BUSINESS_ID}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setClaims(data);
    } catch (e: any) {
      toast.error(
        e.message?.includes("supplier_claim_bills")
          ? "Database table missing — run supabase/migrations/supplier_claim_bills.sql in Supabase first."
          : e.message,
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openClaim = async (id: string) => {
    setOpenId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/supplier-claim-bills/${id}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setDetail(d);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const deleteClaim = async () => {
    if (!detail) return;
    if (!confirm(`Delete claim bill ${detail.claimNo}? The actual cost of the sold items will go back to what it was.`)) return;
    const res = await fetch(`/api/supplier-claim-bills/${detail.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error);
    toast.success("Claim bill deleted");
    setOpenId(null);
    load();
  };

  const totals = useMemo(
    () =>
      claims.reduce(
        (a, c) => {
          a.gross += c.grossTotal;
          a.discount += c.discountAmount;
          return a;
        },
        { gross: 0, discount: 0 },
      ),
    [claims],
  );

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monthly Claim Discounts</h1>
          <p className="text-muted-foreground">
            Orange&apos;s after-month discount bills. Discount only — no stock and no supplier payment.
            Each discount lowers the actual cost of the items on that bill.
          </p>
        </div>
        <Link href="/dashboard/office/orange/claims/monthly/create">
          <Button className="bg-orange-600 hover:bg-orange-700">
            <Plus className="h-4 w-4 mr-2" /> New claim bill
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Claim bills</p>
          <p className="text-2xl font-bold tabular-nums">{claims.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Gross value claimed</p>
          <p className="text-2xl font-bold tabular-nums">LKR {money(totals.gross)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Total extra discount</p>
          <p className="text-2xl font-bold tabular-nums text-emerald-600">LKR {money(totals.discount)}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Claim bill</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Items / Qty</TableHead>
                <TableHead className="text-right">Gross value</TableHead>
                <TableHead className="text-right">Discount %</TableHead>
                <TableHead className="text-right">Discount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin inline mr-2" />Loading…
                </TableCell></TableRow>
              ) : claims.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  No claim bills yet. Click &quot;New claim bill&quot; to enter one.
                </TableCell></TableRow>
              ) : (
                claims.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openClaim(c.id)}>
                    <TableCell>
                      <div className="font-medium">{c.claimNo}</div>
                      <div className="text-[11px] text-muted-foreground">{c.claimDate} · {c.supplierName}</div>
                    </TableCell>
                    <TableCell className="text-sm">{c.periodFrom} → {c.periodTo}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.itemCount} / {c.totalQty.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(c.grossTotal)}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.discountPercent.toFixed(2)}%</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-emerald-600">{money(c.discountAmount)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-orange-600" /> Claim bill {detail?.claimNo}
            </DialogTitle>
            <DialogDescription>
              {detail ? `${detail.supplierName} · period ${detail.periodFrom} → ${detail.periodTo}` : "Loading…"}
            </DialogDescription>
          </DialogHeader>

          {detailLoading || !detail ? (
            <div className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Gross value total</p><p className="font-semibold tabular-nums">{money(detail.grossTotal)}</p></div>
                <div><p className="text-xs text-muted-foreground">Discount ({detail.discountPercent.toFixed(2)}%)</p><p className="font-semibold tabular-nums text-emerald-600">{money(detail.discountAmount)}</p></div>
                <div><p className="text-xs text-muted-foreground">Net after discount</p><p className="font-semibold tabular-nums">{money(detail.grossTotal - detail.discountAmount)}</p></div>
              </div>

              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Discount</TableHead>
                      <TableHead className="text-right">Disc / unit</TableHead>
                      <TableHead className="text-right">Actual cost</TableHead>
                      <TableHead className="text-right">New actual cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.items.map((i: any) => (
                      <TableRow key={i.id}>
                        <TableCell className="max-w-[260px]">
                          <div className="truncate font-medium" title={i.name}>{i.name}</div>
                          <div className="text-[11px] text-muted-foreground">{i.sku}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{i.quantity}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(i.unitPrice)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(i.grossValue)}</TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-600">{money(i.discountAmount)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(i.discountPerUnit)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(i.costBefore)}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{money(i.costAfter)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end">
                <Button variant="ghost" className="text-rose-600" onClick={deleteClaim}>
                  <Trash2 className="h-4 w-4 mr-1" /> Delete claim bill
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
