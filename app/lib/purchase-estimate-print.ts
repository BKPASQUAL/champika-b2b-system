/**
 * purchase-estimate-print.ts
 * Print, PDF download, clipboard copy, and WhatsApp sharing helpers for Purchase Estimates / Quotations.
 * Pure order planning / quotation feature (No stock increment).
 */

import { toast } from "sonner";
import { BUSINESS_NAMES, BUSINESS_THEMES } from "@/app/config/business-constants";

const fmt = (amount: number) =>
  new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);

const formatDate = (dateString?: string) => {
  if (!dateString) return "-";
  try {
    return new Date(dateString).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
};

// ── Copy Items & Quantities to Clipboard ────────────────────────────────────
export const copyEstimateItemsAsText = (
  estimate: any,
  mode: "whatsapp" | "portal_tab" | "bullet" = "whatsapp"
): boolean => {
  try {
    const items = estimate.items || [];
    if (!items.length) {
      toast.error("No items in this estimate to copy");
      return false;
    }

    let textToCopy = "";
    const bName =
      BUSINESS_NAMES[estimate.businessId as keyof typeof BUSINESS_NAMES] ||
      "Champika Agency";
    const supplierName =
      estimate.supplierName || estimate.supplier?.name || "Supplier";
    const estNo = estimate.estimateNumber || estimate.estimate_number || "EST";
    const dateStr = formatDate(estimate.estimateDate || estimate.estimate_date);

    if (mode === "whatsapp") {
      const lines = [
        `*PURCHASE ORDER ESTIMATE / QUOTATION*`,
        `*${bName}*`,
        `Estimate No: ${estNo}`,
        `Supplier: ${supplierName}`,
        `Date: ${dateStr}`,
        `----------------------------------------`,
        ...items.map((it: any, idx: number) => {
          const qty = it.quantity || 0;
          const free = it.freeQuantity ? ` + (Free: ${it.freeQuantity})` : "";
          const unit = it.unit || "Pcs";
          const cost = fmt(it.unitPrice || 0);
          const disc = it.discountPercent ? ` [Disc ${it.discountPercent}%]` : "";
          const tot = fmt(it.total || 0);
          return `${idx + 1}. *${it.productName || it.name}* (${it.sku || "N/A"})\n   Qty: ${qty} ${unit}${free} @ Rs. ${cost}${disc} = Rs. ${tot}`;
        }),
        `----------------------------------------`,
        `Total Items: ${items.length}`,
        `Subtotal: Rs. ${fmt(estimate.subTotal || estimate.sub_total || 0)}`,
      ];

      if (estimate.extraDiscountAmount || estimate.extra_discount_amount) {
        lines.push(
          `Extra Discount (${estimate.extraDiscountPercent || estimate.extra_discount_percent || 0}%): -Rs. ${fmt(estimate.extraDiscountAmount || estimate.extra_discount_amount || 0)}`
        );
      }

      lines.push(
        `*ESTIMATED NET TOTAL: Rs. ${fmt(estimate.totalAmount || estimate.total_amount || 0)}*`,
        `\n_(Order inquiry / estimation only. Please confirm availability & pricing)_`
      );

      textToCopy = lines.join("\n");
    } else if (mode === "portal_tab") {
      // Tab-separated: Product Code / Name, Qty, Free Qty (Ideal for Excel / Portal paste)
      textToCopy = items
        .map((it: any) => `${it.sku || it.productName}\t${it.productName}\t${it.quantity}\t${it.freeQuantity || 0}\t${it.unitPrice || 0}`)
        .join("\n");
    } else {
      // Simple Bullet List: Item Name & Qty
      textToCopy = items
        .map((it: any, idx: number) => {
          const free = it.freeQuantity ? ` (+${it.freeQuantity} Free)` : "";
          return `${idx + 1}. ${it.productName} - Qty: ${it.quantity} ${it.unit || "Pcs"}${free}`;
        })
        .join("\n");
    }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(textToCopy);
      toast.success(
        mode === "whatsapp"
          ? "Formatted order copied for WhatsApp!"
          : "Items and quantities copied to clipboard!"
      );
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      toast.success("Copied to clipboard!");
      return true;
    }
  } catch (err: any) {
    console.error("Failed to copy:", err);
    toast.error("Failed to copy to clipboard");
    return false;
  }
};

