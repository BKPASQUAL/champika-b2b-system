/**
 * quotation-html.ts
 * Pure HTML generation for quotations — works on both server (Node.js) and client.
 * No browser-only imports (no jsPDF, no html2canvas, no toast).
 */
import QRCode from "qrcode";
import { DIVISIONS } from "./invoice-html";

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

export const generateQuotationHTML = async (
  quotation: any,
  divisionKey: keyof typeof DIVISIONS = "retail",
  /** Pass the app's base URL when calling server-side (no window available) */
  baseUrl = "",
  showBranding: boolean = true
): Promise<string> => {
  const cfg = DIVISIONS[divisionKey] ?? DIVISIONS.retail;

  const origin =
    baseUrl ||
    (typeof window !== "undefined" ? window.location.origin : "");

  const quotationUrl = origin
    ? `${origin}/quotation/${quotation._id || quotation.id}`
    : "";

  const shopName     = quotation.customer?.shop     || quotation.shopName     || quotation.customer?.name || "Unknown";
  const customerName = quotation.customer?.name     || quotation.customerName || shopName;
  const address      = quotation.customer?.address  || quotation.address      || "";
  const phone        = quotation.customer?.phone    || quotation.phone        || "";
  const route        = quotation.customer?.route    || quotation.route        || "";
  const salesRep     = quotation.salesRep           || quotation.salesRepName || "-";
  const items        = quotation.items              || [];
  const notes        = (quotation.notes || "").trim();

  const subTotal    = items.reduce((s: number, i: any) => s + (i.total || 0), 0);
  const grandTotal  = quotation.grandTotal || quotation.totalAmount || 0;
  const extraDiscount = Math.max(0, subTotal - grandTotal);

  const ITEMS_PER_PAGE = 17;
  const chunks: any[][] = [];
  for (let i = 0; i < items.length; i += ITEMS_PER_PAGE) {
    chunks.push(items.slice(i, i + ITEMS_PER_PAGE));
  }
  const totalPages = chunks.length;

  const makeTableHeader = () => `
    <table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
      <thead>
        <tr style="border-top:2px solid #1e293b;border-bottom:2px solid #1e293b;background:#f1f5f9;">
          <th style="padding:8px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#1e293b;text-align:center;width:4%;">#</th>
          <th style="padding:8px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#1e293b;text-align:left;width:14%;">Item Code</th>
          <th style="padding:8px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#1e293b;text-align:left;width:29%;">Description</th>
          <th style="padding:8px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#1e293b;text-align:right;width:13%;">Price</th>
          <th style="padding:8px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#1e293b;text-align:center;width:7%;">Qty</th>
          <th style="padding:8px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#1e293b;text-align:center;width:7%;">Unit</th>
          <th style="padding:8px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#1e293b;text-align:center;width:7%;">Free</th>
          <th style="padding:8px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#1e293b;text-align:center;width:7%;">Disc.</th>
          <th style="padding:8px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#1e293b;text-align:right;width:12%;">Total</th>
        </tr>
      </thead>`;

  const pages = chunks.map((chunk, pageIdx) => {
    const isFirst = pageIdx === 0;
    const isLast  = pageIdx === totalPages - 1;
    const pageNo  = pageIdx + 1;
    const globalStart = pageIdx * ITEMS_PER_PAGE;

    const quotationNoDisplay = totalPages > 1
      ? `${quotation.quotationNo || "-"} (${pageNo}/${totalPages})`
      : quotation.quotationNo || "-";

    const chunkRows = chunk
      .map((item: any, idx: number) => {
        const globalIdx = globalStart + idx;
        const rowBg = globalIdx % 2 === 1 ? "background:#fafafa;" : "";
        return `
        <tr style="${globalIdx < items.length - 1 ? "border-bottom:1px solid #e2e8f0;" : ""}${rowBg}">
          <td style="padding:7px 8px;font-size:12px;color:#64748b;text-align:center;vertical-align:middle;">${globalIdx + 1}</td>
          <td style="padding:7px 8px;font-size:12px;color:#475569;font-family:monospace;vertical-align:middle;">${item.sku || "-"}</td>
          <td style="padding:7px 8px;font-size:12px;color:#0f172a;font-weight:600;vertical-align:middle;">${item.productName || item.name || "-"}</td>
          <td style="padding:7px 8px;font-size:12px;color:#0f172a;text-align:right;white-space:nowrap;vertical-align:middle;">LKR ${fmt(item.unitPrice || item.price)}</td>
          <td style="padding:7px 8px;font-size:12px;font-weight:700;color:#0f172a;text-align:center;vertical-align:middle;">${item.quantity}</td>
          <td style="padding:7px 8px;font-size:12px;color:#475569;text-align:center;vertical-align:middle;">${item.unit || "Pcs"}</td>
          <td style="padding:7px 8px;font-size:12px;text-align:center;color:#047857;font-weight:600;vertical-align:middle;">${(item.freeQuantity || item.free || 0) > 0 ? "+" + (item.freeQuantity || item.free) : "-"}</td>
          <td style="padding:7px 8px;font-size:12px;text-align:center;color:#64748b;vertical-align:middle;">${item.discountPercent > 0 ? "-" + item.discountPercent + "%" : "-"}</td>
          <td style="padding:7px 8px;font-size:12px;font-weight:700;color:#0f172a;text-align:right;white-space:nowrap;vertical-align:middle;">LKR ${fmt(item.total)}</td>
        </tr>`;
      })
      .join("");

    const brandedHeader = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:0;">
      <tr>
        <td style="vertical-align:top;width:58%;">
          <div style="font-size:32px;font-weight:900;color:#0f172a;letter-spacing:-0.5px;line-height:1.1;text-transform:uppercase;">CHAMPIKA HARDWARE</div>
          <div style="font-size:10px;color:#475569;margin-top:3px;line-height:1.5;font-weight:500;">
            ${cfg.division} &bull; ${cfg.address}<br>Tel: ${cfg.tel}
          </div>
        </td>
        <td style="vertical-align:top;text-align:right;width:42%;">
          <table style="margin-left:auto;border-collapse:collapse;">
            <tr>
              ${isFirst ? `
              <td style="vertical-align:top;padding-top:4px;padding-right:12px;">
                <div style="display:inline-flex;align-items:center;border:2px solid #0f172a;border-radius:8px;padding:6px 10px;background:#fff;">
                  <div style="position:relative;display:flex;align-items:center;justify-content:center;width:40px;height:40px;margin-right:10px;">
                    <svg viewBox="0 0 100 100" style="width:100%;height:100%;position:absolute;">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="#0f172a" stroke-width="2.5" stroke-dasharray="6 3" />
                      <circle cx="50" cy="8" r="3.5" fill="#0f172a" />
                    </svg>
                    <span style="font-size:19px;font-weight:900;color:#0f172a;">26</span>
                  </div>
                  <div style="text-align:left;border-left:1.5px solid #0f172a;padding-left:10px;line-height:1.25;">
                    <div style="font-size:10px;font-weight:800;letter-spacing:1.5px;color:#0f172a;text-transform:uppercase;">YEARS OF</div>
                    <div style="font-size:9px;font-weight:800;letter-spacing:1.5px;color:#0f172a;text-transform:uppercase;margin-top:-2px;">EXCELLENCE</div>
                    <div style="font-size:8px;color:#64748b;font-weight:700;letter-spacing:0.5px;margin-top:1px;">SINCE 2000</div>
                  </div>
                </div>
              </td>` : ""}
              <td style="vertical-align:top;text-align:right;">
                <div style="font-size:12px;font-weight:800;color:#047857;letter-spacing:1px;text-transform:uppercase;">QUOTATION</div>
                <div style="font-size:18px;font-weight:800;color:#0f172a;letter-spacing:0.5px;margin-top:2px;">${quotationNoDisplay}</div>
                <div style="font-size:11px;color:#475569;margin-top:3px;line-height:1.5;">
                  Date: ${formatDate(quotation.date || quotation.createdAt)}<br>Sales Rep: ${salesRep}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;

    const unbrandedHeader = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:0;">
      <tr>
        <td style="vertical-align:top;width:60%;">
          <div style="font-size:26px;font-weight:900;color:#0f172a;letter-spacing:1px;text-transform:uppercase;">QUOTATION</div>
        </td>
        <td style="vertical-align:top;text-align:right;width:40%;">
          <div style="font-size:18px;font-weight:800;color:#0f172a;letter-spacing:0.5px;">${quotationNoDisplay}</div>
          <div style="font-size:11px;color:#475569;margin-top:3px;line-height:1.5;">
            Date: ${formatDate(quotation.date || quotation.createdAt)}<br>Sales Rep: ${salesRep}
          </div>
        </td>
      </tr>
    </table>`;

    return `
  <div class="invoice-page" style="page-break-after:always;width:100%;min-height:277mm;padding:12px 20px 20px;background:#fff;font-family:${FONT_STACK};color:#0f172a;box-sizing:border-box;display:flex;flex-direction:column;">

    ${showBranding ? brandedHeader : unbrandedHeader}

    <div style="border-top:1.5px solid #cbd5e1;margin:10px 0 12px;"></div>

    ${isFirst ? `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px;margin-bottom:12px;">
      <div style="font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:2px;">Quotation For:</div>
      <div style="font-size:14px;font-weight:700;color:#0f172a;">${shopName}</div>
      ${customerName && customerName !== shopName ? `<div style="font-size:12px;color:#475569;margin-top:1px;">${customerName}</div>` : ""}
      ${address ? `<div style="font-size:11px;color:#475569;margin-top:1px;">${address}${route ? ", " + route : ""}</div>` : ""}
      ${phone ? `<div style="font-size:11px;color:#475569;margin-top:1px;">Tel: ${phone}</div>` : ""}
    </div>` : `
    <div style="margin-bottom:8px;padding:4px 0;">
      <div style="font-size:12px;font-weight:600;color:#0f172a;">${shopName}${customerName && customerName !== shopName ? ` &mdash; ${customerName}` : ""}</div>
    </div>`}

    ${makeTableHeader()}
      <tbody>${chunkRows}</tbody>
    </table>

    ${isLast ? `
    <table style="width:100%;border-collapse:collapse;margin-bottom:10px;margin-top:6px;">
      <tr>
        <td style="width:55%;vertical-align:top;">
          ${notes ? `
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px;font-size:11px;color:#475569;line-height:1.5;">
            <strong style="color:#0f172a;">Notes / Terms:</strong><br>${notes}
          </div>` : ""}
        </td>
        <td style="width:45%;vertical-align:top;padding-left:16px;">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:4px 0;font-size:12px;color:#475569;">Subtotal</td>
                <td style="padding:4px 0;font-size:12px;color:#0f172a;font-weight:600;text-align:right;white-space:nowrap;">LKR ${fmt(subTotal)}</td>
              </tr>
              ${extraDiscount > 1 ? `<tr>
                <td style="padding:4px 0;font-size:12px;color:#dc2626;">Extra Discount</td>
                <td style="padding:4px 0;font-size:12px;color:#dc2626;font-weight:600;text-align:right;white-space:nowrap;">- LKR ${fmt(extraDiscount)}</td>
              </tr>` : ""}
              <tr>
                <td colSpan="2" style="padding:4px 0 0;border-top:1.5px solid #cbd5e1;"></td>
              </tr>
              <tr>
                <td style="padding:4px 0;font-size:13px;font-weight:700;color:#0f172a;">Net Total</td>
                <td style="padding:4px 0;font-size:16px;font-weight:900;color:#0f172a;text-align:right;white-space:nowrap;">LKR ${fmt(grandTotal)}</td>
              </tr>
            </table>
          </div>
        </td>
      </tr>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-top:36px;margin-bottom:8px;">
      <tr>
        <td style="width:55%;"></td>
        <td style="width:45%;text-align:center;padding-top:6px;border-top:1.5px solid #64748b;">
          <div style="font-size:11px;color:#334155;font-weight:600;margin-top:3px;">Authorised Signature</div>
        </td>
      </tr>
    </table>` : `
    <div style="margin-top:12px;text-align:right;font-size:11px;color:#64748b;font-style:italic;">
      Continued on next page (${pageNo}/${totalPages})…
    </div>`}

    <div style="flex:1;"></div>

    <div style="border-top:1px solid #e2e8f0;padding-top:8px;text-align:center;font-size:10px;color:#64748b;">
      ${showBranding
        ? "This is a system generated quotation. Valid for 7 days from date of issue."
        : "Quotation valid for 7 days from date of issue."}
    </div>
  </div>`;
  }).join("");

  return pages;
};

// A5 / Half-page view wrapper for printing
export const generateHalfPageQuotationHTML = async (
  quotation: any,
  divisionKey: keyof typeof DIVISIONS = "retail",
  baseUrl = "",
  showBranding: boolean = true
): Promise<string> => {
  const cfg = DIVISIONS[divisionKey] ?? DIVISIONS.retail;

  const shopName     = quotation.customer?.shop     || quotation.shopName     || quotation.customer?.name || "Unknown";
  const customerName = quotation.customer?.name     || quotation.customerName || shopName;
  const address      = quotation.customer?.address  || quotation.address      || "";
  const phone        = quotation.customer?.phone    || quotation.phone        || "";
  const route        = quotation.customer?.route    || quotation.route        || "";
  const salesRep     = quotation.salesRep           || quotation.salesRepName || "-";
  const items        = quotation.items              || [];
  const notes        = (quotation.notes || "").trim();

  const subTotal      = items.reduce((s: number, i: any) => s + (i.total || 0), 0);
  const grandTotal    = quotation.grandTotal || quotation.totalAmount || 0;
  const extraDiscount = Math.max(0, subTotal - grandTotal);

  const ITEMS_PER_HALF = 8;
  const chunks: any[][] = [];
  for (let i = 0; i < items.length; i += ITEMS_PER_HALF) {
    chunks.push(items.slice(i, i + ITEMS_PER_HALF));
  }
  const totalPages = chunks.length;

  const makeTableHeader = () => `
    <table style="width:100%;border-collapse:collapse;margin-bottom:4px;">
      <thead>
        <tr style="border-top:2px solid #1e293b;border-bottom:2px solid #1e293b;background:#f1f5f9;">
          <th style="padding:5px 5px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#1e293b;text-align:center;width:4%;">#</th>
          <th style="padding:5px 5px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#1e293b;text-align:left;width:14%;">Item Code</th>
          <th style="padding:5px 5px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#1e293b;text-align:left;width:29%;">Description</th>
          <th style="padding:5px 5px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#1e293b;text-align:right;width:13%;">Price</th>
          <th style="padding:5px 5px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#1e293b;text-align:center;width:7%;">Qty</th>
          <th style="padding:5px 5px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#1e293b;text-align:center;width:7%;">Unit</th>
          <th style="padding:5px 5px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#1e293b;text-align:center;width:7%;">Free</th>
          <th style="padding:5px 5px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#1e293b;text-align:center;width:7%;">Disc.</th>
          <th style="padding:5px 5px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#1e293b;text-align:right;width:12%;">Total</th>
        </tr>
      </thead>`;

  const sheets = chunks.map((chunk, pageIdx) => {
    const isFirst = pageIdx === 0;
    const isLast  = pageIdx === totalPages - 1;
    const pageNo  = pageIdx + 1;
    const globalStart = pageIdx * ITEMS_PER_HALF;

    const quotationNoDisplay = totalPages > 1
      ? `${quotation.quotationNo || "-"} (${pageNo}/${totalPages})`
      : quotation.quotationNo || "-";

    const chunkRows = chunk.map((item: any, idx: number) => {
      const gi = globalStart + idx;
      const rowBg = gi % 2 === 1 ? "background:#fafafa;" : "";
      return `
        <tr style="${gi < items.length - 1 ? "border-bottom:1px solid #e2e8f0;" : ""}${rowBg}">
          <td style="padding:4px 5px;font-size:11px;color:#64748b;text-align:center;vertical-align:middle;">${gi + 1}</td>
          <td style="padding:4px 5px;font-size:11px;color:#475569;font-family:monospace;vertical-align:middle;">${item.sku || "-"}</td>
          <td style="padding:4px 5px;font-size:11px;color:#0f172a;font-weight:600;vertical-align:middle;">${item.productName || item.name || "-"}</td>
          <td style="padding:4px 5px;font-size:11px;color:#0f172a;text-align:right;white-space:nowrap;vertical-align:middle;">LKR ${fmt(item.unitPrice || item.price)}</td>
          <td style="padding:4px 5px;font-size:11px;font-weight:700;color:#0f172a;text-align:center;vertical-align:middle;">${item.quantity}</td>
          <td style="padding:4px 5px;font-size:11px;color:#475569;text-align:center;vertical-align:middle;">${item.unit || "Pcs"}</td>
          <td style="padding:4px 5px;font-size:11px;text-align:center;color:#047857;font-weight:600;vertical-align:middle;">${(item.freeQuantity || item.free || 0) > 0 ? "+" + (item.freeQuantity || item.free) : "-"}</td>
          <td style="padding:4px 5px;font-size:11px;text-align:center;color:#64748b;vertical-align:middle;">${item.discountPercent > 0 ? "-" + item.discountPercent + "%" : "-"}</td>
          <td style="padding:4px 5px;font-size:11px;font-weight:700;color:#0f172a;text-align:right;white-space:nowrap;vertical-align:middle;">LKR ${fmt(item.total)}</td>
        </tr>`;
    }).join("");

    const brandedHeader = `
  <table style="width:100%;border-collapse:collapse;margin-bottom:0;">
    <tr>
      <td style="vertical-align:middle;width:42%;">
        <div style="font-size:20px;font-weight:900;color:#0f172a;letter-spacing:-0.3px;line-height:1.1;text-transform:uppercase;">CHAMPIKA HARDWARE</div>
        <div style="font-size:8px;color:#475569;margin-top:2px;line-height:1.4;">
          ${cfg.division} &bull; ${cfg.address}<br>Tel: ${cfg.tel}
        </div>
      </td>
      <td style="width:16%;"></td>
      <td style="vertical-align:top;text-align:right;width:42%;">
        <table style="margin-left:auto;border-collapse:collapse;">
          <tr>
            ${isFirst ? `
            <td style="vertical-align:top;padding-top:4px;padding-right:10px;">
              <div style="display:inline-flex;align-items:center;border:1.5px solid #0f172a;border-radius:6px;padding:3px 6px;background:#fff;">
                <div style="position:relative;display:flex;align-items:center;justify-content:center;width:28px;height:28px;margin-right:6px;">
                  <svg viewBox="0 0 100 100" style="width:100%;height:100%;position:absolute;">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#0f172a" stroke-width="2.5" stroke-dasharray="6 3" />
                    <circle cx="50" cy="8" r="3.5" fill="#0f172a" />
                  </svg>
                  <span style="font-size:14px;font-weight:900;color:#0f172a;">26</span>
                </div>
                <div style="text-align:left;border-left:1px solid #0f172a;padding-left:6px;line-height:1.2;">
                  <div style="font-size:8px;font-weight:800;letter-spacing:1px;color:#0f172a;text-transform:uppercase;">YEARS OF</div>
                  <div style="font-size:7px;font-weight:800;letter-spacing:1px;color:#0f172a;text-transform:uppercase;margin-top:-2px;">EXCELLENCE</div>
                </div>
              </div>
            </td>` : ""}
            <td style="vertical-align:top;text-align:right;">
              <div style="font-size:10px;font-weight:800;color:#047857;letter-spacing:0.8px;text-transform:uppercase;">QUOTATION</div>
              <div style="font-size:14px;font-weight:800;color:#0f172a;">${quotationNoDisplay}</div>
              <div style="font-size:9px;color:#475569;margin-top:1px;line-height:1.4;">
                Date: ${formatDate(quotation.date || quotation.createdAt)}<br>Sales Rep: ${salesRep}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;

    const unbrandedHeader = `
  <table style="width:100%;border-collapse:collapse;margin-bottom:0;">
    <tr>
      <td style="vertical-align:top;width:55%;">
        <div style="font-size:20px;font-weight:900;color:#0f172a;letter-spacing:0.8px;text-transform:uppercase;">QUOTATION</div>
      </td>
      <td style="vertical-align:top;text-align:right;width:45%;">
        <div style="font-size:14px;font-weight:800;color:#0f172a;">${quotationNoDisplay}</div>
        <div style="font-size:9px;color:#475569;margin-top:1px;line-height:1.4;">
          Date: ${formatDate(quotation.date || quotation.createdAt)}<br>Sales Rep: ${salesRep}
        </div>
      </td>
    </tr>
  </table>`;

    const halfContent = `
<div class="half-invoice" style="width:100%;height:138mm;padding:10px 18px 8px 14px;background:#fff;font-family:${FONT_STACK};color:#0f172a;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;">

  ${showBranding ? brandedHeader : unbrandedHeader}

  <div style="border-top:1.5px solid #cbd5e1;margin:5px 0 6px;"></div>

  ${isFirst ? `
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;padding:6px 10px;margin-bottom:6px;">
    <div style="font-size:8.5px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:1px;">Quotation For:</div>
    <div style="font-size:12px;font-weight:700;color:#0f172a;">${shopName}</div>
    ${customerName && customerName !== shopName ? `<div style="font-size:10px;color:#475569;">${customerName}</div>` : ""}
    ${address ? `<div style="font-size:10px;color:#475569;">${address}${route ? ", " + route : ""}</div>` : ""}
    ${phone ? `<div style="font-size:10px;color:#475569;">Tel: ${phone}</div>` : ""}
  </div>` : `
  <div style="margin-bottom:4px;">
    <div style="font-size:11px;font-weight:600;color:#0f172a;">${shopName}${customerName && customerName !== shopName ? ` &mdash; ${customerName}` : ""}</div>
  </div>`}

  ${makeTableHeader()}
      <tbody>${chunkRows}</tbody>
    </table>

  ${isLast ? `
  <table style="width:100%;border-collapse:collapse;margin-top:4px;margin-bottom:4px;">
    <tr>
      <td style="width:55%;vertical-align:top;">
        ${notes ? `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;padding:5px 8px;font-size:9.5px;color:#475569;line-height:1.4;">
          <strong style="color:#0f172a;">Notes:</strong> ${notes}
        </div>` : ""}
      </td>
      <td style="width:45%;vertical-align:top;padding-left:10px;">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;padding:6px 10px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:2px 0;font-size:10.5px;color:#475569;">Subtotal</td>
              <td style="padding:2px 0;font-size:10.5px;color:#0f172a;font-weight:600;text-align:right;white-space:nowrap;">LKR ${fmt(subTotal)}</td>
            </tr>
            ${extraDiscount > 1 ? `<tr>
              <td style="padding:2px 0;font-size:10.5px;color:#dc2626;">Extra Discount</td>
              <td style="padding:2px 0;font-size:10.5px;color:#dc2626;font-weight:600;text-align:right;white-space:nowrap;">- LKR ${fmt(extraDiscount)}</td>
            </tr>` : ""}
            <tr>
              <td colSpan="2" style="padding:2px 0 0;border-top:1.5px solid #cbd5e1;"></td>
            </tr>
            <tr>
              <td style="padding:2px 0;font-size:11.5px;font-weight:700;color:#0f172a;">Net Total</td>
              <td style="padding:2px 0;font-size:13.5px;font-weight:900;color:#0f172a;text-align:right;white-space:nowrap;">LKR ${fmt(grandTotal)}</td>
            </tr>
          </table>
        </div>
      </td>
    </tr>
  </table>

  <table style="width:100%;border-collapse:collapse;margin-top:16px;margin-bottom:4px;">
    <tr>
      <td style="width:55%;"></td>
      <td style="width:45%;text-align:center;padding-top:5px;border-top:1.5px solid #64748b;">
        <div style="font-size:10px;color:#334155;font-weight:600;margin-top:2px;">Authorised Signature</div>
      </td>
    </tr>
  </table>` : `
  <div style="margin-top:8px;text-align:right;font-size:10px;color:#64748b;font-style:italic;">
    Continued on next page (${pageNo}/${totalPages})…
  </div>`}

  <div style="flex:1;"></div>

  <div style="border-top:1px solid #e2e8f0;padding-top:5px;text-align:center;font-size:9.5px;color:#64748b;">
    ${showBranding
      ? "This is a system generated quotation. Valid for 7 days."
      : "Quotation valid for 7 days."}
  </div>
</div>`;

    return `
<div class="a4-sheet" style="page-break-after:always;width:210mm;height:297mm;background:#fff;box-sizing:border-box;">
  ${halfContent}
</div>`;
  });

  return sheets.join("");
};
