import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

export interface ChequeSettlementRow {
  id: string;
  customerName: string;
  invoiceNo: string;
  invoiceDate: string | null;
  chequeDate: string | null;
  chequeNo: string | null;
  bankCode: string | null;
  bankName: string | null;
  branchCode: string | null;
  amount: number;
  status: string;
  settlementDays: number;
}

const fmt = (amount: number) =>
  amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDate = (d: string | null | undefined) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return d;
  }
};

const COLOR = {
  headerBg: [109, 40, 217] as [number, number, number], // Purple-700
  headerText: [255, 255, 255] as [number, number, number],
  custBg: [243, 232, 255] as [number, number, number], // Purple-100
  custText: [88, 28, 135] as [number, number, number], // Purple-900

  // Aging colors
  days30Bg: [240, 253, 244] as [number, number, number], // Green
  days30Text: [22, 101, 52] as [number, number, number],

  days60Bg: [239, 246, 255] as [number, number, number], // Blue
  days60Text: [30, 64, 175] as [number, number, number],

  days90Bg: [254, 243, 199] as [number, number, number], // Amber
  days90Text: [146, 64, 14] as [number, number, number],

  days90PlusBg: [254, 226, 226] as [number, number, number], // Red
  days90PlusText: [153, 27, 27] as [number, number, number],

  grandBg: [237, 233, 254] as [number, number, number], // Purple-100
  grandText: [88, 28, 135] as [number, number, number],
  mutedText: [100, 116, 139] as [number, number, number],
  titleDark: [30, 41, 59] as [number, number, number],
};

const M = 8; // Margin in mm

