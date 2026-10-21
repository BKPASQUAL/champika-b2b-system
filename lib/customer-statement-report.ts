// lib/customer-statement-report.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

export interface InvoicePaymentRecord {
  id?: string;
  paymentDate: string;
  chequeDate?: string | null;
  amount: number;
  method: string;
  receiptNumber?: string | null;
  receipt_number?: string | null;
  chequeNo?: string | null;
  chequeStatus?: string | null;
  bankName?: string | null;
  bankCode?: string | null;
  goodsSummary?: string | null;
  notes?: string | null;
}

export interface StatementInvoice {
  id: string;
  invoiceNo: string;
  manualInvoiceNo?: string;
  date: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status?: string;
  payments?: InvoicePaymentRecord[];
}

export interface StatementReportOptions {
  includeInvoices?: boolean;
  includePaymentSubRows?: boolean;
  includeGoodsSoldToCustomer?: boolean;
  includeOtherGoodsStock?: boolean;
  includePendingCheques?: boolean;
  includeReturnedCheques?: boolean;
  includeClearedCheques?: boolean;
  customTitle?: string;
  customNote?: string;
}

export const DEFAULT_STATEMENT_OPTIONS: StatementReportOptions = {
  includeInvoices: true,
  includePaymentSubRows: true,
  includeGoodsSoldToCustomer: true,
  includeOtherGoodsStock: true,
  includePendingCheques: false,
  includeReturnedCheques: true,
  includeClearedCheques: false,
};

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
  paidBg: [240, 253, 244] as [number, number, number], // Emerald-50 light green
  paidText: [22, 101, 52] as [number, number, number], // Emerald-800 dark green
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

export function filterStatementInvoices(rawInvoices: StatementInvoice[]): StatementInvoice[] {
  if (!rawInvoices || rawInvoices.length === 0) return [];

  // Find the latest payment date across all payments in rawInvoices
  let latestPaymentDate: string | null = null;
  rawInvoices.forEach((inv) => {
    (inv.payments || []).forEach((p) => {
      if (p.paymentDate) {
        const dStr = p.paymentDate.split("T")[0];
        if (!latestPaymentDate || dStr > latestPaymentDate) {
          latestPaymentDate = dStr;
        }
      }
    });
  });

  // An invoice is included if:
  // - It has an active balance > 0 (UNPAID or PARTIAL)
  // - OR it received a payment on the latest payment date (last payment invoice), even if balance === 0 / PAID
  return rawInvoices.filter((inv) => {
    const isOutstanding = inv.balance > 0 && inv.status?.toUpperCase() !== "PAID";
    let isLastPaymentInvoice = false;

    if (latestPaymentDate && inv.payments && inv.payments.length > 0) {
      isLastPaymentInvoice = inv.payments.some(
        (p) => p.paymentDate && p.paymentDate.split("T")[0] === latestPaymentDate
      );
    }

    return isOutstanding || isLastPaymentInvoice;
  });
}

function parseCompanyAndAgency(companyName: string = "CHAMPIKA HARDWARE") {
  const mainTitle = "CHAMPIKA HARDWARE";
  let subAgency = "";

  const cUpper = (companyName || "").toUpperCase();
  if (cUpper.includes("SIERRA")) {
    subAgency = "Sierra Agency";
  } else if (cUpper.includes("DISTRIBUTION")) {
    subAgency = "Distribution Division";
  } else if (cUpper.includes("ORANGE")) {
    subAgency = "Orange Agency";
  } else if (cUpper.includes("WIREMAN")) {
    subAgency = "Wireman Agency";
  } else if (cUpper.includes("RETAIL")) {
    subAgency = "Retail Division";
  } else if (cUpper.includes("HARDWARE")) {
    subAgency = "";
  } else if (companyName) {
    subAgency = companyName;
  }

  return { mainTitle, subAgency };
}

