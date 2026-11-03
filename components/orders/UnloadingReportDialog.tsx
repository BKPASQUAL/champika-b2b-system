"use client";

// Unloading Report for a load: everything that has to come off the lorry and
// back into the store after delivery, as a product summary in two parts:
//   A. Good stock back to store
//        - Not delivered: orders still set to Loading (or cancelled)
//        - Changed: items removed/reduced on invoices edited after loading
//        - Good returns collected from customers
//   B. Damaged returns collected from customers
// Uses the statuses currently picked on the Reconcile page.

import React, { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Loader2, PackageOpen, Printer, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export interface UnloadReturnInput {
  orderId: string;
  invoiceNo: string;
  customer: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  condition: "Good" | "Damage";
  returnType: string;
}

interface ApiLine {
  productId: string;
  quantity: number;
}
interface ApiOrder {
  orderId: string;
  orderNo: string;
  invoiceNo: string;
  customer: string;
  status: string;
  editedAfterLoading: boolean;
  loadedAmount: number;
  currentAmount: number;
  // Set for return-note pickups: items collected from the shop
  pickup: { kind: string; items: { productId: string; quantity: number; condition: "Good" | "Damage" }[] } | null;
  loaded: ApiLine[];
  current: ApiLine[];
}
interface ApiData {
  load: {
    loadId: string;
    lorryNumber: string;
    driverName: string;
    helperName: string;
    loadingDate: string;
    status: string;
  };
  products: Record<string, { name: string; sku: string; unit: string }>;
  orders: ApiOrder[];
}

interface GoodRow {
  key: string;
  name: string;
  sku: string;
  unit: string;
  notDelivered: number;
  changed: number;
  goodReturn: number;
  total: number;
}

interface InvoiceRow {
  invoiceNo: string;
  customer: string;
  label: "Rescheduled" | "Cancel Request" | "Cancelled" | "Edited" | "Not collected";
  detail: string;
}

interface DamageRow {
  key: string;
  name: string;
  sku: string;
  unit: string;
  qty: number;
  invoices: string;
}

const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
const dash = (n: number) => (n ? fmtQty(n) : "-");

export function UnloadingReportDialog({
  open,
  onOpenChange,
  loadId,
  statuses,
  cancelReasons = {},
  returns,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loadId: string;
  statuses: Record<string, string>; // orderId -> status picked on the page
  cancelReasons?: Record<string, string>; // orderId -> reason, for Cancel Request
  returns: UnloadReturnInput[];
}) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/orders/loading/history/${loadId}/unloading`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || "Failed");
        return res.json();
      })
      .then(setData)
      .catch((e) => toast.error(e.message || "Failed to build unloading report"))
      .finally(() => setLoading(false));
  }, [open, loadId]);

  const report = useMemo(() => {
    if (!data) return null;
    const prod = (id: string) => data.products[id] || { name: "Unknown Product", sku: "", unit: "Pcs" };

    const good = new Map<string, GoodRow>();
    const goodRow = (key: string, name: string, sku: string, unit: string) => {
      if (!good.has(key)) {
        good.set(key, { key, name, sku, unit, notDelivered: 0, changed: 0, goodReturn: 0, total: 0 });
      }
      return good.get(key)!;
    };

    const damage = new Map<string, DamageRow & { invoiceSet: Set<string> }>();
    const addDamage = (key: string, name: string, sku: string, unit: string, qty: number, invoiceNo: string) => {
      if (!damage.has(key)) {
        damage.set(key, { key, name, sku, unit, qty: 0, invoices: "", invoiceSet: new Set() });
      }
      const d = damage.get(key)!;
      d.qty += qty;
      d.invoiceSet.add(invoiceNo);
    };

    // Invoices that didn't go as loaded: rescheduled, cancel requested, edited
    const invoiceRows: InvoiceRow[] = [];
    const lkr = (n: number) => n.toLocaleString("en-LK", { maximumFractionDigits: 2 });

    data.orders.forEach((o) => {
      const status = statuses[o.orderId] || o.status;

      if (o.pickup) {
        if (status !== "Delivered") {
          invoiceRows.push({ invoiceNo: o.invoiceNo, customer: o.customer, label: "Not collected", detail: "Return pickup — collect on a later load" });
        }
      } else if (status === "Cancel Request") {
        invoiceRows.push({
          invoiceNo: o.invoiceNo,
          customer: o.customer,
          label: "Cancel Request",
          detail: `LKR ${lkr(o.currentAmount)}${cancelReasons[o.orderId] ? ` — ${cancelReasons[o.orderId]}` : ""}`,
        });
      } else if (status === "Cancelled") {
        invoiceRows.push({ invoiceNo: o.invoiceNo, customer: o.customer, label: "Cancelled", detail: `LKR ${lkr(o.currentAmount)}` });
      } else if (status !== "Delivered") {
        invoiceRows.push({ invoiceNo: o.invoiceNo, customer: o.customer, label: "Rescheduled", detail: `LKR ${lkr(o.currentAmount)} — deliver on a later load` });
      } else if (o.editedAfterLoading) {
        const diff = o.currentAmount - o.loadedAmount;
        invoiceRows.push({
          invoiceNo: o.invoiceNo,
          customer: o.customer,
          label: "Edited",
          detail: `LKR ${lkr(o.loadedAmount)} → ${lkr(o.currentAmount)} (${diff >= 0 ? "+" : ""}${lkr(diff)})`,
        });
      }

      // Return-note pickup: once collected (Delivered), its items come back
      // as returns. Not collected = never on the lorry, nothing to unload.
      if (o.pickup) {
        if (status !== "Delivered") return;
        o.pickup.items.forEach((l) => {
          const p = prod(l.productId);
          if (l.condition === "Damage") addDamage(l.productId, p.name, p.sku, p.unit, l.quantity, o.invoiceNo);
          else goodRow(l.productId, p.name, p.sku, p.unit).goodReturn += l.quantity;
        });
        return;
      }

      if (status !== "Delivered") {
        // Whole order comes back
        o.loaded.forEach((l) => {
          const p = prod(l.productId);
          goodRow(l.productId, p.name, p.sku, p.unit).notDelivered += l.quantity;
        });
        return;
      }

      // Delivered: items removed or reduced after loading come back
      const cur = new Map(o.current.map((l) => [l.productId, l.quantity]));
      o.loaded.forEach((l) => {
        const diff = l.quantity - (cur.get(l.productId) || 0);
        if (diff > 0.0001) {
          const p = prod(l.productId);
          goodRow(l.productId, p.name, p.sku, p.unit).changed += diff;
        }
      });
    });

    returns.forEach((r) => {
      const key = r.productId || r.productName;
      const unit = data.products[r.productId]?.unit || "Pcs";
      if (r.condition === "Damage") {
        addDamage(key, r.productName, r.sku, unit, r.quantity, r.invoiceNo);
      } else {
        goodRow(key, r.productName, r.sku, unit).goodReturn += r.quantity;
      }
    });

    const goodRows = Array.from(good.values())
      .map((g) => ({ ...g, total: g.notDelivered + g.changed + g.goodReturn }))
      .filter((g) => g.total > 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    const damageRows: DamageRow[] = Array.from(damage.values())
      .map(({ invoiceSet, ...d }) => ({ ...d, invoices: Array.from(invoiceSet).join(", ") }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const order: Record<InvoiceRow["label"], number> = {
      "Cancel Request": 0,
      Cancelled: 1,
      Rescheduled: 2,
      "Not collected": 3,
      Edited: 4,
    };
    invoiceRows.sort((a, b) => order[a.label] - order[b.label] || a.invoiceNo.localeCompare(b.invoiceNo));

    return {
      invoiceRows,
      goodRows,
      damageRows,
      goodTotal: goodRows.reduce((t, g) => t + g.total, 0),
      damageTotal: damageRows.reduce((t, d) => t + d.qty, 0),
    };
  }, [data, statuses, cancelReasons, returns]);

  const buildPdf = () => {
    if (!data || !report) return null;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const M = 12;
    const pageW = doc.internal.pageSize.getWidth();
    const body = { fontSize: 8.5, cellPadding: 2 };
    const headStyle = (rgb: [number, number, number]) => ({
      fillColor: rgb,
      textColor: 255,
      fontStyle: "bold" as const,
      fontSize: 8.5,
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(30, 58, 138);
    doc.text("CHAMPIKA HARDWARE", M, 15);
    doc.setFontSize(11);
    doc.setTextColor(220, 38, 38);
    doc.text("LORRY UNLOADING REPORT", M, 21);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    const info = [
      `Load: ${data.load.loadId}`,
      `Lorry: ${data.load.lorryNumber || "-"}`,
      `Driver: ${data.load.driverName || "-"}${data.load.helperName ? `  |  Helper: ${data.load.helperName}` : ""}`,
      `Loading date: ${data.load.loadingDate ? new Date(data.load.loadingDate).toLocaleDateString("en-GB") : "-"}`,
    ];
    doc.text(info.join("     "), M, 27);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${new Date().toLocaleString("en-GB")}`, M, 31.5);

    let y = 38;
    const section = (title: string, rgb: [number, number, number]) => {
      if (y > 255) {
        doc.addPage();
        y = 15;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...rgb);
      doc.text(title, M, y);
      y += 2;
    };
    const after = () => {
      y = (doc as any).lastAutoTable.finalY + 9;
    };

    // Invoice status: rescheduled / cancel request / edited
    if (report.invoiceRows.length > 0) {
      section(`INVOICE STATUS (${report.invoiceRows.length})`, [30, 58, 138]);
      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M },
        head: [["Invoice", "Customer", "Status", "Details"]],
        body: report.invoiceRows.map((r) => [r.invoiceNo, r.customer, r.label, r.detail]),
        headStyles: headStyle([30, 58, 138]),
        styles: body,
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 26 }, 2: { fontStyle: "bold", cellWidth: 28 } },
        didParseCell: (cell) => {
          if (cell.section !== "body" || cell.column.index !== 2) return;
          const label = String(cell.cell.raw);
          cell.cell.styles.textColor =
            label === "Cancel Request" || label === "Cancelled"
              ? [190, 18, 60]
              : label === "Edited"
                ? [180, 83, 9]
                : [29, 78, 216];
        },
      });
      after();
    }

    // A. Good stock
    section(`A. GOOD STOCK BACK TO STORE (${fmtQty(report.goodTotal)} units)`, [21, 128, 61]);
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [["Product", "SKU", "Not Delivered", "Changed", "Good Return", "Total", "Checked"]],
      body: report.goodRows.length
        ? report.goodRows.map((g) => [
            g.name,
            g.sku,
            dash(g.notDelivered),
            dash(g.changed),
            dash(g.goodReturn),
            `${fmtQty(g.total)} ${g.unit}`,
            "",
          ])
        : [[{ content: "No good stock to unload", colSpan: 7, styles: { halign: "center", textColor: [100, 116, 139] } }]],
      foot: report.goodRows.length
        ? [[{ content: "TOTAL", colSpan: 5, styles: { halign: "right" } }, fmtQty(report.goodTotal), ""]]
        : undefined,
      headStyles: headStyle([21, 128, 61]),
      footStyles: { fillColor: [240, 253, 244], textColor: [21, 128, 61], fontStyle: "bold", fontSize: 8.5 },
      styles: body,
      columnStyles: {
        2: { halign: "center" },
        3: { halign: "center" },
        4: { halign: "center" },
        5: { halign: "right", fontStyle: "bold" },
        6: { cellWidth: 18 },
      },
    });
    after();

    // B. Damaged returns
    section(`B. DAMAGED RETURNS (${fmtQty(report.damageTotal)} units)`, [185, 28, 28]);
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [["Product", "SKU", "Invoices", "Qty", "Checked"]],
      body: report.damageRows.length
        ? report.damageRows.map((d) => [d.name, d.sku, d.invoices, `${fmtQty(d.qty)} ${d.unit}`, ""])
        : [[{ content: "No damaged returns", colSpan: 5, styles: { halign: "center", textColor: [100, 116, 139] } }]],
      foot: report.damageRows.length
        ? [[{ content: "TOTAL", colSpan: 3, styles: { halign: "right" } }, fmtQty(report.damageTotal), ""]]
        : undefined,
      headStyles: headStyle([185, 28, 28]),
      footStyles: { fillColor: [254, 242, 242], textColor: [185, 28, 28], fontStyle: "bold", fontSize: 8.5 },
      styles: body,
      columnStyles: { 3: { halign: "right", fontStyle: "bold" }, 4: { cellWidth: 18 } },
    });
    after();

    // Signatures
    if (y > 255) {
      doc.addPage();
      y = 25;
    } else {
      y += 8;
    }
    doc.setDrawColor(148, 163, 184);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    const colW = (pageW - M * 2) / 3;
    ["Unloaded by (Driver)", "Received by (Store)", "Checked by (Office)"].forEach((label, i) => {
      const x = M + i * colW;
      doc.line(x, y, x + colW - 10, y);
      doc.text(label, x, y + 4.5);
    });

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(`${data.load.loadId} · Unloading Report`, M, doc.internal.pageSize.getHeight() - 8);
      doc.text(`Page ${i} of ${pages}`, pageW - M, doc.internal.pageSize.getHeight() - 8, { align: "right" });
    }
    return doc;
  };

  const download = () => {
    const doc = buildPdf();
    if (!doc || !data) return;
    doc.save(`Unloading_${data.load.loadId}.pdf`);
  };

  const print = () => {
    const doc = buildPdf();
    if (!doc) return;
    doc.autoPrint();
    const url = URL.createObjectURL(doc.output("blob"));
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const empty =
    report && report.goodRows.length === 0 && report.damageRows.length === 0 && report.invoiceRows.length === 0;

  const labelClass: Record<InvoiceRow["label"], string> = {
    "Cancel Request": "bg-rose-100 text-rose-700 border-rose-200",
    Cancelled: "bg-rose-100 text-rose-700 border-rose-200",
    Rescheduled: "bg-blue-100 text-blue-700 border-blue-200",
    "Not collected": "bg-slate-100 text-slate-700 border-slate-200",
    Edited: "bg-amber-100 text-amber-800 border-amber-200",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageOpen className="w-5 h-5 text-orange-600" /> Lorry Unloading Report
          </DialogTitle>
          <DialogDescription>
            {data
              ? `${data.load.loadId} · ${data.load.lorryNumber || ""} — items to take off the lorry and back into the store.`
              : "Items to take off the lorry and back into the store."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {loading || !report ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : empty ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground text-sm text-center">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
              Nothing to unload — every invoice was delivered as loaded and no returns were collected.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                  <p className="text-[11px] text-green-800">Good stock to unload</p>
                  <p className="text-lg font-bold text-green-700">{fmtQty(report.goodTotal)} units</p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <p className="text-[11px] text-red-800">Damaged returns</p>
                  <p className="text-lg font-bold text-red-700">{fmtQty(report.damageTotal)} units</p>
                </div>
              </div>

              {/* Invoice status */}
              {report.invoiceRows.length > 0 && (
                <Block title="Invoice status" tone="info">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-blue-50 hover:bg-blue-50">
                        <TableHead>Invoice</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.invoiceRows.map((r) => (
                        <TableRow key={`${r.invoiceNo}-${r.label}`}>
                          <TableCell>
                            <div className="font-mono text-xs font-semibold">{r.invoiceNo}</div>
                            <div className="text-[11px] text-muted-foreground">{r.customer}</div>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${labelClass[r.label]}`}>
                              {r.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">{r.detail}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Block>
              )}

              {/* A. Good stock */}
              <Block title="Good stock back to store" tone="good">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-green-50 hover:bg-green-50">
                      <TableHead>Product</TableHead>
                      <TableHead className="text-center">Not Delivered</TableHead>
                      <TableHead className="text-center">Changed</TableHead>
                      <TableHead className="text-center">Good Return</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.goodRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                          No good stock to unload.
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {report.goodRows.map((g) => (
                          <TableRow key={g.key}>
                            <TableCell>
                              <div className="text-sm font-medium">{g.name}</div>
                              <div className="text-[11px] text-muted-foreground font-mono">{g.sku}</div>
                            </TableCell>
                            <TableCell className="text-center text-sm">{g.notDelivered ? fmtQty(g.notDelivered) : "—"}</TableCell>
                            <TableCell className="text-center text-sm">{g.changed ? fmtQty(g.changed) : "—"}</TableCell>
                            <TableCell className="text-center text-sm">{g.goodReturn ? fmtQty(g.goodReturn) : "—"}</TableCell>
                            <TableCell className="text-right font-bold text-sm whitespace-nowrap">
                              {fmtQty(g.total)} {g.unit}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-green-50/60 hover:bg-green-50/60">
                          <TableCell colSpan={4} className="text-right text-sm font-semibold">Total</TableCell>
                          <TableCell className="text-right font-bold text-green-700">{fmtQty(report.goodTotal)}</TableCell>
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </Block>

              {/* B. Damaged returns */}
              <Block title="Damaged returns" tone="damage">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-red-50 hover:bg-red-50">
                      <TableHead>Product</TableHead>
                      <TableHead>Invoices</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.damageRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">
                          No damaged returns.
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {report.damageRows.map((d) => (
                          <TableRow key={d.key}>
                            <TableCell>
                              <div className="text-sm font-medium">{d.name}</div>
                              <div className="text-[11px] text-muted-foreground font-mono">{d.sku}</div>
                            </TableCell>
                            <TableCell className="text-xs font-mono">{d.invoices}</TableCell>
                            <TableCell className="text-right font-bold text-sm whitespace-nowrap text-red-600">
                              {fmtQty(d.qty)} {d.unit}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-red-50/60 hover:bg-red-50/60">
                          <TableCell colSpan={2} className="text-right text-sm font-semibold">Total</TableCell>
                          <TableCell className="text-right font-bold text-red-700">{fmtQty(report.damageTotal)}</TableCell>
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </Block>
            </>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="outline" className="gap-1.5" disabled={!report} onClick={print}>
            <Printer className="w-4 h-4" /> Print
          </Button>
          <Button className="gap-1.5 bg-orange-600 hover:bg-orange-700 text-white" disabled={!report} onClick={download}>
            <Download className="w-4 h-4" /> Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Block({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "good" | "damage" | "info";
  children: React.ReactNode;
}) {
  const text = { good: "text-green-700", damage: "text-red-700", info: "text-blue-800" }[tone];
  const border = { good: "border-green-200", damage: "border-red-200", info: "border-blue-200" }[tone];
  return (
    <div>
      <h3 className={`text-sm font-semibold mb-2 ${text}`}>{title}</h3>
      <div className={`rounded-md border overflow-x-auto ${border}`}>
        {children}
      </div>
    </div>
  );
}
