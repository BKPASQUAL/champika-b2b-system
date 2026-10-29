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

// Every original bill number on a return note: from each item's billRef and every [INV:x] tag in the notes
const getBillRefs = (items: any[], rawNotes: string): string[] => [
  ...new Set(
    [
      ...items.map((it: any) => it?.billRef),
      ...[...(rawNotes || "").matchAll(/\[INV:([^\]]+)\]/g)].map((m) => m[1]),
    ]
      .map((b: any) => String(b || "").trim())
      .filter((b: string) => b && b !== "-")
  ),
];

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
  const rawNotes     = (invoice.notes || "").replace(/created via rep portal/gi, "").trim();

  let paymentMethod = invoice.paymentMethod || "";
  let cashDiscountPercent = invoice.cashDiscountPercent || 0;
  let cashDiscountAmount = invoice.cashDiscountAmount || 0;

  if (!paymentMethod && rawNotes) {
    const pmMatch = rawNotes.match(/\[PAYMENT_METHOD:([^\]]+)\]/);
    if (pmMatch) paymentMethod = pmMatch[1];
  }
  if (!cashDiscountPercent && rawNotes) {
    const cdpMatch = rawNotes.match(/\[CASH_DISCOUNT_PERCENT:([\d.]+)\]/);
    if (cdpMatch) cashDiscountPercent = parseFloat(cdpMatch[1]);
  }
  if (!cashDiscountAmount && rawNotes) {
    const cdaMatch = rawNotes.match(/\[CASH_DISCOUNT_AMOUNT:([\d.]+)\]/);
    if (cdaMatch) cashDiscountAmount = parseFloat(cdaMatch[1]);
  }

  const notes = rawNotes
    .replace(/\[PAYMENT_METHOD:[^\]]+\]/g, "")
    .replace(/\[CASH_DISCOUNT_PERCENT:[\d.]+\]/g, "")
    .replace(/\[CASH_DISCOUNT_AMOUNT:[\d.]+\]/g, "")
    .trim();

  const returnsTotal = Number(invoice.returnsTotal || invoice.totalRefunded || 0);
  const subTotal    = items.reduce((s: number, i: any) => s + (i.total || 0), 0);
  const grandTotal  = invoice.grandTotal || invoice.totalAmount || 0;
  const extraDiscount = Math.max(0, subTotal - grandTotal - cashDiscountAmount - returnsTotal);

  // Detect Return Note documents
  const isReturnNote = Boolean(
    invoice.invoiceNo?.startsWith("RET-") ||
    invoice.orderId?.startsWith("RET-") ||
    invoice.invoiceNo?.startsWith("RGN-") ||
    invoice.orderId?.startsWith("RGN-") ||
    invoice.invoiceNo?.startsWith("EXC-") ||
    invoice.orderId?.startsWith("EXC-") ||
    rawNotes?.includes("[RETURN_NOTE:") ||
    rawNotes?.includes("[DAMAGE_EXCHANGE:") ||
    rawNotes?.includes("[RETURN_GOOD:") ||
    rawNotes?.includes("[DAMAGE_RETURN:") ||
    rawNotes?.toLowerCase().includes("good return note") ||
    rawNotes?.toLowerCase().includes("damage return note") ||
    rawNotes?.toLowerCase().includes("customer return")
  );

  let returnTypeTitle = "GOOD RETURN NOTE";
  let returnBadgeBg = "#f0fdf4";
  let returnBadgeColor = "#15803d";
  let returnBadgeBorder = "#86efac";

  if (rawNotes?.includes("[DAMAGE_EXCHANGE:") || rawNotes?.toLowerCase().includes("exchange")) {
    returnTypeTitle = "EXCHANGE RETURN NOTE";
    returnBadgeBg = "#f0f9ff";
    returnBadgeColor = "#0369a1";
    returnBadgeBorder = "#7dd3fc";
  } else if (rawNotes?.includes("[DAMAGE_RETURN:") || rawNotes?.toLowerCase().includes("damage return")) {
    returnTypeTitle = "DAMAGE RETURN NOTE";
    returnBadgeBg = "#fef2f2";
    returnBadgeColor = "#b91c1c";
    returnBadgeBorder = "#fca5a5";
  }

  // Extract original invoice reference if present in notes
  // A return note can hold items from several bills: collect every bill number
  let originalInvoiceNo: string | null = null;
  const billRefs = getBillRefs(items, rawNotes);
  const multiBill = billRefs.length > 1;
  if (billRefs.length > 0) {
    originalInvoiceNo = billRefs.join(", ");
  } else {
    const bracketMatch = rawNotes.match(/\[([A-Z]{2,4}-[\d]+)\]/);
    if (bracketMatch) originalInvoiceNo = bracketMatch[1];
  }

  // Extract unit price if present in notes
  const priceMatch = rawNotes.match(/\[PRICE:([\d.]+)\]/);
  const noteExtractedPrice = priceMatch ? parseFloat(priceMatch[1]) : 0;

  // Clean notes for presentation
  const cleanReturnNotes = notes
    .replace(/\[RETURN_NOTE:[^\]]+\]/gi, "")
    .replace(/\[DAMAGE_EXCHANGE:[^\]]+\]/gi, "")
    .replace(/\[RETURN_GOOD:[^\]]+\]/gi, "")
    .replace(/\[DAMAGE_RETURN:[^\]]+\]/gi, "")
    .replace(/\[INV:[^\]]+\]/gi, "")
    .replace(/\[PRICE:[\d.]+\]/gi, "")
    .replace(/\[NOTE:[^\]]+\]/gi, "")
    .replace(/\[RETURN_ITEM:[^\]]+\]/gi, "")
    .replace(/Good Return Note [^\.]+\./gi, "")
    .replace(/Damage Return Note [^\.]+\./gi, "")
    .replace(/Replacement item \/ Exchange for Return Note [^\.]+\./gi, "")
    .replace(/Reason:\s*/gi, "")
    .trim();

  // Calculate total return value
  const totalReturnValue = items.reduce((sum: number, it: any) => {
    const p = Number(it.unitPrice || it.price || noteExtractedPrice || 0);
    const q = Number(it.quantity || it.qty || 1);
    return sum + (it.total > 0 ? Number(it.total) : p * q);
  }, 0);

  const ITEMS_PER_PAGE = 17;
  const chunks: any[][] = [];
  for (let i = 0; i < items.length; i += ITEMS_PER_PAGE) {
    chunks.push(items.slice(i, i + ITEMS_PER_PAGE));
  }
  const totalPages = Math.max(1, chunks.length);

  const makeTableHeader = () => {
    if (isReturnNote) {
      return `
    <table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
      <thead>
        <tr style="border-top:2px solid #000;border-bottom:2px solid #000;background:#f0f0f0;">
          <th style="padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:center;width:5%;">#</th>
          <th style="padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:left;width:16%;">Item Code</th>
          <th style="padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:left;width:34%;">Description</th>
          <th style="padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:center;width:8%;">Unit</th>
          <th style="padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:right;width:12%;">Unit Price</th>
          <th style="padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:center;width:11%;">Return Qty</th>
          <th style="padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:right;width:14%;">Total Value</th>
        </tr>
      </thead>`;
    }

    return `
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
      </thead>`;
  };

  const pages = (chunks.length > 0 ? chunks : [[]]).map((chunk, pageIdx) => {
    const isFirst = pageIdx === 0;
    const isLast  = pageIdx === totalPages - 1;
    const pageNo  = pageIdx + 1;
    const globalStart = pageIdx * ITEMS_PER_PAGE;

    const invoiceNoDisplay = totalPages > 1
      ? `${invoice.invoiceNo || "-"} (${pageNo}/${totalPages})`
      : invoice.invoiceNo || "-";

    const chunkRows = chunk
      .map((item: any, idx: number) => {
        const globalIdx = globalStart + idx;
        const isRetail = item.retailOnly || item.retail_only || item.isRetail || item.subCategory === "Retail Exclusive";
        const retailTag = isRetail ? ' <span style="font-size:9px;background:#fef3c7;color:#92400e;border:1px solid #fcd34d;padding:1px 4px;border-radius:3px;font-weight:600;margin-left:4px;display:inline-block;">RETAIL</span>' : '';

        if (isReturnNote) {
          const itemPrice = Number(item.unitPrice || item.price || noteExtractedPrice || 0);
          const itemQty = Number(item.quantity || item.qty || 1);
          const lineVal = item.total > 0 ? Number(item.total) : itemPrice * itemQty;
          return `
        <tr style="${globalIdx < items.length - 1 ? "border-bottom:1px solid #e8e8e8;" : ""}">
          <td style="padding:7px 8px;font-size:13px;color:#777;text-align:center;vertical-align:middle;">${globalIdx + 1}</td>
          <td style="padding:7px 8px;font-size:13px;color:#555;vertical-align:middle;">${item.sku || "-"}</td>
          <td style="padding:7px 8px;font-size:13px;color:#111;font-weight:600;vertical-align:middle;">${item.productName || item.name || "-"}${retailTag}${multiBill && item.billRef ? `<div style="font-size:10px;font-weight:600;color:#0284c7;margin-top:1px;">Bill: ${item.billRef}</div>` : ""}</td>
          <td style="padding:7px 8px;font-size:13px;color:#555;text-align:center;vertical-align:middle;">${item.unit || "Pcs"}</td>
          <td style="padding:7px 8px;font-size:13px;color:#111;text-align:right;white-space:nowrap;vertical-align:middle;">LKR ${fmt(itemPrice)}</td>
          <td style="padding:7px 8px;font-size:14px;font-weight:800;color:#000;text-align:center;vertical-align:middle;">${itemQty}</td>
          <td style="padding:7px 8px;font-size:13px;font-weight:800;color:#000;text-align:right;white-space:nowrap;vertical-align:middle;">LKR ${fmt(lineVal)}</td>
        </tr>`;
        }

        return `
        <tr style="${globalIdx < items.length - 1 ? "border-bottom:1px solid #e8e8e8;" : ""}">
          <td style="padding:7px 8px;font-size:13px;color:#777;text-align:center;vertical-align:middle;">${globalIdx + 1}</td>
          <td style="padding:7px 8px;font-size:13px;color:#555;vertical-align:middle;">${item.sku || "-"}</td>
          <td style="padding:7px 8px;font-size:13px;color:#111;font-weight:500;vertical-align:middle;">${item.productName || item.name || "-"}${retailTag}</td>
          <td style="padding:7px 8px;font-size:13px;color:#111;text-align:right;white-space:nowrap;vertical-align:middle;">LKR ${fmt(item.unitPrice || item.price)}</td>
          <td style="padding:7px 8px;font-size:13px;font-weight:700;color:#111;text-align:center;vertical-align:middle;">${item.quantity}</td>
          <td style="padding:7px 8px;font-size:13px;color:#555;text-align:center;vertical-align:middle;">${item.unit || "Pcs"}</td>
          <td style="padding:7px 8px;font-size:13px;text-align:center;color:#111;vertical-align:middle;">${(item.freeQuantity || item.free || 0) > 0 ? (item.freeQuantity || item.free) : "-"}</td>
          <td style="padding:7px 8px;font-size:13px;text-align:center;color:#777;vertical-align:middle;">${item.discountPercent > 0 ? "-" + item.discountPercent + "%" : "-"}</td>
          <td style="padding:7px 8px;font-size:13px;font-weight:700;color:#111;text-align:right;white-space:nowrap;vertical-align:middle;">LKR ${fmt(item.total)}</td>
        </tr>`;
      })
      .join("");

    return `
  <div class="invoice-page" style="page-break-after:${isLast ? "auto" : "always"};page-break-inside:avoid;width:100%;min-height:250mm;padding:8px 20px 14px;background:#fff;font-family:${FONT_STACK};color:#111;box-sizing:border-box;display:flex;flex-direction:column;">

    <table style="width:100%;border-collapse:collapse;margin-bottom:0;">
      <tr>
        <td style="vertical-align:top;width:55%;">
          <div style="font-size:34px;font-weight:900;color:#000;letter-spacing:-0.5px;line-height:1.1;white-space:nowrap;">CHAMPIKA HARDWARE</div>
          ${isReturnNote ? `
          <div style="margin-top:4px;margin-bottom:3px;">
            <span style="display:inline-block;padding:3px 10px;background:${returnBadgeBg};color:${returnBadgeColor};border:1.5px solid ${returnBadgeBorder};border-radius:4px;font-size:12px;font-weight:900;letter-spacing:0.8px;white-space:nowrap;text-transform:uppercase;">
              ${returnTypeTitle}
            </span>
          </div>` : ""}
          <div style="font-size:10px;color:#333;margin-top:2px;line-height:1.5;">
            ${cfg.division}<br>${cfg.address}<br>Tel: ${cfg.tel}
          </div>
        </td>
        <td style="vertical-align:top;text-align:right;width:45%;">
          <table style="margin-left:auto;border-collapse:collapse;">
            <tr>
              ${isFirst && !isReturnNote ? `
              <td style="vertical-align:top;padding-top:6px;padding-right:14px;white-space:nowrap;">
                <div style="display:inline-flex;align-items:center;border:2px solid #000;border-radius:8px;padding:6px 10px;background:#fff;">
                  <div style="position:relative;display:flex;align-items:center;justify-content:center;width:42px;height:42px;margin-right:10px;">
                    <svg viewBox="0 0 100 100" style="width:100%;height:100%;position:absolute;">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="#000" stroke-width="2.5" stroke-dasharray="6 3" />
                      <circle cx="50" cy="8" r="3.5" fill="#000" />
                    </svg>
                    <span style="font-size:20px;font-weight:900;color:#000;">26</span>
                  </div>
                  <div style="text-align:left;border-left:1.5px solid #000;padding-left:10px;line-height:1.25;">
                    <div style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:#000;text-transform:uppercase;">YEARS OF</div>
                    <div style="font-size:10px;font-weight:800;letter-spacing:1.5px;color:#000;text-transform:uppercase;margin-top:-2px;">EXCELLENCE</div>
                    <div style="font-size:8px;color:#555;font-weight:700;letter-spacing:0.5px;margin-top:1px;">SINCE 2000</div>
                  </div>
                </div>
              </td>` : ""}
              <td style="vertical-align:top;text-align:right;white-space:nowrap;">
                <div style="font-size:19px;font-weight:800;color:#000;letter-spacing:0.5px;white-space:nowrap;">${invoiceNoDisplay}</div>
                ${originalInvoiceNo ? `<div style="font-size:11px;font-weight:700;color:#0284c7;margin-top:2px;${multiBill ? "white-space:normal;max-width:260px;margin-left:auto;" : "white-space:nowrap;"}">Original Bill Ref${multiBill ? "s" : ""}: ${originalInvoiceNo}</div>` : ""}
                ${invoice.manualInvoiceNo ? `<div style="font-size:12px;font-weight:600;color:#444;margin-top:2px;white-space:nowrap;">Book No: ${invoice.manualInvoiceNo}</div>` : ""}
                <div style="font-size:11px;color:#333;margin-top:2px;line-height:1.5;white-space:nowrap;">
                  Date: ${formatDate(invoice.date || invoice.createdAt)}<br>
                  ${salesRep}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <div style="border-top:1.5px solid #bbb;margin:10px 0 12px;"></div>

    ${isFirst ? `
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
      <tr>
        <td style="vertical-align:top;width:60%;">
          <div style="font-size:13px;font-weight:700;color:#000;">${shopName}</div>
          ${customerName && customerName !== shopName ? `<div style="font-size:12px;color:#555;">${customerName}</div>` : ""}
          ${address ? `<div style="font-size:12px;color:#333;">${address}${route ? ", " + route : ""}</div>` : ""}
          ${phone ? `<div style="font-size:12px;color:#333;">${phone}</div>` : ""}
        </td>
        <td style="vertical-align:top;padding-top:1px;text-align:right;width:40%;">
          ${divisionKey !== "retail" && paymentMethod ? `
          <div style="font-size:13px;font-weight:800;color:#000;text-transform:uppercase;letter-spacing:0.3px;">
            Terms: ${paymentMethod}
          </div>` : ""}
        </td>
      </tr>
    </table>` : `
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
      <tr>
        <td style="vertical-align:top;width:60%;">
          <div style="font-size:12px;font-weight:600;color:#000;">${shopName}${customerName && customerName !== shopName ? ` — ${customerName}` : ""}</div>
        </td>
        <td style="vertical-align:top;padding-top:1px;text-align:right;width:40%;">
          ${divisionKey !== "retail" && paymentMethod ? `
          <div style="font-size:12px;font-weight:800;color:#000;text-transform:uppercase;">
            Terms: ${paymentMethod}
          </div>` : ""}
        </td>
      </tr>
    </table>`}

    ${makeTableHeader()}
      <tbody>${chunkRows}</tbody>
    </table>

    ${isLast ? (
      isReturnNote ? `
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
      <tr>
        <td style="width:55%;vertical-align:top;">
          <div style="border:1px solid #cbd5e1;background:#f8fafc;border-radius:6px;padding:8px 12px;font-size:11px;line-height:1.5;color:#334155;">
            <div style="font-weight:700;color:#0f172a;margin-bottom:3px;font-size:11px;text-transform:uppercase;letter-spacing:0.3px;">
              Return Collection Instructions
            </div>
            <div>• Lorry driver / rep to verify and collect listed items from customer.</div>
            ${originalInvoiceNo ? `<div>• Original Invoice Reference${multiBill ? "s" : ""}: <strong>${originalInvoiceNo}</strong></div>` : ""}
            ${cleanReturnNotes ? `<div>• Notes: ${cleanReturnNotes}</div>` : ""}
          </div>
        </td>
        <td style="width:45%;vertical-align:top;padding-left:16px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:4px 0;font-size:12px;color:#333;">Total Items Returned</td>
              <td style="padding:4px 0;font-size:12px;font-weight:700;color:#000;text-align:right;">
                ${items.reduce((s: number, it: any) => s + (Number(it.quantity || it.qty) || 0), 0)} Units
              </td>
            </tr>
            <tr>
              <td style="padding:4px 0 0;border-top:1.5px solid #bbb;"></td>
              <td style="border-top:1.5px solid #bbb;"></td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-size:13px;font-weight:800;color:#000;">Total Return Value</td>
              <td style="padding:4px 0;font-size:16px;font-weight:900;color:#000;text-align:right;white-space:nowrap;">
                LKR ${fmt(totalReturnValue)}
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding-top:2px;font-size:10px;color:#64748b;text-align:right;font-style:italic;">
                ${returnTypeTitle.includes("GOOD") ? "(Credit allocated to customer balance)" : "(Direct exchange / replacement)"}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-top:70px;margin-bottom:6px;page-break-inside:avoid;">
      <tr>
        <td style="width:45%;text-align:center;padding-top:6px;border-top:1.5px solid #000;vertical-align:top;">
          <div style="font-size:11px;color:#000;font-weight:700;">Customer Signature &amp; Stamp</div>
          <div style="font-size:9px;color:#666;margin-top:2px;">(Goods Handed Over By Customer)</div>
        </td>
        <td style="width:10%;"></td>
        <td style="width:45%;text-align:center;padding-top:6px;border-top:1.5px solid #000;vertical-align:top;">
          <div style="font-size:11px;color:#000;font-weight:700;">Company Responsible Person Signature</div>
          <div style="font-size:9px;color:#666;margin-top:2px;">(Goods Received in Stated Condition)</div>
        </td>
      </tr>
    </table>` : `
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
            ${returnsTotal > 0 ? `<tr>
              <td style="padding:5px 0;font-size:12px;color:#c00;">Returns &amp; Adjustments</td>
              <td style="padding:5px 0;font-size:12px;color:#c00;text-align:right;white-space:nowrap;">- LKR ${fmt(returnsTotal)}</td>
            </tr>` : ""}
            ${extraDiscount > 1 ? `<tr>
              <td style="padding:5px 0;font-size:12px;color:#333;">Extra Discount</td>
              <td style="padding:5px 0;font-size:12px;color:#000;text-align:right;white-space:nowrap;">- LKR ${fmt(extraDiscount)}</td>
            </tr>` : ""}
            ${cashDiscountAmount > 0 ? `<tr>
              <td style="padding:5px 0;font-size:12px;color:#333;">Cash Discount ${cashDiscountPercent > 0 ? `(${cashDiscountPercent}%)` : ""}</td>
              <td style="padding:5px 0;font-size:12px;color:#000;text-align:right;white-space:nowrap;">- LKR ${fmt(cashDiscountAmount)}</td>
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

    <table style="width:100%;border-collapse:collapse;margin-top:24px;margin-bottom:8px;page-break-inside:avoid;">
      <tr>
        <td style="width:55%;"></td>
        <td style="width:45%;text-align:center;padding-top:6px;border-top:1.5px solid #555;">
          <div style="font-size:11px;color:#333;font-weight:600;margin-top:3px;">Customer Signature &amp; Stamp</div>
        </td>
      </tr>
    </table>`
    ) : `
    <div style="margin-top:12px;text-align:right;font-size:11px;color:#777;font-style:italic;">
      Continued on next page (${pageNo}/${totalPages})…
    </div>`}

    <div style="flex:1;"></div>

    <div style="border-top:1px solid #ddd;padding-top:6px;text-align:center;font-size:11px;color:#777;page-break-inside:avoid;">
      ${isReturnNote ? "Customer Return Collection Note — Champika Hardware" : "Thank you for your business!"}
    </div>
  </div>`;
  }).join("");

  return pages;
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
        /* No fixed paper size: works on A4 and Letter (chosen in the print dialog) */
        /* Keep a real page margin: printers can't print the outer ~5mm, so margin:0 clipped the right edge */
        @page { size: portrait; margin: 5mm 8mm 5mm 6mm; }
        html, body { width: 100% !important; margin: 0 auto; padding: 0; }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .invoice-page { page-break-after: always; page-break-inside: avoid; width: 100% !important; min-height: calc(100vh - 1mm) !important; padding: 0 2mm 0 2mm !important; }
        /* Page fills the paper height (A4 or Letter), so the "Thank you" footer always sits at the bottom */
        .invoice-page:last-child { page-break-after: auto !important; }
      }
    </style>
  </head>
  <body>${content}</body>
  </html>`;

// ── Half-page invoice (2-ply carbon paper on A4) ────────────────────────────
// Prints on the TOP HALF of A4 only. The 2-ply carbon paper makes the copy.
// Same visual design as the full-page invoice, proportionally scaled to ~138mm.
export const generateHalfPageInvoiceHTML = async (
  invoice: any,
  divisionKey: keyof typeof DIVISIONS = "retail",
  baseUrl = ""
): Promise<string> => {
  const cfg = DIVISIONS[divisionKey] ?? DIVISIONS.retail;

  const shopName     = invoice.customer?.shop     || invoice.shopName     || invoice.customer?.name || "Unknown";
  const customerName = invoice.customer?.name     || invoice.customerName || shopName;
  const address      = invoice.customer?.address  || invoice.address      || "";
  const phone        = invoice.customer?.phone    || invoice.phone        || "";
  const route        = invoice.customer?.route    || invoice.route        || "";
  const salesRep     = invoice.salesRep           || invoice.salesRepName || "-";
  const items        = invoice.items              || [];
  const rawNotes     = (invoice.notes || "").replace(/created via rep portal/gi, "").trim();

  let paymentMethod = invoice.paymentMethod || "";
  let cashDiscountPercent = invoice.cashDiscountPercent || 0;
  let cashDiscountAmount = invoice.cashDiscountAmount || 0;

  if (!paymentMethod && rawNotes) {
    const pmMatch = rawNotes.match(/\[PAYMENT_METHOD:([^\]]+)\]/);
    if (pmMatch) paymentMethod = pmMatch[1];
  }
  if (!cashDiscountPercent && rawNotes) {
    const cdpMatch = rawNotes.match(/\[CASH_DISCOUNT_PERCENT:([\d.]+)\]/);
    if (cdpMatch) cashDiscountPercent = parseFloat(cdpMatch[1]);
  }
  if (!cashDiscountAmount && rawNotes) {
    const cdaMatch = rawNotes.match(/\[CASH_DISCOUNT_AMOUNT:([\d.]+)\]/);
    if (cdaMatch) cashDiscountAmount = parseFloat(cdaMatch[1]);
  }

  const notes = rawNotes
    .replace(/\[PAYMENT_METHOD:[^\]]+\]/g, "")
    .replace(/\[CASH_DISCOUNT_PERCENT:[\d.]+\]/g, "")
    .replace(/\[CASH_DISCOUNT_AMOUNT:[\d.]+\]/g, "")
    .trim();

  const subTotal      = items.reduce((s: number, i: any) => s + (i.total || 0), 0);
  const grandTotal    = invoice.grandTotal || invoice.totalAmount || 0;
  const extraDiscount = Math.max(0, subTotal - grandTotal - cashDiscountAmount);

  // Detect Return Note documents
  const isReturnNote = Boolean(
    invoice.invoiceNo?.startsWith("RET-") ||
    invoice.orderId?.startsWith("RET-") ||
    invoice.invoiceNo?.startsWith("RGN-") ||
    invoice.orderId?.startsWith("RGN-") ||
    invoice.invoiceNo?.startsWith("EXC-") ||
    invoice.orderId?.startsWith("EXC-") ||
    rawNotes?.includes("[RETURN_NOTE:") ||
    rawNotes?.includes("[DAMAGE_EXCHANGE:") ||
    rawNotes?.includes("[RETURN_GOOD:") ||
    rawNotes?.includes("[DAMAGE_RETURN:") ||
    rawNotes?.toLowerCase().includes("good return note") ||
    rawNotes?.toLowerCase().includes("damage return note") ||
    rawNotes?.toLowerCase().includes("customer return")
  );

  let returnTypeTitle = "GOOD RETURN NOTE";
  let returnBadgeBg = "#f0fdf4";
  let returnBadgeColor = "#15803d";
  let returnBadgeBorder = "#86efac";

  if (rawNotes?.includes("[DAMAGE_EXCHANGE:") || rawNotes?.toLowerCase().includes("exchange")) {
    returnTypeTitle = "EXCHANGE RETURN NOTE";
    returnBadgeBg = "#f0f9ff";
    returnBadgeColor = "#0369a1";
    returnBadgeBorder = "#7dd3fc";
  } else if (rawNotes?.includes("[DAMAGE_RETURN:") || rawNotes?.toLowerCase().includes("damage return")) {
    returnTypeTitle = "DAMAGE RETURN NOTE";
    returnBadgeBg = "#fef2f2";
    returnBadgeColor = "#b91c1c";
    returnBadgeBorder = "#fca5a5";
  }

  // Extract original invoice reference if present in notes
  // A return note can hold items from several bills: collect every bill number
  let originalInvoiceNo: string | null = null;
  const billRefs = getBillRefs(items, rawNotes);
  const multiBill = billRefs.length > 1;
  if (billRefs.length > 0) {
    originalInvoiceNo = billRefs.join(", ");
  } else {
    const bracketMatch = rawNotes.match(/\[([A-Z]{2,4}-[\d]+)\]/);
    if (bracketMatch) originalInvoiceNo = bracketMatch[1];
  }

  // Extract unit price if present in notes
  const priceMatch = rawNotes.match(/\[PRICE:([\d.]+)\]/);
  const noteExtractedPrice = priceMatch ? parseFloat(priceMatch[1]) : 0;

  // Clean notes for presentation
  const cleanReturnNotes = notes
    .replace(/\[RETURN_NOTE:[^\]]+\]/gi, "")
    .replace(/\[DAMAGE_EXCHANGE:[^\]]+\]/gi, "")
    .replace(/\[RETURN_GOOD:[^\]]+\]/gi, "")
    .replace(/\[DAMAGE_RETURN:[^\]]+\]/gi, "")
    .replace(/\[INV:[^\]]+\]/gi, "")
    .replace(/\[PRICE:[\d.]+\]/gi, "")
    .replace(/\[NOTE:[^\]]+\]/gi, "")
    .replace(/\[RETURN_ITEM:[^\]]+\]/gi, "")
    .replace(/Good Return Note [^\.]+\./gi, "")
    .replace(/Damage Return Note [^\.]+\./gi, "")
    .replace(/Replacement item \/ Exchange for Return Note [^\.]+\./gi, "")
    .replace(/Reason:\s*/gi, "")
    .trim();

  // Calculate total return value
  const totalReturnValue = items.reduce((sum: number, it: any) => {
    const p = Number(it.unitPrice || it.price || noteExtractedPrice || 0);
    const q = Number(it.quantity || it.qty || 1);
    return sum + (it.total > 0 ? Number(it.total) : p * q);
  }, 0);

  const ITEMS_PER_HALF = 8;
  const chunks: any[][] = [];
  for (let i = 0; i < items.length; i += ITEMS_PER_HALF) {
    chunks.push(items.slice(i, i + ITEMS_PER_HALF));
  }
  const totalPages = Math.max(1, chunks.length);

  const makeTableHeader = () => {
    if (isReturnNote) {
      return `
    <table style="width:100%;border-collapse:collapse;margin-bottom:4px;">
      <thead>
        <tr style="border-top:2px solid #000;border-bottom:2px solid #000;background:#f0f0f0;">
          <th style="padding:4px 5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:center;width:5%;">#</th>
          <th style="padding:4px 5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:left;width:16%;">Item Code</th>
          <th style="padding:4px 5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:left;width:34%;">Description</th>
          <th style="padding:4px 5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:center;width:8%;">Unit</th>
          <th style="padding:4px 5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:right;width:12%;">Unit Price</th>
          <th style="padding:4px 5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:center;width:11%;">Return Qty</th>
          <th style="padding:4px 5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:right;width:14%;">Total Value</th>
        </tr>
      </thead>`;
    }

    return `
    <table style="width:100%;border-collapse:collapse;margin-bottom:4px;">
      <thead>
        <tr style="border-top:2px solid #000;border-bottom:2px solid #000;background:#f0f0f0;">
          <th style="padding:4px 5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:center;width:4%;">#</th>
          <th style="padding:4px 5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:left;width:14%;">Item Code</th>
          <th style="padding:4px 5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:left;width:29%;">Description</th>
          <th style="padding:4px 5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:right;width:13%;">Price</th>
          <th style="padding:4px 5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:center;width:7%;">Qty</th>
          <th style="padding:4px 5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:center;width:7%;">Unit</th>
          <th style="padding:4px 5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:center;width:7%;">Free</th>
          <th style="padding:4px 5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:center;width:7%;">Disc.</th>
          <th style="padding:4px 5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000;text-align:right;width:12%;">Total</th>
        </tr>
      </thead>`;
  };

  const sheets = (chunks.length > 0 ? chunks : [[]]).map((chunk, pageIdx) => {
    const isFirst = pageIdx === 0;
    const isLast  = pageIdx === totalPages - 1;
    const pageNo  = pageIdx + 1;
    const globalStart = pageIdx * ITEMS_PER_HALF;

    const invoiceNoDisplay = totalPages > 1
      ? `${invoice.invoiceNo || "-"} (${pageNo}/${totalPages})`
      : invoice.invoiceNo || "-";

    const chunkRows = chunk.map((item: any, idx: number) => {
      const gi = globalStart + idx;
      const isRetail = item.retailOnly || item.retail_only || item.isRetail || item.subCategory === "Retail Exclusive";
      const retailTag = isRetail ? ' <span style="font-size:8px;background:#fef3c7;color:#92400e;border:1px solid #fcd34d;padding:1px 3px;border-radius:3px;font-weight:600;margin-left:3px;display:inline-block;">RETAIL</span>' : '';

      if (isReturnNote) {
        const itemPrice = Number(item.unitPrice || item.price || noteExtractedPrice || 0);
        const itemQty = Number(item.quantity || item.qty || 1);
        const lineVal = item.total > 0 ? Number(item.total) : itemPrice * itemQty;
        return `
        <tr style="${gi < items.length - 1 ? "border-bottom:1px solid #e8e8e8;" : ""}">
          <td style="padding:4px 5px;font-size:12px;color:#777;text-align:center;vertical-align:middle;">${gi + 1}</td>
          <td style="padding:4px 5px;font-size:12px;color:#555;vertical-align:middle;">${item.sku || "-"}</td>
          <td style="padding:4px 5px;font-size:12px;color:#111;font-weight:600;vertical-align:middle;">${item.productName || item.name || "-"}${retailTag}${multiBill && item.billRef ? `<div style="font-size:9px;font-weight:600;color:#0284c7;">Bill: ${item.billRef}</div>` : ""}</td>
          <td style="padding:4px 5px;font-size:12px;color:#555;text-align:center;vertical-align:middle;">${item.unit || "Pcs"}</td>
          <td style="padding:4px 5px;font-size:12px;color:#111;text-align:right;white-space:nowrap;vertical-align:middle;">LKR ${fmt(itemPrice)}</td>
          <td style="padding:4px 5px;font-size:13px;font-weight:800;color:#000;text-align:center;vertical-align:middle;">${itemQty}</td>
          <td style="padding:4px 5px;font-size:12px;font-weight:800;color:#000;text-align:right;white-space:nowrap;vertical-align:middle;">LKR ${fmt(lineVal)}</td>
        </tr>`;
      }

      return `
        <tr style="${gi < items.length - 1 ? "border-bottom:1px solid #e8e8e8;" : ""}">
          <td style="padding:4px 5px;font-size:12px;color:#777;text-align:center;vertical-align:middle;">${gi + 1}</td>
          <td style="padding:4px 5px;font-size:12px;color:#555;vertical-align:middle;">${item.sku || "-"}</td>
          <td style="padding:4px 5px;font-size:12px;color:#111;font-weight:500;vertical-align:middle;">${item.productName || item.name || "-"}${retailTag}</td>
          <td style="padding:4px 5px;font-size:12px;color:#111;text-align:right;white-space:nowrap;vertical-align:middle;">LKR ${fmt(item.unitPrice || item.price)}</td>
          <td style="padding:4px 5px;font-size:12px;font-weight:700;color:#111;text-align:center;vertical-align:middle;">${item.quantity}</td>
          <td style="padding:4px 5px;font-size:12px;color:#555;text-align:center;vertical-align:middle;">${item.unit || "Pcs"}</td>
          <td style="padding:4px 5px;font-size:12px;text-align:center;color:#111;vertical-align:middle;">${(item.freeQuantity || item.free || 0) > 0 ? (item.freeQuantity || item.free) : "-"}</td>
          <td style="padding:4px 5px;font-size:12px;text-align:center;color:#777;vertical-align:middle;">${item.discountPercent > 0 ? "-" + item.discountPercent + "%" : "-"}</td>
          <td style="padding:4px 5px;font-size:12px;font-weight:700;color:#111;text-align:right;white-space:nowrap;vertical-align:middle;">LKR ${fmt(item.total)}</td>
        </tr>`;
    }).join("");

    const halfContent = `
<div class="half-invoice" style="width:100%;height:138mm;padding:10px 22px 8px 14px;background:#fff;font-family:${FONT_STACK};color:#111;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;">

  <table style="width:100%;border-collapse:collapse;margin-bottom:0;">
    <tr>
      <td style="vertical-align:middle;width:45%;">
        <div style="font-size:22px;font-weight:800;color:#000;letter-spacing:-0.3px;line-height:1.1;white-space:nowrap;">CHAMPIKA HARDWARE</div>
        ${isReturnNote ? `
        <div style="margin-top:2px;margin-bottom:2px;">
          <span style="display:inline-block;padding:2px 7px;background:${returnBadgeBg};color:${returnBadgeColor};border:1px solid ${returnBadgeBorder};border-radius:3px;font-size:10px;font-weight:900;letter-spacing:0.5px;white-space:nowrap;text-transform:uppercase;">
            ${returnTypeTitle}
          </span>
        </div>` : ""}
        <div style="font-size:8px;color:#333;margin-top:1px;line-height:1.5;">
          ${cfg.division}<br>${cfg.address}<br>Tel: ${cfg.tel}
        </div>
      </td>

      <td style="width:5%;"></td>

      <td style="vertical-align:top;text-align:right;width:50%;">
        <table style="margin-left:auto;border-collapse:collapse;">
          <tr>
            ${isFirst && !isReturnNote ? `
            <td style="vertical-align:top;padding-top:6px;padding-right:12px;white-space:nowrap;">
              <div style="display:inline-flex;align-items:center;border:1.5px solid #000;border-radius:6px;padding:4px 8px;background:#fff;">
                <div style="position:relative;display:flex;align-items:center;justify-content:center;width:32px;height:32px;margin-right:8px;">
                  <svg viewBox="0 0 100 100" style="width:100%;height:100%;position:absolute;">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#000" stroke-width="2.5" stroke-dasharray="6 3" />
                    <circle cx="50" cy="8" r="3.5" fill="#000" />
                  </svg>
                  <span style="font-size:15px;font-weight:900;color:#000;">26</span>
                </div>
                <div style="text-align:left;border-left:1px solid #000;padding-left:8px;line-height:1.2;">
                  <div style="font-size:9px;font-weight:800;letter-spacing:1.2px;color:#000;text-transform:uppercase;">YEARS OF</div>
                  <div style="font-size:8px;font-weight:800;letter-spacing:1.2px;color:#000;text-transform:uppercase;margin-top:-2px;">EXCELLENCE</div>
                  <div style="font-size:7px;color:#555;font-weight:700;letter-spacing:0.5px;margin-top:1px;">SINCE 2000</div>
                </div>
              </div>
            </td>` : ""}
            <td style="vertical-align:top;text-align:right;white-space:nowrap;">
              <div style="font-size:15px;font-weight:800;color:#000;letter-spacing:0.5px;white-space:nowrap;">${invoiceNoDisplay}</div>
              ${originalInvoiceNo ? `<div style="font-size:9px;font-weight:700;color:#0284c7;margin-top:1px;${multiBill ? "white-space:normal;max-width:200px;margin-left:auto;" : "white-space:nowrap;"}">Original Ref${multiBill ? "s" : ""}: ${originalInvoiceNo}</div>` : ""}
              ${invoice.manualInvoiceNo ? `<div style="font-size:9px;font-weight:600;color:#444;margin-top:1px;white-space:nowrap;">Book No: ${invoice.manualInvoiceNo}</div>` : ""}
              <div style="font-size:9px;color:#333;margin-top:1px;line-height:1.5;white-space:nowrap;">
                Date: ${formatDate(invoice.date || invoice.createdAt)}<br>
                ${salesRep}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <div style="border-top:1.5px solid #bbb;margin:5px 0 6px;"></div>

  ${isFirst ? `
  <table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
    <tr>
      <td style="vertical-align:top;width:60%;">
        <div style="font-size:12px;font-weight:700;color:#000;">${shopName}</div>
        ${customerName && customerName !== shopName ? `<div style="font-size:11px;color:#555;">${customerName}</div>` : ""}
        ${address ? `<div style="font-size:11px;color:#333;">${address}${route ? ", " + route : ""}</div>` : ""}
        ${phone ? `<div style="font-size:11px;color:#333;">${phone}</div>` : ""}
      </td>
      <td style="vertical-align:top;padding-top:1px;text-align:right;width:40%;">
        ${divisionKey !== "retail" && paymentMethod ? `
        <div style="font-size:12px;font-weight:800;color:#000;text-transform:uppercase;">
          Terms: ${paymentMethod}
        </div>` : ""}
      </td>
    </tr>
  </table>` : `
  <table style="width:100%;border-collapse:collapse;margin-bottom:4px;">
    <tr>
      <td style="vertical-align:top;width:60%;">
        <div style="font-size:11px;font-weight:600;color:#000;">${shopName}${customerName && customerName !== shopName ? ` — ${customerName}` : ""}</div>
      </td>
      <td style="vertical-align:top;padding-top:1px;text-align:right;width:40%;">
        ${divisionKey !== "retail" && paymentMethod ? `
        <div style="font-size:11px;font-weight:800;color:#000;text-transform:uppercase;">
          Terms: ${paymentMethod}
        </div>` : ""}
      </td>
    </tr>
  </table>`}

  ${makeTableHeader()}
      <tbody>${chunkRows}</tbody>
    </table>

  ${isLast ? (
    isReturnNote ? `
  <table style="width:100%;border-collapse:collapse;margin-top:3px;margin-bottom:3px;">
    <tr>
      <td style="width:55%;vertical-align:top;">
        <div style="border:1px solid #cbd5e1;background:#f8fafc;border-radius:4px;padding:5px 8px;font-size:9px;line-height:1.4;color:#334155;">
          <div style="font-weight:700;color:#0f172a;margin-bottom:1px;font-size:9px;text-transform:uppercase;">Return Instructions</div>
          <div>• Collect listed items from customer.</div>
          ${originalInvoiceNo ? `<div>• Ref Bill${multiBill ? "s" : ""}: <strong>${originalInvoiceNo}</strong></div>` : ""}
          ${cleanReturnNotes ? `<div>• Notes: ${cleanReturnNotes}</div>` : ""}
        </div>
      </td>
      <td style="width:45%;vertical-align:top;padding-left:10px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:2px 0;font-size:10px;color:#333;">Total Return Qty</td>
            <td style="padding:2px 0;font-size:10px;font-weight:700;color:#000;text-align:right;">
              ${items.reduce((s: number, it: any) => s + (Number(it.quantity || it.qty) || 0), 0)} Units
            </td>
          </tr>
          <tr>
            <td style="padding:2px 0 0;border-top:1px solid #bbb;"></td>
            <td style="border-top:1px solid #bbb;"></td>
          </tr>
          <tr>
            <td style="padding:2px 0;font-size:11px;font-weight:800;color:#000;">Total Return Value</td>
            <td style="padding:2px 0;font-size:13px;font-weight:900;color:#000;text-align:right;white-space:nowrap;">
              LKR ${fmt(totalReturnValue)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <table style="width:100%;border-collapse:collapse;margin-top:40px;margin-bottom:3px;">
    <tr>
      <td style="width:45%;text-align:center;padding-top:4px;border-top:1.5px solid #000;vertical-align:top;">
        <div style="font-size:9px;color:#000;font-weight:700;">Customer Signature &amp; Stamp</div>
        <div style="font-size:8px;color:#666;margin-top:1px;">(Handed Over By)</div>
      </td>
      <td style="width:10%;"></td>
      <td style="width:45%;text-align:center;padding-top:4px;border-top:1.5px solid #000;vertical-align:top;">
        <div style="font-size:9px;color:#000;font-weight:700;">Company Responsible Person</div>
        <div style="font-size:8px;color:#666;margin-top:1px;">(Received In Good Condition)</div>
      </td>
    </tr>
  </table>` : `
  <table style="width:100%;border-collapse:collapse;margin-top:4px;margin-bottom:4px;">
    <tr>
      <td style="width:55%;">
        ${notes ? `<div style="font-size:9px;color:#555;line-height:1.5;">${notes}</div>` : ""}
      </td>
      <td style="width:45%;vertical-align:top;padding-left:12px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:3px 0;font-size:11px;color:#333;">Subtotal</td>
            <td style="padding:3px 0;font-size:11px;color:#000;text-align:right;white-space:nowrap;">LKR ${fmt(subTotal)}</td>
          </tr>
          ${extraDiscount > 1 ? `<tr>
            <td style="padding:3px 0;font-size:11px;color:#333;">Extra Discount</td>
            <td style="padding:3px 0;font-size:11px;color:#000;text-align:right;white-space:nowrap;">- LKR ${fmt(extraDiscount)}</td>
          </tr>` : ""}
          <tr>
            <td style="padding:4px 0 0;border-top:1.5px solid #bbb;"></td>
            <td style="border-top:1.5px solid #bbb;"></td>
          </tr>
          <tr>
            <td style="padding:3px 0;font-size:12px;font-weight:700;color:#000;">Net Total</td>
            <td style="padding:3px 0;font-size:14px;font-weight:800;color:#000;text-align:right;white-space:nowrap;">LKR ${fmt(grandTotal)}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <table style="width:100%;border-collapse:collapse;margin-top:16px;margin-bottom:4px;">
    <tr>
      <td style="width:55%;"></td>
      <td style="width:45%;text-align:center;padding-top:5px;border-top:1.5px solid #555;">
        <div style="font-size:10px;color:#333;font-weight:600;margin-top:2px;">Customer Signature &amp; Stamp</div>
      </td>
    </tr>
  </table>`
  ) : `
  <div style="margin-top:8px;text-align:right;font-size:10px;color:#777;font-style:italic;">
    Continued on next page (${pageNo}/${totalPages})…
  </div>`}

  <div style="flex:1;"></div>

  <div style="border-top:1px solid #ddd;padding-top:5px;text-align:center;font-size:10px;color:#777;">
    ${isReturnNote ? "Customer Return Collection Note — Champika Hardware" : "Thank you for your business!"}
  </div>
</div>`;

    return `
<div class="a4-sheet" style="page-break-after:always;width:210mm;height:297mm;background:#fff;box-sizing:border-box;">
  ${halfContent}
</div>`;
  });

  return sheets.join("");
};

