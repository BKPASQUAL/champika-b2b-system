"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Loader2, Printer, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadInvoice, printHalfPageInvoice, printInvoice } from "@/app/lib/invoice-print";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";

const lkr = (n: number) => `LKR ${Number(n || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const statusTone = (s: string) =>
  s === "Paid" ? "bg-green-100 text-green-700 border-green-200" : s === "Partial" ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-red-100 text-red-700 border-red-200";

/** One BK Wiring invoice: print with the BK Wiring header and take payments. */
export default function BkWiringInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [inv, setInv] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<"cash" | "bank">("cash");
  const [paying, setPaying] = useState(false);

  const load = () =>
    fetch(`/api/invoices/${id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setInv)
      .catch(() => toast.error("Failed to load invoice"))
      .finally(() => setLoading(false));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <div className="py-16 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-teal-600" /></div>;
  if (!inv) return null;

  const total = Number(inv.grandTotal || 0);
  const paid = Number(inv.paidAmount || 0);
  const due = Math.max(0, total - paid);
  const status = due <= 0.01 ? "Paid" : paid > 0 ? "Partial" : "Unpaid";
  const subTotal = (inv.items || []).reduce((s: number, i: any) => s + Number(i.total || 0), 0);

  const recordPayment = async () => {
    const amount = Number(payAmount);
    if (!(amount > 0)) return toast.error("Enter an amount");
    if (amount > due + 0.01) return toast.error(`Amount is more than the due ${lkr(due)}`);
    setPaying(true);
    try {
      const user = getUserBusinessContext();
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: inv.orderId,
          customerId: inv.customerId,
          amount,
          method: payMethod,
          date: new Date().toISOString().split("T")[0],
          performedById: user?.id,
          performedByName: user?.name,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Payment failed");
      toast.success("Payment recorded");
      setPayOpen(false);
      setPayAmount("");
      load();
    } catch (e: any) {
      toast.error(e.message || "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/office/website/office-invoices")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold font-mono">{inv.invoiceNo}</h1>
            <Badge className={statusTone(status)}>{status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{inv.date ? new Date(inv.date).toLocaleDateString("en-GB") : ""} · BK Wiring invoice</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => printInvoice(id, "website")}><Printer className="w-4 h-4 mr-1.5" /> Print A4</Button>
          <Button variant="outline" size="sm" onClick={() => printHalfPageInvoice(id, "website")}><Printer className="w-4 h-4 mr-1.5" /> Print Half</Button>
          <Button variant="outline" size="sm" onClick={() => downloadInvoice(id, "website")}><Download className="w-4 h-4 mr-1.5" /> PDF</Button>
          {due > 0.01 && (
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => { setPayAmount(due.toFixed(2)); setPayOpen(true); }}>
              <Wallet className="w-4 h-4 mr-1.5" /> Record Payment
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Items</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(inv.items || []).map((it: any) => (
                  <TableRow key={it.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{it.productName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{it.sku}</p>
                    </TableCell>
                    <TableCell className="text-right text-sm">{lkr(it.unitPrice)}{it.discountPercent > 0 && <span className="text-xs text-muted-foreground"> −{it.discountPercent}%</span>}</TableCell>
                    <TableCell className="text-center text-sm">{it.quantity}{it.freeQuantity > 0 && <span className="text-green-700"> +{it.freeQuantity}</span>}</TableCell>
                    <TableCell className="text-right text-sm font-semibold">{lkr(it.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Customer</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-0.5">
              <p className="font-semibold">{inv.customer?.shop || "-"}</p>
              {inv.customer?.name && <p className="text-muted-foreground">{inv.customer.name}</p>}
              {inv.customer?.phone && <p className="text-muted-foreground">{inv.customer.phone}</p>}
              {inv.customer?.address && <p className="text-muted-foreground">{inv.customer.address}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 text-sm space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{lkr(subTotal)}</span></div>
              {subTotal - total > 0.01 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-red-600">− {lkr(subTotal - total)}</span></div>
              )}
              <div className="flex justify-between font-bold text-base border-t pt-2"><span>Total</span><span>{lkr(total)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span className="text-green-700">{lkr(paid)}</span></div>
              <div className="flex justify-between font-semibold"><span>Due</span><span className={due > 0.01 ? "text-red-600" : ""}>{lkr(due)}</span></div>
            </CardContent>
          </Card>
          {(inv.payments || []).length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Payments</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                {inv.payments.map((p: any) => (
                  <div key={p.id} className="flex justify-between">
                    <span className="text-muted-foreground">{p.payment_date ? new Date(p.payment_date).toLocaleDateString("en-GB") : ""} · {p.method}</span>
                    <span>{lkr(p.amount)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Record payment · {inv.invoiceNo}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Amount (due {lkr(due)})</Label>
              <Input type="number" min={0} step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["cash", "bank"] as const).map((m) => (
                <Button key={m} type="button" variant={payMethod === m ? "default" : "outline"} onClick={() => setPayMethod(m)}>
                  {m === "cash" ? "Cash" : "Bank transfer"}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={recordPayment} disabled={paying}>
              {paying && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