export function buildChequeSettlementDoc(
  cheques: ChequeSettlementRow[],
  portalName: string = "Sierra Agency",
  customerFilter?: string,
  sortBy: string = "days_desc"
): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // ── Header Title ──────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...COLOR.titleDark);
  doc.text(`${portalName} — Cheque Realization & Settlement Days Report`, M, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...COLOR.mutedText);

  const filterSubtitle = customerFilter && customerFilter !== "all"
    ? `Customer: ${customerFilter} | Total Cheques: ${cheques.length}`
    : `All Customers Grouped | Total Cheques: ${cheques.length}`;
  doc.text(filterSubtitle, M, 20);

  doc.setFontSize(8);
  doc.text(
    `Generated: ${new Date().toLocaleDateString("en-GB")}, ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
    M,
    25
  );

  // ── Aging / Settlement Buckets Summary ──────────────────────────────────────
  let totalAmount = 0;
  let count30 = 0;
  let amount30 = 0;
  let count60 = 0;
  let amount60 = 0;
  let count90 = 0;
  let amount90 = 0;
  let count90Plus = 0;
  let amount90Plus = 0;

  cheques.forEach((c) => {
    totalAmount += c.amount;
    const days = c.settlementDays;
    if (days <= 30) {
      count30++;
      amount30 += c.amount;
    } else if (days <= 60) {
      count60++;
      amount60 += c.amount;
    } else if (days <= 90) {
      count90++;
      amount90 += c.amount;
    } else {
      count90Plus++;
      amount90Plus += c.amount;
    }
  });

  const avgDays = cheques.length > 0
    ? Math.round(cheques.reduce((sum, c) => sum + c.settlementDays, 0) / cheques.length)
    : 0;

  const summaryData = [
    [
      "0 - 30 Days (Fast)",
      `${count30} cheque(s)`,
      `LKR ${fmt(amount30)}`,
      "61 - 90 Days (Extended)",
      `${count90} cheque(s)`,
      `LKR ${fmt(amount90)}`,
    ],
    [
      "31 - 60 Days (Standard)",
      `${count60} cheque(s)`,
      `LKR ${fmt(amount60)}`,
      "> 90 Days (Critical)",
      `${count90Plus} cheque(s)`,
      `LKR ${fmt(amount90Plus)}`,
    ],
    [
      "Avg Settlement Period",
      `${avgDays} Days`,
      "—",
      "Total Portfolio",
      `${cheques.length} cheque(s)`,
      `LKR ${fmt(totalAmount)}`,
    ],
  ];

  autoTable(doc, {
    startY: 28,
    margin: { left: M, right: M },
    head: [["Settlement Aging", "Count", "Amount", "Settlement Aging", "Count", "Amount"]],
    body: summaryData,
    theme: "grid",
    headStyles: {
      fillColor: [71, 85, 105],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
      cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 },
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: { top: 1.2, bottom: 1.2, left: 2, right: 2 },
    },
    columnStyles: {
      0: { cellWidth: 45, fontStyle: "bold" },
      1: { cellWidth: 30, halign: "center" },
      2: { cellWidth: 50, halign: "right", fontStyle: "bold" },
      3: { cellWidth: 45, fontStyle: "bold" },
      4: { cellWidth: 30, halign: "center" },
      5: { cellWidth: 50, halign: "right", fontStyle: "bold" },
    },
    didParseCell(data) {
      if (data.section === "body") {
        if (data.row.index === 0 && data.column.index < 3) {
          data.cell.styles.fillColor = COLOR.days30Bg;
          data.cell.styles.textColor = COLOR.days30Text;
        } else if (data.row.index === 1 && data.column.index < 3) {
          data.cell.styles.fillColor = COLOR.days60Bg;
          data.cell.styles.textColor = COLOR.days60Text;
        } else if (data.row.index === 0 && data.column.index >= 3) {
          data.cell.styles.fillColor = COLOR.days90Bg;
          data.cell.styles.textColor = COLOR.days90Text;
        } else if (data.row.index === 1 && data.column.index >= 3) {
          data.cell.styles.fillColor = COLOR.days90PlusBg;
          data.cell.styles.textColor = COLOR.days90PlusText;
          data.cell.styles.fontStyle = "bold";
        } else if (data.row.index === 2) {
          data.cell.styles.fillColor = COLOR.grandBg;
          data.cell.styles.textColor = COLOR.grandText;
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  const finalSummaryY = (doc as any).lastAutoTable.finalY + 4;

  // ── Group Cheques by Customer ──────────────────────────────────────────────
  const grouped: Record<string, ChequeSettlementRow[]> = {};
  cheques.forEach((c) => {
    const cust = c.customerName || "Unknown Customer";
    if (!grouped[cust]) grouped[cust] = [];
    grouped[cust].push(c);
  });

  const sortedCustomers = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  const tableData: any[] = [];
  let grandTotalAmount = 0;

  sortedCustomers.forEach((customer) => {
    const rows = grouped[customer].sort((a, b) => {
      if (sortBy === "days_desc") return b.settlementDays - a.settlementDays;
      if (sortBy === "days_asc") return a.settlementDays - b.settlementDays;
      if (sortBy === "amount_desc") return b.amount - a.amount;
      if (sortBy === "date_desc") {
        const da = a.chequeDate ? new Date(a.chequeDate).getTime() : 0;
        const db = b.chequeDate ? new Date(b.chequeDate).getTime() : 0;
        return db - da;
      }
      const da = a.chequeDate ? new Date(a.chequeDate).getTime() : 0;
      const db = b.chequeDate ? new Date(b.chequeDate).getTime() : 0;
      return da - db;
    });

    const custTotal = rows.reduce((s, r) => s + r.amount, 0);

    // Customer section header
    tableData.push([
      {
        content: `CUSTOMER: ${customer.toUpperCase()}   (${rows.length} Cheque${rows.length > 1 ? "s" : ""} — Total: LKR ${fmt(custTotal)})`,
        colSpan: 9,
        styles: {
          fillColor: COLOR.custBg,
          textColor: COLOR.custText,
          fontStyle: "bold",
          halign: "left",
          fontSize: 8,
          cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
        },
      },
    ]);

    rows.forEach((r, idx) => {
      grandTotalAmount += r.amount;

      tableData.push([
        idx + 1,
        formatDate(r.invoiceDate),
        r.invoiceNo || "—",
        formatDate(r.chequeDate),
        r.chequeNo || "—",
        r.bankCode ? `${r.bankCode} - ${r.bankName || ""}` : r.bankName || "—",
        r.branchCode || "—",
        `${r.settlementDays} Days`,
        fmt(r.amount),
      ]);
    });
  });

  // Grand Total Row
  tableData.push([
    {
      content: `GRAND TOTAL (${cheques.length} Cheques)`,
      colSpan: 8,
      styles: {
        fontStyle: "bold",
        halign: "right",
        fillColor: COLOR.grandBg,
        textColor: COLOR.grandText,
        fontSize: 8.5,
        cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
      },
    },
    {
      content: `LKR ${fmt(grandTotalAmount)}`,
      styles: {
        fontStyle: "bold",
        halign: "right",
        fillColor: COLOR.grandBg,
        textColor: COLOR.grandText,
        fontSize: 8.5,
        cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
      },
    },
  ]);

  autoTable(doc, {
    startY: finalSummaryY,
    margin: { left: M, right: M },
    head: [
      [
        "#",
        "Bill Date",
        "Invoice No",
        "Cheque Date",
        "Cheque No",
        "Bank Code / Name",
        "Branch",
        "Settlement Period",
        "Amount (LKR)",
      ],
    ],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: COLOR.headerBg,
      textColor: COLOR.headerText,
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 },
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 26, halign: "center" },
      2: { cellWidth: 32, halign: "center", fontStyle: "bold" },
      3: { cellWidth: 26, halign: "center", fontStyle: "bold" },
      4: { cellWidth: 32, halign: "center", fontStyle: "bold" },
      5: { cellWidth: 60, halign: "left" },
      6: { cellWidth: 20, halign: "center" },
      7: { cellWidth: 34, halign: "center", fontStyle: "bold" },
      8: { cellWidth: 41, halign: "right", fontStyle: "bold" },
    },
    didParseCell(data) {
      if (
        data.section === "body" &&
        data.column.index === 7 &&
        typeof data.cell.raw === "string"
      ) {
        const match = data.cell.raw.match(/(\d+)\s*Days/i);
        if (match) {
          const days = parseInt(match[1], 10);
          data.cell.styles.halign = "center";
          data.cell.styles.fontStyle = "bold";
          if (days <= 30) {
            data.cell.styles.fillColor = COLOR.days30Bg;
            data.cell.styles.textColor = COLOR.days30Text;
          } else if (days <= 60) {
            data.cell.styles.fillColor = COLOR.days60Bg;
            data.cell.styles.textColor = COLOR.days60Text;
          } else if (days <= 90) {
            data.cell.styles.fillColor = COLOR.days90Bg;
            data.cell.styles.textColor = COLOR.days90Text;
          } else {
            data.cell.styles.fillColor = COLOR.days90PlusBg;
            data.cell.styles.textColor = COLOR.days90PlusText;
          }
        }
      }
    },
    didDrawPage(data) {
      const pageCount = (doc.internal as any).getNumberOfPages();
      const currentPage = (doc.internal as any).getCurrentPageInfo().pageNumber;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Page ${currentPage} of ${pageCount} — Champika B2B Management System (${portalName})`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 5,
        { align: "center" }
      );
    },
  });

  return doc;
}