export function buildDoc(
  customerName: string,
  rawInvoices: StatementInvoice[],
  companyName: string = "CHAMPIKA HARDWARE",
  options?: StatementReportOptions
): jsPDF {
  const opts = { ...DEFAULT_STATEMENT_OPTIONS, ...(options || {}) };
  const invoices = filterStatementInvoices(rawInvoices);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const today = new Date();

  const showInvoices = opts.includeInvoices !== false;
  const showSubRows = opts.includePaymentSubRows !== false;
  const showSoldGoods = opts.includeGoodsSoldToCustomer !== false;
  const showOtherGoods = opts.includeOtherGoodsStock !== false;
  const showPendingCheques = Boolean(opts.includePendingCheques);
  const showReturnedCheques = opts.includeReturnedCheques !== false;
  const showClearedCheques = Boolean(opts.includeClearedCheques);

  // ── 1. Header & Title ──────────────────────────────────────────────────────
  const { mainTitle, subAgency } = parseCompanyAndAgency(companyName);
  const statementTitle = opts.customTitle || "CUSTOMER OUTSTANDING STATEMENT";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...COLOR.titleBlue);
  doc.text(mainTitle, M, 16);

  let cardY = 32;
  if (subAgency) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139); // Muted slate gray
    doc.text(`(${subAgency})`, M, 21);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(220, 38, 38);
    doc.text(statementTitle, M, 27);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLOR.mutedText);
    doc.text(`Generated: ${today.toLocaleDateString("en-GB")}, ${today.toLocaleTimeString()}`, M, 32);

    cardY = 36;
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(220, 38, 38);
    doc.text(statementTitle, M, 23);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLOR.mutedText);
    doc.text(`Generated: ${today.toLocaleDateString("en-GB")}, ${today.toLocaleTimeString()}`, M, 28);
  }

  // ── 2. Customer Info Card Box ──────────────────────────────────────────────
  doc.setFillColor(...COLOR.custBg);
  doc.roundedRect(M, cardY, pageWidth - M * 2, 16, 1.5, 1.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLOR.custText);
  doc.text(`Customer: ${customerName}`, M + 4, cardY + 6);

  const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.balance, 0);
  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
  const activeUnpaidCount = invoices.filter((inv) => inv.balance > 0).length;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(220, 38, 38);
  doc.text(`Total Due: LKR ${fmt(totalOutstanding)}`, pageWidth - M - 4, cardY + 6, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR.mutedText);
  doc.text(`Unpaid / Partial Invoices: ${activeUnpaidCount}`, M + 4, cardY + 12);
  doc.text(`Total Invoiced: LKR ${fmt(totalInvoiced)} | Paid: LKR ${fmt(totalPaid)}`, pageWidth - M - 4, cardY + 12, { align: "right" });

  const START_Y = cardY + 20;

  // ── 3. Build Table Data with Payment History Rows ─────────────────────────
  let currentY = START_Y;

  if (showInvoices) {
    const tableData: any[] = [];

    invoices.forEach((inv) => {
      const invDate = inv.date ? new Date(inv.date) : today;
      const daysOverdue = Math.max(0, Math.floor((today.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24)));

      // Main Invoice Row
      tableData.push([
        inv.date ? invDate.toLocaleDateString("en-GB") : "—",
        inv.manualInvoiceNo || inv.invoiceNo,
        `${daysOverdue} days`,
        fmt(inv.totalAmount),
        fmt(inv.paidAmount),
        fmt(inv.balance),
        inv.balance === 0 ? "PAID" : inv.paidAmount > 0 ? "PARTIAL" : "UNPAID",
      ]);

      // Payment History Sub-rows (Non-Cheque Payments: Cash, Bank Transfer, Goods Settlement, etc.)
      if (showSubRows && inv.payments && inv.payments.length > 0) {
        const nonChequePayments = inv.payments.filter(
          (p) => p.method?.toLowerCase() !== "cheque"
        );
        nonChequePayments.forEach((p) => {
          const pDate = p.paymentDate ? new Date(p.paymentDate).toLocaleDateString("en-GB") : "—";
          const isGoods = p.method?.toLowerCase() === "goods";
          const methodStr = isGoods ? "GOODS SETTLEMENT" : p.method.toUpperCase();
          const paymentLabel = inv.balance === 0 ? "Payment" : "Partial Payment";
          const invDisplay = inv.manualInvoiceNo || inv.invoiceNo;
          const detailStr = `     Invoice ${invDisplay} -- ${paymentLabel} on ${pDate} via ${methodStr}: LKR ${fmt(p.amount)}`;

          tableData.push([
            {
              content: detailStr,
              colSpan: 7,
              styles: {
                fillColor: isGoods ? [245, 243, 255] : COLOR.paymentSubRowBg,
                textColor: isGoods ? [109, 40, 217] : COLOR.paymentSubRowText,
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
      head: [["Date", "Invoice / Manual Ref", "Age", "Total (LKR)", "Paid (LKR)", "Balance Due", "Status"]],
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
        1: { halign: "center", cellWidth: 32 }, // Invoice / Manual Ref
        2: { halign: "center", cellWidth: 18 }, // Age
        3: { halign: "right", cellWidth: 30 }, // Total
        4: { halign: "right", cellWidth: 28 }, // Paid
        5: { halign: "right", cellWidth: 32, fontStyle: "bold" }, // Balance Due
        6: { halign: "center", cellWidth: 16 }, // Status
      },
      didParseCell(data) {
        if (data.section !== "body") return;
        const raw = data.row.raw as any[];
        if (!raw || raw.length !== 7 || typeof raw[0] !== "string") return;

        const days = parseInt(raw[2] || "0", 10);
        const status = String(raw[6]);

        if (status === "PAID") {
          data.cell.styles.fillColor = COLOR.paidBg;
          data.cell.styles.textColor = COLOR.paidText;
        } else if (days >= 90) {
          data.cell.styles.fillColor = COLOR.overdueXHigh;
          data.cell.styles.textColor = COLOR.overdueXText;
        } else if (days >= 45) {
          data.cell.styles.fillColor = COLOR.overdueHigh;
          data.cell.styles.textColor = COLOR.overdueText;
        }

        if (data.column.index === 6) {
          if (status === "PAID") {
            data.cell.styles.textColor = [22, 101, 52];
            data.cell.styles.fontStyle = "bold";
          } else if (status === "PARTIAL") {
            data.cell.styles.textColor = [180, 83, 9];
            data.cell.styles.fontStyle = "bold";
          } else if (status === "UNPAID") {
            data.cell.styles.textColor = [185, 28, 28];
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
    });

    currentY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : START_Y + 10;
  }

  // ── 4. Dedicated Goods / Product Settlement Details Tables ────────────────
  interface ParsedGoodsItem {
    date: string;
    manualInvoiceNo: string;
    itemName: string;
    qty: string | number;
    unitPrice: number;
    amount: number;
    isSoldToCustomer: boolean;
  }

  function parseSingleGoodsChunk(
    chunk: string,
    defaultDate: string,
    parentInv: StatementInvoice,
    invMap: Map<string, StatementInvoice>
  ): ParsedGoodsItem {
    const trimmed = chunk.trim();

    // 1. Amount: extract from "@ LKR 21,736" or "@ 21,736" or "@ LKR 21736.00"
    let amount = 0;
    const amountMatch = trimmed.match(/@\s*(?:LKR\s*)?([\d,]+(?:\.\d+)?)/i);
    if (amountMatch) {
      const parsedAmt = parseFloat(amountMatch[1].replace(/,/g, ""));
      if (!isNaN(parsedAmt) && parsedAmt > 0) {
        amount = parsedAmt;
      }
    }

    // 2. Is Sold To Customer (items originally billed to customer vs other agency stock)
    const isSoldToCustomer =
      trimmed.includes("CustomerBilled") ||
      trimmed.includes("SoldToCust") ||
      (!trimmed.includes("OtherAgencyStock") && /Bill:\s*|Manual:\s*/i.test(trimmed));

    // 3. Manual Invoice Number
    let manualRef = "—";
    const manualMatch = trimmed.match(/Manual:\s*([^,\)]+)/i);
    if (manualMatch && manualMatch[1].trim()) {
      manualRef = manualMatch[1].trim();
    } else {
      const billMatch = trimmed.match(/Bill:\s*([^,\)]+)/i);
      if (billMatch && billMatch[1].trim()) {
        const referencedInv = invMap.get(billMatch[1].trim());
        if (referencedInv?.manualInvoiceNo) {
          manualRef = referencedInv.manualInvoiceNo;
        }
      }
      if (manualRef === "—" && isSoldToCustomer && parentInv.manualInvoiceNo) {
        manualRef = parentInv.manualInvoiceNo;
      }
    }

    // 4. Clean Item Name & Extract Quantity (e.g. "3x Sierra 1/113 Brown 100m Coil")
    const isDamage = /\bDamage\b/i.test(trimmed);
    let cleanName = trimmed;
    const parenIdx = cleanName.indexOf("(");
    if (parenIdx !== -1) {
      cleanName = cleanName.substring(0, parenIdx).trim();
    } else {
      const atIdx = cleanName.indexOf("@");
      if (atIdx !== -1) {
        cleanName = cleanName.substring(0, atIdx).trim();
      }
    }
    cleanName = cleanName.replace(/^(?:goods(?:\s+settlement)?:\s*)/i, "").trim();

    let qty: string | number = 1;
    const qtyMatch = cleanName.match(/^(\d+(?:\.\d+)?)\s*x\s+/i);
    if (qtyMatch) {
      qty = qtyMatch[1];
      cleanName = cleanName.substring(qtyMatch[0].length).trim();
    }

    if (isDamage && !cleanName.toLowerCase().includes("damage")) {
      cleanName += " [Damaged]";
    }
    if (!cleanName) cleanName = "Sierra Products Exchanged";

    const numQty = parseFloat(String(qty)) || 1;
    const unitPrice = numQty > 0 ? amount / numQty : amount;

    return {
      date: defaultDate,
      manualInvoiceNo: manualRef,
      itemName: cleanName,
      qty,
      unitPrice,
      amount,
      isSoldToCustomer,
    };
  }

  const invoiceMap = new Map<string, StatementInvoice>();
  rawInvoices.forEach((inv) => {
    if (inv.invoiceNo) invoiceMap.set(inv.invoiceNo, inv);
    if (inv.id) invoiceMap.set(inv.id, inv);
  });

  const processedSummaries = new Set<string>();
  const parsedGoodsItems: ParsedGoodsItem[] = [];

  rawInvoices.forEach((inv) => {
    if (inv.payments && inv.payments.length > 0) {
      inv.payments.forEach((p) => {
        const isGoods = p.method?.toLowerCase() === "goods";
        if (!isGoods) return;

        let rawDetails = (p.goodsSummary || p.chequeNo || "").trim();
        if (rawDetails.toLowerCase().startsWith("goods:")) {
          rawDetails = rawDetails.slice(6).trim();
        }
        if (!rawDetails) rawDetails = "Sierra Goods / Products Exchanged";

        const pDate = p.paymentDate ? new Date(p.paymentDate).toLocaleDateString("en-GB") : "—";

        const isStructured =
          rawDetails.includes(";") ||
          rawDetails.includes("@") ||
          rawDetails.includes("CustomerBilled") ||
          rawDetails.includes("OtherAgencyStock");

        if (isStructured) {
          const summaryKey = `${pDate}_${p.receiptNumber || ""}_${rawDetails}`;
          if (!processedSummaries.has(summaryKey)) {
            processedSummaries.add(summaryKey);
            const chunks = rawDetails.split(/\s*;\s*/).filter(Boolean);
            chunks.forEach((chunk) => {
              const item = parseSingleGoodsChunk(chunk, pDate, inv, invoiceMap);
              parsedGoodsItems.push(item);
            });
          }
        } else {
          // Legacy unstructured payment record
          const manualRef = inv.manualInvoiceNo || "—";
          let cleanName = rawDetails.replace(/^(?:goods(?:\s+settlement)?:\s*)/i, "").trim();
          let qty: string | number = 1;
          const qtyMatch = cleanName.match(/^(\d+(?:\.\d+)?)\s*x\s+/i);
          if (qtyMatch) {
            qty = qtyMatch[1];
            cleanName = cleanName.substring(qtyMatch[0].length).trim();
          }
          const numQty = parseFloat(String(qty)) || 1;
          const unitPrice = numQty > 0 ? p.amount / numQty : p.amount;
          parsedGoodsItems.push({
            date: pDate,
            manualInvoiceNo: manualRef,
            itemName: cleanName || "Sierra Products Exchanged",
            qty,
            unitPrice,
            amount: p.amount,
            isSoldToCustomer: false,
          });
        }
      });
    }
  });

  // Deduplicate goods items so that multi-invoice settlements sharing items on the same date never duplicate
  const deduplicatedGoodsItems: ParsedGoodsItem[] = [];
  const seenItemKeys = new Set<string>();

  // Process items in reverse (newest payment records first) so updated rates overwrite older ones
  for (let idx = parsedGoodsItems.length - 1; idx >= 0; idx--) {
    const item = parsedGoodsItems[idx];
    const key = `${item.date}_${item.itemName.trim().toLowerCase()}_${item.qty}_${item.manualInvoiceNo.trim().toLowerCase()}_${item.isSoldToCustomer ? "sold" : "stock"}`;
    if (!seenItemKeys.has(key)) {
      seenItemKeys.add(key);
      deduplicatedGoodsItems.unshift(item);
    }
  }

  const soldItems = deduplicatedGoodsItems.filter((i) => i.isSoldToCustomer);
  const notSoldItems = deduplicatedGoodsItems.filter((i) => !i.isSoldToCustomer);
  const totalGoodsAmount = deduplicatedGoodsItems.reduce((sum, i) => sum + i.amount, 0);
  let goodsBannerBottomY = 0;

  if (parsedGoodsItems.length > 0 && (showSoldGoods || showOtherGoods)) {
    currentY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : currentY + 8;

    // Table 1: Items Sold to Customer (Customer Billed)
    if (showSoldGoods && soldItems.length > 0) {
      if (currentY > pageHeight - 45) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(5, 150, 105); // Emerald-700
      doc.text("GOODS RETURNED FROM INVOICES (SOLD TO CUSTOMER)", M, currentY);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...COLOR.mutedText);
      doc.text(
        `${soldItems.length} item(s) returned from customer invoices`,
        pageWidth - M,
        currentY,
        { align: "right" }
      );

      const soldSubtotal = soldItems.reduce((sum, i) => sum + i.amount, 0);
      const soldTableBody: any[] = [
        ...soldItems.map((item) => [
          item.manualInvoiceNo,
          item.date,
          item.itemName,
          String(item.qty),
          fmt(item.unitPrice),
          fmt(item.amount),
        ]),
        [
          {
            content: `SUBTOTAL (SOLD TO CUSTOMER): ${soldItems.length} item(s)`,
            colSpan: 5,
            styles: {
              fontStyle: "bold",
              halign: "right",
              fillColor: [236, 253, 245],
              textColor: [4, 120, 87],
              fontSize: 8,
            },
          },
          {
            content: fmt(soldSubtotal),
            styles: {
              fontStyle: "bold",
              halign: "right",
              fillColor: [236, 253, 245],
              textColor: [4, 120, 87],
              fontSize: 8,
            },
          },
        ],
      ];

      autoTable(doc, {
        startY: currentY + 3.5,
        margin: { left: M, right: M },
        head: [["Manual Bill Ref", "Date", "Item Name", "Qty", "Unit Price (LKR)", "Amount (LKR)"]],
        body: soldTableBody,
        theme: "plain",
        headStyles: {
          fillColor: [5, 150, 105], // Emerald-600
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8,
          halign: "center",
          cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
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
          0: { halign: "center", cellWidth: 26 },
          1: { halign: "center", cellWidth: 22 },
          2: { halign: "left",   cellWidth: 68 },
          3: { halign: "center", cellWidth: 12 },
          4: { halign: "right",  cellWidth: 26 },
          5: { halign: "right",  cellWidth: 26, fontStyle: "bold" },
        },
      });

      currentY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : currentY + 35;
    }

    // Table 2: Other Sierra Products Received (Not Sold to Customer)
    if (showOtherGoods && notSoldItems.length > 0) {
      if (currentY > pageHeight - 45) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(109, 40, 217); // Purple-700
      doc.text("OTHER SIERRA PRODUCTS RECEIVED (NOT SOLD TO CUSTOMER)", M, currentY);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...COLOR.mutedText);
      doc.text(
        `${notSoldItems.length} other stock item(s) received`,
        pageWidth - M,
        currentY,
        { align: "right" }
      );

      const notSoldSubtotal = notSoldItems.reduce((sum, i) => sum + i.amount, 0);
      const notSoldTableBody: any[] = [
        ...notSoldItems.map((item) => [
          item.manualInvoiceNo,
          item.date,
          item.itemName,
          String(item.qty),
          fmt(item.unitPrice),
          fmt(item.amount),
        ]),
        [
          {
            content: `SUBTOTAL (OTHER SIERRA STOCK): ${notSoldItems.length} item(s)`,
            colSpan: 5,
            styles: {
              fontStyle: "bold",
              halign: "right",
              fillColor: [243, 232, 255],
              textColor: [109, 40, 217],
              fontSize: 8,
            },
          },
          {
            content: fmt(notSoldSubtotal),
            styles: {
              fontStyle: "bold",
              halign: "right",
              fillColor: [243, 232, 255],
              textColor: [109, 40, 217],
              fontSize: 8,
            },
          },
        ],
      ];

      autoTable(doc, {
        startY: currentY + 3.5,
        margin: { left: M, right: M },
        head: [["Manual Bill Ref", "Date", "Item Name", "Qty", "Unit Price (LKR)", "Amount (LKR)"]],
        body: notSoldTableBody,
        theme: "plain",
        headStyles: {
          fillColor: [109, 40, 217], // Purple-700
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8,
          halign: "center",
          cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
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
          0: { halign: "center", cellWidth: 26 },
          1: { halign: "center", cellWidth: 22 },
          2: { halign: "left",   cellWidth: 68 },
          3: { halign: "center", cellWidth: 12 },
          4: { halign: "right",  cellWidth: 26 },
          5: { halign: "right",  cellWidth: 26, fontStyle: "bold" },
        },
      });

      currentY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : currentY + 35;
    }

    // Grand Total Goods Settlement Banner (when both tables exist and are enabled)
    if (showSoldGoods && showOtherGoods && soldItems.length > 0 && notSoldItems.length > 0) {
      if (currentY > pageHeight - 20) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFillColor(245, 243, 255);
      doc.setDrawColor(221, 214, 254);
      doc.roundedRect(M, currentY, pageWidth - M * 2, 7.5, 1, 1, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(109, 40, 217);
      doc.text(
        `TOTAL GOODS SETTLEMENT CREDITS: ${parsedGoodsItems.length} item(s)`,
        M + 4,
        currentY + 5
      );
      doc.text(
        `LKR ${fmt(totalGoodsAmount)}`,
        pageWidth - M - 4,
        currentY + 5,
        { align: "right" }
      );

      goodsBannerBottomY = currentY + 7.5;
    }
  }

  // ── 5. Dedicated Cheque Details Tables (Grouped by Cheque No) ─────────────
  interface GroupedCheque {
    invoiceNos: string[];
    date: string;
    chequeNo: string;
    amount: number;
    status: string;
  }

  const chequeMap = new Map<string, GroupedCheque>();

  rawInvoices.forEach((inv) => {
    if (inv.payments && inv.payments.length > 0) {
      inv.payments.forEach((p) => {
        const isCheque = p.method?.toLowerCase() === "cheque" || Boolean(p.chequeNo && p.chequeNo.trim());
        if (isCheque) {
          const rawNo = (p.chequeNo || "").trim();
          const chequeKey = rawNo ? rawNo.toLowerCase() : `no_no_${p.id || Math.random()}`;
          const dateToUse = p.chequeDate || p.paymentDate;
          const pDate = dateToUse ? new Date(dateToUse).toLocaleDateString("en-GB") : "—";
          const bankDetail = p.bankName ? ` (${p.bankName}${p.bankCode ? ` - ${p.bankCode}` : ""})` : "";
          const chequeNoStr = rawNo ? `${rawNo.startsWith("#") ? rawNo : `#${rawNo}`}${bankDetail}` : "—";
          const status = (p.chequeStatus || "Pending").toUpperCase();
          const invDisplay = inv.manualInvoiceNo || inv.invoiceNo;

          if (chequeMap.has(chequeKey)) {
            const existing = chequeMap.get(chequeKey)!;
            if (invDisplay && !existing.invoiceNos.includes(invDisplay)) {
              existing.invoiceNos.push(invDisplay);
            }
            if (!existing.chequeNo.includes("(") && bankDetail) {
              existing.chequeNo = `${existing.chequeNo}${bankDetail}`;
            }
            existing.amount += p.amount;
            if (["RETURNED", "BOUNCED"].includes(status)) {
              existing.status = status;
            } else if (existing.status !== "RETURNED" && existing.status !== "BOUNCED") {
              existing.status = status;
            }
          } else {
            chequeMap.set(chequeKey, {
              invoiceNos: invDisplay ? [invDisplay] : [],
              date: pDate,
              chequeNo: chequeNoStr,
              amount: p.amount,
              status,
            });
          }
        }
      });
    }
  });

  // Separate into Pending / Deposited, Returned / Bounced, and Cleared
  const pendingCheques: GroupedCheque[] = [];
  const returnedCheques: GroupedCheque[] = [];
  const clearedCheques: GroupedCheque[] = [];

  chequeMap.forEach((chq) => {
    const s = chq.status.toUpperCase();
    if (["RETURNED", "BOUNCED"].includes(s)) {
      returnedCheques.push(chq);
    } else if (s === "CLEARED") {
      clearedCheques.push(chq);
    } else {
      pendingCheques.push(chq);
    }
  });

  const totalPendingAmount = pendingCheques.reduce((sum, c) => sum + c.amount, 0);
  const totalReturnedAmount = returnedCheques.reduce((sum, c) => sum + c.amount, 0);
  const totalClearedAmount = clearedCheques.reduce((sum, c) => sum + c.amount, 0);

  const lastFinalY = (doc as any).lastAutoTable
    ? (doc as any).lastAutoTable.finalY + 8
    : currentY + 8;
  currentY = goodsBannerBottomY > 0 ? Math.max(lastFinalY, goodsBannerBottomY + 8) : lastFinalY;

  // ── Table 5A: Pending / Deposited Cheques Details ─────────────────────────
  if (showPendingCheques && pendingCheques.length > 0) {
    if (currentY > pageHeight - 45) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(180, 83, 9); // Amber-700
    doc.text("PENDING CHEQUES DETAILS (AWAITING CLEARANCE)", M, currentY);

    const pendingCount = pendingCheques.filter((c) => c.status === "PENDING").length;
    const depositedCount = pendingCheques.filter((c) => c.status === "DEPOSITED").length;
    const pSubtitle =
      depositedCount > 0
        ? `${pendingCheques.length} cheque(s) (${pendingCount} Pending, ${depositedCount} Deposited)`
        : `${pendingCheques.length} pending cheque(s)`;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR.mutedText);
    doc.text(pSubtitle, pageWidth - M, currentY, { align: "right" });

    const pendingTableBody = [
      ...pendingCheques.map((c) => [
        c.invoiceNos.join(", ") || "—",
        c.date,
        c.chequeNo,
        fmt(c.amount),
        c.status,
      ]),
      [
        {
          content: `TOTAL PENDING CHEQUES: ${pendingCheques.length}`,
          colSpan: 3,
          styles: {
            fontStyle: "bold",
            halign: "right",
            fillColor: [254, 243, 199], // Amber-100
            textColor: [146, 64, 14], // Amber-800
            fontSize: 8.5,
          },
        },
        {
          content: fmt(totalPendingAmount),
          styles: {
            fontStyle: "bold",
            halign: "right",
            fillColor: [254, 243, 199],
            textColor: [146, 64, 14],
            fontSize: 8.5,
          },
        },
        {
          content: "",
          styles: { fillColor: [254, 243, 199] },
        },
      ],
    ];

    autoTable(doc, {
      startY: currentY + 3.5,
      margin: { left: M, right: M },
      head: [["Invoice / Manual Ref", "Date", "Cheque No & Branch", "Amount (LKR)", "Cheque Status"]],
      body: pendingTableBody as any,
      theme: "plain",
      headStyles: {
        fillColor: [217, 119, 6], // Amber-600
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
        halign: "center",
        cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
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
        0: { halign: "center", cellWidth: 28 },
        1: { halign: "center", cellWidth: 24 },
        2: { halign: "left",   cellWidth: 64 },
        3: { halign: "right",  cellWidth: 34, fontStyle: "bold" },
        4: { halign: "center", cellWidth: 30 },
      },
      didParseCell(data) {
        if (data.section !== "body") return;
        const raw = data.row.raw as any[];
        if (!raw || raw.length !== 5 || typeof raw[0] !== "string") return;

        const status = String(raw[4]).toUpperCase();
        if (data.column.index === 4) {
          if (status === "PENDING") {
            data.cell.styles.textColor = [180, 83, 9];
            data.cell.styles.fontStyle = "bold";
          } else if (status === "DEPOSITED") {
            data.cell.styles.textColor = [29, 78, 216];
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
    });

    currentY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : currentY + 35;
  }

  // ── Table 5B: Returned Cheques Details ────────────────────────────────────
  if (showReturnedCheques && returnedCheques.length > 0) {
    if (currentY > pageHeight - 45) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(185, 28, 28); // Red-700
    doc.text("RETURN CHEQUES DETAILS", M, currentY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR.mutedText);
    doc.text(`${returnedCheques.length} returned cheque(s)`, pageWidth - M, currentY, { align: "right" });

    const returnedTableBody = [
      ...returnedCheques.map((c) => [
        c.invoiceNos.join(", ") || "—",
        c.date,
        c.chequeNo,
        fmt(c.amount),
        c.status,
      ]),
      [
        {
          content: `TOTAL RETURNED CHEQUES: ${returnedCheques.length}`,
          colSpan: 3,
          styles: {
            fontStyle: "bold",
            halign: "right",
            fillColor: [254, 226, 226], // Red-100
            textColor: [185, 28, 28], // Red-700
            fontSize: 8.5,
          },
        },
        {
          content: fmt(totalReturnedAmount),
          styles: {
            fontStyle: "bold",
            halign: "right",
            fillColor: [254, 226, 226],
            textColor: [185, 28, 28],
            fontSize: 8.5,
          },
        },
        {
          content: "",
          styles: { fillColor: [254, 226, 226] },
        },
      ],
    ];

    autoTable(doc, {
      startY: currentY + 3.5,
      margin: { left: M, right: M },
      head: [["Invoice / Manual Ref", "Date", "Cheque No & Branch", "Amount (LKR)", "Cheque Status"]],
      body: returnedTableBody as any,
      theme: "plain",
      headStyles: {
        fillColor: [185, 28, 28], // Red-700
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
        halign: "center",
        cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
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
        0: { halign: "center", cellWidth: 28 },
        1: { halign: "center", cellWidth: 24 },
        2: { halign: "left",   cellWidth: 64 },
        3: { halign: "right",  cellWidth: 34, fontStyle: "bold" },
        4: { halign: "center", cellWidth: 30 },
      },
      didParseCell(data) {
        if (data.section !== "body") return;
        const raw = data.row.raw as any[];
        if (!raw || raw.length !== 5 || typeof raw[0] !== "string") return;

        // Apply soft red row background for returned cheques to highlight caution
        data.cell.styles.fillColor = [254, 242, 242];
        if (data.column.index === 3 || data.column.index === 4) {
          data.cell.styles.textColor = [185, 28, 28];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    currentY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : currentY + 35;
  }

  // ── Table 5C: Cleared Cheques Details (Optional) ─────────────────────────
  if (showClearedCheques && clearedCheques.length > 0) {
    if (currentY > pageHeight - 45) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(5, 150, 105); // Emerald-700
    doc.text("CLEARED CHEQUES (HISTORICAL SETTLED)", M, currentY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR.mutedText);
    doc.text(`${clearedCheques.length} cleared cheque(s)`, pageWidth - M, currentY, { align: "right" });

    const clearedTableBody = [
      ...clearedCheques.map((c) => [
        c.invoiceNos.join(", ") || "—",
        c.date,
        c.chequeNo,
        fmt(c.amount),
        c.status,
      ]),
      [
        {
          content: `TOTAL CLEARED CHEQUES: ${clearedCheques.length}`,
          colSpan: 3,
          styles: {
            fontStyle: "bold",
            halign: "right",
            fillColor: [236, 253, 245], // Emerald-50
            textColor: [4, 120, 87], // Emerald-700
            fontSize: 8.5,
          },
        },
        {
          content: fmt(totalClearedAmount),
          styles: {
            fontStyle: "bold",
            halign: "right",
            fillColor: [236, 253, 245],
            textColor: [4, 120, 87],
            fontSize: 8.5,
          },
        },
        {
          content: "",
          styles: { fillColor: [236, 253, 245] },
        },
      ],
    ];

    autoTable(doc, {
      startY: currentY + 3.5,
      margin: { left: M, right: M },
      head: [["Invoice / Manual Ref", "Date", "Cheque No & Branch", "Amount (LKR)", "Cheque Status"]],
      body: clearedTableBody as any,
      theme: "plain",
      headStyles: {
        fillColor: [5, 150, 105], // Emerald-600
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
        halign: "center",
        cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
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
        0: { halign: "center", cellWidth: 28 },
        1: { halign: "center", cellWidth: 24 },
        2: { halign: "left",   cellWidth: 64 },
        3: { halign: "right",  cellWidth: 34, fontStyle: "bold" },
        4: { halign: "center", cellWidth: 30 },
      },
      didParseCell(data) {
        if (data.section !== "body") return;
        const raw = data.row.raw as any[];
        if (!raw || raw.length !== 5 || typeof raw[0] !== "string") return;

        if (data.column.index === 4) {
          data.cell.styles.textColor = [22, 101, 52]; // Emerald-800
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    currentY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : currentY + 35;
  }

  // Stamp footer line & page numbers across ALL pages
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(M, pageHeight - 15, pageWidth - M, pageHeight - 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR.mutedText);
    const footerMsg = options?.customNote || "Thank you for your business. Please arrange payment for overdue invoices.";
    doc.text(footerMsg, M, pageHeight - 10);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - M, pageHeight - 10, { align: "right" });
  }

  return doc;
}

export function downloadCustomerStatement(
  customerName: string,
  rawInvoices: StatementInvoice[],
  companyName?: string,
  options?: StatementReportOptions
) {
  if (!rawInvoices || rawInvoices.length === 0) {
    toast.info("No invoice records found for statement");
    return;
  }
  const doc = buildDoc(customerName, rawInvoices, companyName, options);
  const dateStr = new Date().toISOString().split("T")[0];
  const safeName = customerName.replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`Statement_${safeName}_${dateStr}.pdf`);
  toast.success(`Statement downloaded for ${customerName}`);
}

export function printCustomerStatement(
  customerName: string,
  rawInvoices: StatementInvoice[],
  companyName?: string,
  options?: StatementReportOptions
) {
  if (!rawInvoices || rawInvoices.length === 0) {
    toast.info("No invoice records found for statement");
    return;
  }
  const doc = buildDoc(customerName, rawInvoices, companyName, options);
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
  rawInvoices: StatementInvoice[],
  companyName?: string,
  options?: StatementReportOptions
) {
  if (!rawInvoices || rawInvoices.length === 0) {
    toast.info("No invoice records found for statement");
    return;
  }
  const opts = { ...DEFAULT_STATEMENT_OPTIONS, ...(options || {}) };
  const invoices = filterStatementInvoices(rawInvoices);
  const totalDue = invoices.reduce((sum, i) => sum + i.balance, 0);

  const { mainTitle, subAgency } = parseCompanyAndAgency(companyName);
  const agencyLabel = subAgency ? ` (${subAgency})` : "";
  const statementTitle = opts.customTitle || "Customer Statement";

  const showInvoices = opts.includeInvoices !== false;
  const showSubRows = opts.includePaymentSubRows !== false;
  const showPendingCheques = Boolean(opts.includePendingCheques);
  const showReturnedCheques = opts.includeReturnedCheques !== false;
  const showClearedCheques = Boolean(opts.includeClearedCheques);

  // WhatsApp text summary
  let msg = `*${mainTitle}${agencyLabel}*\n`;
  msg += `*${statementTitle} - ${customerName}*\n\n`;
  msg += `*Total Outstanding Balance:* LKR ${fmt(totalDue)}\n`;
  msg += `*Pending Invoices:* ${invoices.length}\n\n`;

  if (showInvoices) {
    msg += `*Invoice Breakdown:*\n`;
    invoices.forEach((inv) => {
      const invDate = inv.date ? new Date(inv.date).toLocaleDateString("en-GB") : "—";
      const days = inv.date
        ? Math.max(0, Math.floor((new Date().getTime() - new Date(inv.date).getTime()) / (1000 * 60 * 60 * 24)))
        : 0;
      const dueStr = inv.balance === 0 ? "*✅ PAID*" : `Due LKR ${fmt(inv.balance)}`;
      msg += `• *${inv.invoiceNo}* (${invDate}, ${days} days): ${dueStr} (Total LKR ${fmt(inv.totalAmount)})\n`;
      if (showSubRows && inv.payments && inv.payments.length > 0) {
        const nonChequePayments = inv.payments.filter(
          (p) => p.method?.toLowerCase() !== "cheque" && !Boolean(p.chequeNo)
        );
        nonChequePayments.forEach((p) => {
          const pDate = p.paymentDate ? new Date(p.paymentDate).toLocaleDateString("en-GB") : "—";
          msg += `   - Invoice ${inv.invoiceNo}: Paid LKR ${fmt(p.amount)} on ${pDate} (${p.method.toUpperCase()})\n`;
        });
      }
    });
  }

  const groupedChequesMap = new Map<string, { invoiceNos: string[]; date: string; chequeNo: string; amount: number; status: string }>();

  rawInvoices.forEach((inv) => {
    if (inv.payments && inv.payments.length > 0) {
      inv.payments.forEach((p) => {
        if (p.method?.toLowerCase() === "cheque" || p.chequeNo) {
          const rawNo = (p.chequeNo || "").trim();
          const key = rawNo ? rawNo.toLowerCase() : `no_no_${p.id || Math.random()}`;
          const dateToUse = p.chequeDate || p.paymentDate;
          const pDate = dateToUse ? new Date(dateToUse).toLocaleDateString("en-GB") : "—";
          const bankDetail = p.bankName ? ` (${p.bankName}${p.bankCode ? ` - ${p.bankCode}` : ""})` : "";
          const chequeDisplay = rawNo ? `${rawNo}${bankDetail}` : "N/A";
          const status = (p.chequeStatus || "Pending").toUpperCase();
          const invDisplay = inv.manualInvoiceNo || inv.invoiceNo;

          if (groupedChequesMap.has(key)) {
            const ext = groupedChequesMap.get(key)!;
            if (invDisplay && !ext.invoiceNos.includes(invDisplay)) {
              ext.invoiceNos.push(invDisplay);
            }
            if (!ext.chequeNo.includes("(") && bankDetail) {
              ext.chequeNo = `${ext.chequeNo}${bankDetail}`;
            }
            ext.amount += p.amount;
            if (["RETURNED", "BOUNCED"].includes(status)) ext.status = status;
          } else {
            groupedChequesMap.set(key, {
              invoiceNos: invDisplay ? [invDisplay] : [],
              date: pDate,
              chequeNo: chequeDisplay,
              amount: p.amount,
              status,
            });
          }
        }
      });
    }
  });

  const pendingWaCheques: string[] = [];
  const returnedWaCheques: string[] = [];
  const clearedWaCheques: string[] = [];

  groupedChequesMap.forEach((chq) => {
    const s = chq.status.toUpperCase();
    const invList = chq.invoiceNos.join(", ") || "—";
    const line = `• Cheque #${chq.chequeNo} (Invoices: ${invList}): LKR ${fmt(chq.amount)} (${chq.date}) [${s}]`;
    if (["RETURNED", "BOUNCED"].includes(s)) {
      returnedWaCheques.push(line);
    } else if (s === "CLEARED") {
      clearedWaCheques.push(line);
    } else {
      pendingWaCheques.push(line);
    }
  });

  if (showPendingCheques && pendingWaCheques.length > 0) {
    msg += `\n*PENDING CHEQUES DETAILS (${pendingWaCheques.length}):*\n`;
    pendingWaCheques.forEach((chq) => {
      msg += `${chq}\n`;
    });
  }

  if (showReturnedCheques && returnedWaCheques.length > 0) {
    msg += `\n*RETURN CHEQUES DETAILS (${returnedWaCheques.length}):*\n`;
    returnedWaCheques.forEach((chq) => {
      msg += `${chq}\n`;
    });
  }

  if (showClearedCheques && clearedWaCheques.length > 0) {
    msg += `\n*CLEARED CHEQUES DETAILS (${clearedWaCheques.length}):*\n`;
    clearedWaCheques.forEach((chq) => {
      msg += `${chq}\n`;
    });
  }

  if (options?.customNote) {
    msg += `\n*Note:* ${options.customNote}\n`;
  }

  msg += `\nPlease arrange payment at your earliest convenience. Thank you!`;

  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

  // Try Web Share API if PDF file sharing is supported
  const doc = buildDoc(customerName, rawInvoices, companyName, options);
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

