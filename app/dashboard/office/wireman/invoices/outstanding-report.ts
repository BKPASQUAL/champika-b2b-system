import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { Invoice } from "./types";
import { BUSINESS_IDS, BUSINESS_NAMES } from "@/app/config/business-constants";

const COMPANY_NAME = BUSINESS_NAMES[BUSINESS_IDS.WIREMAN_AGENCY];

const fmt = (amount: number) =>
  amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const COLOR = {
  headerBg:      [220, 38,   38 ] as [number, number, number],
  headerText:    [255, 255, 255] as [number, number, number],
  custBg:        [240, 240, 240] as [number, number, number],
  custText:      [50,  50,  50 ] as [number, number, number],

  // 3 Color Themes for Aging Buckets:
  overdue45Bg:   [254, 249, 195] as [number, number, number], // Yellow/Amber
  overdue45Text: [161, 98,  7  ] as [number, number, number],

  overdue60Bg:   [254, 215, 170] as [number, number, number], // Orange
  overdue60Text: [194, 65,  12 ] as [number, number, number],

  overdue90Bg:   [254, 226, 226] as [number, number, number], // Dark Red Critical
  overdue90Text: [185, 28,  28 ] as [number, number, number],

  grandBg:       [255, 237, 213] as [number, number, number],
  grandText:     [124, 45,  18 ] as [number, number, number],
  divider:       [200, 200, 200] as [number, number, number],
  titleRed:      [220, 38,  38 ] as [number, number, number],
  bodyText:      [50,  50,  50 ] as [number, number, number],
  mutedText:     [120, 120, 120] as [number, number, number],
};

const M = 8;

function getOutstandingForRep(invoices: Invoice[], repFilter: string = "all", excludeChampika: boolean = false): Invoice[] {
  const eligible = invoices.filter(
    (inv) => {
      const invSt = inv.status as string;
      const isDelivered = inv.orderStatus === "Delivered" || invSt === "Delivered" || (!inv.orderStatus && invSt !== "Cancelled");
      return (
        inv.status !== "Paid" &&
        inv.orderStatus !== "Cancelled" &&
        isDelivered &&
        inv.dueAmount > 0 &&
        (!excludeChampika || !(inv.customerName || "").toLowerCase().includes("champika hardware"))
      );
    }
  );

  if (repFilter === "all") {
    return eligible;
  }

  const repCustomerNames = new Set(
    eligible
      .filter((inv) => inv.salesRepName === repFilter)
      .map((inv) => (inv.customerName || "").toLowerCase().trim())
  );

  return eligible.filter((inv) =>
    repCustomerNames.has((inv.customerName || "").toLowerCase().trim())
  );
}

