// app/dashboard/office/distribution/invoices/print-utils.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

/**
 * Generates the Invoice PDF document
 * Returns the jsPDF document object and the invoice number
 */
const generateInvoicePDF = async (invoiceId: string) => {
  // 1. Fetch Full Invoice Details
  const res = await fetch(`/api/invoices/${invoiceId}`);
  if (!res.ok) throw new Error("Failed to load invoice details");
  const invoice = await res.json();

  // 2. Initialize PDF
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // --- Header Section ---
  // Company Name (All Black)
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("CHAMPIKA HARDWARE", pageWidth / 2, 20, { align: "center" });

  // Company Details
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("No 45, Main Street, Galle", pageWidth / 2, 26, {
    align: "center",
  });
  doc.text("Tel: 077-1234567 | Email: sales@champika.lk", pageWidth / 2, 31, {
    align: "center",
  });

  // Separator Line
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(14, 36, pageWidth - 14, 36);

  // Invoice Title
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", 14, 46);

  // --- Details Section ---
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  // Left Side: Customer Info
  const leftColX = 14;
  let currentY = 54;

  doc.setFont("helvetica", "bold");
  doc.text("Bill To:", leftColX, currentY);
  doc.setFont("helvetica", "normal");
  currentY += 5;

  doc.text(invoice.customer.shop || "", leftColX, currentY);
  currentY += 5;
  doc.text(invoice.customer.name || "", leftColX, currentY);
  currentY += 5;
  if (invoice.customer.address) {
    doc.text(invoice.customer.address, leftColX, currentY);
    currentY += 5;
  }
  if (invoice.customer.phone) {
    doc.text(`Tel: ${invoice.customer.phone}`, leftColX, currentY);
  }

  // Right Side: Invoice Info
  const rightColLabelX = 130;
  const rightColValueX = 165;
  currentY = 54;

  doc.text("Invoice No:", rightColLabelX, currentY);
  doc.text(invoice.invoiceNo, rightColValueX, currentY);
  currentY += 6;

  doc.text("Date:", rightColLabelX, currentY);
  doc.text(
    invoice.date ? new Date(invoice.date).toLocaleDateString() : "-",
    rightColValueX,
    currentY
  );
  currentY += 6;

  doc.text("Sales Rep:", rightColLabelX, currentY);
  doc.text(invoice.salesRep || "-", rightColValueX, currentY);

  // --- Items Table ---
  const tableColumn = [
    "#",
    "Description",
    "Unit",
    "Price",
    "Qty",
    "Free",
    "Total",
  ];

  const tableRows = invoice.items.map((item: any, index: number) => [
    index + 1,
    item.productName || item.name,
    item.unit,
    item.unitPrice
      ? item.unitPrice.toLocaleString("en-LK", { minimumFractionDigits: 2 })
      : "0.00",
    item.quantity,
    item.freeQuantity > 0 ? item.freeQuantity : "-",
    item.total.toLocaleString("en-LK", { minimumFractionDigits: 2 }),
  ]);

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 85,
    theme: "plain",
    headStyles: {
      fillColor: [0, 0, 0],
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
    },
    bodyStyles: {
      textColor: 0,
      fontSize: 9,
    },
    styles: {
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: "auto" },
      3: { halign: "right" },
      4: { halign: "center" },
      5: { halign: "center" },
      6: { halign: "right", fontStyle: "bold" },
    },
  });

  // --- Calculations ---
  const calculatedSubTotal = invoice.items.reduce(
    (sum: number, item: any) => sum + (item.total || 0),
    0
  );
  const grandTotal = invoice.grandTotal || invoice.totals?.grandTotal || 0;
  const extraDiscount = Math.max(0, calculatedSubTotal - grandTotal);

  // --- Footer Totals ---
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  const rightMargin = pageWidth - 14;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.1);
  doc.line(120, finalY - 3, rightMargin, finalY - 3);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  // Sub Total
  let currentTotalY = finalY;
  doc.text("Sub Total:", 130, currentTotalY);
  doc.text(
    `LKR ${calculatedSubTotal.toLocaleString("en-LK", {
      minimumFractionDigits: 2,
    })}`,
    rightMargin,
    currentTotalY,
    { align: "right" }
  );
  currentTotalY += 6;

  // Extra Discount
  if (extraDiscount > 0.01) {
    doc.text("Extra Discount:", 130, currentTotalY);
    doc.text(
      `- LKR ${extraDiscount.toLocaleString("en-LK", {
        minimumFractionDigits: 2,
      })}`,
      rightMargin,
      currentTotalY,
      { align: "right" }
    );
    currentTotalY += 6;
  }

  // Grand Total
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  if (extraDiscount > 0.01) {
    doc.line(120, currentTotalY - 4, rightMargin, currentTotalY - 4);
  }

  doc.text("Grand Total:", 130, currentTotalY + 2);
  doc.text(
    `LKR ${grandTotal.toLocaleString("en-LK", { minimumFractionDigits: 2 })}`,
    rightMargin,
    currentTotalY + 2,
    { align: "right" }
  );

  // --- Signature Section ---
  const signatureY = pageHeight - 35;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setLineWidth(0.5);
  doc.setDrawColor(0, 0, 0);

  doc.line(14, signatureY, 80, signatureY);
  doc.text("Customer Signature & Stamp", 14, signatureY + 5);

  doc.line(pageWidth - 60, signatureY, pageWidth - 14, signatureY);
  doc.text("Date", pageWidth - 60, signatureY + 5);

  doc.line(pageWidth / 2 - 20, signatureY, pageWidth / 2 + 20, signatureY);
  doc.text("Authorized By", pageWidth / 2, signatureY + 5, { align: "center" });

  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100);
  doc.text("Thank you for your business!", pageWidth / 2, pageHeight - 10, {
    align: "center",
  });

  return { doc, invoiceNo: invoice.invoiceNo };
};

/**
 * Direct Print (Same Window)
 * Opens the print dialog immediately without downloading the file.
 */
export const printInvoice = async (invoiceId: string) => {
  try {
    const { doc } = await generateInvoicePDF(invoiceId);

    // AutoPrint sets the flag for the PDF to trigger print dialog on open
    doc.autoPrint();

    // Generate Blob URL
    const blob = doc.output("blob");
    const blobUrl = URL.createObjectURL(blob);

    // Create a hidden iframe to print
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = blobUrl;

    document.body.appendChild(iframe);

    iframe.onload = () => {
      if (iframe.contentWindow) {
        iframe.contentWindow.print();
      }
    };

    // Cleanup (optional: remove iframe after printing, though difficult to time perfectly with print dialog)
    // setTimeout(() => { document.body.removeChild(iframe); URL.revokeObjectURL(blobUrl); }, 60000);

    toast.success("Printing invoice...");
  } catch (error) {
    console.error(error);
    toast.error("Failed to print invoice");
  }
};

/**
 * Download Invoice PDF
 */
export const downloadInvoice = async (invoiceId: string) => {
  try {
    const { doc, invoiceNo } = await generateInvoicePDF(invoiceId);
    doc.save(`Invoice_${invoiceNo}.pdf`);
    toast.success("Invoice downloaded successfully");
  } catch (error) {
    console.error(error);
    toast.error("Failed to download invoice");
  }
};
