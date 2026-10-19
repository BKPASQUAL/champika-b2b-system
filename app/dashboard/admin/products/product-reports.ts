// app/dashboard/admin/products/product-reports.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Product } from "./types";

const fmt = (amount: number) =>
  (amount || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtInt = (amount: number) =>
  (amount || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

// Pre-load images safely with timeout
const loadImageAsBase64 = (url: string): Promise<string | null> => {
  if (!url || typeof window === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => resolve(null), 1200);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width || 60;
        canvas.height = img.height || 60;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
};

const prefetchProductImages = async (products: Product[]): Promise<Record<string, string | null>> => {
  const imageMap: Record<string, string | null> = {};
  const urlsToFetch = Array.from(
    new Set(
      products
        .map((p) => p.images?.[0])
        .filter((url): url is string => Boolean(url))
    )
  );

  const chunkSize = 15;
  for (let i = 0; i < urlsToFetch.length; i += chunkSize) {
    const chunk = urlsToFetch.slice(i, i + chunkSize);
    const results = await Promise.allSettled(chunk.map((url) => loadImageAsBase64(url)));
    results.forEach((res, idx) => {
      imageMap[chunk[idx]] = res.status === "fulfilled" ? res.value : null;
    });
  }
  return imageMap;
};

// Print utility via hidden iframe
export const triggerPrintDoc = (doc: jsPDF, toastId = "print-report") => {
  doc.autoPrint();
  const pdfBlob = doc.output("blob");
  const blobUrl = URL.createObjectURL(pdfBlob);

  let iframe = document.getElementById("product-report-print-iframe") as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = "product-report-print-iframe";
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
        window.open(blobUrl, "_blank");
      }
      toast.success("Print dialog opened", { id: toastId });
    }, 200);
  };
};

export interface ReportOptions {
  action?: "print" | "download";
  supplierFilter?: string;
  categoryFilter?: string;
  subCategoryFilter?: string;
  stockFilter?: string;
  channelFilter?: "all" | "distribution" | "retail_only";
  includeImages?: boolean;
  title?: string;
  isRetailPortal?: boolean;
  companyName?: string;
}

