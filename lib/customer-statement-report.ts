// lib/customer-statement-report.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

export interface InvoicePaymentRecord {
  id?: string;
  paymentDate: string;
  amount: number;
  method: string;
  chequeNo?: string | null;
  chequeStatus?: string | null;
}

export interface StatementInvoice {
  id: string;
  invoiceNo: string;
  date: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status?: string;
  payments?: InvoicePaymentRecord[];
}

const fmt = (amount: number) =>
  amount.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const COLOR = {
  headerBg: [30, 58, 138] as [number, number, number], // Blue-900
  headerText: [255, 255, 255] as [number, number, number],
  custBg: [241, 245, 249] as [number, number, number],
  custText: [15, 23, 42] as [number, number, number],
  overdueHigh: [254, 249, 195] as [number, number, number],
  overdueText: [161, 98, 7] as [number, number, number],
  overdueXHigh: [254, 226, 226] as [number, number, number],
  overdueXText: [185, 28, 28] as [number, number, number],
  paymentSubRowBg: [248, 250, 252] as [number, number, number],
  paymentSubRowText: [71, 85, 105] as [number, number, number],
  grandBg: [254, 243, 199] as [number, number, number],
  grandText: [146, 64, 14] as [number, number, number],
  divider: [226, 232, 240] as [number, number, number],
  titleBlue: [30, 58, 138] as [number, number, number],
  bodyText: [51, 65, 85] as [number, number, number],
  mutedText: [100, 116, 139] as [number, number, number],
};

const M = 15;
const START_Y = 56;

