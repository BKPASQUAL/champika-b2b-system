import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

export interface CustomerProfile {
  id: string;
  customerId: string;
  shopName: string;
  ownerName?: string;
  phone?: string;
  email?: string;
  address?: string;
  route?: string;
  status?: string;
  creditLimit: number;
  outstandingBalance: number;
  businessName?: string;
}

export interface FinancialSummary {
  totalInvoicesCount: number;
  totalInvoiced: number;
  totalPaid: number;
  totalDue: number;
  outstandingBalance: number;
  creditLimit: number;
  creditAvailable: number;
  cheques?: {
    totalCount: number;
    pendingCount: number;
    pendingAmount: number;
    clearedCount: number;
    clearedAmount: number;
    returnedCount: number;
    returnedAmount: number;
  };
  returns?: {
    totalCount: number;
    goodCount: number;
    damageCount: number;
  };
}

export interface CustomerInvoiceItem {
  id: string;
  invoiceNo: string;
  manualInvoiceNo?: string;
  date: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
  orderStatus?: string;
  paymentType?: string;
  notes?: string;
}

export interface CustomerPaymentItem {
  id: string;
  date: string;
  amount: number;
  method: string;
  chequeNo?: string;
  chequeDate?: string;
  chequeStatus?: string;
  invoiceNo?: string;
  notes?: string;
}

export interface CustomerChequeItem {
  id: string;
  chequeNo: string;
  chequeDate: string;
  amount: number;
  status: string;
  invoiceNo?: string;
  notes?: string;
}

export interface CustomerReturnItem {
  id: string;
  returnNumber: string;
  date: string;
  productName: string;
  sku: string;
  quantity: number;
  returnType: string;
  reason?: string;
}

export interface CustomerPurchasedProductItem {
  id: string;
  name: string;
  sku: string;
  unit?: string;
  latestUnitPrice?: number;
  totalPurchasedQty: number;
  totalSpent: number;
  purchaseCount: number;
  lastPurchasedDate?: string;
}

export interface CustomerFullReportData {
  customer: CustomerProfile;
  summary: FinancialSummary;
  invoices: CustomerInvoiceItem[];
  payments: CustomerPaymentItem[];
  cheques: CustomerChequeItem[];
  returns: CustomerReturnItem[];
  purchasedProducts?: CustomerPurchasedProductItem[];
}

const COMPANY_NAME = "Champika B2B Management System";
const M = 10; // Page margin

const COLOR = {
  headerBg: [30, 41, 59] as [number, number, number],
  headerText: [255, 255, 255] as [number, number, number],
  sectionBg: [241, 245, 249] as [number, number, number],
  sectionText: [15, 23, 42] as [number, number, number],
  tableBorder: [226, 232, 240] as [number, number, number],
  primary: [37, 99, 235] as [number, number, number],
  success: [16, 185, 129] as [number, number, number],
  danger: [220, 38, 38] as [number, number, number],
  warning: [217, 119, 6] as [number, number, number],
  mutedText: [100, 116, 139] as [number, number, number],
  bodyText: [51, 65, 85] as [number, number, number],
};

