/**
 * invoice-html-orange.ts
 * Orange Agency invoice layout (distributor-style bill: bordered item table,
 * free items on their own "***" lines, Prepared / Issued / Authorized footer).
 * Pure HTML — works on both server and client. Wrapped by getDocumentWrapper.
 */

// Company details printed at the top of every Orange invoice
export const ORANGE_INVOICE_COMPANY = {
  name: "C D PASKUAL & P W KUMARI",
  address: "PARANAWATHTHA ROAD,WALLABADA BOOSSA,",
  tel: "114792185",
};

const FONT = "Calibri, 'Segoe UI', Arial, Helvetica, sans-serif";

// Blank space at the top of every page. The print/PDF page edge is already 5mm,
// so 33.1mm here makes a 1.5 inch (38.1mm) top margin on each page.
const TOP_SPACE = "33.1mm";

// Table rows per page; the totals + signature block needs about this many rows of space
const ROWS_PER_PAGE = 21;
const FOOTER_ROWS = 8;

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string)
  );

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number(n) || 0
  );

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad2 = (n: number) => String(n).padStart(2, "0");

// 03-Nov-2026 06:26:55
const formatInvoiceDate = (value?: string) => {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return esc(value);
  const hasTime = value.includes("T");
  const date = `${pad2(d.getDate())}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
  return hasTime ? `${date} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}` : date;
};

// 03/11/2026 08:06 PM
const formatPrintTime = (d: Date) => {
  const h = d.getHours();
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(h % 12 || 12)}:${pad2(
    d.getMinutes()
  )} ${h >= 12 ? "PM" : "AM"}`;
};

// "15 Days Credit" → Credit Period "15 Days (Credit)", Payment Mode "Credit"
const paymentInfo = (method: string) => {
  const m = (method || "").trim();
  const credit = m.match(/(\d+)\s*Days?\s*Credit/i);
  if (credit) return { creditPeriod: `${credit[1]} Days (Credit)`, paymentMode: "Credit" };
  if (/cheque/i.test(m)) return { creditPeriod: "-", paymentMode: "Cheque" };
  if (/cash/i.test(m)) return { creditPeriod: "Cash", paymentMode: "Cash" };
  return { creditPeriod: "-", paymentMode: esc(m) || "-" };
};

// Group heading shown above the items, e.g. "ORANGE"
const groupName = (item: any) =>
  String(item.brand || (item.supplier || "").split("(")[0] || "Items")
    .trim()
    .toUpperCase();

type Row =
  | { kind: "group"; name: string }
  | { kind: "item"; no: number; item: any; free: boolean };

