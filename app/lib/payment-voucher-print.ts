/**
 * payment-voucher-print.ts
 * Prints a supplier payment voucher — signed by whoever takes the cheques.
 * Two copies on one A4 (Office Copy on top, Receiver Copy below, cut line between).
 */

import { amountToWords } from "@/app/lib/cheque-print";
import { BUSINESS_NAMES } from "@/app/config/business-constants";

export interface VoucherCheque {
  cheque_number: string | null;
  cheque_date: string | null;
  account_name: string | null;
  account_number?: string | null;
  amount: number;
}

export interface VoucherInvoice {
  purchase_id: string | null;
  invoice_no: string | null;
  invoice_date: string | null;
  invoice_total: number;
  paid_amount: number;
  cheque_number: string | null;
}

export interface PaymentVoucher {
  id: string;
  voucher_number: string;
  business_id: string | null;
  supplier_id?: string | null;
  supplier_name: string | null;
  voucher_date: string;
  receiver_name: string | null;
  receiver_nic: string | null;
  receiver_designation: string | null;
  receiver_phone: string | null;
  total_amount: number;
  cheques: VoucherCheque[];
  invoices: VoucherInvoice[];
  notes: string | null;
  prepared_by: string | null;
  created_at: string;
}

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const money = (n: number) =>
  new Intl.NumberFormat("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number(n) || 0
  );

const date = (d: string | null | undefined) => {
  if (!d) return "—";
  const x = new Date(d);
  if (isNaN(x.getTime())) return esc(d);
  return x.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
};

// Half of A4 holds the voucher only up to this many table rows (invoices + cheques).
// Above that, each copy gets its own full A4 page.
const HALF_PAGE_MAX_ROWS = 15;

function copyHTML(v: PaymentVoucher, copyLabel: string): string {
  const businessName =
    (v.business_id && (BUSINESS_NAMES as Record<string, string>)[v.business_id]) ||
    "Champika Hardware";

  const invoiceRows = (v.invoices ?? [])
    .map(
      (i, idx) => `
      <tr>
        <td class="c">${idx + 1}</td>
        <td>${esc(i.invoice_no || "—")}</td>
        <td>${esc(i.purchase_id || "—")}</td>
        <td class="c">${date(i.invoice_date)}</td>
        <td class="r">${money(i.invoice_total)}</td>
        <td class="mono c">${esc(i.cheque_number || "—")}</td>
        <td class="r b">${money(i.paid_amount)}</td>
      </tr>`
    )
    .join("");

  const chequeRows = (v.cheques ?? [])
    .map(
      (c, idx) => `
      <tr>
        <td class="c">${idx + 1}</td>
        <td class="mono b">${esc(c.cheque_number || "—")}</td>
        <td class="c">${date(c.cheque_date)}</td>
        <td>${esc(c.account_name || "—")}${c.account_number ? ` <span class="muted">(${esc(c.account_number)})</span>` : ""}</td>
        <td class="r b">${money(c.amount)}</td>
      </tr>`
    )
    .join("");

  const chequeCount = v.cheques?.length ?? 0;

  return `
  <div class="head">
    <div>
      <div class="biz">Champika Hardware</div>
      <div class="muted">${businessName !== "Champika Hardware" ? `${esc(businessName)} · ` : ""}Supplier Payment</div>
    </div>
    <div class="copy-tag">${esc(copyLabel)}</div>
    <div>
      <div class="title">PAYMENT VOUCHER</div>
      <div class="vno">${esc(v.voucher_number)}</div>
    </div>
  </div>

  <div class="info">
    <div><span>Paid To:</span> <b>${esc(v.supplier_name || "—")}</b></div>
    <div><span>Date:</span> <b>${date(v.voucher_date)}</b></div>
    <div><span>Cheques:</span> ${chequeCount} &nbsp; <span>Invoices:</span> ${v.invoices?.length ?? 0}</div>
  </div>

  <h3>Invoice Details</h3>
  <table>
    <thead><tr>
      <th class="c" style="width:18px">#</th><th>Supplier Invoice No</th><th>Our Bill ID</th>
      <th class="c">Invoice Date</th><th class="r">Invoice Amount</th><th class="c">Cheque No</th><th class="r">Paid Amount</th>
    </tr></thead>
    <tbody>${invoiceRows}</tbody>
    <tfoot><tr><td colspan="6" class="r">TOTAL</td><td class="r">${money(v.total_amount)}</td></tr></tfoot>
  </table>

  <h3>Cheque Details</h3>
  <table>
    <thead><tr>
      <th class="c" style="width:18px">#</th><th>Cheque No</th><th class="c">Cheque Date</th><th>Drawn From (Account)</th><th class="r">Amount (Rs.)</th>
    </tr></thead>
    <tbody>${chequeRows}</tbody>
  </table>

  <div class="words"><b>Amount in words:</b> Rupees ${esc(amountToWords(Number(v.total_amount) || 0))}
    &nbsp;<b>(Rs. ${money(v.total_amount)})</b>${v.notes ? ` &nbsp;·&nbsp; <b>Notes:</b> ${esc(v.notes)}` : ""}</div>

  <div class="recv">
    <p><b>RECEIVED BY (AUTHORIZED PERSON)</b> — I acknowledge receipt of the above ${chequeCount} cheque(s) totalling
      <b>Rs. ${money(v.total_amount)}</b> on behalf of <b>${esc(v.supplier_name || "")}</b>.</p>
    <div class="line"><span>Name:</span><div class="fill">${esc(v.receiver_name || "")}</div>
      <span>NIC / ID No:</span><div class="fill w35">${esc(v.receiver_nic || "")}</div></div>
    <div class="line"><span>Designation:</span><div class="fill">${esc(v.receiver_designation || "")}</div>
      <span>Mobile No:</span><div class="fill w35">${esc(v.receiver_phone || "")}</div></div>
    <div class="line"><span>Signature:</span><div class="fill sign"></div>
      <span>Date:</span><div class="fill w35"></div></div>
  </div>`;
}

