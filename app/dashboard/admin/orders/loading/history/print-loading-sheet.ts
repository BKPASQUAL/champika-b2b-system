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

// Helper: Generate Customer Outstanding PDF Content for Loading Sheet
const generateOutstandingPDFContent = async (loadId: string) => {
  const res = await fetch(`/api/orders/loading/history/${loadId}`);
  if (!res.ok) throw new Error("Failed to load loading sheet details");
  const data = await res.json();

  // Group orders by shop / customer
  const shopMap: Record<
    string,
    {
      customer: any;
      orders: any[];
      currentLoadTotal: number;
    }
  > = {};

  (data.orders || []).forEach((order: any) => {
    const shopName = order.customer?.shopName || "Unknown Shop";
    if (!shopMap[shopName]) {
      shopMap[shopName] = {
        customer: order.customer || {},
        orders: [],
        currentLoadTotal: 0,
      };
    }
    shopMap[shopName].orders.push(order);
    shopMap[shopName].currentLoadTotal += order.totalAmount || 0;
  });

  const today = new Date();
  const shopEntries = Object.entries(shopMap);

  // Filter shops that have at least 1 unpaid delivered invoice
  const outstandingShops = shopEntries.filter(([_, info]) => {
    const cust = info.customer;
    const unpaidInvoices = cust.unpaidInvoices || [];
    const calcDue = cust.calculatedOutstanding || 0;
    return unpaidInvoices.length > 0 && calcDue > 0;
  });

  if (outstandingShops.length === 0) {
    toast.info("No customers on this loading sheet have outstanding delivered invoices.");
    return null;
  }

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 10;

  let startY = 15;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(220, 38, 38); // Crimson red
  doc.text("CUSTOMER OUTSTANDING REPORT (DELIVERED INVOICES ONLY)", margin, startY);

  startY += 6;
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(`Load Ref: ${data.loadId}`, margin, startY);
  doc.text(
    `Date: ${new Date(data.loadingDate || data.createdAt).toLocaleDateString("en-LK")}`,
    pageWidth - margin,
    startY,
    { align: "right" }
  );

  startY += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`Lorry No: ${data.lorryNumber}`, margin, startY);
  doc.text(`Driver: ${data.driverName}${data.helperName ? ` (Helper: ${data.helperName})` : ""}`, pageWidth - margin, startY, { align: "right" });

  startY += 5;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-LK")} ${new Date().toLocaleTimeString()}`, margin, startY);

  // Color theme definitions for aging buckets
  const COLOR = {
    overdue45Bg:   [254, 249, 195] as [number, number, number], // Amber
    overdue45Text: [161, 98,  7  ] as [number, number, number],
    overdue60Bg:   [254, 215, 170] as [number, number, number], // Orange
    overdue60Text: [194, 65,  12 ] as [number, number, number],
    overdue90Bg:   [254, 226, 226] as [number, number, number], // Red Critical
    overdue90Text: [185, 28,  28 ] as [number, number, number],
  };

  // Calculate Overall Totals & Aging Breakdown (Delivered Invoices Only)
  let totalDeliveredDue = 0;
  let totalDeliveredInvoiceCount = 0;
  let due45 = 0, count45 = 0;
  let due60 = 0, count60 = 0;
  let due90 = 0, count90 = 0;

  outstandingShops.forEach(([_, info]) => {
    const unpaidInvoices: any[] = info.customer?.unpaidInvoices || [];
    unpaidInvoices.forEach((inv) => {
      const due = inv.dueAmount || 0;
      totalDeliveredDue += due;
      totalDeliveredInvoiceCount++;

      const invDate = inv.createdAt ? new Date(inv.createdAt) : null;
      const days = invDate ? Math.floor((today.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      if (days >= 90) {
        due90 += due;
        count90++;
      } else if (days >= 60) {
        due60 += due;
        count60++;
      } else if (days >= 45) {
        due45 += due;
        count45++;
      }
    });
  });

  // Summary Table with Aging Colors
  autoTable(doc, {
    startY: startY + 4,
    margin: { left: margin, right: margin },
    head: [["Summary Category (Delivered Invoices Only)", "Bills Count", "Total Amount (LKR)"]],
    body: [
      ["All Delivered Outstanding Invoices", totalDeliveredInvoiceCount.toString(), totalDeliveredDue.toLocaleString("en-LK", { minimumFractionDigits: 2 })],
      ["45+ Days Overdue (Amber Theme)", count45.toString(), due45.toLocaleString("en-LK", { minimumFractionDigits: 2 })],
      ["60+ Days Overdue (Orange Theme)", count60.toString(), due60.toLocaleString("en-LK", { minimumFractionDigits: 2 })],
      ["90+ Days Overdue (Critical Red)", count90.toString(), due90.toLocaleString("en-LK", { minimumFractionDigits: 2 })],
    ],
    theme: "grid",
    headStyles: {
      fillColor: [60, 60, 60],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      cellPadding: 1.5,
    },
    styles: { fontSize: 8, cellPadding: 1.5 },
    columnStyles: {
      0: { cellWidth: 90, fontStyle: "bold" },
      1: { cellWidth: 30, halign: "center" },
      2: { cellWidth: 70, halign: "right", fontStyle: "bold" },
    },
    didParseCell(dataCell) {
      if (dataCell.section === "body") {
        if (dataCell.row.index === 1) {
          dataCell.cell.styles.fillColor = COLOR.overdue45Bg;
          dataCell.cell.styles.textColor = COLOR.overdue45Text;
        } else if (dataCell.row.index === 2) {
          dataCell.cell.styles.fillColor = COLOR.overdue60Bg;
          dataCell.cell.styles.textColor = COLOR.overdue60Text;
        } else if (dataCell.row.index === 3) {
          dataCell.cell.styles.fillColor = COLOR.overdue90Bg;
          dataCell.cell.styles.textColor = COLOR.overdue90Text;
          dataCell.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  let currentY = (doc as any).lastAutoTable.finalY + 6;

  // Render per-customer outstanding breakdown
  outstandingShops.forEach(([shopName, info], idx) => {
    const cust = info.customer;
    const unpaidInvoices: any[] = cust.unpaidInvoices || [];
    const calcDue = cust.calculatedOutstanding || 0;
    const dbBal = cust.outstandingBalance || 0;
    const totalShopDue = calcDue > 0 ? calcDue : dbBal;

    // Check vertical space
    if (currentY + 35 > pageHeight - margin) {
      doc.addPage();
      currentY = 15;
    }

    // Shop Title Banner
    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [[
        `(${idx + 1}) ${shopName} ${cust.ownerName ? `| Owner: ${cust.ownerName}` : ""} ${cust.phone ? `| Tel: ${cust.phone}` : ""}`
      ]],
      body: [],
      theme: "plain",
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: "bold",
        fontSize: 10,
        cellPadding: 2,
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 1;

    // Sub-info text: Route & Total Due
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(185, 28, 28);
    doc.text(`Route: ${cust.route || "N/A"} | Current Load Order: LKR ${info.currentLoadTotal.toLocaleString("en-LK", { minimumFractionDigits: 2 })} | Total Delivered Outstanding: LKR ${totalShopDue.toLocaleString("en-LK", { minimumFractionDigits: 2 })}`, margin + 2, currentY + 3);

    currentY += 6;

    if (unpaidInvoices.length > 0) {
      const tableColumn = ["#", "Invoice #", "Invoice Date", "Days Overdue", "Total (LKR)", "Paid (LKR)", "Due Amount (LKR)"];
      const tableRows = unpaidInvoices.map((inv: any, i: number) => {
        const invDate = inv.createdAt ? new Date(inv.createdAt) : null;
        const daysOverdue = invDate ? Math.max(0, Math.floor((today.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24))) : "-";
        return [
          i + 1,
          inv.invoiceNo,
          invDate ? invDate.toLocaleDateString("en-LK") : "-",
          daysOverdue !== "-" ? `${daysOverdue} days` : "-",
          inv.totalAmount.toLocaleString("en-LK", { minimumFractionDigits: 2 }),
          inv.paidAmount.toLocaleString("en-LK", { minimumFractionDigits: 2 }),
          inv.dueAmount.toLocaleString("en-LK", { minimumFractionDigits: 2 }),
        ];
      });

      autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [tableColumn],
        body: tableRows,
        theme: "grid",
        styles: {
          fontSize: 8,
          cellPadding: 2,
          textColor: [0, 0, 0],
          lineColor: [200, 200, 200],
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [248, 250, 252],
          textColor: [51, 65, 85],
          fontStyle: "bold",
          halign: "center",
        },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 35, fontStyle: "bold" },
          2: { cellWidth: 25, halign: "center" },
          3: { cellWidth: 25, halign: "center" },
          4: { cellWidth: 32, halign: "right" },
          5: { cellWidth: 30, halign: "right" },
          6: { cellWidth: 35, halign: "right", fontStyle: "bold" },
        },
        didParseCell(dataCell) {
          if (dataCell.section === "body") {
            const invRow = unpaidInvoices[dataCell.row.index];
            if (invRow && invRow.createdAt) {
              const invDate = new Date(invRow.createdAt);
              const days = Math.floor((today.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));
              if (days >= 90) {
                dataCell.cell.styles.fillColor = COLOR.overdue90Bg;
                dataCell.cell.styles.textColor = COLOR.overdue90Text;
                if (dataCell.column.index === 6) dataCell.cell.styles.fontStyle = "bold";
              } else if (days >= 60) {
                dataCell.cell.styles.fillColor = COLOR.overdue60Bg;
                dataCell.cell.styles.textColor = COLOR.overdue60Text;
              } else if (days >= 45) {
                dataCell.cell.styles.fillColor = COLOR.overdue45Bg;
                dataCell.cell.styles.textColor = COLOR.overdue45Text;
              }
            }
          }
        },
      });

      currentY = (doc as any).lastAutoTable.finalY + 5;
    } else {
      // Single summary row when itemized list is empty
      autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [["Customer Outstanding Summary", "Due Amount (LKR)"]],
        body: [["Recorded Balance", totalShopDue.toLocaleString("en-LK", { minimumFractionDigits: 2 })]],
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [248, 250, 252], textColor: [51, 65, 85], fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 140, fontStyle: "bold" },
          1: { cellWidth: 50, halign: "right", fontStyle: "bold", textColor: [185, 28, 28] },
        },
      });

      currentY = (doc as any).lastAutoTable.finalY + 5;
    }
  });

  return { doc, loadId: data.loadId, count: outstandingShops.length };
};

