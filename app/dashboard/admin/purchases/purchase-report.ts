import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { Purchase } from "./types";

const COMPANY_NAME = "Champika Hardware";

type RGB = [number, number, number];
const COLOR = {
  brand: [220, 38, 38] as RGB,
  headerText: [255, 255, 255] as RGB,
  body: [50, 50, 50] as RGB,
  muted: [120, 120, 120] as RGB,
  groupBg: [240, 240, 240] as RGB,
  totalBg: [255, 237, 213] as RGB,
  totalText: [124, 45, 18] as RGB,
  paid: [22, 163, 74] as RGB,
  unpaid: [185, 28, 28] as RGB,
};

const M = 10;

/** Makes header/footer cells use the same alignment as the column's numbers. */
const alignHeadFoot = (columnStyles: Record<number, any>) => (data: any) => {
  if (data.section === "body" || data.cell.colSpan !== 1) return;
  const align = columnStyles[data.column.index]?.halign;
  if (align) data.cell.styles.halign = align;
};

export type GroupMode = "supplier" | "business";

export type ReportColumns = {
  bills: boolean;
  amount: boolean;
  paid: boolean;
  unpaid: boolean;
  share: boolean;
};

export type ReportOptions = {
  mode: GroupMode;
  title: string;
  showBoxes: boolean;
  showSummary: boolean;
  showDetails: boolean;
  columns: ReportColumns;
  /** Supplier/business names to include. null = all. */
  selectedNames: string[] | null;
};

export const defaultReportOptions = (mode: GroupMode = "supplier"): ReportOptions => ({
  mode,
  title: "Purchase Report",
  showBoxes: true,
  showSummary: true,
  showDetails: true,
  columns: { bills: true, amount: true, paid: true, unpaid: true, share: true },
  selectedNames: null,
});

const fmt = (n: number) =>
  n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const groupName = (p: Purchase, mode: GroupMode) =>
  mode === "supplier"
    ? p.supplierName || "Unknown supplier"
    : p.businessName || "No business";

type Group = {
  name: string;
  bills: Purchase[];
  total: number;
  paid: number;
  unpaid: number;
};

function groupPurchases(purchases: Purchase[], mode: GroupMode): Group[] {
  const map = new Map<string, Group>();
  for (const p of purchases) {
    const name = groupName(p, mode);
    const total = Number(p.totalAmount) || 0;
    const paid = Number(p.paidAmount) || 0;
    const g = map.get(name) || { name, bills: [], total: 0, paid: 0, unpaid: 0 };
    g.bills.push(p);
    g.total += total;
    g.paid += paid;
    g.unpaid += total - paid;
    map.set(name, g);
  }
  const groups = [...map.values()].sort((a, b) => b.total - a.total);
  groups.forEach((g) =>
    g.bills.sort((a, b) => (a.purchaseDate || "").localeCompare(b.purchaseDate || ""))
  );
  return groups;
}

