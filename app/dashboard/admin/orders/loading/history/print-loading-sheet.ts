import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

// Shared function to generate the PDF content
const generatePDFContent = async (loadId: string) => {
  // 1. Fetch Data
  const res = await fetch(`/api/orders/loading/history/${loadId}`);
  if (!res.ok) throw new Error("Failed to load loading sheet details");
  const data = await res.json();

  // 2. Initialize PDF
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 10;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  // Top Info Grid
  let startY = 15;
  doc.setFont("helvetica", "bold");
  doc.text(`Load Ref: ${data.loadId}`, margin, startY);
  doc.text(
    `Date: ${new Date(data.loadingDate).toLocaleDateString()}`,
    pageWidth - margin,
    startY,
    { align: "right" }
  );

  startY += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`Lorry No: ${data.lorryNumber}`, margin, startY);
  doc.text(`${data.driverName}`, pageWidth - margin, startY, {
    align: "right",
  });

  // --- Table ---
  const tableColumn = [
    "#",
    "Invoice #",
    "Shop Details",
    "Address",
    "Amount",
    "Stamp & Signature",
  ];
  const tableRows = data.orders.map((order: any, index: number) => [
    index + 1,
    order.invoiceNo,
    `${order.customer.shopName}\n${order.customer.phone || ""}`,
    order.customer.address || "-",
    order.totalAmount.toLocaleString("en-LK", { minimumFractionDigits: 2 }),
    "",
  ]);

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: startY + 6,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 3,
      minCellHeight: 16,
      lineColor: [150, 150, 150],
      lineWidth: 0.1,
      valign: "middle",
      textColor: 0,
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: 0,
      fontStyle: "bold",
      halign: "center",
      lineWidth: 0.1,
      lineColor: [100, 100, 100],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 22, fontStyle: "bold" },
      2: { cellWidth: 45 },
      3: { cellWidth: 45 },
      4: { cellWidth: 25, halign: "right" },
      5: { cellWidth: "auto", minCellHeight: 22 },
    },
  });

  // --- Footer / Signatures ---
  let currentY = (doc as any).lastAutoTable.finalY + 10;
  const requiredSpace = 40;

  if (currentY + requiredSpace > pageHeight - margin) {
    doc.addPage();
    currentY = 20;
  }

  // Totals
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Total Orders: ${data.totalOrders}`, margin, currentY);

  // Signatures (2 Columns)
  currentY += 20;
  const sigLineWidth = 60;
  const colWidth = (pageWidth - margin * 2) / 2;

  doc.setLineWidth(0.2);
  doc.setDrawColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");

  // 1. Authorized Dispatcher
  doc.line(margin, currentY, margin + sigLineWidth, currentY);
  doc.text("Authorized Dispatcher", margin, currentY + 4);

  // 2. Responsible Person (Driver)
  const xPos2 = margin + colWidth;
  doc.line(xPos2, currentY, xPos2 + sigLineWidth, currentY);
  doc.text("Responsible Person", xPos2, currentY + 4);
  doc.setFont("helvetica", "bold");
  doc.text(`(${data.driverName})`, xPos2, currentY + 8);
  doc.setFont("helvetica", "normal");

  return { doc, loadId: data.loadId };
};

// Function 1: Download File
export const downloadLoadingSheet = async (loadId: string) => {
  try {
    const { doc, loadId: id } = await generatePDFContent(loadId);
    doc.save(`Dispatch_Sheet_${id}.pdf`);
    toast.success("PDF Downloaded");
  } catch (error) {
    console.error(error);
    toast.error("Failed to generate PDF");
  }
};

// Function 2: Print Directly (Stay on Page)
export const printLoadingSheet = async (loadId: string) => {
  try {
    const { doc } = await generatePDFContent(loadId);

    // Use autoPrint to embed JS in PDF, then load in iframe
    doc.autoPrint();
    const blob = doc.output("blob");
    const blobUrl = URL.createObjectURL(blob);

    // Create invisible iframe
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.width = "0px";
    iframe.style.height = "0px";
    iframe.style.border = "none";
    iframe.src = blobUrl;

    // Append to body to trigger load
    document.body.appendChild(iframe);

    // Once loaded, the autoPrint script inside PDF should trigger,
    // but we can also force focus/print for better compatibility
    iframe.onload = () => {
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }
    };

    // Optional: Remove iframe after a delay (e.g. 1 minute) to cleanup memory
    // We delay significantly to ensure print dialog has opened
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(blobUrl);
    }, 60000);
  } catch (error) {
    console.error(error);
    toast.error("Failed to print");
  }
};

// Helper: Generate Returns Summary PDF
const generateReturnsPDFContent = async (loadId: string) => {
  const res = await fetch(`/api/orders/loading/history/${loadId}`);
  if (!res.ok) throw new Error("Failed to load loading sheet details");
  const data = await res.json();

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.width;
  const margin = 10;

  let startY = 15;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Customer Exchange & Return Items Summary", margin, startY);

  startY += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`Load Ref: ${data.loadId}`, margin, startY);
  doc.text(
    `Date: ${new Date(data.loadingDate || data.createdAt).toLocaleDateString()}`,
    pageWidth - margin,
    startY,
    { align: "right" }
  );

  startY += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`Lorry No: ${data.lorryNumber}`, margin, startY);
  doc.text(`Responsible Person: ${data.driverName}`, pageWidth - margin, startY, { align: "right" });

  startY += 6;

  // Group returns by Shop Name
  const shopReturnsMap: Record<string, any[]> = {};
  (data.orders || []).forEach((order: any) => {
    const shopName = order.customer?.shopName || "Unknown Shop";
    const returns = order.returns || [];
    if (returns.length > 0) {
      if (!shopReturnsMap[shopName]) {
        shopReturnsMap[shopName] = [];
      }
      returns.forEach((ret: any) => {
        shopReturnsMap[shopName].push(ret);
      });
    }
  });

  const shopNames = Object.keys(shopReturnsMap);
  if (shopNames.length === 0) {
    toast.info("No customer returns found for this loading sheet.");
    return null;
  }

  let currentY = startY + 4;

  shopNames.forEach((shopName, shopIdx) => {
    const items = shopReturnsMap[shopName];

    // Shop Header Title
    autoTable(doc, {
      head: [[`Shop (${shopIdx + 1}): ${shopName}`]],
      body: [],
      startY: currentY,
      theme: "plain",
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        fontSize: 11,
        cellPadding: 1,
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 1;

    // Items table under this shop
    const tableColumn = ["#", "Item Name", "SKU / Code", "Return Type", "Qty"];
    const tableRows = items.map((ret: any, itemIdx: number) => [
      itemIdx + 1,
      ret.productName,
      ret.sku || "-",
      ret.returnType || "Exchange",
      `${ret.quantity} ${ret.unit || ret.unitOfMeasure || ""}`.trim(),
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: currentY,
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 2.5,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
        valign: "middle",
      },
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 95, fontStyle: "bold" },
        2: { cellWidth: 40, halign: "center" },
        3: { cellWidth: 28, halign: "center" },
        4: { cellWidth: 15, halign: "center", fontStyle: "bold" },
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;
  });

  return { doc, loadId: data.loadId };
};

// Function 3: Download Customer Returns & Exchange Items Summary PDF
export const downloadReturnsSummarySheet = async (loadId: string) => {
  try {
    const result = await generateReturnsPDFContent(loadId);
    if (!result) return;
    result.doc.save(`Exchange_Returns_Summary_${result.loadId}.pdf`);
    toast.success("Returns Summary PDF Downloaded");
  } catch (error) {
    console.error(error);
    toast.error("Failed to generate Returns Summary PDF");
  }
};

import { generateReturnsSummaryHTML, getDocumentWrapper } from "@/app/lib/invoice-html";

// Function 4: Print Customer Returns & Exchange Items Summary
export const printReturnsSummarySheet = async (loadIdOrData: string | any) => {
  try {
    let data = loadIdOrData;
    if (typeof loadIdOrData === "string") {
      const res = await fetch(`/api/orders/loading/history/${loadIdOrData}`);
      if (!res.ok) throw new Error("Failed to load loading sheet details");
      data = await res.json();
    }
    const html = generateReturnsSummaryHTML(data);
    if (!html) {
      toast.info("No customer returns found for this loading sheet.");
      return;
    }
    const iframe = document.createElement("iframe");
    Object.assign(iframe.style, {
      position: "fixed",
      right: "0",
      bottom: "0",
      width: "0",
      height: "0",
      border: "0",
    });
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(getDocumentWrapper(html, `Returns_Summary_${data.loadId || ""}`));
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 2000);
    }, 500);
  } catch (error) {
    console.error(error);
    toast.error("Failed to print Returns Summary");
  }
};