export function buildVoucherHTML(v: PaymentVoucher): string {
  const rows = (v.invoices?.length || 0) + (v.cheques?.length || 0);
  const half = rows <= HALF_PAGE_MAX_ROWS;

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<title>&#8203;</title>
<style>
  /* margin 0 stops the browser printing its own date / title / URL header & footer */
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9.5px; color: #111; background: #fff; }
  .copy { width: 210mm; padding: 7mm 11mm 5mm; overflow: hidden; }
  .copy.half { height: 148.4mm; }
  .copy.half.top { border-bottom: 1px dashed #888; position: relative; }
  .copy.half.top::after { content: "✂  cut here"; position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%);
    background: #fff; padding: 0 6px; font-size: 8px; color: #888; }
  .copy.full { min-height: 297mm; page-break-after: always; break-after: page; }
  .copy.full:last-child { page-break-after: auto; break-after: auto; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1.5px solid #111; padding-bottom: 4px; }
  .biz { font-size: 15px; font-weight: 700; }
  .copy-tag { align-self: center; border: 1px solid #111; padding: 2px 8px; font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
  .title { font-size: 13px; font-weight: 700; letter-spacing: 2px; text-align: right; }
  .vno { font-family: monospace; font-size: 12px; text-align: right; margin-top: 2px; }
  .info { display: flex; justify-content: space-between; gap: 12px; margin: 5px 0 2px; }
  .info span { color: #555; }
  h3 { font-size: 9.5px; margin: 6px 0 2px; text-transform: uppercase; letter-spacing: 1px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #444; padding: 1.5px 5px; }
  th { background: #eee; font-size: 8.5px; text-align: left; }
  .c { text-align: center; } .r { text-align: right; } .b { font-weight: 700; }
  .mono { font-family: monospace; } .muted { color: #666; font-size: 8.5px; }
  tfoot td { font-weight: 700; background: #f6f6f6; }
  .words { margin-top: 5px; padding: 3px 6px; border: 1px dashed #444; }
  .recv { margin-top: 6px; border: 1.2px solid #111; padding: 5px 8px 6px; }
  .recv p { margin: 0; }
  .line { display: flex; gap: 6px; margin-top: 9px; align-items: flex-end; }
  .line span { white-space: nowrap; }
  .line .fill { flex: 1; border-bottom: 1px dotted #111; min-height: 13px; padding-left: 4px; font-weight: 700; }
  .line .fill.w35 { flex: 0 0 35%; }
  .line .sign { min-height: 22px; }
</style></head>
<body>
  <div class="copy ${half ? "half top" : "full"}">${copyHTML(v, "Office Copy")}</div>
  <div class="copy ${half ? "half" : "full"}">${copyHTML(v, "Receiver Copy")}</div>
</body></html>`;
}

export function printPaymentVoucher(v: PaymentVoucher): void {
  const iframe = document.createElement("iframe");
  Object.assign(iframe.style, {
    position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0", visibility: "hidden",
  });
  document.body.appendChild(iframe);
  iframe.srcdoc = buildVoucherHTML(v);
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 3000);
  };
}