// ══════════════════════════════════════════════════════════════════════════
// 1. COST & SELLING PRICE REPORT (GROUPED BY SUPPLIER) - LANDSCAPE
// ══════════════════════════════════════════════════════════════════════════
export const generateCostAndPriceReport = async (
  products: Product[],
  options: ReportOptions = {}
) => {
  const {
    action = "download",
    supplierFilter = "all",
    categoryFilter = "all",
    subCategoryFilter = "all",
    stockFilter = "all",
    channelFilter = "all",
    includeImages = true,
    isRetailPortal = false,
    companyName = isRetailPortal ? "CHAMPIKA HARDWARE - RETAIL" : "CHAMPIKA HARDWARE & DISTRIBUTORS",
    title = isRetailPortal
      ? "RETAIL PRODUCT COST & PRICE LIST (BY SUPPLIER)"
      : "PRODUCT COST & PRICE LIST (BY SUPPLIER)",
  } = options;

  const toastId = "cost-price-report";
  toast.loading(
    action === "print" ? "Preparing report for printing..." : "Generating Cost & Price Report PDF...",
    { id: toastId }
  );

  try {
    let eligible = products.filter((p) => p.isActive !== false);

    if (supplierFilter && supplierFilter !== "all") {
      eligible = eligible.filter((p) => p.supplier?.toLowerCase().trim() === supplierFilter.toLowerCase().trim());
    }
    if (categoryFilter && categoryFilter !== "all") {
      eligible = eligible.filter((p) => p.category?.toLowerCase().trim() === categoryFilter.toLowerCase().trim());
    }
    if (subCategoryFilter && subCategoryFilter !== "all") {
      eligible = eligible.filter((p) => p.subCategory?.toLowerCase().trim() === subCategoryFilter.toLowerCase().trim());
    }
    if (channelFilter === "distribution") {
      eligible = eligible.filter((p) => !p.retailOnly);
    } else if (channelFilter === "retail_only") {
      eligible = eligible.filter((p) => Boolean(p.retailOnly));
    }
    if (stockFilter === "in-stock") {
      eligible = eligible.filter((p) => (p.stock || 0) > 0);
    } else if (stockFilter === "low") {
      eligible = eligible.filter((p) => (p.stock || 0) > 0 && (p.stock || 0) < (p.minStock || 0));
    } else if (stockFilter === "out-of-stock") {
      eligible = eligible.filter((p) => (p.stock || 0) === 0);
    }

    if (eligible.length === 0) {
      toast.error("No products matching the selected filters", { id: toastId });
      return;
    }

    const imageMap = includeImages ? await prefetchProductImages(eligible) : {};

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.width; // 297mm
    const pageHeight = doc.internal.pageSize.height; // 210mm
    const marginLeft = 12;
    const marginRight = pageWidth - 12;

    const todayStr = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const timeStr = new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const grouped: Record<string, Product[]> = {};
    eligible.forEach((p) => {
      const sup = p.supplier?.trim() || "Unassigned Supplier";
      if (!grouped[sup]) grouped[sup] = [];
      grouped[sup].push(p);
    });

    const supplierNames = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

    const grandTotalItems = eligible.length;
    const grandDistCount = eligible.filter((p) => !p.retailOnly).length;
    const grandRetailCount = eligible.filter((p) => Boolean(p.retailOnly)).length;

    const scopeLabel =
      channelFilter === "distribution"
        ? "Scope: Distribution Items"
        : channelFilter === "retail_only"
        ? "Scope: Retail Exclusive Only"
        : "Scope: All Items (Dist + Retail)";

    const drawPageHeader = () => {
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(15);
      doc.setFont("helvetica", "bold");
      doc.text(companyName, marginLeft, 12);

      doc.setTextColor(100, 116, 139);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text("Pranawatta Road, Wallabada, Boossa | Tel: 0777681663 / 0912234567", marginLeft, 16.5);

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(title.toUpperCase(), marginRight, 12, { align: "right" });

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Generated: ${todayStr} ${timeStr} | ${supplierFilter === "all" ? "All Suppliers" : `Supplier: ${supplierFilter}`} | ${scopeLabel}`,
        marginRight,
        16.5,
        { align: "right" }
      );

      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.4);
      doc.line(marginLeft, 19, marginRight, 19);
    };

    const drawPageFooter = (pageNum: number, total: number) => {
      doc.setFontSize(7);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(148, 163, 184);
      doc.text(`${companyName} — Product Cost & Price Report`, marginLeft, pageHeight - 6);
      doc.text(`Page ${pageNum} of ${total}`, marginRight, pageHeight - 6, { align: "right" });
    };

    drawPageHeader();

    let currentY = 22;

    supplierNames.forEach((supplierName, sIndex) => {
      const supplierProducts = grouped[supplierName];

      // Group products: Category -> Sub Category
      const catMap: Record<string, Record<string, Product[]>> = {};
      supplierProducts.forEach((p) => {
        const cat = p.category?.trim() || "Uncategorized";
        const sub = p.subCategory?.trim() || "General";
        if (!catMap[cat]) catMap[cat] = {};
        if (!catMap[cat][sub]) catMap[cat][sub] = [];
        catMap[cat][sub].push(p);
      });

      const sortedCategories = Object.keys(catMap).sort((a, b) => a.localeCompare(b));

      if (currentY > pageHeight - 35) {
        doc.addPage();
        drawPageHeader();
        currentY = 22;
      }

      // Supplier banner
      doc.setFillColor(30, 41, 59);
      doc.roundedRect(marginLeft, currentY, marginRight - marginLeft, 6.5, 1, 1, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.text(`SUPPLIER: ${supplierName.toUpperCase()}  (${supplierProducts.length} items)`, marginLeft + 3, currentY + 4.5);

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text(
        `${sortedCategories.length} Categories  |  ${supplierProducts.length} Products`,
        marginRight - 3,
        currentY + 4.5,
        { align: "right" }
      );

      currentY += 8;

      const tableRows: any[] = [];
      const rowProductMap: Record<number, Product> = {};
      let itemSeq = 1;
      let rowIndex = 0;

      sortedCategories.forEach((catName) => {
        const subCats = Object.keys(catMap[catName]).sort((a, b) => a.localeCompare(b));
        const totalCatItems = subCats.reduce((sum, sc) => sum + catMap[catName][sc].length, 0);

        // Category Header Row spanning all 9 columns
        tableRows.push([
          {
            content: `CATEGORY: ${catName.toUpperCase()}  (${totalCatItems} item${totalCatItems !== 1 ? "s" : ""})`,
            colSpan: 9,
            styles: {
              fillColor: [51, 65, 85], // Slate-700
              textColor: [255, 255, 255],
              fontStyle: "bold",
              fontSize: 7.5,
              halign: "left",
              cellPadding: { top: 2.2, bottom: 2.2, left: 4, right: 4 },
            },
          },
        ]);
        rowIndex++;

        subCats.forEach((subCatName) => {
          // Sort items in alphabetical order by product name
          const items = catMap[catName][subCatName].sort((a, b) =>
            (a.name || "").localeCompare(b.name || "", undefined, {
              numeric: true,
              sensitivity: "base",
            })
          );

          // Show subcategory banner if there's multiple subcategories or an explicit subcategory name
          const hasExplicitSubCat =
            subCatName &&
            subCatName.toLowerCase() !== "general" &&
            subCatName.toLowerCase() !== catName.toLowerCase();
          const shouldShowSubCat = subCats.length > 1 || hasExplicitSubCat;

          if (shouldShowSubCat) {
            tableRows.push([
              {
                content: `    SUB CATEGORY: ${(subCatName || "General").toUpperCase()}  (${items.length} item${items.length !== 1 ? "s" : ""})`,
                colSpan: 9,
                styles: {
                  fillColor: [241, 245, 249], // Slate-100
                  textColor: [30, 41, 59],     // Dark Slate
                  fontStyle: "bold",
                  fontSize: 7,
                  halign: "left",
                  cellPadding: { top: 1.8, bottom: 1.8, left: 6, right: 4 },
                },
              },
            ]);
            rowIndex++;
          }

          items.forEach((p) => {
            const cost = Number(p.costPrice) || 0;
            const sellingPrice = Number(p.sellingPrice) || 0;
            const retailPrice = Number(p.retailPrice) || 0;
            const mrp = Number(p.mrp) || 0;
            // Only show [Retail Only] for retail exclusive items; REMOVE [Distribution] completely
            const typeTag = p.retailOnly ? "\n[Retail Only]" : "";

            rowProductMap[rowIndex] = p;
            tableRows.push([
              itemSeq++,
              p.sku || p.companyCode || "-",
              "",
              `${p.name || "-"}${typeTag}`,
              p.unitOfMeasure || "Pcs",
              cost > 0 ? fmt(cost) : "-",
              sellingPrice > 0 ? fmt(sellingPrice) : "-",
              retailPrice > 0 ? fmt(retailPrice) : "-",
              mrp > 0 ? fmt(mrp) : "-",
            ]);
            rowIndex++;
          });
        });
      });

      autoTable(doc, {
        head: [
          [
            "#",
            "Item Code",
            "Img",
            "Product Name / Type",
            "Unit",
            "Cost Price",
            "Selling Price",
            "Retail Price",
            "MRP",
          ],
        ],
        body: tableRows,
        startY: currentY,
        theme: "grid",
        margin: { top: 22, left: marginLeft, right: 12, bottom: 12 },
        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: "bold",
          fontSize: 7.5,
          halign: "center",
          lineColor: [203, 213, 225],
          lineWidth: 0.2,
          cellPadding: 1.8,
        },
        bodyStyles: {
          textColor: [30, 41, 59],
          fontSize: 7,
          lineColor: [226, 232, 240],
          lineWidth: 0.15,
          minCellHeight: includeImages ? 8 : 6,
          valign: "middle",
          cellPadding: 1.5,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 9, halign: "center" },
          1: { cellWidth: 25, fontStyle: "bold" },
          2: { cellWidth: includeImages ? 11 : 0.1, halign: "center", cellPadding: 0.5 },
          3: { cellWidth: "auto" },
          4: { cellWidth: 14, halign: "center" },
          5: { cellWidth: 26, halign: "right", fontStyle: "bold", textColor: [37, 99, 235] },
          6: { cellWidth: 26, halign: "right", fontStyle: "bold", textColor: [16, 185, 129] },
          7: { cellWidth: 26, halign: "right", fontStyle: "bold", textColor: [147, 51, 234] },
          8: { cellWidth: 25, halign: "right", textColor: [100, 116, 139] },
        },
        didDrawCell: (data) => {
          if (includeImages && data.column.index === 2 && data.section === "body") {
            const product = rowProductMap[data.row.index];
            if (product) {
              const imgUrl = product?.images?.[0];
              if (imgUrl && imageMap[imgUrl]) {
                const cellX = data.cell.x;
                const cellY = data.cell.y;
                const cellH = data.cell.height;
                const cellW = data.cell.width;
                const imgSize = Math.min(cellH - 1, cellW - 1, 7);
                const x = cellX + (cellW - imgSize) / 2;
                const y = cellY + (cellH - imgSize) / 2;
                doc.addImage(imageMap[imgUrl]!, "JPEG", x, y, imgSize, imgSize);
              }
            }
          }
        },
        didDrawPage: () => {
          drawPageHeader();
        },
      });

      currentY = (doc as any).lastAutoTable.finalY + (sIndex < supplierNames.length - 1 ? 5 : 4);
    });

    if (currentY > pageHeight - 32) {
      doc.addPage();
      drawPageHeader();
      currentY = 22;
    }

    const summaryY = currentY + 2;
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.4);
    doc.roundedRect(marginLeft, summaryY, marginRight - marginLeft, 10, 1.5, 1.5, "FD");

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.text("REPORT SUMMARY TOTALS", marginLeft + 4, summaryY + 6);

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    doc.text(
      `Total Suppliers: ${supplierNames.length}  |  Total Products: ${grandTotalItems} (Distribution: ${grandDistCount}, Retail Exclusive: ${grandRetailCount})`,
      marginRight - 4,
      summaryY + 6,
      { align: "right" }
    );

    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      drawPageFooter(i, totalPages);
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const supplierSlug = supplierFilter === "all" ? "All_Suppliers" : supplierFilter.replace(/[^a-zA-Z0-9]/g, "_");
    const prefix = isRetailPortal ? "Retail_Product_Cost_Price_Report" : "Product_Cost_Price_Report";
    const fileName = `${prefix}_${supplierSlug}_${dateStr}.pdf`;

    if (action === "print") {
      triggerPrintDoc(doc, toastId);
    } else {
      doc.save(fileName);
      toast.success("Cost & Price Report PDF downloaded", { id: toastId });
    }
  } catch (error: any) {
    console.error("Error generating cost report:", error);
    toast.error(error.message || "Failed to generate report", { id: toastId });
  }
};

// ══════════════════════════════════════════════════════════════════════════
// 2. SELLING / RETAIL PRICE LIST REPORT (PORTRAIT / CUSTOMER FACING)
// ══════════════════════════════════════════════════════════════════════════
export const generatePriceListReport = async (
  products: Product[],
  options: ReportOptions = {}
) => {
  const {
    action = "download",
    supplierFilter = "all",
    categoryFilter = "all",
    subCategoryFilter = "all",
    channelFilter = "all",
    includeImages = true,
    isRetailPortal = false,
    companyName = isRetailPortal ? "CHAMPIKA HARDWARE - RETAIL" : "CHAMPIKA HARDWARE",
    title = isRetailPortal ? "RETAIL PRODUCT PRICE LIST" : "DISTRIBUTION PRODUCTS — PRICE LIST",
  } = options;

  const toastId = "price-list-report";
  toast.loading(
    action === "print" ? "Preparing price list for printing..." : "Generating Price List PDF...",
    { id: toastId }
  );

  try {
    let eligible = products.filter((p) => p.isActive !== false);

    if (supplierFilter && supplierFilter !== "all") {
      eligible = eligible.filter((p) => p.supplier?.toLowerCase().trim() === supplierFilter.toLowerCase().trim());
    }
    if (categoryFilter && categoryFilter !== "all") {
      eligible = eligible.filter((p) => p.category?.toLowerCase().trim() === categoryFilter.toLowerCase().trim());
    }
    if (subCategoryFilter && subCategoryFilter !== "all") {
      eligible = eligible.filter((p) => p.subCategory?.toLowerCase().trim() === subCategoryFilter.toLowerCase().trim());
    }
    if (channelFilter === "distribution") {
      eligible = eligible.filter((p) => !p.retailOnly);
    } else if (channelFilter === "retail_only") {
      eligible = eligible.filter((p) => Boolean(p.retailOnly));
    }

    if (eligible.length === 0) {
      toast.error("No products matching the selected filters", { id: toastId });
      return;
    }

    const imageMap = includeImages ? await prefetchProductImages(eligible) : {};

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const marginLeft = 14;
    const marginRight = pageWidth - 14;

    const scopeLabel =
      channelFilter === "distribution"
        ? "Scope: Distribution"
        : channelFilter === "retail_only"
        ? "Scope: Retail Only"
        : "Scope: All Items";

    const drawPageHeader = () => {
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(companyName, pageWidth / 2, 16, { align: "center" });

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
      doc.text(title, pageWidth / 2, 32, { align: "center" });

      const today = new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      doc.text(`Date: ${today}  |  ${supplierFilter === "all" ? "All Suppliers" : `Supplier: ${supplierFilter}`}  |  ${scopeLabel}`, marginLeft, 38);
      doc.text(`Total Products: ${eligible.length}`, marginRight, 38, { align: "right" });

      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.3);
      doc.line(marginLeft, 41, marginRight, 41);
    };

    const drawPageFooter = (pageNum: number, totalPages: number) => {
      doc.setFontSize(7);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(130, 130, 130);
      doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: "center" });
      doc.text(`${companyName} — Price List`, marginLeft, pageHeight - 8);
    };

    const grouped: Record<string, Product[]> = {};
    eligible.forEach((p) => {
      const key = p.supplier?.trim() || "Unknown Supplier";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(p);
    });

    const supplierNames = Object.keys(grouped).sort();

    drawPageHeader();
    let currentY = 45;

    supplierNames.forEach((supplierName, sIndex) => {
      const supplierProducts = grouped[supplierName];

      const catMap: Record<string, Record<string, Product[]>> = {};
      supplierProducts.forEach((p) => {
        const cat = p.category?.trim() || "Uncategorized";
        const sub = p.subCategory?.trim() || "General";
        if (!catMap[cat]) catMap[cat] = {};
        if (!catMap[cat][sub]) catMap[cat][sub] = [];
        catMap[cat][sub].push(p);
      });

      const sortedCategories = Object.keys(catMap).sort((a, b) => a.localeCompare(b));

      if (currentY > pageHeight - 50) {
        doc.addPage();
        drawPageHeader();
        currentY = 45;
      }

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

      const tableRows: any[] = [];
      const rowProductMap: Record<number, Product> = {};
      let itemSeq = 1;
      let rowIndex = 0;

      sortedCategories.forEach((catName) => {
        const subCats = Object.keys(catMap[catName]).sort((a, b) => a.localeCompare(b));
        const totalCatItems = subCats.reduce((sum, sc) => sum + catMap[catName][sc].length, 0);

        tableRows.push([
          {
            content: `CATEGORY: ${catName.toUpperCase()} (${totalCatItems} items)`,
            colSpan: 8,
            styles: {
              fillColor: [60, 60, 60],
              textColor: [255, 255, 255],
              fontStyle: "bold",
              fontSize: 7.5,
              halign: "left",
              cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
            },
          },
        ]);
        rowIndex++;

        subCats.forEach((subCatName) => {
          const items = catMap[catName][subCatName].sort((a, b) =>
            (a.name || "").localeCompare(b.name || "", undefined, {
              numeric: true,
              sensitivity: "base",
            })
          );

          const hasExplicitSubCat =
            subCatName &&
            subCatName.toLowerCase() !== "general" &&
            subCatName.toLowerCase() !== catName.toLowerCase();
          const shouldShowSubCat = subCats.length > 1 || hasExplicitSubCat;

          if (shouldShowSubCat) {
            tableRows.push([
              {
                content: `    SUB CATEGORY: ${(subCatName || "General").toUpperCase()} (${items.length} items)`,
                colSpan: 8,
                styles: {
                  fillColor: [240, 240, 240],
                  textColor: [40, 40, 40],
                  fontStyle: "bold",
                  fontSize: 7,
                  halign: "left",
                  cellPadding: { top: 1.5, bottom: 1.5, left: 5, right: 3 },
                },
              },
            ]);
            rowIndex++;
          }

          items.forEach((p) => {
            const sellPrice = Number(p.sellingPrice) || 0;
            const retailPrice = Number(p.retailPrice) || 0;
            const mrp = Number(p.mrp) || 0;
            const typeTag = p.retailOnly ? " [Retail Only]" : "";

            rowProductMap[rowIndex] = p;
            tableRows.push([
              itemSeq++,
              p.sku || p.companyCode || "-",
              "",
              `${p.name}${typeTag}`,
              p.unitOfMeasure || "-",
              sellPrice > 0 ? `LKR ${fmt(sellPrice)}` : "-",
              retailPrice > 0 ? `LKR ${fmt(retailPrice)}` : "-",
              mrp > 0 ? `LKR ${fmt(mrp)}` : "-",
            ]);
            rowIndex++;
          });
        });
      });

      autoTable(doc, {
        head: [["#", "Item Code", "Image", "Item Name / Type", "Unit", "Selling Price", "Retail Price", "MRP"]],
        body: tableRows,
        startY: currentY,
        theme: "plain",
        margin: { top: 45, left: marginLeft, right: 14 },
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: [30, 30, 30],
          fontStyle: "bold",
          fontSize: 7.5,
          halign: "center",
          lineColor: [200, 200, 200],
          lineWidth: 0.3,
        },
        bodyStyles: {
          textColor: [30, 30, 30],
          fontSize: 7.5,
          lineColor: [220, 220, 220],
          lineWidth: 0.2,
          minCellHeight: 10,
          valign: "middle",
        },
        alternateRowStyles: {
          fillColor: [250, 250, 250],
        },
        styles: {
          cellPadding: 2,
          overflow: "linebreak",
        },
        columnStyles: {
          0: { cellWidth: 9, halign: "center" },
          1: { cellWidth: 24, fontStyle: "bold" },
          2: { cellWidth: includeImages ? 11 : 0.1, halign: "center", cellPadding: 1 },
          3: { cellWidth: "auto", overflow: "linebreak" },
          4: { cellWidth: 16, halign: "center" },
          5: { cellWidth: 26, halign: "right", fontStyle: "bold" },
          6: { cellWidth: 26, halign: "right", fontStyle: "bold" },
          7: { cellWidth: 24, halign: "right", textColor: [100, 100, 100] },
        },
        didDrawCell: (data) => {
          if (includeImages && data.column.index === 2 && data.section === "body") {
            const product = rowProductMap[data.row.index];
            if (product) {
              const imgUrl = product?.images?.[0];
              if (imgUrl && imageMap[imgUrl]) {
                const cellX = data.cell.x;
                const cellY = data.cell.y;
                const cellH = data.cell.height;
                const cellW = data.cell.width;
                const imgSize = Math.min(cellH - 2, cellW - 2, 8);
                const x = cellX + (cellW - imgSize) / 2;
                const y = cellY + (cellH - imgSize) / 2;
                doc.addImage(imageMap[imgUrl]!, "JPEG", x, y, imgSize, imgSize);
              }
            }
          }
        },
        didDrawPage: () => {
          drawPageHeader();
        },
      });

      currentY = (doc as any).lastAutoTable.finalY + (sIndex < supplierNames.length - 1 ? 6 : 4);
    });

    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      drawPageFooter(i, totalPages);
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const prefix = isRetailPortal ? "Retail_Price_List" : "Price_List";
    const fileName = `${prefix}_${dateStr}.pdf`;

    if (action === "print") {
      triggerPrintDoc(doc, toastId);
    } else {
      doc.save(fileName);
      toast.success("Price list report downloaded", { id: toastId });
    }
  } catch (error: any) {
    console.error("Price list error:", error);
    toast.error(error.message || "Failed to generate price list", { id: toastId });
  }
};

// ══════════════════════════════════════════════════════════════════════════
// 3. EXPORT EXCEL (WITH CHANNEL, COST, SELLING & RETAIL PRICES)
// ══════════════════════════════════════════════════════════════════════════
export const exportProductsToExcel = (
  products: Product[],
  options: {
    supplierFilter?: string;
    categoryFilter?: string;
    subCategoryFilter?: string;
    channelFilter?: "all" | "distribution" | "retail_only";
    includeCost?: boolean;
    isRetailPortal?: boolean;
  } = {}
) => {
  const {
    supplierFilter = "all",
    categoryFilter = "all",
    subCategoryFilter = "all",
    channelFilter = "all",
    includeCost = true,
    isRetailPortal = false,
  } = options;

  let eligible = products;
  if (supplierFilter !== "all") {
    eligible = eligible.filter((p) => p.supplier?.toLowerCase().trim() === supplierFilter.toLowerCase().trim());
  }
  if (categoryFilter !== "all") {
    eligible = eligible.filter((p) => p.category?.toLowerCase().trim() === categoryFilter.toLowerCase().trim());
  }
  if (subCategoryFilter && subCategoryFilter !== "all") {
    eligible = eligible.filter((p) => p.subCategory?.toLowerCase().trim() === subCategoryFilter.toLowerCase().trim());
  }
  if (channelFilter === "distribution") {
    eligible = eligible.filter((p) => !p.retailOnly);
  } else if (channelFilter === "retail_only") {
    eligible = eligible.filter((p) => Boolean(p.retailOnly));
  }

  if (eligible.length === 0) {
    toast.error("No products to export");
    return;
  }

  // Sort alphabetically by Supplier, Category, Sub Category, and Name
  eligible = [...eligible].sort((a, b) => {
    const supCompare = (a.supplier || "").localeCompare(b.supplier || "");
    if (supCompare !== 0) return supCompare;
    const catCompare = (a.category || "").localeCompare(b.category || "");
    if (catCompare !== 0) return catCompare;
    const subCompare = (a.subCategory || "").localeCompare(b.subCategory || "");
    if (subCompare !== 0) return subCompare;
    return (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" });
  });

  const data = eligible.map((p) => {
    const cost = Number(p.costPrice) || 0;
    const sell = Number(p.sellingPrice) || 0;
    const retail = Number(p.retailPrice) || 0;
    const stock = Number(p.stock) || 0;
    const effectiveSell = (isRetailPortal && retail > 0) ? retail : sell;
    const profit = effectiveSell - cost;
    const marginPct = effectiveSell > 0 ? Number(((profit / effectiveSell) * 100).toFixed(2)) : 0;

    const row: Record<string, any> = {
      SKU: p.sku || "",
      "Company Code": p.companyCode || "-",
      Name: p.name,
      Channel: p.retailOnly ? "Retail Only" : "Distribution & Wholesale",
      Category: p.category,
      "Sub Category": p.subCategory || "-",
      Supplier: p.supplier,
      Stock: stock,
      Unit: p.unitOfMeasure || "Pcs",
    };

    if (includeCost) {
      row["Cost Price (LKR)"] = cost;
    }

    row["Base Selling Price (LKR)"] = sell;
    row["Retail Price (LKR)"] = retail > 0 ? retail : "-";
    row["MRP (LKR)"] = p.mrp || 0;

    if (includeCost) {
      row["Unit Margin (LKR)"] = profit;
      row["Margin %"] = `${marginPct}%`;
      row["Total Stock Cost (LKR)"] = stock * cost;
      row["Total Stock Value (LKR)"] = stock * effectiveSell;
    }

    row["Status"] = p.isActive ? "Active" : "Inactive";
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Products");
  const dateStr = new Date().toISOString().slice(0, 10);
  const prefix = isRetailPortal ? "retail_products_report" : "products_cost_price_report";
  XLSX.writeFile(wb, `${prefix}_${dateStr}.xlsx`);
  toast.success("Excel report exported successfully");
};

// Legacy compatibility export
export const printPriceListReport = (products: Product[]) => {
  return generatePriceListReport(products, { action: "download" });
};