function buildDoc(purchases: Purchase[], monthLabel: string, opt: ReportOptions): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const groups = groupPurchases(purchases, opt.mode);
  const groupLabel = opt.mode === "supplier" ? "Supplier" : "Business";
  const otherLabel = opt.mode === "supplier" ? "Business" : "Supplier";
  const col = opt.columns;
  const title = opt.title.trim() || "Purchase Report";

  const grand = groups.reduce(
    (a, g) => ({
      count: a.count + g.bills.length,
      total: a.total + g.total,
      paid: a.paid + g.paid,
      unpaid: a.unpaid + g.unpaid,
    }),
    { count: 0, total: 0, paid: 0, unpaid: 0 }
  );

  // ── Brand header band ──────────────────────────────────────────────
  doc.setFillColor(...COLOR.brand);
  doc.rect(0, 0, pageWidth, 26, "F");
  doc.setTextColor(...COLOR.headerText);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(COMPANY_NAME, M, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`${title} — ${monthLabel}`, M, 20.5);
  doc.setFontSize(8.5);
  const gen = `Generated: ${new Date().toLocaleDateString("en-GB")} ${new Date().toLocaleTimeString()}`;
  doc.text(gen, pageWidth - M, 20.5, { align: "right" });

  let y = 32;

  // ── Summary boxes (follow the chosen columns) ─────────────────────
  if (opt.showBoxes) {
    const boxes: { label: string; value: string; color: RGB }[] = [];
    if (col.bills) boxes.push({ label: "Bills", value: String(grand.count), color: COLOR.body });
    if (col.amount) boxes.push({ label: "Purchased (LKR)", value: fmt(grand.total), color: COLOR.brand });
    if (col.paid) boxes.push({ label: "Paid (LKR)", value: fmt(grand.paid), color: COLOR.paid });
    if (col.unpaid) boxes.push({ label: "Unpaid (LKR)", value: fmt(grand.unpaid), color: COLOR.unpaid });

    if (boxes.length > 0) {
      const gap = 3;
      const boxW = (pageWidth - M * 2 - gap * (boxes.length - 1)) / boxes.length;
      boxes.forEach((b, i) => {
        const x = M + i * (boxW + gap);
        doc.setDrawColor(210, 210, 210);
        doc.roundedRect(x, y, boxW, 16, 2, 2, "S");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...COLOR.muted);
        doc.text(b.label, x + 3, y + 5.5);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...b.color);
        doc.text(b.value, x + 3, y + 12.5);
      });
      y += 25;
    }
  }

  const sectionTitle = (text: string) => {
    if (y > pageHeight - 40) {
      doc.addPage();
      y = 16;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLOR.body);
    doc.text(text, M, y);
    y += 3;
  };

  const tableBase = {
    margin: { left: M, right: M, top: 16 },
    theme: "grid" as const,
    headStyles: { fillColor: COLOR.brand, textColor: COLOR.headerText, fontStyle: "bold" as const },
    footStyles: { fillColor: COLOR.totalBg, textColor: COLOR.totalText, fontStyle: "bold" as const },
  };

  // ── Summary by supplier / business ────────────────────────────────
  if (opt.showSummary) {
    sectionTitle(`Summary by ${groupLabel}`);

    const cols: { head: string; cell: (g: Group, i: number) => string; foot: string; style?: any }[] = [
      { head: "#", cell: (_g, i) => String(i + 1), foot: "", style: { cellWidth: 8, halign: "center" } },
      { head: groupLabel, cell: (g) => g.name, foot: "TOTAL" },
    ];
    if (col.bills) cols.push({ head: "Bills", cell: (g) => String(g.bills.length), foot: String(grand.count), style: { halign: "center", cellWidth: 14 } });
    if (col.amount) cols.push({ head: "Amount", cell: (g) => fmt(g.total), foot: fmt(grand.total), style: { halign: "right" } });
    if (col.paid) cols.push({ head: "Paid", cell: (g) => fmt(g.paid), foot: fmt(grand.paid), style: { halign: "right", textColor: COLOR.paid } });
    if (col.unpaid) cols.push({ head: "Unpaid", cell: (g) => fmt(g.unpaid), foot: fmt(grand.unpaid), style: { halign: "right", textColor: COLOR.unpaid } });
    if (col.share) cols.push({
      head: "Share",
      cell: (g) => (grand.total > 0 ? ((g.total / grand.total) * 100).toFixed(1) + "%" : "-"),
      foot: "100%",
      style: { halign: "right", cellWidth: 16 },
    });

    const summaryStyles = Object.fromEntries(cols.map((c, i) => [i, c.style || {}]));
    autoTable(doc, {
      ...tableBase,
      startY: y,
      head: [cols.map((c) => c.head)],
      body: groups.map((g, i) => cols.map((c) => c.cell(g, i))),
      foot: [cols.map((c) => c.foot)],
      styles: { fontSize: 8.5, cellPadding: 2, textColor: COLOR.body },
      columnStyles: summaryStyles,
      didParseCell: alignHeadFoot(summaryStyles),
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── Bill details grouped ──────────────────────────────────────────
  if (opt.showDetails) {
    sectionTitle(`Bill Details by ${groupLabel}`);

    const money: { head: string; get: (p: Purchase) => number; groupVal: (g: Group) => number; grandVal: number; color?: RGB }[] = [];
    if (col.amount) money.push({ head: "Amount", get: (p) => Number(p.totalAmount) || 0, groupVal: (g) => g.total, grandVal: grand.total });
    if (col.paid) money.push({ head: "Paid", get: (p) => Number(p.paidAmount) || 0, groupVal: (g) => g.paid, grandVal: grand.paid, color: COLOR.paid });
    if (col.unpaid) money.push({
      head: "Unpaid",
      get: (p) => (Number(p.totalAmount) || 0) - (Number(p.paidAmount) || 0),
      groupVal: (g) => g.unpaid,
      grandVal: grand.unpaid,
      color: COLOR.unpaid,
    });

    const body: any[] = [];
    groups.forEach((g) => {
      const label = col.bills
        ? `${g.name}  (${g.bills.length} bill${g.bills.length > 1 ? "s" : ""})`
        : g.name;
      body.push([
        { content: label, colSpan: 4, styles: { fillColor: COLOR.groupBg, fontStyle: "bold" } },
        ...money.map((mc) => ({
          content: fmt(mc.groupVal(g)),
          styles: { fillColor: COLOR.groupBg, fontStyle: "bold", halign: "right", textColor: mc.color || COLOR.body },
        })),
      ]);
      g.bills.forEach((p) => {
        body.push([
          (p.purchaseDate || "").slice(0, 10),
          p.purchaseId,
          p.invoiceNo && p.invoiceNo !== "-" ? p.invoiceNo : "-",
          (opt.mode === "supplier" ? p.businessName : p.supplierName) || "-",
          ...money.map((mc) => fmt(mc.get(p))),
        ]);
      });
    });

    const columnStyles: Record<number, any> = { 0: { cellWidth: 19 }, 1: { cellWidth: 19 } };
    money.forEach((mc, i) => {
      columnStyles[4 + i] = { halign: "right", cellWidth: 25 };
    });

    autoTable(doc, {
      ...tableBase,
      startY: y,
      head: [["Date", "PO No", "Invoice No", otherLabel, ...money.map((mc) => mc.head)]],
      body,
      foot: money.length
        ? [[{ content: "GRAND TOTAL", colSpan: 4 }, ...money.map((mc) => fmt(mc.grandVal))]]
        : undefined,
      showFoot: "lastPage",
      styles: { fontSize: 7.5, cellPadding: 1.6, textColor: COLOR.body },
      footStyles: { ...tableBase.footStyles, halign: "right" },
      columnStyles,
      didParseCell: alignHeadFoot(columnStyles),
    });
  }

  // ── Footer on each page ───────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(200, 200, 200);
    doc.line(M, pageHeight - 10, pageWidth - M, pageHeight - 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLOR.muted);
    doc.text(`${COMPANY_NAME} — ${title} ${monthLabel}`, M, pageHeight - 6);
    doc.text(`Page ${i} of ${pages}`, pageWidth - M, pageHeight - 6, { align: "right" });
  }

  return doc;
}

const fileName = (monthLabel: string, opt: ReportOptions) =>
  `Champika_Hardware_${(opt.title.trim() || "Purchase Report").replace(/\s+/g, "_")}_${monthLabel.replace(/\s+/g, "_")}.pdf`;

/** Drops cancelled orders and anything not in the chosen supplier/business list. */
function prepare(purchases: Purchase[], opt: ReportOptions) {
  const chosen = opt.selectedNames ? new Set(opt.selectedNames) : null;
  const active = purchases.filter(
    (p) => p.status !== "Cancelled" && (!chosen || chosen.has(groupName(p, opt.mode)))
  );
  if (active.length === 0) {
    toast.info("No purchases to show in the report");
    return null;
  }
  if (!opt.showBoxes && !opt.showSummary && !opt.showDetails) {
    toast.info("Pick at least one section for the report");
    return null;
  }
  return active;
}

export function downloadPurchaseReport(
  purchases: Purchase[],
  monthLabel: string,
  opt: ReportOptions = defaultReportOptions()
) {
  const active = prepare(purchases, opt);
  if (!active) return;
  buildDoc(active, monthLabel, opt).save(fileName(monthLabel, opt));
  toast.success("Purchase report downloaded");
}

export function printPurchaseReport(
  purchases: Purchase[],
  monthLabel: string,
  opt: ReportOptions = defaultReportOptions()
) {
  const active = prepare(purchases, opt);
  if (!active) return;
  const doc = buildDoc(active, monthLabel, opt);
  doc.autoPrint();
  const url = URL.createObjectURL(doc.output("blob"));

  document.getElementById("__purchase_print_frame__")?.remove();
  const iframe = document.createElement("iframe");
  iframe.id = "__purchase_print_frame__";
  iframe.src = url;
  iframe.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;border:none;";
  document.body.appendChild(iframe);
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      iframe.remove();
    }, 10000);
  };
}

