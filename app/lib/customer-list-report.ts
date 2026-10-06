import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { downloadCustomerHistoryReport, printCustomerHistoryReport } from "@/app/lib/customer-history-report";
import { shareCustomerStatement, StatementInvoice } from "@/lib/customer-statement-report";

export interface CustomerReportItem {
  id: string;
  shopName: string;
  ownerName?: string;
  phone?: string;
  route?: string;
  status?: string;
  creditLimit?: number;
  outstandingBalance?: number;
  isPinned?: boolean;
}

export interface CustomerListReportOptions {
  agencyName: string;
  customers: CustomerReportItem[];
  filterInfo?: string;
  primaryColor?: [number, number, number]; // RGB
}

const fmt = (amount: number) =>
  (amount || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const DEFAULT_PRIMARY: [number, number, number] = [153, 27, 27]; // Red-800 for Wireman

export function buildCustomerListDoc(options: CustomerListReportOptions): jsPDF {
  const { agencyName, customers, filterInfo, primaryColor = DEFAULT_PRIMARY } = options;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const M = 12;

  // Header Banner
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 28, "F");

  // Title Text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("CHAMPIKA HARDWARE", M, 11);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`${agencyName} — Customer & Outstanding Ledger`, M, 18);

  // Date & Filter on Right
  doc.setFontSize(8);
  const dateStr = new Date().toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  doc.text(`Generated: ${dateStr}`, pageWidth - M, 11, { align: "right" });
  if (filterInfo) {
    doc.text(`Filter: ${filterInfo}`, pageWidth - M, 17, { align: "right" });
  }

  // Summary KPIs Box
  const totalCustomers = customers.length;
  const totalOutstanding = customers.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);
  const totalCreditLimit = customers.reduce((sum, c) => sum + (c.creditLimit || 0), 0);
  const withBalanceCount = customers.filter((c) => (c.outstandingBalance || 0) > 0).length;

  const kpiY = 32;
  const kpiWidth = (pageWidth - M * 2) / 3;

  // Card 1: Total Customers
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(M, kpiY, kpiWidth - 2, 14, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL CUSTOMERS", M + 4, kpiY + 4.5);
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${totalCustomers} (${withBalanceCount} with Balance)`, M + 4, kpiY + 10.5);

  // Card 2: Total Outstanding
  const card2X = M + kpiWidth;
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(card2X, kpiY, kpiWidth - 2, 14, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(185, 28, 28);
  doc.text("TOTAL OUTSTANDING", card2X + 4, kpiY + 4.5);
  doc.setFontSize(10.5);
  doc.text(`LKR ${fmt(totalOutstanding)}`, card2X + 4, kpiY + 10.5);

  // Card 3: Total Credit Limit
  const card3X = M + kpiWidth * 2;
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(card3X, kpiY, kpiWidth - 2, 14, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(22, 101, 52);
  doc.text("TOTAL CREDIT LIMIT", card3X + 4, kpiY + 4.5);
  doc.setFontSize(10.5);
  doc.text(`LKR ${fmt(totalCreditLimit)}`, card3X + 4, kpiY + 10.5);

  // AutoTable
  const tableRows = customers.map((c, index) => {
    const isPinned = c.isPinned ? " [INTERNAL]" : "";
    const balance = c.outstandingBalance || 0;
    return [
      (index + 1).toString(),
      `${c.shopName}${isPinned}`,
      c.phone || c.ownerName || "—",
      c.route || "General",
      c.status || "Active",
      fmt(c.creditLimit || 0),
      balance > 0 ? fmt(balance) : "0.00",
    ];
  });

  autoTable(doc, {
    startY: 50,
    margin: { left: M, right: M, bottom: 14 },
    head: [["#", "Customer / Shop", "Contact", "Route", "Status", "Credit Limit", "Outstanding (LKR)"]],
    body: tableRows,
    theme: "striped",
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
      halign: "center",
      cellPadding: 2.5,
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [30, 41, 59],
      valign: "middle",
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      1: { halign: "left", fontStyle: "bold", cellWidth: 50 },
      2: { halign: "left", cellWidth: 32 },
      3: { halign: "left", cellWidth: 28 },
      4: { halign: "center", cellWidth: 16 },
      5: { halign: "right", cellWidth: 24 },
      6: { halign: "right", fontStyle: "bold", cellWidth: 28 },
    },
    didParseCell: (data) => {
      if (data.section === "body") {
        if (data.column.index === 6) {
          const rawVal = data.cell.raw as string;
          if (rawVal && rawVal !== "0.00") {
            data.cell.styles.textColor = [185, 28, 28]; // Red highlight for balance
          }
        }
        if (data.column.index === 4) {
          const status = data.cell.raw as string;
          if (status === "Active") data.cell.styles.textColor = [22, 101, 52];
          else if (status === "Blocked") data.cell.styles.textColor = [185, 28, 28];
        }
      }
    },
    foot: [
      [
        "",
        `TOTAL (${totalCustomers} Customers)`,
        "",
        "",
        "",
        fmt(totalCreditLimit),
        fmt(totalOutstanding),
      ],
    ],
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      fontSize: 8,
      halign: "right",
      cellPadding: 2.5,
    },
  });

  // Footer on each page
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.setDrawColor(226, 232, 240);
    doc.line(M, pageHeight - 10, pageWidth - M, pageHeight - 10);
    doc.text(`Champika B2B Management System — ${agencyName}`, M, pageHeight - 5);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - M, pageHeight - 5, { align: "right" });
  }

  return doc;
}

export function downloadCustomerListPDF(options: CustomerListReportOptions) {
  try {
    const doc = buildCustomerListDoc(options);
    const safeAgency = options.agencyName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const dateStr = new Date().toISOString().split("T")[0];
    doc.save(`${safeAgency}_Customers_${dateStr}.pdf`);
    toast.success(`Downloaded ${options.agencyName} Customer PDF`);
  } catch (error: any) {
    console.error("PDF generation failed:", error);
    toast.error("Failed to generate Customer PDF report");
  }
}

export function printCustomerListReport(options: CustomerListReportOptions) {
  try {
    const doc = buildCustomerListDoc(options);
    doc.autoPrint();
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);

    const existingFrame = document.getElementById("___customer_list_print_frame__");
    if (existingFrame) existingFrame.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "___customer_list_print_frame__";
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

    toast.success(`Print preview opened for ${options.agencyName}`);
  } catch (error: any) {
    console.error("Print generation failed:", error);
    toast.error("Failed to print Customer report");
  }
}

export async function shareCustomerListSummary(options: CustomerListReportOptions) {
  const { agencyName, customers, filterInfo } = options;
  const totalOutstanding = customers.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);
  const outstandingCustomers = customers.filter((c) => (c.outstandingBalance || 0) > 0);

  let msg = `*CHAMPIKA HARDWARE — ${agencyName.toUpperCase()}*\n`;
  msg += `📋 *Customer Outstanding Summary Report*\n`;
  if (filterInfo) msg += `🔍 _Filter: ${filterInfo}_\n`;
  msg += `📅 _Date: ${new Date().toLocaleDateString("en-GB")}_\n\n`;

  msg += `👥 *Total Customers:* ${customers.length}\n`;
  msg += `⚠️ *Customers with Balance:* ${outstandingCustomers.length}\n`;
  msg += `💰 *Total Outstanding Balance:* LKR ${fmt(totalOutstanding)}\n\n`;

  if (outstandingCustomers.length > 0) {
    msg += `*TOP OUTSTANDING BALANCES:*\n`;
    const sorted = [...outstandingCustomers].sort(
      (a, b) => (b.outstandingBalance || 0) - (a.outstandingBalance || 0)
    );
    sorted.slice(0, 15).forEach((c, i) => {
      msg += `${i + 1}. *${c.shopName}* (${c.route || "General"})\n`;
      msg += `   📞 ${c.phone || "No phone"} | *LKR ${fmt(c.outstandingBalance || 0)}*\n`;
    });

    if (sorted.length > 15) {
      msg += `\n_...and ${sorted.length - 15} more customers with balance._\n`;
    }
  } else {
    msg += `✅ *All customer accounts are clear with 0.00 outstanding balance.*\n`;
  }

  msg += `\n_Generated via Champika B2B Management System_`;

  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

  // Attempt Web Share with PDF if supported
  try {
    const doc = buildCustomerListDoc(options);
    const blob = doc.output("blob");
    const safeAgency = agencyName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const file = new File([blob], `${safeAgency}_Outstanding_Summary.pdf`, {
      type: "application/pdf",
    });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: `${agencyName} - Customer Outstanding Summary`,
        text: `Customer Outstanding Summary for ${agencyName} (Total: LKR ${fmt(totalOutstanding)})`,
        files: [file],
      });
      toast.success("Shared successfully");
      return;
    }
  } catch (err: any) {
    if (err.name === "AbortError") return;
  }

  // Fallback to WhatsApp
  window.open(waUrl, "_blank");
  toast.success("Opened WhatsApp with customer summary");
}

export async function quickDownloadCustomerStatement(customerId: string, shopName: string) {
  const tid = toast.loading(`Generating statement for ${shopName}...`);
  try {
    const [resCust, resProds] = await Promise.all([
      fetch(`/api/customers/${customerId}`),
      fetch(`/api/customers/${customerId}/purchased-products`),
    ]);
    if (!resCust.ok) throw new Error("Failed to load customer profile");
    const jsonCust = await resCust.json();
    const jsonProds = resProds.ok ? await resProds.json() : [];

    downloadCustomerHistoryReport({
      ...jsonCust,
      purchasedProducts: jsonProds || [],
    });
    toast.dismiss(tid);
  } catch (err: any) {
    toast.dismiss(tid);
    toast.error(err.message || "Failed to generate statement PDF");
  }
}

export async function quickPrintCustomerStatement(customerId: string, shopName: string) {
  const tid = toast.loading(`Preparing print for ${shopName}...`);
  try {
    const [resCust, resProds] = await Promise.all([
      fetch(`/api/customers/${customerId}`),
      fetch(`/api/customers/${customerId}/purchased-products`),
    ]);
    if (!resCust.ok) throw new Error("Failed to load customer profile");
    const jsonCust = await resCust.json();
    const jsonProds = resProds.ok ? await resProds.json() : [];

    printCustomerHistoryReport({
      ...jsonCust,
      purchasedProducts: jsonProds || [],
    });
    toast.dismiss(tid);
  } catch (err: any) {
    toast.dismiss(tid);
    toast.error(err.message || "Failed to prepare print statement");
  }
}

export async function quickShareCustomerStatement(
  customerId: string,
  shopName: string,
  agencyName: string = "Wireman Agency"
) {
  const tid = toast.loading(`Preparing share for ${shopName}...`);
  try {
    const res = await fetch(`/api/customers/${customerId}`);
    if (!res.ok) throw new Error("Failed to load customer profile");
    const data = await res.json();

    const rawInvoices: StatementInvoice[] = (data.invoices || []).map((inv: any) => ({
      id: inv.id,
      invoiceNo: inv.invoiceNo || inv.invoice_no || "INV",
      date: inv.date || inv.created_at || new Date().toISOString(),
      totalAmount: inv.totalAmount || inv.total_amount || 0,
      paidAmount: inv.paidAmount || inv.paid_amount || 0,
      balance: inv.dueAmount || inv.due_amount || 0,
      status: inv.status || "UNPAID",
      payments: (inv.payments || []).map((p: any) => ({
        paymentDate: p.paymentDate || p.created_at,
        amount: p.amount,
        method: p.method,
        chequeNo: p.chequeNo,
        chequeStatus: p.chequeStatus,
      })),
    }));

    await shareCustomerStatement(shopName, rawInvoices, agencyName);
    toast.dismiss(tid);
  } catch (err: any) {
    toast.dismiss(tid);
    toast.error(err.message || "Failed to share statement");
  }
}