export const getHalfPageDocumentWrapper = (content: string, title: string) => `
  <!DOCTYPE html>
  <html>
  <head>
    <title>${title}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: ${FONT_STACK}; margin: 0; padding: 0; background: #fff; width: 794px; }
      @media print {
        /* No fixed paper size: works on A4 and Letter. Invoice stays on the top half. */
        @page { size: portrait; margin: 0; }
        html, body { width: 100% !important; margin: 0 auto; padding: 0; }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .a4-sheet { page-break-after: always; width: 100% !important; height: auto !important; }
        .a4-sheet:last-child { page-break-after: auto; }
      }
    </style>
  </head>
  <body>${content}</body>
  </html>`;

export const generateReturnsSummaryHTML = (loadingSheet: any): string => {
  if (!loadingSheet) return "";

  const shopReturnsMap: Record<string, any[]> = {};
  (loadingSheet.orders || []).forEach((order: any) => {
    const shopName =
      order.customer?.shopName || order.customer?.shop || "Unknown Shop";
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
  if (shopNames.length === 0) return "";

  const shopTables = shopNames
    .map((shopName, shopIdx) => {
      const items = shopReturnsMap[shopName];
      const rows = items
        .map((ret: any, itemIdx: number) => {
          return `
        <tr>
          <td style="padding:5px 6px;font-size:12px;color:#000;text-align:center;vertical-align:middle;border:1px solid #000;">${itemIdx + 1}</td>
          <td style="padding:5px 6px;font-size:12px;color:#000;font-weight:700;vertical-align:middle;border:1px solid #000;">${ret.productName || "-"}</td>
          <td style="padding:5px 6px;font-size:12px;color:#000;text-align:center;font-family:monospace;vertical-align:middle;border:1px solid #000;">${ret.sku || "-"}</td>
          <td style="padding:5px 6px;font-size:12px;color:#000;text-align:center;vertical-align:middle;border:1px solid #000;">${ret.returnType || "Exchange"}</td>
          <td style="padding:5px 6px;font-size:12px;font-weight:700;color:#000;text-align:center;vertical-align:middle;border:1px solid #000;">
            ${ret.quantity} ${ret.unit || ret.unitOfMeasure || ""}
          </td>
        </tr>`;
        })
        .join("");

      return `
      <div style="margin-top:10px;margin-bottom:14px;">
        <div style="font-size:13px;font-weight:700;color:#000;margin-bottom:4px;">
          Shop (${shopIdx + 1}): ${shopName}
        </div>
        <table style="width:100%;border-collapse:collapse;border:1.5px solid #000;">
          <thead>
            <tr style="background:#f0f0f0;border-bottom:1.5px solid #000;">
              <th style="padding:5px 6px;font-size:10px;font-weight:700;text-transform:uppercase;color:#000;text-align:center;width:6%;border:1px solid #000;">#</th>
              <th style="padding:5px 6px;font-size:10px;font-weight:700;text-transform:uppercase;color:#000;text-align:left;width:48%;border:1px solid #000;">Item Name</th>
              <th style="padding:5px 6px;font-size:10px;font-weight:700;text-transform:uppercase;color:#000;text-align:center;width:20%;border:1px solid #000;">SKU / Code</th>
              <th style="padding:5px 6px;font-size:10px;font-weight:700;text-transform:uppercase;color:#000;text-align:center;width:14%;border:1px solid #000;">Return Type</th>
              <th style="padding:5px 6px;font-size:10px;font-weight:700;text-transform:uppercase;color:#000;text-align:center;width:12%;border:1px solid #000;">Qty</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    })
    .join("");

  const loadingDateStr = loadingSheet.loadingDate || loadingSheet.createdAt;
  const formattedDate = loadingDateStr
    ? new Date(loadingDateStr).toLocaleDateString("en-GB", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "-";

  return `
  <div class="invoice-page" style="page-break-before:always;page-break-after:always;width:100%;min-height:277mm;padding:12px 20px 20px;background:#fff;font-family:${FONT_STACK};color:#000;box-sizing:border-box;display:flex;flex-direction:column;">
    <div style="font-size:18px;font-weight:800;color:#000;margin-bottom:10px;">Customer Exchange &amp; Return Items Summary</div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
      <tr>
        <td style="vertical-align:top;width:50%;font-size:11px;color:#000;line-height:1.4;">
          <strong>Load Ref:</strong> ${loadingSheet.loadId || "-"}<br>
          Lorry No: ${loadingSheet.lorryNumber || "-"}
        </td>
        <td style="vertical-align:top;text-align:right;width:50%;font-size:11px;color:#000;line-height:1.4;">
          <strong>Date:</strong> ${formattedDate}<br>
          Responsible Person: ${loadingSheet.driverName || "-"}
        </td>
      </tr>
    </table>

    <div style="border-top:1.5px solid #000;margin:4px 0 8px;"></div>

    ${shopTables}

    <div style="flex:1;"></div>

    <div style="border-top:1px solid #000;padding-top:8px;text-align:center;font-size:10px;color:#000;">
      Customer Exchange &amp; Return Items Summary — Champika Hardware
    </div>
  </div>`;
};
