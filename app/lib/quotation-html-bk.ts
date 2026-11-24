/**
 * quotation-html-bk.ts
 * BK Wiring (website) quotation print — same look as the shop's quotation PDF
 * (app/shop/_components/CompareBrands.tsx → makeQuotationPdf): navy + royal-blue
 * letterhead, logo with "බඩු කඩේ", customer / delivery / payment strip, navy table
 * head, NET QUOTATION TOTAL bar, terms and footer. Works on server and client.
 */
import { DIVISIONS } from "./invoice-html";

const FONT = "'Plus Jakarta Sans', 'Inter', -apple-system, 'Segoe UI', Arial, Helvetica, sans-serif";
const SI_FONT = "'Abhaya Libre', 'Yaldevi', 'Iskoola Pota', 'Noto Serif Sinhala', serif";
const FONT_LINK =
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Abhaya+Libre:wght@800&family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap">';

const NAVY = "#0b1120";
const BLUE = "#2563eb";
const BLUE_SOFT = "#eff6ff";
const INK = "#0f172a";
const INK_2 = "#334155";
const MUTED = "#64748b";
const LINE = "#cbd5e1";
const LINE_SOFT = "#e2e8f0";
const SOFT = "#f8fafc";
const GREEN = "#15803d";
const GREEN_SOFT = "#dcfce7";

const esc = (s: any) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rs = (n: number) =>
  `Rs ${new Intl.NumberFormat("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)}`;
const longDate = (d: string) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "-";

/** The shop's logo mark (same as BrandLogoMark), as plain SVG. */
const markSvg = (size: number, uid: string) => `
<svg viewBox="0 0 48 48" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" style="display:block;flex-shrink:0;">
  <defs>
    <linearGradient id="bg${uid}" x1="4" y1="2" x2="44" y2="46" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#1e3a8a"/><stop offset="48%" stop-color="#1d4ed8"/><stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="rim${uid}" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.8"/><stop offset="50%" stop-color="#60a5fa" stop-opacity="0.3"/><stop offset="100%" stop-color="#f97316" stop-opacity="0.7"/>
    </linearGradient>
    <linearGradient id="bolt${uid}" x1="17" y1="13" x2="31" y2="39" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fb923c"/><stop offset="50%" stop-color="#f97316"/><stop offset="100%" stop-color="#e11d48"/>
    </linearGradient>
  </defs>
  <rect x="1.5" y="1.5" width="45" height="45" rx="12" fill="url(#bg${uid})"/>
  <rect x="2.2" y="2.2" width="43.6" height="43.6" rx="11.3" fill="none" stroke="url(#rim${uid})" stroke-width="1.4"/>
  <circle cx="24" cy="24" r="14.5" fill="none" stroke="#38bdf8" stroke-opacity="0.16" stroke-width="1.2" stroke-dasharray="3 3"/>
  <path d="M13.5 20.5V33C13.5 34.3807 14.6193 35.5 16 35.5H18.8M34.5 20.5V33C34.5 34.3807 33.3807 35.5 32 35.5H29.2" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M9.5 21.2L24 9.2L38.5 21.2" fill="none" stroke="#ffffff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M25.8 15.2L16.8 26.5H23.2L20.8 37.2L31.2 24.8H24.6L25.8 15.2Z" fill="url(#bolt${uid})" stroke="#ffffff" stroke-width="0.9" stroke-linejoin="round"/>
</svg>`;

/** Logo mark + "BK WIRING බඩු කඩේ" on a light background. */
const logoBlock = (k: number, uid: string) => `
<div style="display:flex;align-items:center;gap:${9 * k}px;">
  ${markSvg(Math.round(40 * k), uid)}
  <div style="display:flex;align-items:baseline;gap:${6 * k}px;white-space:nowrap;line-height:1;">
    <span style="font-size:${24 * k}px;font-weight:800;color:${INK};letter-spacing:-0.3px;">BK</span>
    <span style="font-size:${24 * k}px;font-weight:800;color:${BLUE};letter-spacing:-0.3px;">WIRING</span>
    <span style="font-family:${SI_FONT};font-size:${30 * k}px;font-weight:800;font-style:italic;color:#f97316;">බඩු කඩේ</span>
  </div>
</div>`;