function buildDoc(
  customerName: string,
  invoices: StatementInvoice[],
  companyName: string = "CHAMPIKA HARDWARE & DISTRIBUTION"
): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const today = new Date();

  // ── 1. Header & Title ──────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...COLOR.titleBlue);
  doc.text(companyName, M, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(220, 38, 38);
  doc.text("CUSTOMER OUTSTANDING STATEMENT", M, 25);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR.mutedText);
  doc.text(`Generated: ${today.toLocaleDateString("en-GB")}, ${today.toLocaleTimeString()}`, M, 31);

  // ── 2. Customer Info Card Box ──────────────────────────────────────────────
  doc.setFillColor(...COLOR.custBg);
  doc.roundedRect(M, 35, pageWidth - M * 2, 16, 1.5, 1.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLOR.custText);
  doc.text(`Customer: ${customerName}`, M + 4, 41);

  const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.balance, 0);
  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.paidAmount, 0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(220, 38, 38);
  doc.text(`Total Due: LKR ${fmt(totalOutstanding)}`, pageWidth - M - 4, 41, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR.mutedText);
  doc.text(`Unpaid / Partial Invoices: ${invoices.length}`, M + 4, 47);
  doc.text(`Total Invoiced: LKR ${fmt(totalInvoiced)} | Paid: LKR ${fmt(totalPaid)}`, pageWidth - M - 4, 47, { align: "right" });

  // ── 3. Build Table Data with Payment History Rows ─────────────────────────
  const tableData: any[] = [];

  invoices.forEach((inv) => {
    const invDate = inv.date ? new Date(inv.date) : today;
    const daysOverdue = Math.max(0, Math.floor((today.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24)));

    // Main Invoice Row
    tableData.push([
      inv.date ? invDate.toLocaleDateString("en-GB") : "—",
      inv.invoiceNo,
      `${daysOverdue} days`,
      fmt(inv.totalAmount),
      fmt(inv.paidAmount),
      fmt(inv.balance),
      inv.balance === 0 ? "PAID" : inv.paidAmount > 0 ? "PARTIAL" : "UNPAID",
    ]);

    // Payment History Sub-rows (if any payments exist)
    if (inv.payments && inv.payments.length > 0) {
      inv.payments.forEach((p) => {
        const pDate = p.paymentDate ? new Date(p.paymentDate).toLocaleDateString("en-GB") : "—";
        const methodStr = p.method.toUpperCase();
        const chequeStr = p.chequeNo ? ` (Cheque #${p.chequeNo})` : "";
        const detailStr = `     Invoice ${inv.invoiceNo} -- Partial Payment on ${pDate} via ${methodStr}${chequeStr}: LKR ${fmt(p.amount)}`;

        tableData.push([
          {
            content: detailStr,
            colSpan: 7,
            styles: {
              fillColor: COLOR.paymentSubRowBg,
              textColor: COLOR.paymentSubRowText,
              fontStyle: "italic",
              fontSize: 8,
              cellPadding: { top: 2, bottom: 2, left: 6, right: 2 },
            },
          },
        ]);
      });
    }
  });

  // Grand Total Summary Row
  tableData.push([
    {
      content: "TOTAL OUTSTANDING BALANCE",
      colSpan: 3,
      styles: {
        fontStyle: "bold",
        halign: "right",
        fillColor: COLOR.grandBg,
        textColor: COLOR.grandText,
        fontSize: 9,
      },
    },
    {
      content: fmt(totalInvoiced),
      styles: {
        fontStyle: "bold",
        halign: "right",
        fillColor: COLOR.grandBg,
        textColor: COLOR.grandText,
        fontSize: 9,
      },
    },
    {
      content: fmt(totalPaid),
      styles: {
        fontStyle: "bold",
        halign: "right",
        fillColor: COLOR.grandBg,
        textColor: COLOR.grandText,
        fontSize: 9,
      },
    },
    {
      content: fmt(totalOutstanding),
      styles: {
        fontStyle: "bold",
        halign: "right",
        fillColor: COLOR.grandBg,
        textColor: [185, 28, 28], // Red for due
        fontSize: 9,
      },
    },
    {
      content: "",
      styles: { fillColor: COLOR.grandBg },
    },
  ]);

  autoTable(doc, {
    startY: START_Y,
    margin: { left: M, right: M },
    head: [["Date", "Invoice No", "Age", "Total (LKR)", "Paid (LKR)", "Balance Due", "Status"]],
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
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
      lineColor: COLOR.divider,
      lineWidth: 0.1,
      textColor: COLOR.bodyText,
      overflow: "linebreak",
    },
    columnStyles: {
      0: { halign: "left", cellWidth: 24 }, // Date
      1: { halign: "center", cellWidth: 28 }, // Invoice No
      2: { halign: "center", cellWidth: 20 }, // Age
      3: { halign: "right", cellWidth: 32 }, // Total
      4: { halign: "right", cellWidth: 28 }, // Paid
      5: { halign: "right", cellWidth: 32, fontStyle: "bold" }, // Balance Due
      6: { halign: "center", cellWidth: 16 }, // Status
    },
    didParseCell(data) {
      const raw = data.row.raw as any[];
      if (!raw || raw.length !== 7 || typeof raw[0] !== "string") return;

      const days = parseInt(raw[2] || "0", 10);
      const status = String(raw[6]);

      if (days >= 90) {
        data.cell.styles.fillColor = COLOR.overdueXHigh;
        data.cell.styles.textColor = COLOR.overdueXText;
      } else if (days >= 45) {
        data.cell.styles.fillColor = COLOR.overdueHigh;
        data.cell.styles.textColor = COLOR.overdueText;
      }

      if (data.column.index === 6) {
        if (status === "PARTIAL") data.cell.styles.textColor = [180, 83, 9];
        else if (status === "UNPAID") data.cell.styles.textColor = [185, 28, 28];
      }
    },
    didDrawPage(_data) {
      const pageNum = (doc as any).internal.getCurrentPageInfo().pageNumber;
      const pageCount = (doc as any).internal.getNumberOfPages();

      // Footer line
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.2);
      doc.line(M, pageHeight - 15, pageWidth - M, pageHeight - 15);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...COLOR.mutedText);
      doc.text("Thank you for your business. Please arrange payment for overdue invoices.", M, pageHeight - 10);
      doc.text(`Page ${pageNum} of ${pageCount}`, pageWidth - M, pageHeight - 10, { align: "right" });
    },
  });

  return doc;
}

