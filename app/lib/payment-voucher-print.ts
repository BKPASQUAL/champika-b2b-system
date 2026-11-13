/**
 * payment-voucher-print.ts
 * Prints a supplier payment voucher — signed by whoever takes the cheques.
 * One copy only, on the top half of an A4 sheet (full page if there are many rows).
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
// Above that, the voucher uses a full A4 page.
const HALF_PAGE_MAX_ROWS = 7;

function copyHTML(v: PaymentVoucher): string {
  const businessName =
    (v.business_id && (BUSINESS_NAMES as Record<string, string>)[v.business_id]) ||
    "Champika Hardware";

  const invoiceRows = (v.invoices ?? [])
    .map(
      (i, idx) => `
      <tr>
        <td class="c n">${idx + 1}</td>
        <td>${esc(i.invoice_no || "—")}</td>
        <td>${esc(i.purchase_id || "—")}</td>
        <td class="c">${date(i.invoice_date)}</td>
        <td class="r">${money(i.invoice_total)}</td>
        <td class="c mono">${esc(i.cheque_number || "—")}</td>
        <td class="r b">${money(i.paid_amount)}</td>
      </tr>`
    )
    .join("");

  const chequeRows = (v.cheques ?? [])
    .map(
      (c, idx) => `
      <tr>
        <td class="c n">${idx + 1}</td>
        <td class="mono b">${esc(c.cheque_number || "—")}</td>
        <td class="c">${date(c.cheque_date)}</td>
        <td>${esc(c.account_name || "—")}${c.account_number ? ` <span class="muted">· ${esc(c.account_number)}</span>` : ""}</td>
        <td class="r b">${money(c.amount)}</td>
      </tr>`
    )
    .join("");

  const chequeCount = v.cheques?.length ?? 0;
  const invoiceCount = v.invoices?.length ?? 0;
  const branch = businessName !== "Champika Hardware" ? businessName : "";

  return `
  <header class="head">
    <div class="brand">
      <div class="biz">CHAMPIKA HARDWARE</div>
      <div class="sub">${branch ? `${esc(branch)} &nbsp;|&nbsp; ` : ""}Supplier Payments</div>
    </div>
    <div class="docbox">
      <div class="doctitle">PAYMENT VOUCHER</div>
      <table class="meta">
        <tr><td>Voucher No</td><td class="mono b">${esc(v.voucher_number)}</td></tr>
        <tr><td>Date</td><td class="b">${date(v.voucher_date)}</td></tr>
      </table>
    </div>
  </header>

  <section class="party">
    <div class="pcell grow">
      <div class="lbl">Paid To</div>
      <div class="pval">${esc(v.supplier_name || "—")}</div>
    </div>
    <div class="pcell">
      <div class="lbl">Payment Mode</div>
      <div class="pval sm">Cheque</div>
    </div>
    <div class="pcell">
      <div class="lbl">Cheques / Invoices</div>
      <div class="pval sm">${chequeCount} / ${invoiceCount}</div>
    </div>
  </section>

  <div class="sec">Invoice Details</div>
  <table class="grid">
    <thead><tr>
      <th class="c n">#</th><th>Supplier Invoice No</th><th>Our Bill ID</th>
      <th class="c">Invoice Date</th><th class="r">Invoice Amount</th><th class="c">Cheque No</th><th class="r">Paid Amount</th>
    </tr></thead>
    <tbody>${invoiceRows}</tbody>
  </table>

  <div class="sec">Cheque Details</div>
  <table class="grid">
    <thead><tr>
      <th class="c n">#</th><th>Cheque No</th><th class="c">Cheque Date</th><th>Drawn From (Account)</th><th class="r">Amount (Rs.)</th>
    </tr></thead>
    <tbody>${chequeRows}</tbody>
  </table>

  <section class="sum">
    <div class="words">
      <div class="lbl">Amount in Words</div>
      <div>Rupees ${esc(amountToWords(Number(v.total_amount) || 0))}</div>
      ${v.notes ? `<div class="note"><span class="lbl">Notes:</span> ${esc(v.notes)}</div>` : ""}
    </div>
    <div class="total">
      <div class="lbl">Total Amount</div>
      <div class="tval">Rs. ${money(v.total_amount)}</div>
    </div>
  </section>

  <section class="recv">
    <div class="recv-h">RECEIVED BY &nbsp;<span>(Authorized Person)</span></div>
    <p class="decl">I acknowledge receipt of the above ${chequeCount} cheque(s) totalling
      <b>Rs. ${money(v.total_amount)}</b> on behalf of <b>${esc(v.supplier_name || "")}</b>.</p>
    <div class="recv-body">
      <div class="fields">
        <div class="f wide"><span>Name</span><div class="fill">${esc(v.receiver_name || "")}</div></div>
        <div class="f"><span>NIC / ID No</span><div class="fill">${esc(v.receiver_nic || "")}</div></div>
        <div class="f"><span>Mobile No</span><div class="fill">${esc(v.receiver_phone || "")}</div></div>
        <div class="f"><span>Designation</span><div class="fill">${esc(v.receiver_designation || "")}</div></div>
        <div class="f"><span>Date</span><div class="fill"></div></div>
      </div>
      <div class="signbox">
        <div class="signarea"></div>
        <div class="signlbl">Signature</div>
      </div>
    </div>
  </section>`;
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
  body { font-family: "Segoe UI", Arial, Helvetica, sans-serif; font-size: 9.5px; color: #1a1a1a; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .copy { width: 210mm; padding: 9mm 12mm 8mm; display: flex; flex-direction: column; }
  .copy.half { height: 148.4mm; overflow: hidden; }
  .copy.full { min-height: 297mm; }

  .c { text-align: center; } .r { text-align: right; } .b { font-weight: 700; }
  .mono { font-family: Consolas, "Courier New", monospace; letter-spacing: .3px; }
  .muted { color: #777; }
  .lbl { font-size: 7.5px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: .8px; }

  /* Header */
  .head { display: flex; justify-content: space-between; align-items: stretch; padding-bottom: 6px; border-bottom: 2px solid #1a1a1a; }
  .brand { display: flex; flex-direction: column; justify-content: center; }
  .biz { font-size: 17px; font-weight: 800; letter-spacing: 1.2px; }
  .sub { font-size: 8.5px; color: #555; margin-top: 2px; letter-spacing: .3px; }
  .docbox { border: 1px solid #1a1a1a; min-width: 62mm; }
  .doctitle { background: #1a1a1a; color: #fff; text-align: center; font-weight: 700; font-size: 10.5px; letter-spacing: 2.5px; padding: 3px 8px; }
  .meta { width: 100%; border-collapse: collapse; }
  .meta td { padding: 2px 8px; font-size: 9px; }
  .meta tr + tr td { border-top: 1px solid #ddd; }
  .meta td:first-child { color: #666; width: 42%; }
  .meta td:last-child { text-align: right; }

  /* Paid-to strip */
  .party { display: flex; margin-top: 7px; border: 1px solid #cfcfcf; }
  .pcell { padding: 4px 9px; min-width: 32mm; }
  .pcell + .pcell { border-left: 1px solid #cfcfcf; }
  .pcell.grow { flex: 1; }
  .pval { font-size: 12px; font-weight: 700; margin-top: 1px; }
  .pval.sm { font-size: 10px; }

  /* Tables */
  .sec { margin: 8px 0 3px; font-size: 8.5px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: #333; }
  .grid { width: 100%; border-collapse: collapse; }
  .grid th { background: #efefef; font-size: 8px; font-weight: 700; color: #333; text-transform: uppercase; letter-spacing: .3px;
    padding: 3.5px 6px; border-top: 1px solid #1a1a1a; border-bottom: 1px solid #1a1a1a; text-align: left; }
  .grid th.c { text-align: center; } .grid th.r { text-align: right; }
  .grid td { padding: 3.5px 6px; border-bottom: 1px solid #e2e2e2; }
  .grid tbody tr:last-child td { border-bottom: 1px solid #1a1a1a; }
  .grid .n { width: 22px; color: #777; }

  /* Totals */
  .sum { display: flex; gap: 8px; margin: 8px 0 8px; align-items: stretch; }
  .words { flex: 1; border: 1px solid #cfcfcf; padding: 4px 9px; font-size: 9px; }
  .words .lbl { margin-bottom: 1px; }
  .note { margin-top: 3px; }
  .total { min-width: 62mm; border: 1.5px solid #1a1a1a; padding: 4px 9px; text-align: right; background: #f4f4f4; }
  .tval { font-size: 14px; font-weight: 800; margin-top: 1px; }

  /* Received by — pushed to the bottom of the half page */
  .recv { margin-top: auto; border: 1px solid #1a1a1a; }
  .copy.full .recv { margin-top: 14px; }
  .recv-h { background: #efefef; border-bottom: 1px solid #1a1a1a; padding: 3px 9px; font-weight: 700; font-size: 9px; letter-spacing: 1.2px; }
  .recv-h span { font-weight: 400; color: #555; letter-spacing: .3px; }
  .decl { margin: 4px 9px 0; font-size: 8.5px; color: #333; }
  .recv-body { display: flex; gap: 10px; padding: 2px 9px 7px; }
  .fields { flex: 1; display: grid; grid-template-columns: 1fr 1fr; column-gap: 14px; }
  .f { display: flex; align-items: flex-end; gap: 6px; margin-top: 9px; }
  .f.wide { grid-column: 1 / -1; }
  .f span { white-space: nowrap; color: #555; font-size: 8.5px; min-width: 52px; }
  .fill { flex: 1; border-bottom: 1px dotted #1a1a1a; min-height: 13px; padding: 0 3px 1px; font-weight: 700; font-size: 10px; }
  .signbox { width: 52mm; display: flex; flex-direction: column; justify-content: flex-end; margin-top: 9px; }
  .signarea { flex: 1; min-height: 32px; border: 1px dashed #aaa; border-bottom: 1px solid #1a1a1a; }
  .signlbl { text-align: center; font-size: 8px; color: #555; text-transform: uppercase; letter-spacing: 1px; padding-top: 2px; }
</style></head>
<body>
  <div class="copy ${half ? "half" : "full"}">${copyHTML(v)}</div>
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
