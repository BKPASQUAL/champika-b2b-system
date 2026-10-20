/**
 * purchase-estimate-print.ts
 * Print, PDF download, clipboard copy, and WhatsApp sharing helpers for Purchase Estimates / Quotations.
 * Pure order planning / quotation feature (No stock increment).
 */

import { toast } from "sonner";

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
    const supplierName =
      estimate.supplierName || estimate.supplier?.name || "Supplier";
    const estNo = estimate.estimateNumber || estimate.estimate_number || "EST";
    const dateStr = formatDate(estimate.estimateDate || estimate.estimate_date);

    if (mode === "whatsapp") {
      const lines = [
        `*PURCHASE ORDER ESTIMATE*`,
        `*C D Pasqual And PW kumari*`,
        `Paranawaththa Road, Wallabada, Boossa | Tel: 0777681663`,
        `Estimate No: ${estNo}`,
        `Supplier: ${supplierName}`,
        `Date: ${dateStr}`,
        `----------------------------------------`,
        ...items.map((it: any, idx: number) => {
          const qty = it.quantity || 0;
          return `${idx + 1}. *${it.productName || it.name}* - Qty: ${qty}`;
        }),
        `----------------------------------------`,
        `Total Items: ${items.length}`,
        `Total Qty: ${items.reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0)} units`,
      ];

      textToCopy = lines.join("\n");
    } else if (mode === "portal_tab") {
      // Tab-separated: Product Name, Qty (Ideal for Excel / Portal paste)
      textToCopy = items
        .map((it: any) => `${it.productName || it.name}\t${it.quantity || 0}`)
        .join("\n");
    } else {
      // Simple Bullet List: Item Name & Qty
      textToCopy = items
        .map((it: any, idx: number) => {
          return `${idx + 1}. ${it.productName || it.name} - Qty: ${it.quantity || 0}`;
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
  const supplierName =
    estimate.supplierName || estimate.supplier?.name || "Supplier";
  const estNo = estimate.estimateNumber || estimate.estimate_number || "EST";
  const dateStr = formatDate(estimate.estimateDate || estimate.estimate_date);
  const totalQty = items.reduce(
    (acc: number, it: any) => acc + (Number(it.quantity) || 0),
    0
  );

  const lines = [
    `*PURCHASE ORDER ESTIMATE*`,
    `*C D Pasqual And PW kumari*`,
    `Paranawaththa Road, Wallabada, Boossa`,
    `Tel: 0777681663`,
    `----------------------------------------`,
    `Estimate No: ${estNo}`,
    `Supplier: ${supplierName}`,
    `Date: ${dateStr}`,
    `----------------------------------------`,
    ...items.map((it: any, idx: number) => {
      return `${idx + 1}. *${it.productName || it.name}* - Qty: ${it.quantity || 0}`;
    }),
    `----------------------------------------`,
    `Total Items: ${items.length}`,
    `Total Quantity: ${totalQty} units`,
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
export const generateEstimateHTML = (
  estimate: any,
  mode: "order_sheet" | "full" = "order_sheet"
): string => {
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

  // ── ORDER SHEET MODE (Item Name & Qty Only, Letterhead, Black Font) ────────
  if (mode === "order_sheet") {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <title>Purchase Order Sheet - ${estNo}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 12mm 12mm 15mm 12mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, Helvetica, sans-serif;
          color: #000000;
          background: #ffffff;
          margin: 0 auto;
          padding: 20px 24px;
          font-size: 11px;
          line-height: 1.35;
          width: 794px;
          max-width: 794px;
        }
        @media print {
          body {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          tr {
            page-break-inside: avoid;
          }
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2.5px solid #000000;
          padding-bottom: 10px;
          margin-bottom: 12px;
        }
        .letterhead-title {
          font-size: 22px;
          font-weight: 900;
          color: #000000;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0 0 4px 0;
          line-height: 1.1;
        }
        .letterhead-address {
          font-size: 12px;
          font-weight: 700;
          color: #000000;
          line-height: 1.4;
        }
        .meta-box {
          text-align: right;
          min-width: 220px;
        }
        .meta-num {
          font-size: 16px;
          font-weight: 900;
          color: #000000;
          font-family: monospace;
          margin-bottom: 2px;
        }
        .meta-row {
          font-size: 11px;
          font-weight: 700;
          color: #000000;
          margin-top: 2px;
        }
        table.items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 12px;
        }
        table.items-table th {
          border: 1.5px solid #000000;
          background: #000000;
          color: #ffffff;
          font-size: 10.5px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 6px 8px;
        }
        table.items-table td {
          border: 1px solid #000000;
          padding: 5px 8px;
          font-size: 11.5px;
          color: #000000;
          background: #ffffff;
        }
        .col-idx {
          width: 8%;
          text-align: center;
          font-weight: 800;
        }
        .col-name {
          width: 74%;
          text-align: left;
          font-weight: 700;
        }
        .col-qty {
          width: 18%;
          text-align: center;
          font-weight: 900;
          font-size: 13px;
        }
        .total-row td {
          border-top: 2px solid #000000;
          border-bottom: 2.5px solid #000000;
          font-size: 12px;
          font-weight: 900;
          padding: 6px 8px;
          background: #ffffff;
        }
        .summary-section {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-top: 6px;
          font-size: 11px;
          font-weight: 700;
        }
        .notes-box {
          border: 1px solid #000000;
          padding: 6px 8px;
          width: 60%;
          min-height: 40px;
          color: #000000;
        }
        .notes-box h5 {
          margin: 0 0 3px 0;
          font-size: 10px;
          text-transform: uppercase;
          font-weight: 800;
          color: #000000;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="letterhead-title">C D Pasqual And PW kumari</div>
          <div class="letterhead-address">
            Paranawaththa Road, Wallabada, Boossa<br/>
            Tel - 0777681663
          </div>
        </div>
        <div class="meta-box">
          <div class="meta-num">${estNo}</div>
          <div class="meta-row"><strong>Date:</strong> ${dateStr}</div>
          ${arrivalDateStr !== "-" ? `<div class="meta-row"><strong>Expected:</strong> ${arrivalDateStr}</div>` : ""}
          ${estimate.referenceNo ? `<div class="meta-row"><strong>Ref #:</strong> ${estimate.referenceNo}</div>` : ""}
        </div>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th class="col-idx">#</th>
            <th class="col-name">Item Name</th>
            <th class="col-qty">Qty</th>
          </tr>
        </thead>
        <tbody>
          ${items.length === 0 ? `
            <tr>
              <td colspan="3" style="text-align: center; padding: 14px; font-weight: 700;">No items in this estimate</td>
            </tr>
          ` : items.map((it: any, idx: number) => `
            <tr>
              <td class="col-idx">${idx + 1}</td>
              <td class="col-name">${it.productName || it.name || "Item"}</td>
              <td class="col-qty">${it.quantity || 0}</td>
            </tr>
          `).join("")}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="2" style="text-align: right; font-weight: 900;">TOTAL QUANTITY:</td>
            <td class="col-qty" style="font-size: 14px; font-weight: 900;">${totalQty}</td>
          </tr>
        </tfoot>
      </table>

      ${estimate.notes ? `
        <div class="summary-section">
          <div class="notes-box">
            <h5>Notes & Planning Instructions</h5>
            <div>${estimate.notes}</div>
          </div>
        </div>
      ` : ""}
    </body>
    </html>
    `;
  }

  // ── FULL PRICING MODE (With Costs, Totals, Letterhead, Black Font) ─────────
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
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, Helvetica, sans-serif;
        color: #000000;
        background: #ffffff;
        margin: 0 auto;
        padding: 20px 24px;
        font-size: 11px;
        line-height: 1.4;
        width: 794px;
        max-width: 794px;
      }
      @media print {
        body {
          width: 100% !important;
          max-width: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        tr {
          page-break-inside: avoid;
        }
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 2.5px solid #000000;
        padding-bottom: 12px;
        margin-bottom: 14px;
      }
      .letterhead-title {
        font-size: 22px;
        font-weight: 900;
        color: #000000;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin: 0 0 4px 0;
        line-height: 1.1;
      }
      .letterhead-address {
        font-size: 12px;
        font-weight: 700;
        color: #000000;
        line-height: 1.4;
      }
      .doc-badge {
        display: inline-block;
        border: 1.5px solid #000000;
        color: #000000;
        padding: 3px 10px;
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 6px;
      }
      .meta-box {
        text-align: right;
      }
      .meta-num {
        font-size: 16px;
        font-weight: 900;
        color: #000000;
        font-family: monospace;
      }
      .meta-row {
        font-size: 11px;
        font-weight: 700;
        color: #000000;
        margin-top: 2px;
      }
      .info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-bottom: 14px;
      }
      .info-card {
        border: 1.5px solid #000000;
        border-radius: 4px;
        padding: 10px 12px;
        background: #ffffff;
      }
      .info-card h4 {
        margin: 0 0 6px 0;
        font-size: 11px;
        text-transform: uppercase;
        color: #000000;
        font-weight: 800;
        letter-spacing: 0.5px;
      }
      .info-card .name {
        font-size: 13px;
        font-weight: 800;
        color: #000000;
      }
      .info-card p {
        margin: 2px 0;
        font-size: 11px;
        font-weight: 600;
        color: #000000;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 14px;
      }
      th {
        border: 1.5px solid #000000;
        background: #000000;
        color: #ffffff;
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        padding: 7px 6px;
      }
      td {
        padding: 6px;
        border: 1px solid #000000;
        font-size: 11px;
        color: #000000;
        background: #ffffff;
      }
      .text-left { text-align: left; }
      .text-center { text-align: center; }
      .text-right { text-align: right; }
      .font-mono { font-family: monospace; }
      .font-bold { font-weight: 700; }
      .font-black { font-weight: 900; }
      .summary-section {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-top: 10px;
      }
      .notes-box {
        width: 55%;
        border: 1.5px solid #000000;
        border-radius: 4px;
        padding: 10px;
        background: #ffffff;
        min-height: 80px;
        color: #000000;
      }
      .notes-box h5 {
        margin: 0 0 4px 0;
        font-size: 10px;
        text-transform: uppercase;
        color: #000000;
        font-weight: 800;
      }
      .totals-table {
        width: 40%;
        border-collapse: collapse;
      }
      .totals-table td {
        padding: 5px 6px;
        font-size: 11px;
        border: 1px solid #000000;
        color: #000000;
      }
      .totals-table tr.grand-total td {
        border-top: 2.5px solid #000000;
        border-bottom: 2.5px solid #000000;
        font-size: 13px;
        font-weight: 900;
        color: #000000;
        padding: 6px;
        background: #ffffff;
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
        border-top: 1.5px solid #000000;
        padding-top: 6px;
        font-size: 11px;
        color: #000000;
        font-weight: 800;
        text-transform: uppercase;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <div class="letterhead-title">C D Pasqual And PW kumari</div>
        <div class="letterhead-address">
          Paranawaththa Road, Wallabada, Boossa<br/>
          Tel - 0777681663
        </div>
      </div>
      <div class="meta-box">
        <div class="meta-num">${estNo}</div>
        <div class="meta-row"><strong>Date:</strong> ${dateStr}</div>
        ${arrivalDateStr !== "-" ? `<div class="meta-row"><strong>Expected:</strong> ${arrivalDateStr}</div>` : ""}
        ${estimate.referenceNo ? `<div class="meta-row"><strong>Ref #:</strong> ${estimate.referenceNo}</div>` : ""}
      </div>
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
        ${totalFree > 0 ? `<p><strong>Total Free Qty:</strong> ${totalFree} units</p>` : ""}
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
            <td class="text-center font-bold font-mono">${idx + 1}</td>
            <td class="text-left font-mono font-bold">${it.sku || "-"}</td>
            <td class="text-left font-bold">
              ${it.productName || it.name}
            </td>
            <td class="text-right font-mono font-bold">${fmt(it.unitPrice)}</td>
            <td class="text-center font-black">${it.quantity}</td>
            <td class="text-center font-bold">${it.freeQuantity || "-"}</td>
            <td class="text-center">${it.unit || "Pcs"}</td>
            <td class="text-right font-bold">${it.discountPercent ? `${it.discountPercent}%` : "-"}</td>
            <td class="text-right font-mono font-black">${fmt(it.total)}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>

    <div class="summary-section">
      <div class="notes-box">
        <h5>Notes & Planning Instructions</h5>
        <p>${estimate.notes || "No special instructions provided."}</p>
      </div>
      <table class="totals-table">
        ${grossTotal !== subTotal ? `
          <tr>
            <td class="text-left font-bold">Gross Total:</td>
            <td class="text-right font-mono font-bold">Rs. ${fmt(grossTotal)}</td>
          </tr>
          <tr>
            <td class="text-left font-bold">Line Discounts:</td>
            <td class="text-right font-mono font-bold">-Rs. ${fmt(lineDiscounts)}</td>
          </tr>
        ` : ""}
        <tr>
          <td class="text-left font-bold">Subtotal:</td>
          <td class="text-right font-mono font-bold">Rs. ${fmt(subTotal)}</td>
        </tr>
        ${extraDiscAmt > 0 ? `
          <tr>
            <td class="text-left font-bold">Extra Cash Disc (${extraDiscPct}%):</td>
            <td class="text-right font-mono font-bold">-Rs. ${fmt(extraDiscAmt)}</td>
          </tr>
        ` : ""}
        <tr class="grand-total">
          <td class="text-left font-black">Estimated Total:</td>
          <td class="text-right font-mono font-black">Rs. ${fmt(netTotal)}</td>
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
export const printPurchaseEstimate = (
  estimate: any,
  mode: "order_sheet" | "full" = "order_sheet"
) => {
  const html = generateEstimateHTML(estimate, mode);
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
export const downloadPurchaseEstimatePdf = async (
  estimate: any,
  mode: "order_sheet" | "full" = "order_sheet"
) => {
  const tid = toast.loading("Generating PDF...");
  const estNo = estimate.estimateNumber || estimate.estimate_number || "EST";
  const filename =
    mode === "order_sheet"
      ? `Order_Sheet_${estNo}.pdf`
      : `Purchase_Estimate_${estNo}.pdf`;

  const html = generateEstimateHTML(estimate, mode);
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

    // Single-page guarantee: If content is within 1 A4 page (or slightly exceeding by up to 25mm due to padding),
    // fit strictly onto 1 single page so it never creates an unwanted second page!
    if (imgH <= pageH + 25) {
      const renderH = imgH > pageH ? pageH : imgH;
      const renderW = imgH > pageH ? (pageH * canvas.width) / canvas.height : pageW;
      const xOffset = imgH > pageH ? (pageW - renderW) / 2 : 0;
      pdf.addImage(imgData, "JPEG", xOffset, 0, renderW, renderH);
    } else {
      let yOffset = 0;
      // Multi-page: do not add a page if the remaining slice is just bottom whitespace (< 15mm)
      while (yOffset < imgH - 15) {
        if (yOffset > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, -yOffset, pageW, imgH);
        yOffset += pageH;
      }
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