// ── Share via WhatsApp ──────────────────────────────────────────────────────
export const shareViaWhatsApp = (estimate: any) => {
  const items = estimate.items || [];
  const bName =
    BUSINESS_NAMES[estimate.businessId as keyof typeof BUSINESS_NAMES] ||
    "Champika Agency";
  const supplierName =
    estimate.supplierName || estimate.supplier?.name || "Supplier";
  const estNo = estimate.estimateNumber || estimate.estimate_number || "EST";
  const dateStr = formatDate(estimate.estimateDate || estimate.estimate_date);

  const lines = [
    `*PURCHASE ORDER ESTIMATE*`,
    `*${bName}*`,
    `Estimate No: ${estNo}`,
    `Supplier: ${supplierName}`,
    `Date: ${dateStr}`,
    `----------------------------------------`,
    ...items.map((it: any, idx: number) => {
      const free = it.freeQuantity ? ` (+${it.freeQuantity} Free)` : "";
      return `${idx + 1}. *${it.productName}* (${it.sku || "N/A"}) - ${it.quantity} ${it.unit || "Pcs"}${free}`;
    }),
    `----------------------------------------`,
    `Total Items: ${items.length}`,
    `Estimated Total: Rs. ${fmt(estimate.totalAmount || estimate.total_amount || 0)}`,
  ];

  const fullText = encodeURIComponent(lines.join("\n"));
  const phone = estimate.supplierPhone || estimate.supplier?.phone || "";
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  const waUrl = cleanPhone
    ? `https://wa.me/${cleanPhone.startsWith("0") ? "94" + cleanPhone.slice(1) : cleanPhone}?text=${fullText}`
    : `https://wa.me/?text=${fullText}`;

  window.open(waUrl, "_blank");
};

