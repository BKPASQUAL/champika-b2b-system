// app/dashboard/admin/products/print-price-list.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { Product } from "./types";

const loadImageAsBase64 = (url: string): Promise<string | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/jpeg"));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
};

export const printPriceListReport = async (products: Product[]) => {
  if (products.length === 0) {
    toast.error("No products to generate report");
    return;
  }

  // Pre-load all first product images as base64
  const imageMap: Record<string, string | null> = {};
  for (const p of products) {
    const imgUrl = p.images?.[0];
    if (imgUrl && !(imgUrl in imageMap)) {
      imageMap[imgUrl] = await loadImageAsBase64(imgUrl);
    }
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
    doc.text("Pranawatta Road, Wallabada, Boossa  |  Tel: 0777681663", pageWidth / 2, 21, { align: "center" });

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
    const supplierProducts = grouped[supplierName].sort((a, b) =>
      (a.sku || "").localeCompare(b.sku || "", undefined, { numeric: true, sensitivity: "base" })
    );

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

    // Table rows — empty string placeholder for image column
    const tableRows = supplierProducts.map((p, idx) => [
      idx + 1,
      p.sku || "-",
      "",            // image cell — drawn via didDrawCell
      p.name,
      p.unitOfMeasure || "-",
      `LKR ${p.sellingPrice.toLocaleString("en-LK", { minimumFractionDigits: 2 })}`,
    ]);

    autoTable(doc, {
      head: [["#", "Item Code", "Image", "Item Name", "Pack Size", "Selling Price"]],
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
        minCellHeight: 12,
        valign: "middle",
      },

      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },

      styles: {
        cellPadding: 2.5,
        overflow: "linebreak",
      },

      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 26 },
        2: { cellWidth: 14, halign: "center", cellPadding: 1 },
        3: { cellWidth: "auto", overflow: "linebreak" },
        4: { cellWidth: 24, halign: "center" },
        5: { cellWidth: 32, halign: "right", fontStyle: "bold" },
      },

      didDrawCell: (data) => {
        // Draw product image in the Image column (index 2) for body rows
        if (data.column.index === 2 && data.section === "body") {
          const product = supplierProducts[data.row.index];
          const imgUrl = product?.images?.[0];
          if (imgUrl && imageMap[imgUrl]) {
            const cellX = data.cell.x;
            const cellY = data.cell.y;
            const cellH = data.cell.height;
            const cellW = data.cell.width;
            const imgSize = Math.min(cellH - 2, cellW - 2, 10);
            const x = cellX + (cellW - imgSize) / 2;
            const y = cellY + (cellH - imgSize) / 2;
            doc.addImage(imageMap[imgUrl]!, "JPEG", x, y, imgSize, imgSize);
          }
        }
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