export function downloadChequeSettlementPdf(
  cheques: ChequeSettlementRow[],
  portalName: string = "Sierra Agency",
  customerFilter?: string,
  sortBy: string = "days_desc"
) {
  if (cheques.length === 0) {
    toast.info("No cheques to export");
    return;
  }
  const doc = buildChequeSettlementDoc(cheques, portalName, customerFilter, sortBy);
  const date = new Date().toISOString().split("T")[0];
  const custSuffix = customerFilter && customerFilter !== "all"
    ? `_${customerFilter.replace(/[^a-zA-Z0-9_-]/g, "_")}`
    : "_All_Customers";
  doc.save(`Sierra_Cheque_Realization_Days${custSuffix}_${date}.pdf`);
  toast.success(`PDF downloaded — ${cheques.length} cheque(s)`);
}

export function printChequeSettlementPdf(
  cheques: ChequeSettlementRow[],
  portalName: string = "Sierra Agency",
  customerFilter?: string,
  sortBy: string = "days_desc"
) {
  if (cheques.length === 0) {
    toast.info("No cheques to print");
    return;
  }

  const doc = buildChequeSettlementDoc(cheques, portalName, customerFilter, sortBy);
  doc.autoPrint();
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);

  const existing = document.getElementById("__settlement_print_frame__");
  if (existing) existing.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "__settlement_print_frame__";
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

  toast.success(`Print ready — ${cheques.length} cheque(s)`);
}

export function getChequeSettlementPdfBlob(
  cheques: ChequeSettlementRow[],
  portalName: string = "Sierra Agency",
  customerFilter?: string,
  sortBy: string = "days_desc"
): { blob: Blob; url: string; filename: string } {
  const doc = buildChequeSettlementDoc(cheques, portalName, customerFilter, sortBy);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().split("T")[0];
  const custSuffix = customerFilter && customerFilter !== "all"
    ? `_${customerFilter.replace(/[^a-zA-Z0-9_-]/g, "_")}`
    : "_All_Customers";
  const filename = `Sierra_Cheque_Realization_Days${custSuffix}_${date}.pdf`;
  return { blob, url, filename };
}

export function buildCustomerWhatsAppMessage(
  customerName: string,
  cheques: ChequeSettlementRow[],
  portalName: string = "Sierra Agency"
): string {
  const totalAmount = cheques.reduce((s, c) => s + c.amount, 0);
  const avgDays =
    cheques.length > 0
      ? Math.round(cheques.reduce((s, c) => s + c.settlementDays, 0) / cheques.length)
      : 0;

  let msg = `*${portalName.toUpperCase()} — CHEQUE REALIZATION STATEMENT*\n`;
  msg += `👤 *Customer:* ${customerName}\n`;
  msg += `📅 *Generated:* ${new Date().toLocaleDateString("en-GB")}\n`;
  msg += `--------------------------------\n`;
  msg += `📊 *Summary:* ${cheques.length} Cheque(s) | *Total:* LKR ${fmt(totalAmount)}\n`;
  msg += `⏱ *Avg Credit / Settlement:* ${avgDays} Days\n\n`;
  msg += `*Cheque Breakdown:*\n`;

  cheques.forEach((c, i) => {
    msg += `${i + 1}) *Chq #${c.chequeNo || "N/A"}* (${c.bankName || c.bankCode || "Bank"})\n`;
    msg += `   • Bill Date: ${formatDate(c.invoiceDate)} (Inv: ${c.invoiceNo})\n`;
    msg += `   • Cheque Date: ${formatDate(c.chequeDate)} (${c.settlementDays} Days Credit)\n`;
    msg += `   • Amount: LKR ${fmt(c.amount)} [${c.status}]\n`;
  });

  msg += `\n--------------------------------\n`;
  msg += `*Grand Total:* LKR ${fmt(totalAmount)}\n`;
  msg += `Thank you for your business! 🙏`;

  return msg;
}