// ── Generate Clean Printable HTML ───────────────────────────────────────────
export const generateEstimateHTML = (estimate: any): string => {
  const bName =
    BUSINESS_NAMES[estimate.businessId as keyof typeof BUSINESS_NAMES] ||
    "Champika Hardware & Agency";
  const estNo = estimate.estimateNumber || estimate.estimate_number || "EST-0001";
  const dateStr = formatDate(estimate.estimateDate || estimate.estimate_date);
  const arrivalDateStr = formatDate(estimate.arrivalDate || estimate.arrival_date);
  const supplier = estimate.supplier || {};
  const supplierName =
    estimate.supplierName || supplier.name || "Supplier";
  const items = estimate.items || [];

  const subTotal = Number(estimate.subTotal || estimate.sub_total || 0);
  const extraDiscPct = Number(estimate.extraDiscountPercent || estimate.extra_discount_percent || 0);
  const extraDiscAmt = Number(estimate.extraDiscountAmount || estimate.extra_discount_amount || 0);
  const netTotal = Number(estimate.totalAmount || estimate.total_amount || 0);
  const grossTotal = Number(estimate.grossTotal || estimate.gross_total || subTotal);
  const lineDiscounts = Number(estimate.lineDiscountTotal || estimate.line_discount_total || (grossTotal - subTotal));

  const totalQty = items.reduce(
    (acc: number, it: any) => acc + (Number(it.quantity) || 0),
    0
  );
  const totalFree = items.reduce(
    (acc: number, it: any) => acc + (Number(it.freeQuantity) || 0),
    0
  );

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <title>Purchase Estimate - ${estNo}</title>
    <style>
      @page {
        size: A4 portrait;
        margin: 12mm 10mm;
      }
      * { box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #1e293b;
        background: #fff;
        margin: 0;
        padding: 16px;
        font-size: 11px;
        line-height: 1.4;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 2px solid #0f172a;
        padding-bottom: 12px;
        margin-bottom: 14px;
      }
      .brand-title {
        font-size: 20px;
        font-weight: 800;
        color: #0f172a;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin: 0 0 4px 0;
      }
      .brand-subtitle {
        font-size: 11px;
        color: #64748b;
        font-weight: 500;
      }
      .doc-badge {
        display: inline-block;
        background: #f1f5f9;
        color: #334155;
        border: 1px solid #cbd5e1;
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 6px;
      }
      .meta-box {
        text-align: right;
      }
      .meta-num {
        font-size: 16px;
        font-weight: 800;
        color: #0f172a;
      }
      .meta-row {
        font-size: 10px;
        color: #475569;
        margin-top: 2px;
      }
      .watermark-notice {
        background: #eff6ff;
        border: 1px dashed #93c5fd;
        color: #1e40af;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 600;
        text-align: center;
        margin-bottom: 14px;
      }
      .info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-bottom: 14px;
      }
      .info-card {
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 10px 12px;
        background: #f8fafc;
      }
      .info-card h4 {
        margin: 0 0 6px 0;
        font-size: 10px;
        text-transform: uppercase;
        color: #64748b;
        font-weight: 700;
        letter-spacing: 0.5px;
      }
      .info-card .name {
        font-size: 13px;
        font-weight: 700;
        color: #0f172a;
      }
      .info-card p {
        margin: 2px 0;
        font-size: 10px;
        color: #475569;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 14px;
      }
      th {
        background: #0f172a;
        color: #ffffff;
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        padding: 7px 6px;
      }
      td {
        padding: 6px;
        border-bottom: 1px solid #e2e8f0;
        font-size: 10px;
      }
      tr:nth-child(even) td {
        background: #f8fafc;
      }
      .text-left { text-align: left; }
      .text-center { text-align: center; }
      .text-right { text-align: right; }
      .font-mono { font-family: monospace; }
      .font-bold { font-weight: 700; }
      .free-badge {
        color: #16a34a;
        font-weight: 700;
      }
      .summary-section {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-top: 10px;
      }
      .notes-box {
        width: 55%;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 10px;
        background: #f8fafc;
        min-height: 80px;
      }
      .notes-box h5 {
        margin: 0 0 4px 0;
        font-size: 10px;
        text-transform: uppercase;
        color: #64748b;
      }
      .totals-table {
        width: 40%;
        border-collapse: collapse;
      }
      .totals-table td {
        padding: 4px 6px;
        font-size: 10px;
        border-bottom: 1px solid #f1f5f9;
      }
      .totals-table tr.grand-total td {
        border-top: 2px solid #0f172a;
        border-bottom: 2px solid #0f172a;
        font-size: 13px;
        font-weight: 800;
        color: #0f172a;
        padding: 6px;
        background: #f8fafc;
      }
      .footer-sign {
        margin-top: 40px;
        display: flex;
        justify-content: space-between;
        padding: 0 20px;
      }
      .sign-box {
        text-align: center;
        width: 180px;
        border-top: 1px dashed #94a3b8;
        padding-top: 6px;
        font-size: 10px;
        color: #475569;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <h1 class="brand-title">${bName}</h1>
        <div class="brand-subtitle">Supplier Order Planning & Purchase Quotation</div>
      </div>
      <div class="meta-box">
        <span class="doc-badge">PURCHASE ESTIMATE</span>
        <div class="meta-num">${estNo}</div>
        <div class="meta-row"><strong>Date:</strong> ${dateStr}</div>
        ${arrivalDateStr !== "-" ? `<div class="meta-row"><strong>Expected:</strong> ${arrivalDateStr}</div>` : ""}
        ${estimate.referenceNo ? `<div class="meta-row"><strong>Ref #:</strong> ${estimate.referenceNo}</div>` : ""}
      </div>
    </div>

    <div class="watermark-notice">
      📋 ORDER ESTIMATE ONLY — NOT A BILL / NO INVENTORY DEDUCTED OR ADDED TO STOCK
    </div>

    <div class="info-grid">
      <div class="info-card">
        <h4>Supplier Details</h4>
        <div class="name">${supplierName}</div>
        ${supplier.contactPerson ? `<p><strong>Contact:</strong> ${supplier.contactPerson}</p>` : ""}
        ${supplier.phone ? `<p><strong>Phone:</strong> ${supplier.phone}</p>` : ""}
        ${supplier.email ? `<p><strong>Email:</strong> ${supplier.email}</p>` : ""}
        ${supplier.address ? `<p><strong>Address:</strong> ${supplier.address}</p>` : ""}
      </div>
      <div class="info-card">
        <h4>Order Summary Details</h4>
        <p><strong>Total Items Listed:</strong> ${items.length}</p>
        <p><strong>Total Billed Qty:</strong> ${totalQty} units</p>
        ${totalFree > 0 ? `<p><strong>Total Free Qty:</strong> <span class="free-badge">${totalFree} units</span></p>` : ""}
        <p><strong>Status:</strong> ${estimate.status || "Saved"}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="text-center" style="width: 4%;">#</th>
          <th class="text-left" style="width: 14%;">Item Code</th>
          <th class="text-left" style="width: 32%;">Description</th>
          <th class="text-right" style="width: 12%;">Cost Price</th>
          <th class="text-center" style="width: 7%;">Qty</th>
          <th class="text-center" style="width: 7%;">Free</th>
          <th class="text-center" style="width: 6%;">Unit</th>
          <th class="text-right" style="width: 7%;">Disc %</th>
          <th class="text-right" style="width: 11%;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (it: any, idx: number) => `
          <tr>
            <td class="text-center text-muted font-mono">${idx + 1}</td>
            <td class="text-left font-mono font-bold">${it.sku || "-"}</td>
            <td class="text-left">
              <strong>${it.productName}</strong>
            </td>
            <td class="text-right font-mono">${fmt(it.unitPrice)}</td>
            <td class="text-center font-bold">${it.quantity}</td>
            <td class="text-center free-badge">${it.freeQuantity || "-"}</td>
            <td class="text-center">${it.unit || "Pcs"}</td>
            <td class="text-right">${it.discountPercent ? `${it.discountPercent}%` : "-"}</td>
            <td class="text-right font-mono font-bold">${fmt(it.total)}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>

    <div class="summary-section">
      <div class="notes-box">
        <h5>Notes & Planning Instructions</h5>
        <p>${estimate.notes || "No special instructions provided. Please review price and confirm order with supplier."}</p>
      </div>
      <table class="totals-table">
        ${grossTotal !== subTotal ? `
          <tr>
            <td class="text-left">Gross Total:</td>
            <td class="text-right font-mono">Rs. ${fmt(grossTotal)}</td>
          </tr>
          <tr>
            <td class="text-left">Line Discounts:</td>
            <td class="text-right font-mono" style="color: #dc2626;">-Rs. ${fmt(lineDiscounts)}</td>
          </tr>
        ` : ""}
        <tr>
          <td class="text-left">Subtotal:</td>
          <td class="text-right font-mono font-bold">Rs. ${fmt(subTotal)}</td>
        </tr>
        ${extraDiscAmt > 0 ? `
          <tr>
            <td class="text-left">Extra Cash Disc (${extraDiscPct}%):</td>
            <td class="text-right font-mono" style="color: #dc2626;">-Rs. ${fmt(extraDiscAmt)}</td>
          </tr>
        ` : ""}
        <tr class="grand-total">
          <td class="text-left">Estimated Total:</td>
          <td class="text-right font-mono">Rs. ${fmt(netTotal)}</td>
        </tr>
      </table>
    </div>

    <div class="footer-sign">
      <div class="sign-box">Prepared By</div>
      <div class="sign-box">Authorized By</div>
    </div>
  </body>
  </html>
  `;
};

// ── Native Browser Print ────────────────────────────────────────────────────
export const printPurchaseEstimate = (estimate: any) => {
  const html = generateEstimateHTML(estimate);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    toast.error("Could not open print document");
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  iframe.contentWindow?.focus();
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 400);
};

// ── PDF Download using jsPDF + html2canvas ──────────────────────────────────
export const downloadPurchaseEstimatePdf = async (estimate: any) => {
  const tid = toast.loading("Generating PDF...");
  const estNo = estimate.estimateNumber || estimate.estimate_number || "EST";
  const filename = `Purchase_Estimate_${estNo}.pdf`;

  const html = generateEstimateHTML(estimate);
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;left:-9999px;top:0;width:794px;height:1123px;border:none;visibility:hidden;";
  document.body.appendChild(iframe);

  try {
    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
      iframe.contentDocument!.open();
      iframe.contentDocument!.write(html);
      iframe.contentDocument!.close();
    });

    await new Promise((r) => setTimeout(r, 400));

    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const body = iframe.contentDocument!.body;
    body.style.margin = "0";

    const canvas = await html2canvas(body, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: 794,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pageW) / canvas.width;

    let yOffset = 0;
    while (yOffset < imgH) {
      if (yOffset > 0) pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, -yOffset, pageW, imgH);
      yOffset += pageH;
    }

    pdf.save(filename);
    toast.success("PDF downloaded successfully!", { id: tid });
  } catch (err: any) {
    console.error("PDF generation failed:", err);
    toast.error("Failed to generate PDF. You can use Print instead.", {
      id: tid,
    });
  } finally {
    document.body.removeChild(iframe);
  }
};