export async function sharePurchaseReport(
  purchases: Purchase[],
  monthLabel: string,
  opt: ReportOptions = defaultReportOptions()
) {
  const active = prepare(purchases, opt);
  if (!active) return;

  const groups = groupPurchases(active, opt.mode);
  const total = groups.reduce((s, g) => s + g.total, 0);
  const paid = groups.reduce((s, g) => s + g.paid, 0);
  const unpaid = groups.reduce((s, g) => s + g.unpaid, 0);
  const col = opt.columns;
  const title = opt.title.trim() || "Purchase Report";

  let msg = `*CHAMPIKA HARDWARE - ${title.toUpperCase()}*\n*${monthLabel}*\n\n`;
  if (col.bills) msg += `Bills: *${active.length}*\n`;
  if (col.amount) msg += `Purchased: *LKR ${fmt(total)}*\n`;
  if (col.paid) msg += `Paid: *LKR ${fmt(paid)}*\n`;
  if (col.unpaid) msg += `Unpaid: *LKR ${fmt(unpaid)}*\n`;
  msg += `\n*By ${opt.mode === "supplier" ? "Supplier" : "Business"}:*\n`;
  groups.forEach((g) => {
    const parts: string[] = [];
    if (col.amount) parts.push(`LKR ${fmt(g.total)}`);
    if (col.unpaid) parts.push(`unpaid ${fmt(g.unpaid)}`);
    if (col.bills) parts.push(`${g.bills.length} bills`);
    msg += `• ${g.name}${parts.length ? ": " + parts.join(", ") : ""}\n`;
  });

  const doc = buildDoc(active, monthLabel, opt);
  const name = fileName(monthLabel, opt);
  const file = new File([doc.output("blob")], name, { type: "application/pdf" });

  // Phones/tablets: share the PDF file directly (WhatsApp, email, etc.)
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: `Champika Hardware - ${title} ${monthLabel}`,
        text: `${title} ${monthLabel}`,
        files: [file],
      });
      return;
    } catch (e: any) {
      if (e?.name === "AbortError") return;
    }
  }

  // Desktop fallback: download the PDF and open WhatsApp with the summary text
  doc.save(name);
  if (encodeURIComponent(msg).length > 2000) {
    msg = msg.split("\n").slice(0, 25).join("\n") + "\n... (see attached PDF)";
  }
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
  toast.success("PDF downloaded — attach it in WhatsApp");
}
