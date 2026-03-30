// app/dashboard/office/distribution/orders/loading/print-loading-summary.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

const fetchSummary = async (orderIds: string[]) => {
  const res = await fetch(
    `/api/orders/loading/summary?orderIds=${orderIds.join(",")}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to fetch summary data");
  }
  return await res.json();
};

const generateSummaryPDF = (data: any, reportTitle = "LOADING — ITEMS SUMMARY REPORT"): jsPDF => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const marginL = 14;
  const marginR = pageWidth - 14;

  const reportDate = new Date(data.reportDate).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // ── Page header (reused on each page) ──
  const drawHeader = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("CHAMPIKA HARDWARE", pageWidth / 2, 14, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(
      "Pranawatta Road, Wallabada, Boossa  |  Tel: 0777681663",
      pageWidth / 2,
      19,
      { align: "center" }
    );

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(marginL, 22, marginR, 22);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(reportTitle, pageWidth / 2, 29, {
      align: "center",
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(`Date: ${reportDate}`, marginL, 35);
    doc.text(
      `Invoices: ${data.invoiceCount}  |  Products: ${data.summary.length}`,
      marginR,
      35,
      { align: "right" }
    );

    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.line(marginL, 38, marginR, 38);
  };

  // ── Footer ──
  const drawFooter = (pageNum: number, totalPages: number) => {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${pageNum} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: "center" }
    );
    doc.text("Champika Hardware — Confidential", marginL, pageHeight - 8);
  };

  drawHeader();

  let currentY = 42;

  // ════════════════════════════════════════
  // SECTION 1 — AGGREGATED ITEMS SUMMARY
  // ════════════════════════════════════════
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.setFillColor(30, 80, 160);
  doc.rect(marginL, currentY, marginR - marginL, 7, "F");
  doc.text("  ITEMS SUMMARY (All Selected Invoices)", marginL + 2, currentY + 5);
  currentY += 9;

  const summaryRows = data.summary.map((item: any, idx: number) => [
    idx + 1,
    item.sku || "-",
    item.productName,
    item.totalQuantity,
    item.totalFreeQuantity,
    item.totalQuantity + item.totalFreeQuantity,
  ]);

  const totalRegQty = data.summary.reduce(
    (s: number, i: any) => s + i.totalQuantity,
    0
  );
  const totalFreeQty = data.summary.reduce(
    (s: number, i: any) => s + i.totalFreeQuantity,
    0
  );

  autoTable(doc, {
    head: [["#", "SKU", "Product Name", "Reg Qty", "Free Qty", "Total Qty"]],
    body: summaryRows,
    foot: [
      ["", "", "GRAND TOTAL", totalRegQty, totalFreeQty, totalRegQty + totalFreeQty],
    ],
    startY: currentY,
    theme: "grid",
    margin: { left: marginL, right: 14 },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 30, 30],
    },
    alternateRowStyles: {
      fillColor: [245, 248, 255],
    },
    footStyles: {
      fillColor: [220, 230, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 28 },
      2: { cellWidth: "auto" },
      3: { cellWidth: 22, halign: "center" },
      4: { cellWidth: 22, halign: "center" },
      5: { cellWidth: 22, halign: "center", fontStyle: "bold" },
    },
    didDrawPage: () => drawHeader(),
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // ════════════════════════════════════════
  // SECTION 2 — PER-INVOICE BREAKDOWN
  // ════════════════════════════════════════
  if (currentY > pageHeight - 60) {
    doc.addPage();
    drawHeader();
    currentY = 42;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.setFillColor(30, 120, 80);
  doc.rect(marginL, currentY, marginR - marginL, 7, "F");
  doc.text("  PER-INVOICE BREAKDOWN", marginL + 2, currentY + 5);
  currentY += 9;

  data.invoices.forEach((inv: any, invIdx: number) => {
    if (currentY > pageHeight - 50) {
      doc.addPage();
      drawHeader();
      currentY = 42;
    }

    // Invoice sub-header
    doc.setFillColor(235, 245, 235);
    doc.setDrawColor(180, 210, 180);
    doc.setLineWidth(0.3);
    doc.rect(marginL, currentY, marginR - marginL, 6, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(30, 80, 30);
    doc.text(
      `${invIdx + 1}.  Invoice: ${inv.invoiceNo}   |   ${inv.shopName}   |   Route: ${inv.route}`,
      marginL + 2,
      currentY + 4
    );
    currentY += 7;

    const invRows = inv.items.map((item: any, i: number) => [
      i + 1,
      item.sku || "-",
      item.productName,
      item.quantity,
      item.freeQuantity,
      item.quantity + item.freeQuantity,
    ]);

    const invRegTotal = inv.items.reduce(
      (s: number, i: any) => s + i.quantity,
      0
    );
    const invFreeTotal = inv.items.reduce(
      (s: number, i: any) => s + i.freeQuantity,
      0
    );

    autoTable(doc, {
      head: [["#", "SKU", "Product Name", "Reg Qty", "Free Qty", "Total"]],
      body: invRows,
      foot: [["", "", "Subtotal", invRegTotal, invFreeTotal, invRegTotal + invFreeTotal]],
      startY: currentY,
      theme: "plain",
      margin: { left: marginL, right: 14 },
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [30, 30, 30],
        fontStyle: "bold",
        fontSize: 7.5,
        halign: "center",
        lineColor: [200, 200, 200],
        lineWidth: 0.2,
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [50, 50, 50],
        lineColor: [220, 220, 220],
        lineWidth: 0.2,
      },
      footStyles: {
        fillColor: [245, 245, 245],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        fontSize: 7.5,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 28 },
        2: { cellWidth: "auto" },
        3: { cellWidth: 22, halign: "center" },
        4: { cellWidth: 22, halign: "center" },
        5: { cellWidth: 22, halign: "center", fontStyle: "bold" },
      },
      didDrawPage: () => drawHeader(),
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;
  });

  // Draw footers on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(i, totalPages);
  }

  return doc;
};

export const downloadLoadingSummary = async (
  orderIds: string[],
  options?: { title?: string; filePrefix?: string }
) => {
  if (orderIds.length === 0) {
    toast.error("Select at least one order to generate summary");
    return;
  }
  const title = options?.title ?? "LOADING — ITEMS SUMMARY REPORT";
  const filePrefix = options?.filePrefix ?? "Loading_Summary";
  try {
    toast.loading("Generating summary report...", { id: "summary-report" });
    const data = await fetchSummary(orderIds);
    const doc = generateSummaryPDF(data, title);
    const dateStr = new Date().toISOString().slice(0, 10);
    doc.save(`${filePrefix}_${dateStr}.pdf`);
    toast.success("Summary report downloaded", { id: "summary-report" });
  } catch (error: any) {
    console.error("Summary report error:", error);
    toast.error(error.message || "Failed to generate report", {
      id: "summary-report",
    });
  }
};
