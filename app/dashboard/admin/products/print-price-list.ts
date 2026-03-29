// app/dashboard/admin/products/print-price-list.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { Product } from "./types";

export const printPriceListReport = (products: Product[]) => {
  if (products.length === 0) {
    toast.error("No products to generate report");
    return;
  }

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const marginLeft = 14;
  const marginRight = pageWidth - 14;

  // --- Helper: draw header on each page ---
  const drawPageHeader = () => {
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("CHAMPIKA HARDWARE", pageWidth / 2, 16, { align: "center" });

    doc.setTextColor(60, 60, 60);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("No 45, Main Street, Galle  |  Tel: 077-1234567  |  sales@champika.lk", pageWidth / 2, 21, { align: "center" });

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(marginLeft, 25, marginRight, 25);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("DISTRIBUTION PRODUCTS — PRICE LIST", pageWidth / 2, 32, { align: "center" });

    const today = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(`Date: ${today}`, marginLeft, 38);
    doc.text(`Total Products: ${products.length}`, marginRight, 38, { align: "right" });

    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.line(marginLeft, 41, marginRight, 41);
  };

  // --- Helper: draw page footer ---
  const drawPageFooter = (pageNum: number, totalPages: number) => {
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(130, 130, 130);
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: "center" });
    doc.text("Champika Hardware — Confidential", marginLeft, pageHeight - 8);
  };

  // --- Group products by supplier ---
  const grouped: Record<string, Product[]> = {};
  products.forEach((p) => {
    const key = p.supplier?.trim() || "Unknown Supplier";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  });

  const supplierNames = Object.keys(grouped).sort();

  drawPageHeader();

  let currentY = 45;

  supplierNames.forEach((supplierName, sIndex) => {
    const supplierProducts = grouped[supplierName];

    // Check if we need a new page for the supplier block
    if (currentY > pageHeight - 50) {
      doc.addPage();
      drawPageHeader();
      currentY = 45;
    }

    // Supplier section header bar
    doc.setFillColor(30, 30, 30);
    doc.rect(marginLeft, currentY, marginRight - marginLeft, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(
      `  ${supplierName.toUpperCase()}   (${supplierProducts.length} item${supplierProducts.length !== 1 ? "s" : ""})`,
      marginLeft + 2,
      currentY + 5
    );

    currentY += 9;

    // Table rows
    const tableRows = supplierProducts.map((p, idx) => [
      idx + 1,
      p.sku || "-",
      p.name,
      p.unitOfMeasure || "-",
      `LKR ${p.sellingPrice.toLocaleString("en-LK", { minimumFractionDigits: 2 })}`,
    ]);

    autoTable(doc, {
      head: [["#", "Item Code", "Item Name", "Pack Size", "Selling Price"]],
      body: tableRows,
      startY: currentY,
      theme: "plain",
      margin: { top: 45, left: marginLeft, right: 14 },

      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [30, 30, 30],
        fontStyle: "bold",
        fontSize: 8,
        halign: "center",
        lineColor: [200, 200, 200],
        lineWidth: 0.3,
      },

      bodyStyles: {
        textColor: [30, 30, 30],
        fontSize: 8,
        lineColor: [220, 220, 220],
        lineWidth: 0.2,
      },

      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },

      styles: {
        cellPadding: 2.5,
        overflow: "linebreak",
      },

      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 28 },
        2: { cellWidth: "auto" },
        3: { cellWidth: 26, halign: "center" },
        4: { cellWidth: 32, halign: "right", fontStyle: "bold" },
      },

      didDrawPage: () => {
        drawPageHeader();
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + (sIndex < supplierNames.length - 1 ? 6 : 4);
  });

  // --- Draw footers on all pages ---
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawPageFooter(i, totalPages);
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`Price_List_${dateStr}.pdf`);
  toast.success("Price list report downloaded");
};