function buildDoc(outstanding: Invoice[], repFilter: string, excludeChampika: boolean = false): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const today = new Date();

  // ── Header Title ──────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(50, 50, 50);
  doc.text(COMPANY_NAME, M, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(...COLOR.titleRed);
  const subtitle =
    repFilter !== "all"
      ? `Outstanding Bills (Grouped by Customer) — Rep: ${repFilter}${excludeChampika ? " (Excl. Champika)" : ""}`
      : `Outstanding Bills (Grouped by Customer)${excludeChampika ? " (Excl. Champika)" : ""}`;
  doc.text(subtitle, M, 23);

  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR.mutedText);
  doc.text(
    `Generated: ${new Date().toLocaleDateString("en-GB")}, ${new Date().toLocaleTimeString()}`,
    M, 29
  );

  // ── Aging Summary Calculation ─────────────────────────────────────────────
  let totalDue = 0;
  let due45 = 0;
  let due60 = 0;
  let due90 = 0;

  let count45 = 0;
  let count60 = 0;
  let count90 = 0;

  outstanding.forEach((inv) => {
    totalDue += inv.dueAmount;
    const days = Math.floor(
      (today.getTime() - new Date(inv.date).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (days >= 90) {
      due90 += inv.dueAmount;
      count90++;
    } else if (days >= 60) {
      due60 += inv.dueAmount;
      count60++;
    } else if (days >= 45) {
      due45 += inv.dueAmount;
      count45++;
    }
  });

  // ── Aging Breakdown Summary Table ─────────────────────────────────────────
  autoTable(doc, {
    startY: 32,
    margin: { left: M, right: M },
    head: [["Summary Category", "Bills Count", "Outstanding Amount (LKR)"]],
    body: [
      ["All Outstanding Bills", outstanding.length.toString(), fmt(totalDue)],
      ["45+ Days Overdue (Amber Theme)", count45.toString(), fmt(due45)],
      ["60+ Days Overdue (Orange Theme)", count60.toString(), fmt(due60)],
      ["90+ Days Overdue (Critical Red)", count90.toString(), fmt(due90)],
    ],
    theme: "grid",
    headStyles: {
      fillColor: [60, 60, 60],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      cellPadding: 1.5,
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 1.5,
    },
    columnStyles: {
      0: { cellWidth: 80, fontStyle: "bold" },
      1: { cellWidth: 35, halign: "center" },
      2: { cellWidth: 60, halign: "right", fontStyle: "bold" },
    },
    didParseCell(data) {
      if (data.section === "body") {
        if (data.row.index === 1) {
          data.cell.styles.fillColor = COLOR.overdue45Bg;
          data.cell.styles.textColor = COLOR.overdue45Text;
        } else if (data.row.index === 2) {
          data.cell.styles.fillColor = COLOR.overdue60Bg;
          data.cell.styles.textColor = COLOR.overdue60Text;
        } else if (data.row.index === 3) {
          data.cell.styles.fillColor = COLOR.overdue90Bg;
          data.cell.styles.textColor = COLOR.overdue90Text;
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  const finalSummaryY = (doc as any).lastAutoTable.finalY + 5;

  // ── Group Bills by Customer ────────────────────────────────────────────────
  const grouped: Record<string, Invoice[]> = {};
  outstanding.forEach((inv) => {
    if (!grouped[inv.customerName]) grouped[inv.customerName] = [];
    grouped[inv.customerName].push(inv);
  });

  const sortedCustomers = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  const tableData: any[] = [];
  let grandTotal = 0;
  let grandPaid  = 0;
  let grandDue   = 0;

  sortedCustomers.forEach((customer) => {
    const rows = grouped[customer].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const custDue = rows.reduce((s, i) => s + i.dueAmount, 0);

    tableData.push([
      {
        content: `${customer}  (Total Due: LKR ${fmt(custDue)})`,
        colSpan: 7,
        styles: {
          fillColor: COLOR.custBg,
          textColor: COLOR.custText,
          fontStyle: "bold",
          halign: "left",
          fontSize: 8.5,
          cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 },
        },
      },
    ]);

    rows.forEach((inv) => {
      const daysOverdue = Math.floor(
        (today.getTime() - new Date(inv.date).getTime()) / (1000 * 60 * 60 * 24)
      );
      grandTotal += inv.totalAmount;
      grandPaid  += inv.paidAmount;
      grandDue   += inv.dueAmount;

      tableData.push([
        new Date(inv.date).toLocaleDateString("en-GB"),
        inv.manualInvoiceNo || "",
        daysOverdue,
        fmt(inv.totalAmount),
        fmt(inv.paidAmount),
        fmt(inv.dueAmount),
        (inv.status || "UNPAID").toUpperCase(),
      ]);
    });
  });

  tableData.push([
    { content: "GRAND TOTAL", colSpan: 3,
      styles: { fontStyle: "bold", halign: "right", fillColor: COLOR.grandBg, textColor: COLOR.grandText, fontSize: 8.5 } },
    { content: fmt(grandTotal),
      styles: { fontStyle: "bold", halign: "right", fillColor: COLOR.grandBg, textColor: COLOR.grandText, fontSize: 8.5 } },
    { content: fmt(grandPaid),
      styles: { fontStyle: "bold", halign: "right", fillColor: COLOR.grandBg, textColor: COLOR.grandText, fontSize: 8.5 } },
    { content: fmt(grandDue),
      styles: { fontStyle: "bold", halign: "right", fillColor: COLOR.grandBg, textColor: COLOR.grandText, fontSize: 8.5 } },
    { content: "", styles: { fillColor: COLOR.grandBg } },
  ]);

  autoTable(doc, {
    startY: finalSummaryY,
    margin: { left: M, right: M },
    head: [["Date", "Invoice No", "Days", "Total (LKR)", "Paid (LKR)", "Due (LKR)", "Status"]],
    body: tableData,
    theme: "plain",
    headStyles: {
      fillColor: COLOR.headerBg,
      textColor: COLOR.headerText,
      fontStyle: "bold",
      fontSize: 8.5,
      halign: "center",
      cellPadding: { top: 2.5, bottom: 2.5, left: 1.5, right: 1.5 },
    },
    styles: {
      fontSize: 8,
      cellPadding: { top: 1.5, bottom: 1.5, left: 1.5, right: 1.5 },
      lineColor: COLOR.divider,
      lineWidth: 0.1,
      textColor: COLOR.bodyText,
      overflow: "linebreak",
    },
    columnStyles: {
      0: { halign: "left",   cellWidth: 24 },
      1: { halign: "center", cellWidth: 26 },
      2: { halign: "center", cellWidth: 20 },
      3: { halign: "right",  cellWidth: 34 },
      4: { halign: "right",  cellWidth: 28 },
      5: { halign: "right",  cellWidth: 32, fontStyle: "bold" },
      6: { halign: "center", cellWidth: 30 },
    },
    didParseCell(data) {
      const raw = data.row.raw as any[];
      if (!raw || raw.length !== 7 || typeof raw[0] !== "string") return;

      const days = Number(raw[2]);
      const status = String(raw[6]);

      if (days >= 90) {
        data.cell.styles.fillColor = COLOR.overdue90Bg;
        data.cell.styles.textColor = COLOR.overdue90Text;
        data.cell.styles.fontStyle = "bold";
      } else if (days >= 60) {
        data.cell.styles.fillColor = COLOR.overdue60Bg;
        data.cell.styles.textColor = COLOR.overdue60Text;
      } else if (days >= 45) {
        data.cell.styles.fillColor = COLOR.overdue45Bg;
        data.cell.styles.textColor = COLOR.overdue45Text;
      }

      if (data.column.index === 6) {
        if (status.includes("PARTIAL")) data.cell.styles.textColor = [180, 83, 9];
        else if (status.includes("UNPAID")) data.cell.styles.textColor = [185, 28, 28];
      }
    },
    didDrawPage(_data) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...COLOR.mutedText);
      const pageNum   = (doc as any).internal.getCurrentPageInfo().pageNumber;
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.text(`Page ${pageNum} of ${pageCount}`, pageWidth / 2, pageHeight - 5, { align: "center" });
    },
  });

  return doc;
}

export function downloadOutstandingReport(
  invoices: Invoice[],
  repFilter: string = "all",
  excludeChampika: boolean = false
) {
  const outstanding = getOutstandingForRep(invoices, repFilter, excludeChampika);
  if (outstanding.length === 0) { toast.info("No outstanding bills found"); return; }
  const doc = buildDoc(outstanding, repFilter, excludeChampika);
  const date = new Date().toISOString().split("T")[0];
  const repSuffix = repFilter !== "all" ? `_${repFilter.replace(/\s+/g, "_")}` : "";
  const champikaSuffix = excludeChampika ? "_Excl_Champika" : "";
  doc.save(`Outstanding_By_Customer${repSuffix}${champikaSuffix}_${date}.pdf`);
  toast.success(`Report downloaded – ${outstanding.length} outstanding bill${outstanding.length > 1 ? "s" : ""}`);
}

export function printOutstandingReport(
  invoices: Invoice[],
  repFilter: string = "all",
  excludeChampika: boolean = false
) {
  const outstanding = getOutstandingForRep(invoices, repFilter, excludeChampika);
  if (outstanding.length === 0) { toast.info("No outstanding bills found"); return; }

  const doc = buildDoc(outstanding, repFilter, excludeChampika);
  doc.autoPrint();
  const blob = doc.output("blob");
  const url  = URL.createObjectURL(blob);

  const existing = document.getElementById("__print_frame__");
  if (existing) existing.remove();

  const iframe = document.createElement("iframe");
  iframe.id  = "___print_frame__";
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

  toast.success(`Print ready – ${outstanding.length} outstanding bill${outstanding.length > 1 ? "s" : ""}`);
}