/**
 * @param compact true = half-page (A5) size
 */
export const generateBkQuotationHTML = (quotation: any, compact = false): string => {
  const cfg = DIVISIONS.website ?? DIVISIONS.retail;
  const k = compact ? 0.72 : 1; // font / spacing scale
  const px = (n: number) => `${(n * k).toFixed(1)}px`;

  // Server PDF passes { customer: { shop, name, phone, address } }; the browser passes the /api/quotations/[id] shape.
  const shopName = quotation.customer?.shop || quotation.shopName || quotation.customerName || "Valued Customer";
  const contact = quotation.customer?.name || quotation.customerOwner || "";
  const phone = quotation.customer?.phone || quotation.customerPhone || quotation.phone || "";
  const address = quotation.customer?.address || quotation.customerAddress || quotation.address || "";
  const ref = quotation.quotationNo || "-";
  const dateText = longDate(quotation.date || quotation.createdAt);
  const items: any[] = quotation.items || [];
  const notes = String(quotation.notes || "").trim();

  const lines = items.map((it) => {
    const price = Number(it.unitPrice ?? it.price ?? 0);
    const qty = Number(it.quantity || 0);
    const total = Number(it.total ?? price * qty);
    const unitNet = qty > 0 ? total / qty : price;
    const mrp = Math.max(Number(it.mrp || 0), price);
    const discPct = mrp > unitNet + 0.005 ? Math.round(((mrp - unitNet) / mrp) * 100) : 0;
    return { it, qty, free: Number(it.freeQuantity || it.free || 0), mrp, unitNet, total, discPct };
  });
  const subTotal = lines.reduce((s, l) => s + l.total, 0);
  const grandTotal = Number(quotation.grandTotal ?? quotation.totalAmount ?? subTotal);
  const extraDiscount = Math.max(0, subTotal - grandTotal);
  const mrpTotal = lines.reduce((s, l) => s + l.mrp * l.qty, 0);
  const saving = Math.max(0, mrpTotal - grandTotal);
  const savingPct = mrpTotal > 0 && saving > 0.5 ? Math.round((saving / mrpTotal) * 100) : 0;
  const units = lines.reduce((s, l) => s + l.qty, 0);
  const itemsWord = `${lines.length} ${lines.length === 1 ? "item" : "items"}`;

  const PER_PAGE = compact ? 10 : 15;
  const chunks: (typeof lines)[] = [];
  for (let i = 0; i < lines.length; i += PER_PAGE) chunks.push(lines.slice(i, i + PER_PAGE));
  if (chunks.length === 0) chunks.push([]);
  const pages = chunks.length;

  const th = (label: string, align: string, width?: string) =>
    `<th style="background:${NAVY};color:#fff;font-size:${px(10.5)};font-weight:700;text-align:${align};padding:${px(8)} ${px(7)};${width ? `width:${width};` : ""}border:1px solid ${NAVY};">${label}</th>`;
  const td = (html: string, style: string) =>
    `<td style="padding:${px(7)} ${px(7)};font-size:${px(11)};border:1px solid ${LINE_SOFT};vertical-align:middle;${style}">${html}</td>`;

  const uid = Math.random().toString(36).slice(2, 8);

  const body = chunks
    .map((chunk, pi) => {
      const isFirst = pi === 0;
      const isLast = pi === pages - 1;
      const start = pi * PER_PAGE;

      const rows = chunk
        .map((l, i) => {
          const name = esc(l.it.productName || l.it.name || "-");
          const sku = l.it.sku && l.it.sku !== "N/A" ? `<div style="font-size:${px(9)};color:${MUTED};font-weight:500;margin-top:1px;">${esc(l.it.sku)}</div>` : "";
          const disc = l.discPct > 0
            ? td(`-${l.discPct}%`, `text-align:center;color:${GREEN};background:${GREEN_SOFT};font-weight:700;font-size:${px(10)};`)
            : td("Net", `text-align:center;color:${MUTED};font-size:${px(10)};`);
          return `<tr>
            ${td(String(start + i + 1), `text-align:center;color:${MUTED};`)}
            ${td(`<div style="font-weight:700;color:${INK};">${name}</div>${sku}`, "")}
            ${td(`${l.qty}${l.free > 0 ? `<div style="font-size:${px(9)};color:${GREEN};">+${l.free} free</div>` : ""}`, "text-align:center;font-weight:700;")}
            ${td(rs(l.mrp), `text-align:right;color:${MUTED};font-size:${px(10.5)};white-space:nowrap;`)}
            ${disc}
            ${td(rs(l.unitNet), "text-align:right;font-weight:700;white-space:nowrap;")}
            ${td(rs(l.total), "text-align:right;font-weight:700;white-space:nowrap;")}
          </tr>`;
        })
        .join("");

      const foot = isLast
        ? `<tr style="background:${SOFT};">
            ${td("", `border-color:${LINE};`)}
            ${td(`Total (${itemsWord} &bull; ${units} ${units === 1 ? "unit" : "units"})`, `font-weight:700;border-color:${LINE};`)}
            ${td(String(units), `text-align:center;font-weight:700;border-color:${LINE};`)}
            ${td(mrpTotal > subTotal + 0.5 ? rs(mrpTotal) : "", `text-align:right;font-weight:700;color:${MUTED};border-color:${LINE};white-space:nowrap;`)}
            ${td(savingPct > 0 ? `-${savingPct}%` : "", `text-align:center;font-weight:700;color:${GREEN};border-color:${LINE};`)}
            ${td("", `border-color:${LINE};`)}
            ${td(rs(subTotal), `text-align:right;font-weight:800;border-color:${LINE};white-space:nowrap;`)}
          </tr>`
        : "";

      const summaryRows: { label: string; value: string; green?: boolean; red?: boolean }[] = [];
      if (saving > 0.5 && mrpTotal > 0) {
        summaryRows.push({ label: "Gross MRP Value", value: rs(mrpTotal) });
        if (mrpTotal - subTotal > 0.5) summaryRows.push({ label: "Discount on MRP", value: `- ${rs(mrpTotal - subTotal)}`, green: true });
      } else {
        summaryRows.push({ label: "Items Subtotal", value: rs(subTotal) });
      }
      if (extraDiscount > 0.5)
        summaryRows.push({
          label: `Extra Discount${quotation.extraDiscountPercent ? ` (${quotation.extraDiscountPercent}%)` : ""}`,
          value: `- ${rs(extraDiscount)}`,
          green: true,
        });
      summaryRows.push({ label: "Delivery", value: "Not included" });

      const terms = [
        `Prices include applicable taxes and are valid for 7 days from ${dateText} (subject to stock).`,
        "Doorstep delivery is available across the Galle area (delivery charges calculated at dispatch).",
        `To confirm this order, call / WhatsApp ${esc(cfg.tel)} or visit bkwiringbadukade.lk and quote Ref ${esc(ref)}.`,
      ];

      const bottom = isLast
        ? `
        <table style="width:100%;border-collapse:collapse;margin-top:${px(14)};page-break-inside:avoid;">
          <tr>
            <td style="vertical-align:top;padding-right:${px(18)};">
              <div style="font-size:${px(10.5)};font-weight:800;color:${INK};letter-spacing:0.3px;">TERMS &amp; ORDERING INSTRUCTIONS</div>
              <ol style="margin:${px(5)} 0 0;padding-left:${px(16)};font-size:${px(10)};color:${INK_2};line-height:1.55;">
                ${terms.map((t) => `<li>${t}</li>`).join("")}
              </ol>
              ${notes ? `<div style="margin-top:${px(8)};padding:${px(7)} ${px(10)};background:${SOFT};border-left:3px solid ${BLUE};font-size:${px(10)};color:${INK_2};line-height:1.5;white-space:pre-line;"><b style="color:${INK};">Notes:</b> ${esc(notes)}</div>` : ""}
            </td>
            <td style="vertical-align:top;width:${compact ? "46%" : "40%"};">
              <table style="width:100%;border-collapse:collapse;">
                ${summaryRows
                  .map(
                    (r) => `<tr>
                  <td style="padding:${px(5)} ${px(3)};font-size:${px(11)};color:${r.green ? GREEN : INK_2};${r.green ? "font-weight:700;" : ""}border-bottom:1px solid ${LINE_SOFT};">${r.label}</td>
                  <td style="padding:${px(5)} ${px(3)};font-size:${px(11)};font-weight:700;text-align:right;white-space:nowrap;color:${r.green ? GREEN : INK};border-bottom:1px solid ${LINE_SOFT};">${r.value}</td>
                </tr>`
                  )
                  .join("")}
              </table>
              <div style="margin-top:${px(7)};background:${NAVY};border-left:${px(6)} solid ${BLUE};border-radius:5px;padding:${px(10)} ${px(12)};display:flex;align-items:center;justify-content:space-between;">
                <span style="font-size:${px(11)};font-weight:800;color:#93c5fd;letter-spacing:0.3px;">NET QUOTATION TOTAL</span>
                <span style="font-size:${px(15)};font-weight:800;color:#fff;white-space:nowrap;">${rs(grandTotal)}</span>
              </div>
            </td>
          </tr>
        </table>
        <table style="width:100%;border-collapse:collapse;margin-top:${px(compact ? 22 : 40)};">
          <tr>
            <td style="width:40%;text-align:center;border-top:1.2px solid ${MUTED};padding-top:${px(4)};font-size:${px(10)};color:${INK_2};font-weight:600;">Prepared By</td>
            <td style="width:20%;"></td>
            <td style="width:40%;text-align:center;border-top:1.2px solid ${MUTED};padding-top:${px(4)};font-size:${px(10)};color:${INK_2};font-weight:600;">Customer Acceptance</td>
          </tr>
        </table>`
        : `<div style="margin-top:${px(10)};text-align:right;font-size:${px(10)};color:${MUTED};font-style:italic;">Continued on next page…</div>`;

      const page = `
  <div class="${compact ? "half-invoice" : "invoice-page"}" style="${compact ? "" : `page-break-after:${isLast ? "auto" : "always"};`}width:100%;min-height:${compact ? "136mm" : "277mm"};${compact ? "height:138mm;overflow:hidden;" : ""}padding:0 ${px(18)} ${px(10)};background:#fff;font-family:${FONT};color:${INK};box-sizing:border-box;display:flex;flex-direction:column;">
    <div style="margin:0 -${px(18)};height:${px(6)};background:${NAVY};"></div>
    <div style="margin:0 -${px(18)};height:${px(2)};background:${BLUE};"></div>

    <table style="width:100%;border-collapse:collapse;margin-top:${px(14)};">
      <tr>
        <td style="vertical-align:top;">
          ${logoBlock(k, uid + pi)}
          <div style="font-size:${px(11)};font-weight:700;color:${INK_2};margin-top:${px(8)};">Genuine House Wiring &amp; Electrical Accessories</div>
          <div style="font-size:${px(10)};color:${MUTED};margin-top:${px(3)};">
            Web: bkwiringbadukade.lk &nbsp;|&nbsp; Delivery: Galle Area &nbsp;|&nbsp; Tel: ${esc(cfg.tel)}
          </div>
        </td>
        <td style="vertical-align:top;text-align:right;white-space:nowrap;">
          <div style="font-size:${px(24)};font-weight:800;color:${NAVY};letter-spacing:0.5px;line-height:1;">QUOTATION</div>
          <div style="font-size:${px(14)};font-weight:800;color:${BLUE};margin-top:${px(6)};">${esc(ref)}${pages > 1 ? ` <span style="font-size:${px(10)};color:${MUTED};">(${pi + 1}/${pages})</span>` : ""}</div>
          <div style="font-size:${px(10.5)};color:${INK_2};margin-top:${px(5)};">Date: ${dateText}</div>
          <div style="font-size:${px(10.5)};color:${MUTED};margin-top:${px(2)};">Validity: 7 Days from issue date</div>
        </td>
      </tr>
    </table>

    <div style="border-top:2px solid ${NAVY};margin-top:${px(10)};"></div>
    <div style="border-top:0.8px solid ${BLUE};margin-top:${px(3)};margin-bottom:${px(12)};"></div>

    ${isFirst ? `
    <table style="width:100%;border-collapse:collapse;background:${SOFT};border:1px solid ${LINE};border-left:${px(5)} solid ${BLUE};margin-bottom:${px(14)};">
      <tr>
        <td style="width:36%;vertical-align:top;padding:${px(8)} ${px(12)};">
          <div style="font-size:${px(8.5)};font-weight:800;color:${BLUE};letter-spacing:0.5px;">CUSTOMER / PREPARED FOR</div>
          <div style="font-size:${px(13)};font-weight:800;color:${INK};margin-top:${px(4)};">${esc(shopName)}</div>
          <div style="font-size:${px(10)};color:${MUTED};margin-top:${px(3)};line-height:1.45;">
            ${[contact && contact !== shopName ? esc(contact) : "", phone ? esc(phone) : "", address ? esc(address) : ""].filter(Boolean).join(" &bull; ") || `${itemsWord} &bull; ${units} ${units === 1 ? "unit" : "units"} total`}
          </div>
        </td>
        <td style="width:32%;vertical-align:top;padding:${px(8)} ${px(12)};border-left:1px solid ${LINE_SOFT};">
          <div style="font-size:${px(8.5)};font-weight:800;color:${MUTED};letter-spacing:0.5px;">DELIVERY &amp; COVERAGE</div>
          <div style="font-size:${px(11.5)};font-weight:800;color:${INK};margin-top:${px(4)};">Galle Area Doorstep Delivery</div>
          <div style="font-size:${px(10)};color:${MUTED};margin-top:${px(3)};">Fast dispatch across Galle &amp; suburbs</div>
        </td>
        <td style="vertical-align:top;padding:${px(8)} ${px(12)};border-left:1px solid ${LINE_SOFT};">
          <div style="font-size:${px(8.5)};font-weight:800;color:${MUTED};letter-spacing:0.5px;">PAYMENT &amp; ASSURANCE</div>
          <div style="font-size:${px(11.5)};font-weight:800;color:${INK};margin-top:${px(4)};">${quotation.paymentType === "Credit" ? "Credit (as agreed)" : "Cash / Bank Transfer"}</div>
          <div style="font-size:${px(10)};color:${MUTED};margin-top:${px(3)};">100% Genuine Branded Products</div>
        </td>
      </tr>
    </table>` : ""}

    <table style="width:100%;border-collapse:collapse;">
      <thead><tr>
        ${th("#", "center", "5%")}
        ${th("Item Description", "left")}
        ${th("Qty", "center", "7%")}
        ${th("MRP", "right", "13%")}
        ${th("Disc.", "center", "8%")}
        ${th("Unit Price", "right", "13%")}
        ${th("Line Total", "right", "15%")}
      </tr></thead>
      <tbody>
        ${isFirst && lines.length === 0 ? `<tr><td colspan="7" style="padding:${px(12)};text-align:center;color:${MUTED};border:1px solid ${LINE_SOFT};">No items</td></tr>` : ""}
        ${rows}
        ${foot}
      </tbody>
    </table>

    ${bottom}

    <div style="flex:1;"></div>

    <div style="border-top:1px solid ${LINE};margin-top:${px(10)};padding-top:${px(5)};display:flex;justify-content:space-between;font-size:${px(9.5)};color:${MUTED};">
      <span>BK Wiring &bull; bkwiringbadukade.lk &bull; Galle Area Delivery &bull; ${esc(cfg.tel)}</span>
      <span>${esc(ref)} &nbsp;|&nbsp; Page ${pi + 1} of ${pages}</span>
    </div>
  </div>`;
      // Half page: top half of an A4 sheet, like the other half-page prints
      return compact
        ? `<div class="a4-sheet" style="page-break-after:always;width:210mm;height:297mm;background:#fff;box-sizing:border-box;padding-top:4mm;">${page}</div>`
        : page;
    })
    .join("");

  return FONT_LINK + body;
};