const fmt = (amount: number) =>
  (amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function buildCustomerDoc(data: CustomerFullReportData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const printableWidth = pageWidth - M * 2;
  const now = new Date();

  // ── Header Banner ────────────────────────────────────────────────────────
  doc.setFillColor(...COLOR.headerBg);
  doc.rect(0, 0, pageWidth, 24, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(COMPANY_NAME, M, 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text("CUSTOMER STATEMENT & DELIVERED INVOICES REPORT", M, 17);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Generated: ${now.toLocaleDateString("en-GB")} ${now.toLocaleTimeString()}`,
    pageWidth - M,
    17,
    { align: "right" }
  );

  let currentY = 29;

  // ── Customer Profile Card ────────────────────────────────────────────────
  const cust = data.customer;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...COLOR.tableBorder);
  doc.roundedRect(M, currentY, printableWidth, 34, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...COLOR.sectionText);
  doc.text(cust.shopName || "N/A", M + 4, currentY + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR.mutedText);
  doc.text(`Customer ID: ${cust.customerId || cust.id}`, M + 4, currentY + 12);

  // Profile details columns
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR.bodyText);

  const col1X = M + 4;
  const col2X = M + 70;
  const col3X = M + 130;

  doc.text(`Owner: ${cust.ownerName || "N/A"}`, col1X, currentY + 19);
  doc.text(`Phone: ${cust.phone || "N/A"}`, col1X, currentY + 24);
  doc.text(`Email: ${cust.email || "N/A"}`, col1X, currentY + 29);

  doc.text(`Route: ${cust.route || "General"}`, col2X, currentY + 19);
  doc.text(`Business: ${cust.businessName || "General"}`, col2X, currentY + 24);
  doc.text(`Address: ${(cust.address || "N/A").substring(0, 32)}`, col2X, currentY + 29);

  // Financial status inside profile box
  doc.setFont("helvetica", "bold");
  doc.text(`Credit Limit: LKR ${fmt(cust.creditLimit)}`, col3X, currentY + 19);
  doc.setTextColor(
    cust.outstandingBalance > 0 ? COLOR.danger[0] : COLOR.bodyText[0],
    cust.outstandingBalance > 0 ? COLOR.danger[1] : COLOR.bodyText[1],
    cust.outstandingBalance > 0 ? COLOR.danger[2] : COLOR.bodyText[2]
  );
  doc.text(`Outstanding: LKR ${fmt(cust.outstandingBalance)}`, col3X, currentY + 24);

  const availCredit = Math.max(0, cust.creditLimit - cust.outstandingBalance);
  doc.setTextColor(...COLOR.success);
  doc.text(`Available Credit: LKR ${fmt(availCredit)}`, col3X, currentY + 29);

  currentY += 38;

  // ── Filter for Delivered & Completed Invoices Only (Strictly exclude Cancelled & Non-delivered) ──
  const eligibleInvoices = (data.invoices || []).filter((inv: any) => {
    const invSt = String(inv.status || "").toLowerCase().trim();
    const ordSt = String(inv.orderStatus || "").toLowerCase().trim();

    // 1. Exclude any invoice or order marked as Cancelled, Canceled, Void, or Draft
    if (
      invSt.includes("cancel") ||
      ordSt.includes("cancel") ||
      invSt.includes("void") ||
      ordSt.includes("void") ||
      invSt.includes("draft") ||
      ordSt.includes("draft")
    ) {
      return false;
    }

    // 2. Exclude non-delivered order statuses
    if (
      ordSt === "pending" ||
      ordSt === "processing" ||
      ordSt === "loading" ||
      ordSt === "in transit" ||
      ordSt === "transit"
    ) {
      return false;
    }

    // 3. Include if explicitly marked as Delivered or Completed
    if (
      ordSt === "delivered" ||
      ordSt === "completed" ||
      invSt === "delivered" ||
      invSt === "completed"
    ) {
      return true;
    }

    // 4. Include active valid invoice statuses (Paid, Partial, Unpaid, Overdue)
    return (
      invSt === "paid" ||
      invSt === "partial" ||
      invSt === "unpaid" ||
      invSt === "overdue"
    );
  });

  const totalInvoicesCount = eligibleInvoices.length;
  const totalInvoiced = eligibleInvoices.reduce(
    (sum, inv) => sum + (inv.totalAmount || 0),
    0
  );
  const totalPaid = eligibleInvoices.reduce(
    (sum, inv) => sum + (inv.paidAmount || 0),
    0
  );
  const totalDue = eligibleInvoices.reduce(
    (sum, inv) => sum + (inv.dueAmount || 0),
    0
  );

  const s = data.summary;
  const pendingChq = s.cheques?.pendingAmount || 0;
  const clearedChq = s.cheques?.clearedAmount || 0;
  const returnedChq = s.cheques?.returnedAmount || 0;
  const goodReturns = s.returns?.goodCount || 0;
  const damageReturns = s.returns?.damageCount || 0;

  // ── Key Financial KPI Summary Table ──────────────────────────────────────
  autoTable(doc, {
    startY: currentY,
    margin: { left: M, right: M },
    head: [
      [
        "Delivered Invoices",
        "Total Invoiced",
        "Total Paid",
        "Balance Due",
        "Pending Cheques",
        "Cleared Cheques",
        "Bounced Cheques",
        "Returns (Good/Dmg)",
      ],
    ],
    body: [
      [
        `${totalInvoicesCount} Inv`,
        `LKR ${fmt(totalInvoiced)}`,
        `LKR ${fmt(totalPaid)}`,
        `LKR ${fmt(totalDue)}`,
        `LKR ${fmt(pendingChq)}`,
        `LKR ${fmt(clearedChq)}`,
        `LKR ${fmt(returnedChq)}`,
        `${goodReturns} G / ${damageReturns} D`,
      ],
    ],
    theme: "grid",
    headStyles: {
      fillColor: [51, 65, 85],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "center",
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7.5,
      halign: "center",
      fontStyle: "bold",
      cellPadding: 2,
    },
    columnStyles: {
      3: { textColor: COLOR.danger, fontStyle: "bold" },
      4: { textColor: COLOR.warning },
      5: { textColor: COLOR.success },
      6: { textColor: COLOR.danger },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // ── 1. DELIVERED INVOICES / BILLS STATEMENT TABLE ────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLOR.sectionText);
  doc.text("1. Delivered Invoices & Bills Statement", M, currentY);
  currentY += 2;

  const invRows: any[] = eligibleInvoices.map((inv) => {
    const invDate = inv.date ? new Date(inv.date).toLocaleDateString("en-GB") : "-";
    return [
      invDate,
      inv.invoiceNo || "-",
      inv.paymentType || "Standard",
      fmt(inv.totalAmount),
      fmt(inv.paidAmount),
      fmt(inv.dueAmount),
      (inv.status || "UNPAID").toUpperCase(),
    ];
  });

  // Grand total for delivered invoices
  invRows.push([
    {
      content: "TOTAL DELIVERED INVOICES STATEMENT",
      colSpan: 3,
      styles: { fontStyle: "bold", halign: "right", fillColor: [241, 245, 249] },
    },
    {
      content: fmt(totalInvoiced),
      styles: { fontStyle: "bold", halign: "right", fillColor: [241, 245, 249] },
    },
    {
      content: fmt(totalPaid),
      styles: { fontStyle: "bold", halign: "right", fillColor: [241, 245, 249] },
    },
    {
      content: fmt(totalDue),
      styles: {
        fontStyle: "bold",
        halign: "right",
        fillColor: [241, 245, 249],
        textColor: COLOR.danger,
      },
    },
    { content: "", styles: { fillColor: [241, 245, 249] } },
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: M, right: M },
    head: [["Date", "Invoice No", "Type", "Total (LKR)", "Paid (LKR)", "Due (LKR)", "Status"]],
    body:
      invRows.length > 1
        ? invRows
        : [["No delivered invoice records found for this customer.", "", "", "", "", "", ""]],
    theme: "plain",
    headStyles: {
      fillColor: COLOR.headerBg,
      textColor: COLOR.headerText,
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
      cellPadding: 2,
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 1.5,
      lineColor: COLOR.tableBorder,
      lineWidth: 0.1,
      textColor: COLOR.bodyText,
    },
    columnStyles: {
      0: { halign: "left", cellWidth: 24 },
      1: { halign: "center", cellWidth: 32, fontStyle: "bold", textColor: COLOR.primary },
      2: { halign: "center", cellWidth: 24 },
      3: { halign: "right", cellWidth: 32 },
      4: { halign: "right", cellWidth: 28, textColor: COLOR.success },
      5: { halign: "right", cellWidth: 28, fontStyle: "bold", textColor: COLOR.danger },
      6: { halign: "center", cellWidth: 22 },
    },
    didParseCell(dataCell) {
      if (dataCell.section === "body" && dataCell.row.index < invRows.length - 1) {
        const raw = dataCell.row.raw as any[];
        if (raw && raw.length === 7) {
          const st = String(raw[6]);
          if (dataCell.column.index === 6) {
            if (st.includes("PAID") && !st.includes("UNPAID"))
              dataCell.cell.styles.textColor = COLOR.success;
            else if (st.includes("PARTIAL"))
              dataCell.cell.styles.textColor = COLOR.warning;
            else if (st.includes("UNPAID"))
              dataCell.cell.styles.textColor = COLOR.danger;
          }
        }
      }
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // ── 2. PAYMENT HISTORY STATEMENT ─────────────────────────────────────────
  if (currentY > pageHeight - 40) {
    doc.addPage();
    currentY = 15;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLOR.sectionText);
  doc.text("2. Payment History Log", M, currentY);
  currentY += 2;

  const payRows = (data.payments || []).map((p) => {
    const payDate = p.date ? new Date(p.date).toLocaleDateString("en-GB") : "-";
    const chqDate = p.chequeDate ? new Date(p.chequeDate).toLocaleDateString("en-GB") : "-";
    const isChq = p.method === "cheque" || Boolean(p.chequeNo);
    const status = p.chequeStatus || (isChq ? "Pending" : "Cleared");

    return [
      payDate,
      p.invoiceNo || "N/A",
      (p.method || "Cash").toUpperCase(),
      p.chequeNo || "-",
      p.chequeNo ? chqDate : "-",
      status.toUpperCase(),
      fmt(p.amount),
      p.notes || "-",
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: M, right: M },
    head: [["Date", "Invoice Ref", "Method", "Cheque No", "Cheque Date", "Status", "Amount (LKR)", "Notes"]],
    body: payRows.length > 0 ? payRows : [["No payment records found.", "", "", "", "", "", "", ""]],
    theme: "plain",
    headStyles: {
      fillColor: [71, 85, 105],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
      cellPadding: 2,
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 1.5,
      lineColor: COLOR.tableBorder,
      lineWidth: 0.1,
      textColor: COLOR.bodyText,
    },
    columnStyles: {
      0: { halign: "left", cellWidth: 22 },
      1: { halign: "center", cellWidth: 26, fontStyle: "bold" },
      2: { halign: "center", cellWidth: 20 },
      3: { halign: "center", cellWidth: 24, fontStyle: "bold" },
      4: { halign: "center", cellWidth: 22 },
      5: { halign: "center", cellWidth: 22 },
      6: { halign: "right", cellWidth: 28, fontStyle: "bold", textColor: COLOR.success },
      7: { halign: "left", cellWidth: 26 },
    },
    didParseCell(dataCell) {
      if (dataCell.section === "body" && dataCell.column.index === 5) {
        const st = String(dataCell.cell.raw).toLowerCase();
        if (st.includes("passed") || st.includes("cleared")) dataCell.cell.styles.textColor = COLOR.success;
        else if (st.includes("returned") || st.includes("bounced")) dataCell.cell.styles.textColor = COLOR.danger;
        else if (st.includes("pending") || st.includes("deposited")) dataCell.cell.styles.textColor = COLOR.warning;
      }
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // ── 3. CHEQUES REGISTER ─────────────────────────────────────────────────
  if (currentY > pageHeight - 40) {
    doc.addPage();
    currentY = 15;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLOR.sectionText);
  doc.text("3. Cheques Register", M, currentY);
  currentY += 2;

  const chqRows = (data.cheques || []).map((c) => {
    const chqDate = c.chequeDate
      ? new Date(c.chequeDate).toLocaleDateString("en-GB")
      : "-";
    return [
      c.chequeNo || "-",
      chqDate,
      c.invoiceNo || "N/A",
      fmt(c.amount),
      (c.status || "PENDING").toUpperCase(),
      c.notes || "-",
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: M, right: M },
    head: [["Cheque No", "Cheque Date", "Invoice Ref", "Amount (LKR)", "Status", "Notes"]],
    body: chqRows.length > 0 ? chqRows : [["No cheque records found.", "", "", "", "", ""]],
    theme: "plain",
    headStyles: {
      fillColor: [180, 83, 9],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
      cellPadding: 2,
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 1.5,
      lineColor: COLOR.tableBorder,
      lineWidth: 0.1,
      textColor: COLOR.bodyText,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 28, fontStyle: "bold" },
      1: { halign: "center", cellWidth: 26 },
      2: { halign: "center", cellWidth: 30 },
      3: { halign: "right", cellWidth: 32, fontStyle: "bold" },
      4: { halign: "center", cellWidth: 28 },
      5: { halign: "left", cellWidth: 46 },
    },
    didParseCell(dataCell) {
      if (dataCell.section === "body" && dataCell.column.index === 4) {
        const st = String(dataCell.cell.raw).toLowerCase();
        if (st.includes("passed") || st.includes("cleared"))
          dataCell.cell.styles.textColor = COLOR.success;
        else if (st.includes("returned") || st.includes("bounced"))
          dataCell.cell.styles.textColor = COLOR.danger;
        else if (st.includes("pending") || st.includes("deposited"))
          dataCell.cell.styles.textColor = COLOR.warning;
      }
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // ── 4. INVENTORY RETURNS & CLAIMS ─────────────────────────────────────────
  if (currentY > pageHeight - 40) {
    doc.addPage();
    currentY = 15;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLOR.sectionText);
  doc.text("4. Inventory Returns & Claims", M, currentY);
  currentY += 2;

  const retRows = (data.returns || []).map((r) => {
    const retDate = r.date ? new Date(r.date).toLocaleDateString("en-GB") : "-";
    return [
      r.returnNumber || "-",
      retDate,
      `${r.productName} (${r.sku || "N/A"})`,
      r.quantity,
      r.returnType,
      r.reason || "-",
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: M, right: M },
    head: [["Return No", "Date", "Product / SKU", "Qty", "Type", "Reason"]],
    body: retRows.length > 0 ? retRows : [["No return records found.", "", "", "", "", ""]],
    theme: "plain",
    headStyles: {
      fillColor: [126, 34, 206],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
      cellPadding: 2,
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 1.5,
      lineColor: COLOR.tableBorder,
      lineWidth: 0.1,
      textColor: COLOR.bodyText,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 30, fontStyle: "bold" },
      1: { halign: "center", cellWidth: 24 },
      2: { halign: "left", cellWidth: 55 },
      3: { halign: "center", cellWidth: 16, fontStyle: "bold" },
      4: { halign: "center", cellWidth: 22 },
      5: { halign: "left", cellWidth: 43 },
    },
  });

  // ── Footer / Page Numbering on all pages ──────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR.mutedText);

    doc.line(M, pageHeight - 9, pageWidth - M, pageHeight - 9);
    doc.text(
      `Champika B2B System — Delivered Invoices & Financial Statement`,
      M,
      pageHeight - 5
    );
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - M, pageHeight - 5, {
      align: "right",
    });
  }

  return doc;
}

/**
 * Downloads the Customer History & Ledger PDF report directly to the client browser.
 */
export function downloadCustomerHistoryReport(data: CustomerFullReportData) {
  if (!data || !data.customer) {
    toast.error("Customer data is invalid or missing");
    return;
  }

  try {
    const doc = buildCustomerDoc(data);
    const shopSlug = (data.customer.shopName || "Customer").replace(/[^a-zA-Z0-9_-]/g, "_");
    const dateStr = new Date().toISOString().split("T")[0];
    doc.save(`Customer_Statement_${shopSlug}_${dateStr}.pdf`);
    toast.success(`Delivered Invoices Statement downloaded for ${data.customer.shopName}`);
  } catch (err: any) {
    console.error("PDF generation error:", err);
    toast.error("Failed to generate Customer PDF Statement");
  }
}

/**
 * Opens browser print window with the formatted Customer History & Ledger PDF.
 */
export function printCustomerHistoryReport(data: CustomerFullReportData) {
  if (!data || !data.customer) {
    toast.error("Customer data is invalid or missing");
    return;
  }

  try {
    const doc = buildCustomerDoc(data);
    doc.autoPrint();
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);

    const existingFrame = document.getElementById("___customer_print_frame__");
    if (existingFrame) existingFrame.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "___customer_print_frame__";
    iframe.src = url;
    iframe.style.cssText =
      "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;border:none;";
    document.body.appendChild(iframe);

    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        iframe.remove();
      }, 10000);
    };

    toast.success(`Print preview prepared for ${data.customer.shopName}`);
  } catch (err: any) {
    console.error("PDF printing error:", err);
    toast.error("Failed to print Customer PDF Statement");
  }
}
