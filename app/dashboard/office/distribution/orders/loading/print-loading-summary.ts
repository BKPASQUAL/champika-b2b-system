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

const generateSummaryPDF = (data: any, reportTitle = "ITEMS SUMMARY REPORT"): jsPDF => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const marginL = 14;
  const marginR = pageWidth - 14;

  let currentY = 15;

  // ════════════════════════════════════════
  // ITEMS SUMMARY (Total Qty Only)
  // ════════════════════════════════════════
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text("ITEMS SUMMARY", marginL, currentY);
  currentY += 5;

  const summaryRows = (data.summary || []).map((item: any, idx: number) => {
    const regQty = Number(item.totalQuantity) || 0;
    const freeQty = Number(item.totalFreeQuantity) || 0;
    const retQty = Number(item.totalReturnQuantity) || 0;
    const totalQty = regQty + freeQty + retQty;

    return [
      idx + 1,
      item.sku || "-",
      item.productName,
      totalQty,
    ];
  });

  const grandTotalQty = (data.summary || []).reduce((s: number, i: any) => {
    const regQty = Number(i.totalQuantity) || 0;
    const freeQty = Number(i.totalFreeQuantity) || 0;
    const retQty = Number(i.totalReturnQuantity) || 0;
    return s + regQty + freeQty + retQty;
  }, 0);

  autoTable(doc, {
    head: [["#", "SKU", "Product Name", "Total Qty"]],
    body: summaryRows,
    foot: [
      ["", "", "GRAND TOTAL", grandTotalQty],
    ],
    startY: currentY,
    theme: "grid",
    margin: { left: marginL, right: 14 },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize: 8.5,
      halign: "center",
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255],
    },
    footStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize: 8.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 30 },
      2: { cellWidth: "auto" },
      3: { cellWidth: 25, halign: "center", fontStyle: "bold" },
    },
  });

  // Draw footers on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: "center" }
    );
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
  const title = options?.title ?? "ITEMS SUMMARY REPORT";
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

export const printLoadingSummary = async (
  orderIds: string[],
  options?: { title?: string }
) => {
  if (orderIds.length === 0) {
    toast.error("Select at least one order to generate summary");
    return;
  }
  const title = options?.title ?? "ITEMS SUMMARY REPORT";
  try {
    toast.loading("Preparing summary report for printing...", { id: "print-summary" });
    const data = await fetchSummary(orderIds);
    const doc = generateSummaryPDF(data, title);
    doc.autoPrint();

    const pdfBlob = doc.output("blob");
    const blobUrl = URL.createObjectURL(pdfBlob);

    // Create or reuse hidden iframe to print directly without opening a new tab
    let iframe = document.getElementById("print-summary-iframe") as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "print-summary-iframe";
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
    }

    iframe.src = blobUrl;

    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (err) {
          console.error("Iframe print error:", err);
        }
        toast.success("Print dialog opened", { id: "print-summary" });
      }, 150);
    };
  } catch (error: any) {
    console.error("Print summary report error:", error);
    toast.error(error.message || "Failed to generate report", {
      id: "print-summary",
    });
  }
};
