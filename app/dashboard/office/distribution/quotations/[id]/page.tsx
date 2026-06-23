"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Printer, Edit2, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { printQuotation } from "@/app/lib/quotation-print";

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700",
  Sent: "bg-blue-100 text-blue-700",
  Accepted: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
  Expired: "bg-orange-100 text-orange-700",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-LK", { minimumFractionDigits: 2 }).format(n || 0);

const fmtDate = (s?: string) =>
  s ? new Date(s).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" }) : "—";

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [quotation, setQuotation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    fetch(`/api/quotations/${id}`)
      .then((r) => r.json())
      .then(setQuotation)
      .catch(() => toast.error("Failed to load quotation"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatusChange = async (status: string) => {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/quotations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      setQuotation((prev: any) => ({ ...prev, status }));
      toast.success(`Status → ${status}`);
    } catch {
      toast.error("Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="py-24 text-center">
        <p className="text-muted-foreground">Quotation not found.</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/dashboard/office/distribution/quotations">Back to Quotations</Link>
        </Button>
      </div>
    );
  }

  const items: any[] = quotation.items || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="sm"
          onClick={() => router.push("/dashboard/office/distribution/quotations")} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Quotations
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{quotation.quotation_no}</h1>
          <p className="text-sm text-muted-foreground">{fmtDate(quotation.date)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={quotation.status} onValueChange={handleStatusChange} disabled={updatingStatus}>
            <SelectTrigger className="h-9 w-36">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[quotation.status] ?? ""}`}>
                {quotation.status}
              </span>
            </SelectTrigger>
            <SelectContent>
              {Object.keys(STATUS_COLORS).map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => printQuotation(quotation)}>
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Customer</p>
            <p className="font-semibold text-sm">{quotation.customer_name || "—"}</p>
            {quotation.customer_phone && (
              <p className="text-xs text-muted-foreground">{quotation.customer_phone}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Valid Until</p>
            <p className={`font-semibold text-sm ${quotation.valid_until && new Date(quotation.valid_until) < new Date() ? "text-red-600" : ""}`}>
              {fmtDate(quotation.valid_until)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Prepared By</p>
            <p className="font-semibold text-sm">{quotation.prepared_by || "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Grand Total</p>
            <p className="font-bold text-lg text-blue-700">Rs. {fmt(quotation.grand_total)}</p>
          </CardContent>
        </Card>
      </div>

      {quotation.customer_address && (
        <p className="text-sm text-muted-foreground">Address: {quotation.customer_address}</p>
      )}

      {/* Items */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4 w-8">#</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Spec</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead className="text-right">MRP</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: any, idx: number) => (
                <TableRow key={idx}>
                  <TableCell className="pl-4 text-muted-foreground text-xs">{idx + 1}</TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{item.productName}</div>
                    {item.sku && <div className="text-xs text-muted-foreground font-mono">{item.sku}</div>}
                  </TableCell>
                  <TableCell>
                    {item.brand && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                        {item.brand}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.sizeSpec && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        {item.sizeSpec}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center font-medium">{item.qty}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">Rs. {fmt(item.mrp)}</TableCell>
                  <TableCell className="text-right text-sm">Rs. {fmt(item.unitPrice)}</TableCell>
                  <TableCell className="text-right font-semibold">Rs. {fmt(item.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Totals */}
          <div className="flex justify-end p-4 border-t gap-8">
            <div className="space-y-1 text-sm min-w-48">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sub Total</span>
                <span>Rs. {fmt(quotation.sub_total)}</span>
              </div>
              {quotation.discount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Discount</span>
                  <span>- Rs. {fmt(quotation.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-2 border-t">
                <span>Grand Total</span>
                <span className="text-blue-700">Rs. {fmt(quotation.grand_total)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {quotation.notes && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Notes</p>
            <p className="text-sm">{quotation.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