// Function 5: Download Customer Outstanding Report PDF
export const downloadLoadingOutstandingReport = async (loadId: string) => {
  try {
    const result = await generateOutstandingPDFContent(loadId);
    if (!result) return;
    result.doc.save(`Customer_Outstanding_${result.loadId}.pdf`);
    toast.success(`Outstanding Report Downloaded (${result.count} customers)`);
  } catch (error) {
    console.error(error);
    toast.error("Failed to generate Outstanding Report PDF");
  }
};

// Function 6: Print Customer Outstanding Report PDF
export const printLoadingOutstandingReport = async (loadId: string) => {
  try {
    const result = await generateOutstandingPDFContent(loadId);
    if (!result) return;
    result.doc.autoPrint();
    const blob = result.doc.output("blob");
    const blobUrl = URL.createObjectURL(blob);
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.width = "0px";
    iframe.style.height = "0px";
    iframe.style.border = "none";
    iframe.src = blobUrl;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }
    };
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(blobUrl);
    }, 60000);
    toast.success("Print dialog opened for Outstanding Report");
  } catch (error) {
    console.error(error);
    toast.error("Failed to print Outstanding Report");
  }
};

// Function 7: Share Customer Outstanding Report PDF
export const shareLoadingOutstandingReport = async (loadId: string) => {
  try {
    const result = await generateOutstandingPDFContent(loadId);
    if (!result) return;
    const blob = result.doc.output("blob");
    const fileName = `Customer_Outstanding_${result.loadId}.pdf`;
    const file = new File([blob], fileName, { type: "application/pdf" });

    if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: `Customer Outstanding Report - ${result.loadId}`,
        text: `Customer Outstanding Report for Loading Sheet ${result.loadId}`,
      });
      toast.success("Shared successfully");
    } else {
      // Fallback to downloading the file for manual sharing
      result.doc.save(fileName);
      toast.success("PDF Downloaded for sharing");
    }
  } catch (error: any) {
    if (error?.name !== "AbortError") {
      console.error(error);
      toast.error("Failed to share PDF");
    }
  }
};

