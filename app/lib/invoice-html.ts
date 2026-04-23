/**
 * invoice-html.ts
 * Pure HTML generation for invoices — works on both server (Node.js) and client.
 * No browser-only imports (no jsPDF, no html2canvas, no toast).
 */
import QRCode from "qrcode";

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, Helvetica, sans-serif";

const fmt = (amount: number) =>
  new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);

const formatDate = (dateString: string) => {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export interface DivisionConfig {
  division: string;
  address: string;
  tel: string;
}

export const DIVISIONS: Record<string, DivisionConfig> = {
  distribution: { division: "Distribution Division", address: "Pranawatta Road, Wallabada, Boossa", tel: "0777681663" },
  retail:       { division: "Retail Division",        address: "Pranawatta Road, Wallabada, Boossa", tel: "077-3151561" },
  orange:       { division: "Orange Agency",          address: "Pranawatta Road, Wallabada, Boossa", tel: "0777681663" },
  sierra:       { division: "Sierra Division",        address: "Pranawatta Road, Wallabada, Boossa", tel: "0777681663" },
  wireman:      { division: "Wireman Division",       address: "Pranawatta Road, Wallabada, Boossa", tel: "0777681663" },
  admin:        { division: "Head Office",            address: "Pranawatta Road, Wallabada, Boossa", tel: "0777681663" },
};

export const generateInvoiceHTML = async (
  invoice: any,
  divisionKey: keyof typeof DIVISIONS = "distribution",
  /** Pass the app's base URL when calling server-side (no window available) */
  baseUrl = ""
): Promise<string> => {
  const cfg = DIVISIONS[divisionKey] ?? DIVISIONS.distribution;

  const origin =
    baseUrl ||
    (typeof window !== "undefined" ? window.location.origin : "");

  const invoiceUrl = origin
    ? `${origin}/invoice/${invoice._id || invoice.id}`
    : "";

  const qrDataUrl = invoiceUrl
    ? await QRCode.toDataURL(invoiceUrl, { width: 80, margin: 1 })
    : "";

  const shopName     = invoice.customer?.shop     || invoice.shopName     || invoice.customer?.name || "Unknown";
  const customerName = invoice.customer?.name     || invoice.customerName || shopName;
  const address      = invoice.customer?.address  || invoice.address      || "";
  const phone        = invoice.customer?.phone    || invoice.phone        || "";
  const route        = invoice.customer?.route    || invoice.route        || "";
  const salesRep     = invoice.salesRep           || invoice.salesRepName || "-";
  const items        = invoice.items              || [];
  // Strip auto-generated internal note so it never appears on printed invoices
  const notes        = (invoice.notes || "").replace(/created via rep portal/gi, "").trim();

  const subTotal    = items.reduce((s: number, i: any) => s + (i.total || 0), 0);
  const grandTotal  = invoice.grandTotal || invoice.totalAmount || 0;
  const extraDiscount = Math.max(0, subTotal - grandTotal);


  const rows = items
    .map((item: any, idx: number) => `
    <tr style="${idx < items.length - 1 ? "border-bottom:1px solid #e8e8e8;" : ""}">
      <td style="padding:7px 8px;font-size:11px;color:#777;text-align:center;vertical-align:middle;">${idx + 1}</td>
      <td style="padding:7px 8px;font-size:11px;color:#555;vertical-align:middle;">${item.sku || "-"}</td>
      <td style="padding:7px 8px;font-size:11px;color:#111;font-weight:600;vertical-align:middle;">${item.productName || item.name || "-"}</td>
      <td style="padding:7px 8px;font-size:11px;color:#111;text-align:right;white-space:nowrap;vertical-align:middle;">LKR ${fmt(item.unitPrice || item.price)}</td>
      <td style="padding:7px 8px;font-size:11px;font-weight:700;color:#111;text-align:center;vertical-align:middle;">${item.quantity}</td>
      <td style="padding:7px 8px;font-size:11px;color:#555;text-align:center;vertical-align:middle;">${item.unit || "Pcs"}</td>
      <td style="padding:7px 8px;font-size:11px;text-align:center;color:#111;vertical-align:middle;">${(item.freeQuantity || item.free || 0) > 0 ? (item.freeQuantity || item.free) : "-"}</td>
      <td style="padding:7px 8px;font-size:11px;text-align:center;color:#777;vertical-align:middle;">${item.discountPercent > 0 ? "-" + item.discountPercent + "%" : "-"}</td>
      <td style="padding:7px 8px;font-size:11px;font-weight:700;color:#111;text-align:right;white-space:nowrap;vertical-align:middle;">LKR ${fmt(item.total)}</td>
    </tr>`)
    .join("");

  return `
  <div class="invoice-page" style="page-break-after:always;width:100%;min-height:277mm;padding:28px 32px 36px;background:#fff;font-family:${FONT_STACK};color:#111;box-sizing:border-box;display:flex;flex-direction:column;">

    <table style="width:100%;border-collapse:collapse;margin-bottom:0;">
      <tr>
        <td style="vertical-align:top;width:60%;">
          <div style="font-size:24px;font-weight:800;color:#000;letter-spacing:-0.3px;line-height:1.1;">CHAMPIKA HARDWARE</div>
          <div style="font-size:10px;color:#333;margin-top:2px;line-height:1.5;">
            ${cfg.division}<br>${cfg.address}<br>Tel: ${cfg.tel}
          </div>
        </td>
        <td style="vertical-align:top;text-align:right;width:40%;">
          <table style="margin-left:auto;border-collapse:collapse;">
            <tr>
              ${qrDataUrl ? `<td style="vertical-align:top;padding-right:10px;"><img src="${qrDataUrl}" style="width:70px;height:70px;display:block;" /></td>` : ""}
              <td style="vertical-align:top;text-align:right;">
                <div style="font-size:18px;font-weight:700;color:#000;letter-spacing:0.5px;">${invoice.invoiceNo || "-"}</div>
                <div style="font-size:11px;color:#333;margin-top:2px;line-height:1.5;">
                  ${formatDate(invoice.date || invoice.createdAt)}<br>${salesRep}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <div style="border-top:1.5px solid #bbb;margin:10px 0 12px;"></div>

    <div style="margin-bottom:12px;">
      <div style="font-size:13px;font-weight:700;color:#000;">${shopName}</div>
      ${customerName !== shopName ? `<div style="font-size:12px;color:#333;">${customerName}</div>` : ""}
      ${address ? `<div style="font-size:12px;color:#333;">${address}${route ? ", " + route : ""}</div>` : ""}
      ${phone ? `<div style="font-size:12px;color:#333;">${phone}</div>` : ""}
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
      <thead>
        <tr style="border-top:2px solid #000;border-bottom:2px solid #000;background:#f0f0f0;">
          <th style="padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:center;width:4%;">#</th>
          <th style="padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:left;width:14%;">Item Code</th>
          <th style="padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:left;width:29%;">Description</th>
          <th style="padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:right;width:13%;">Price</th>
          <th style="padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:center;width:7%;">Qty</th>
          <th style="padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:center;width:7%;">Unit</th>
          <th style="padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:center;width:7%;">Free</th>
          <th style="padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:center;width:7%;">Disc.</th>
          <th style="padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:right;width:12%;">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

<table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
      <tr>
        <td style="width:55%;">
          ${notes ? `<div style="font-size:11px;color:#555;line-height:1.5;">${notes}</div>` : ""}
        </td>
        <td style="width:45%;vertical-align:top;padding-left:16px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:5px 0;font-size:12px;color:#333;">Subtotal</td>
              <td style="padding:5px 0;font-size:12px;color:#000;text-align:right;white-space:nowrap;">LKR ${fmt(subTotal)}</td>
            </tr>
            ${extraDiscount > 1 ? `<tr>
              <td style="padding:5px 0;font-size:12px;color:#333;">Extra Discount</td>
              <td style="padding:5px 0;font-size:12px;color:#000;text-align:right;white-space:nowrap;">- LKR ${fmt(extraDiscount)}</td>
            </tr>` : ""}
            <tr>
              <td style="padding:6px 0 0;border-top:1.5px solid #bbb;"></td>
              <td style="border-top:1.5px solid #bbb;"></td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-size:13px;font-weight:700;color:#000;">Net Total</td>
              <td style="padding:4px 0;font-size:15px;font-weight:800;color:#000;text-align:right;white-space:nowrap;">LKR ${fmt(grandTotal)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-top:40px;margin-bottom:8px;">
      <tr>
        <td style="width:55%;"></td>
        <td style="width:45%;text-align:center;padding-top:6px;border-top:1.5px solid #555;">
          <div style="font-size:11px;color:#333;font-weight:600;margin-top:3px;">Customer Signature &amp; Stamp</div>
        </td>
      </tr>
    </table>

    <div style="flex:1;"></div>

    <div style="border-top:1px solid #ddd;padding-top:8px;text-align:center;font-size:11px;color:#777;">
      Thank you for your business!
    </div>
  </div>`;
};

export const getDocumentWrapper = (content: string, title: string) => `
  <!DOCTYPE html>
  <html>
  <head>
    <title>${title}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: ${FONT_STACK}; margin: 0; padding: 0; background: #fff; width: 794px; }
      @media print {
        @page { size: A4 portrait; margin: 0; }
        html, body { width: 210mm; margin: 0; padding: 0; }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .invoice-page { page-break-after: always; width: 210mm !important; padding: 5mm 8mm !important; }
        .invoice-page:last-child { page-break-after: auto; }
      }
    </style>
  </head>
  <body>${content}</body>
  </html>`;