export const generateOrangeInvoiceHTML = (invoice: any): string => {
  const items: any[] = invoice.items || [];

  // Some callers pass the raw order notes with [TAG:value] markers — read and strip them
  const rawNotes = String(invoice.notes || "");
  const tag = (name: string) => (rawNotes.match(new RegExp(`\\[${name}:([^\\]]+)\\]`)) || [])[1];
  const paymentMethod = invoice.paymentMethod || tag("PAYMENT_METHOD") || "";
  const cashDiscountPercent = Number(invoice.cashDiscountPercent || tag("CASH_DISCOUNT_PERCENT") || 0);
  const notes = rawNotes
    .replace(/\[[A-Z_]+:[^\]]*\]/g, "")
    .replace(/created via rep portal/gi, "")
    .trim();
  const { creditPeriod, paymentMode } = paymentInfo(paymentMethod);

  // Build rows: per group → paid lines, then free lines marked "***"
  const groups = new Map<string, any[]>();
  for (const it of items) {
    const g = groupName(it);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(it);
  }
  const rows: Row[] = [];
  let no = 0;
  for (const [name, list] of groups) {
    rows.push({ kind: "group", name });
    for (const it of list) if (Number(it.quantity) > 0) rows.push({ kind: "item", no: ++no, item: it, free: false });
    for (const it of list)
      if (Number(it.freeQuantity || it.free || 0) > 0) rows.push({ kind: "item", no: ++no, item: it, free: true });
  }

  // Split into pages; give the totals/signatures their own page if the last page is too full
  const pages: Row[][] = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) pages.push(rows.slice(i, i + ROWS_PER_PAGE));
  if (pages.length === 0) pages.push([]);
  if (pages[pages.length - 1].length > ROWS_PER_PAGE - FOOTER_ROWS) pages.push([]);
  const totalPages = pages.length;

  // Totals
  const grossTotal = items.reduce(
    (s, it) => s + (Number(it.unitPrice ?? it.price) || 0) * (Number(it.quantity) || 0),
    0
  );
  const itemDiscount = items.reduce((s, it) => {
    const gross = (Number(it.unitPrice ?? it.price) || 0) * (Number(it.quantity) || 0);
    return s + Math.max(0, gross - (Number(it.total) || 0));
  }, 0);
  const cashDiscount = Number(invoice.cashDiscountAmount || tag("CASH_DISCOUNT_AMOUNT") || 0);
  const returnsTotal = Number(invoice.returnsTotal || invoice.totalRefunded) || 0;
  const invoiceValue = Number(invoice.grandTotal ?? invoice.totalAmount) || 0;
  // Same fallback as the standard layout: whatever is left after item/cash discounts and returns
  const netItems = items.reduce((s, it) => s + (Number(it.total) || 0), 0);
  const extraDiscount =
    Number(invoice.extraDiscountAmount) ||
    Math.max(0, netItems - invoiceValue - cashDiscount - returnsTotal);

  const shop = invoice.customer?.shop || invoice.shopName || "-";
  const address = invoice.customer?.address || invoice.address || "";
  const outletTel = invoice.customer?.phone || invoice.phone || "";
  // Bill shows the CINV Manual Ref when there is one, else the system number (old OR-xxxx bills)
  const manualRef = String(invoice.manualInvoiceNo || "");
  const invoiceNo = manualRef.trim() || invoice.invoiceNo || "-";
  const printedAt = formatPrintTime(new Date());

  const cell = "border:1px solid #000;padding:2px 4px;font-size:14px;";
  const th = (label: string, width: string, align = "left") =>
    `<th style="${cell}font-weight:400;text-align:${align};width:${width};vertical-align:middle;line-height:1.15;">${label}</th>`;

  const tableHead = `
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
      <thead>
        <tr>
          ${th("#", "3%")}
          ${th("Item Code", "11%")}
          ${th("Free<br>Type", "7%")}
          ${th("Item Description", "34%")}
          ${th("Qty", "6%", "center")}
          ${th("Free<br>Qty", "6%", "center")}
          ${th("Price", "12%", "center")}
          ${th("Disc", "8%", "center")}
          ${th("Gross Value", "13%", "center")}
        </tr>
      </thead>`;

  const rowHTML = (r: Row) => {
    const td = "padding:3px 4px;font-size:14.5px;white-space:nowrap;overflow:hidden;";
    if (r.kind === "group") {
      return `<tr><td colspan="9" style="padding:4px 4px 2px;text-align:center;font-size:14.5px;font-weight:700;text-decoration:underline;">${esc(r.name)}</td></tr>`;
    }
    const it = r.item;
    const price = Number(it.unitPrice ?? it.price) || 0;
    const qty = r.free ? 0 : Number(it.quantity) || 0;
    const freeQty = r.free ? Number(it.freeQuantity || it.free || 0) : 0;
    const gross = price * qty;
    const disc = r.free ? 0 : Math.max(0, gross - (Number(it.total) || 0));
    return `
        <tr>
          <td style="${td}">${r.no}</td>
          <td style="${td}">${esc(it.sku || "-")}</td>
          <td style="${td}"></td>
          <td style="${td}">${r.free ? "***" : ""}${esc(it.productName || it.name || "-")}</td>
          <td style="${td}text-align:center;">${qty}</td>
          <td style="${td}text-align:center;">${freeQty}</td>
          <td style="${td}text-align:right;">${money(price)}</td>
          <td style="${td}text-align:right;">${money(disc)}</td>
          <td style="${td}text-align:right;">${money(gross)}</td>
        </tr>`;
  };

  const infoRow = (label: string, value: string) =>
    `<tr><td style="padding:2px 0;width:42%;">${label}</td><td style="padding:2px 0;">: ${value}</td></tr>`;

  const totalLine = (label: string, value: number, negative = false) => `
        <tr>
          <td style="padding:4px 8px;text-align:left;">${label}</td>
          <td style="padding:4px 0;text-align:right;">${negative ? "- " : ""}${money(value)}</td>
        </tr>`;

  const footerHTML = `
    <div style="border-top:1px solid #000;margin-top:2px;"></div>
    <table style="width:55%;margin-left:auto;border-collapse:collapse;font-size:15px;margin-top:6px;">
      ${totalLine("Gross Value Total", grossTotal)}
      ${itemDiscount > 0.009 ? totalLine("Item Discount", itemDiscount, true) : ""}
      ${extraDiscount > 0.009 ? totalLine(`Extra Discount${invoice.extraDiscountPercent ? ` (${invoice.extraDiscountPercent}%)` : ""}`, extraDiscount, true) : ""}
      ${cashDiscount > 0.009 ? totalLine(`Cash Discount${cashDiscountPercent ? ` (${cashDiscountPercent}%)` : ""}`, cashDiscount, true) : ""}
      ${returnsTotal > 0.009 ? totalLine("Returns", returnsTotal, true) : ""}
      <tr>
        <td style="padding:12px 8px 4px;text-align:left;">Invoice Value</td>
        <td style="padding:12px 0 4px;text-align:right;">
          <span style="display:inline-block;min-width:95px;border-top:1px solid #000;border-bottom:3px double #000;padding:3px 0 2px;font-weight:700;">${money(invoiceValue)}</span>
        </td>
      </tr>
    </table>
    ${notes ? `<div style="font-size:14px;margin-top:6px;">Note: ${esc(notes)}</div>` : ""}
    <div style="font-size:14.5px;font-weight:700;margin-top:14px;">Free Items is marked with "***"</div>
    <div style="font-size:14.5px;margin-top:12px;">Accepted above items in order</div>
    <table style="width:100%;border-collapse:collapse;margin-top:30px;font-size:14.5px;font-weight:700;page-break-inside:avoid;">
      <tr>
        <td style="width:33%;">Prepared By <span style="display:inline-block;width:90px;border-bottom:1px solid #888;"></span></td>
        <td style="width:34%;text-align:center;">Issued By <span style="display:inline-block;width:90px;border-bottom:1px solid #888;"></span></td>
        <td style="width:33%;text-align:right;">Authorized By <span style="display:inline-block;width:90px;border-bottom:1px solid #888;"></span></td>
      </tr>
    </table>`;

  return pages
    .map((pageRows, idx) => {
      const pageNo = idx + 1;
      const isFirst = idx === 0;
      const isLast = pageNo === totalPages;
      return `
  <div class="invoice-page" style="page-break-after:${isLast ? "auto" : "always"};width:100%;min-height:250mm;padding:14px 22px 14px;background:#fff;font-family:${FONT};color:#000;box-sizing:border-box;display:flex;flex-direction:column;">
    <div style="height:${TOP_SPACE};flex-shrink:0;"></div>
    ${isFirst ? `
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="vertical-align:bottom;">
          <div style="font-size:15.5px;font-weight:700;">${esc(ORANGE_INVOICE_COMPANY.name)}</div>
          <div style="font-size:14.5px;margin-top:2px;">${esc(ORANGE_INVOICE_COMPANY.address)}</div>
          <div style="font-size:14.5px;margin-top:2px;">Tel : ${esc(ORANGE_INVOICE_COMPANY.tel)}</div>
        </td>
        <td style="vertical-align:top;text-align:right;">
          <span style="display:inline-block;border-top:1px solid #000;padding-top:1px;font-size:13px;font-family:'Times New Roman',serif;">${printedAt}</span>
        </td>
      </tr>
    </table>
    <div style="text-align:center;font-size:25px;font-weight:700;margin:4px 0 6px;">INVOICE</div>` : ""}

    <table style="width:100%;border-collapse:collapse;font-size:15px;">
      <tr>
        <td style="vertical-align:top;width:58%;">
          <div style="padding:2px 0;">Invoiced To &nbsp;&nbsp;&nbsp;:</div>
          <div style="padding:2px 0;">${esc(shop)}</div>
          ${address ? `<div style="padding:2px 0;">${esc(address)}</div>` : ""}
          <table style="border-collapse:collapse;font-size:15px;width:80%;">
            ${infoRow("Outlet Tel", esc(outletTel))}
            ${infoRow("Outlet Vat No", "")}
            ${infoRow("Distributor Vat No", "")}
            ${infoRow("Credit Period", creditPeriod)}
          </table>
        </td>
        <td style="vertical-align:top;width:42%;">
          <table style="border-collapse:collapse;font-size:15px;width:100%;">
            ${infoRow("Invoice No", esc(invoiceNo))}
            ${infoRow("Invoice Date", formatInvoiceDate(invoice.createdAt || invoice.date))}
            ${infoRow("Sales Person", esc(String(invoice.salesRep || "-").toUpperCase()))}
            ${infoRow("Tel", esc(invoice.salesRepPhone || ""))}
            ${infoRow("Payment Mode", paymentMode)}
          </table>
        </td>
      </tr>
    </table>

    <div style="font-size:14.5px;margin:4px 0 2px;">Orderd Products</div>
    ${tableHead}
      <tbody>${pageRows.map(rowHTML).join("")}</tbody>
    </table>

    ${isLast ? footerHTML : ""}

    <div style="flex:1;"></div>
    <div style="text-align:right;font-size:15px;font-weight:700;padding-top:8px;">Page ${pageNo} of ${totalPages}</div>
  </div>`;
    })
    .join("");
};