export function downloadCustomerStatement(
  customerName: string,
  invoices: StatementInvoice[],
  companyName?: string
) {
  if (!invoices || invoices.length === 0) {
    toast.info("No pending invoices to generate statement");
    return;
  }
  const doc = buildDoc(customerName, invoices, companyName);
  const dateStr = new Date().toISOString().split("T")[0];
  const safeName = customerName.replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`Statement_${safeName}_${dateStr}.pdf`);
  toast.success(`Statement downloaded for ${customerName}`);
}

export function printCustomerStatement(
  customerName: string,
  invoices: StatementInvoice[],
  companyName?: string
) {
  if (!invoices || invoices.length === 0) {
    toast.info("No pending invoices to print statement");
    return;
  }
  const doc = buildDoc(customerName, invoices, companyName);
  doc.autoPrint();
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);

  const existing = document.getElementById("__print_frame__");
  if (existing) existing.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "__print_frame__";
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

  toast.success(`Print ready for ${customerName}`);
}

export async function shareCustomerStatement(
  customerName: string,
  invoices: StatementInvoice[],
  companyName?: string
) {
  if (!invoices || invoices.length === 0) {
    toast.info("No pending invoices to share");
    return;
  }
  const totalDue = invoices.reduce((sum, i) => sum + i.balance, 0);

  // WhatsApp text summary
  let msg = `*Customer Statement - ${customerName}*\n`;
  msg += `*${companyName || "Champika Hardware"}*\n\n`;
  msg += `*Total Outstanding Balance:* LKR ${fmt(totalDue)}\n`;
  msg += `*Pending Invoices:* ${invoices.length}\n\n`;
  msg += `*Invoice Breakdown:*\n`;

  invoices.forEach((inv) => {
    const invDate = inv.date ? new Date(inv.date).toLocaleDateString("en-GB") : "—";
    const days = inv.date
      ? Math.max(0, Math.floor((new Date().getTime() - new Date(inv.date).getTime()) / (1000 * 60 * 60 * 24)))
      : 0;
    msg += `• *${inv.invoiceNo}* (${invDate}, ${days} days): Due LKR ${fmt(inv.balance)} (Total LKR ${fmt(inv.totalAmount)})\n`;
    if (inv.payments && inv.payments.length > 0) {
      inv.payments.forEach((p) => {
        const pDate = p.paymentDate ? new Date(p.paymentDate).toLocaleDateString("en-GB") : "—";
        msg += `   - Invoice ${inv.invoiceNo}: Paid LKR ${fmt(p.amount)} on ${pDate} (${p.method.toUpperCase()})\n`;
      });
    }
  });

  msg += `\nPlease arrange payment at your earliest convenience. Thank you!`;

  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

  // Try Web Share API if PDF file sharing is supported
  const doc = buildDoc(customerName, invoices, companyName);
  const blob = doc.output("blob");
  const safeName = customerName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const file = new File([blob], `Statement_${safeName}.pdf`, { type: "application/pdf" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: `Outstanding Statement - ${customerName}`,
        text: `Outstanding Statement for ${customerName} (Total Due: LKR ${fmt(totalDue)})`,
        files: [file],
      });
      toast.success("Statement shared successfully");
      return;
    } catch (e: any) {
      if (e.name !== "AbortError") {
        console.warn("File share failed, falling back to WhatsApp/Clipboard:", e);
      } else {
        return;
      }
    }
  }

  // Fallback: Open WhatsApp with full breakdown
  window.open(waUrl, "_blank");
  toast.success("Opened WhatsApp with invoice statement summary");
}
