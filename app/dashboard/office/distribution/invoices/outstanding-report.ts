// app/dashboard/office/distribution/invoices/outstanding-report.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { Invoice } from "./types";
import { BUSINESS_IDS, BUSINESS_NAMES } from "@/app/config/business-constants";

const COMPANY_NAME = BUSINESS_NAMES[BUSINESS_IDS.CHAMPIKA_DISTRIBUTION];

const fmt = (amount: number) =>
  amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const COLOR = {
  headerBg:     [139, 0,   0  ] as [number, number, number],
  headerText:   [255, 255, 255] as [number, number, number],
  custBg:       [245, 245, 245] as [number, number, number],
  custText:     [30,  30,  30 ] as [number, number, number],
  overdueHigh:  [255, 235, 235] as [number, number, number],
  overdueText:  [153, 27,  27 ] as [number, number, number],
  overdueXHigh: [255, 218, 218] as [number, number, number],
  grandBg:      [255, 237, 213] as [number, number, number],
  grandText:    [124, 45,  18 ] as [number, number, number],
  divider:      [220, 220, 220] as [number, number, number],
  titleOrange:  [220, 80,  0  ] as [number, number, number],
  bodyText:     [50,  50,  50 ] as [number, number, number],
  mutedText:    [130, 130, 130] as [number, number, number],
};

// Left margin and table start Y — tightened to reduce white space
const M = 8;   // left/right margin mm
const START_Y = 34; // table starts after header

function buildDoc(outstanding: Invoice[], repFilter: string): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...COLOR.custText);
  doc.text(COMPANY_NAME, M, 13);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLOR.titleOrange);
  const subtitle =
    repFilter !== "all"
      ? `Outstanding Bills (Grouped by Customer) — ${repFilter}`
      : "Outstanding Bills (Grouped by Customer)";
  doc.text(subtitle, M, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR.mutedText);
  doc.text(
    `Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
    M, 25
  );
  doc.text(`Total Outstanding Bills: ${outstanding.length}`, M, 29);

  doc.setDrawColor(...COLOR.divider);
  doc.setLineWidth(0.3);
  doc.line(M, 31, pageWidth - M, 31);

  // ── Group by Customer ─────────────────────────────────────────────────────
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
  const today = new Date();

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
          cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
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
        inv.invoiceNo,
        daysOverdue,
        fmt(inv.totalAmount),
        fmt(inv.paidAmount),
        fmt(inv.dueAmount),
        inv.status.toUpperCase(),
      ]);
    });
  });

  // Grand total row
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
    startY: START_Y,
    margin: { left: M, right: M },
    head: [["Date", "Invoice No", "Days Overdue", "Total (LKR)", "Paid (LKR)", "Due (LKR)", "Status"]],
    body: tableData,
    theme: "plain",
    headStyles: {
      fillColor: COLOR.headerBg,
      textColor: COLOR.headerText,
      fontStyle: "bold",
      fontSize: 8.5,
      halign: "center",
      cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
    },
    styles: {
      fontSize: 8,
      cellPadding: { top: 1.8, bottom: 1.8, left: 2, right: 2 },
      lineColor: COLOR.divider,
      lineWidth: 0.2,
      textColor: COLOR.bodyText,
      overflow: "linebreak",
    },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      // Total widths = 210 - 8*2 margin = 194mm
      0: { halign: "left",   cellWidth: 24 },  // Date
      1: { halign: "center", cellWidth: 24 },  // Invoice No
      2: { halign: "center", cellWidth: 26 },  // Days Overdue
      3: { halign: "right",  cellWidth: 36 },  // Total
      4: { halign: "right",  cellWidth: 30 },  // Paid
      5: { halign: "right",  cellWidth: 30, fontStyle: "bold" }, // Due
      6: { halign: "center", cellWidth: 24 },  // Status
    },
    didParseCell(data) {
      const raw = data.row.raw as any[];
      if (!raw || raw.length !== 7 || typeof raw[0] !== "string") return;

      const days   = Number(raw[2]);
      const status = String(raw[6]);

      if (days >= 60) {
        data.cell.styles.fillColor = COLOR.overdueXHigh;
        data.cell.styles.textColor = COLOR.overdueText;
        if (data.column.index === 2 || data.column.index === 6)
          data.cell.styles.fontStyle = "bold";
      } else if (days >= 45) {
        data.cell.styles.fillColor = COLOR.overdueHigh;
        data.cell.styles.textColor = COLOR.overdueText;
        if (data.column.index === 2 || data.column.index === 6)
          data.cell.styles.fontStyle = "bold";
      }

      if (data.column.index === 6) {
        if (status === "PARTIAL")      data.cell.styles.textColor = [180, 83, 9];
        else if (status === "UNPAID")  data.cell.styles.textColor = [185, 28, 28];
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

export function downloadOutstandingReport(invoices: Invoice[], repFilter: string = "all") {
  const outstanding = invoices.filter(
    (inv) => inv.status !== "Paid" && inv.dueAmount > 0 && (repFilter === "all" || inv.salesRepName === repFilter)
  );
  if (outstanding.length === 0) { toast.info("No outstanding bills found"); return; }
  const doc = buildDoc(outstanding, repFilter);
  const date = new Date().toISOString().split("T")[0];
  const repSuffix = repFilter !== "all" ? `_${repFilter.replace(/\s+/g, "_")}` : "";
  doc.save(`Outstanding_By_Customer${repSuffix}_${date}.pdf`);
  toast.success(`Report downloaded – ${outstanding.length} outstanding bill${outstanding.length > 1 ? "s" : ""}`);
}

export function printOutstandingReport(invoices: Invoice[], repFilter: string = "all") {
  const outstanding = invoices.filter(
    (inv) => inv.status !== "Paid" && inv.dueAmount > 0 && (repFilter === "all" || inv.salesRepName === repFilter)
  );
  if (outstanding.length === 0) { toast.info("No outstanding bills found"); return; }

  const doc = buildDoc(outstanding, repFilter);
  doc.autoPrint();
  const blob = doc.output("blob");
  const url  = URL.createObjectURL(blob);

  // Print via hidden iframe — stays on same page, no navigation
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
