/**
 * cheque-print.ts
 * Prints supplier payment cheques directly onto physical cheque leaves.
 * Designed for Epson L380 with rear manual feed.
 * Supports Pan Asia Bank and Nations Trust Bank Sri Lanka layouts.
 *
 * Cheque leaf size: 200mm × 85mm (landscape)
 * All positions are in millimetres from top-left corner.
 */

// ─── Amount to Words ──────────────────────────────────────────────────────────

const ones = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function wordifyHundreds(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + wordifyHundreds(n % 100) : "");
}

export function amountToWords(amount: number): string {
  const fixed = Math.round(amount * 100);
  const rupees = Math.floor(fixed / 100);
  const cents = fixed % 100;

  if (rupees === 0 && cents === 0) return "Zero Rupees Only";

  let words = "Rupees ";

  if (rupees >= 10_000_000) {
    words += wordifyHundreds(Math.floor(rupees / 10_000_000)) + " Crore ";
    const rem = rupees % 10_000_000;
    if (rem > 0) words += wordifyHundreds(Math.floor(rem / 100_000)) + " Lakh " + wordifyHundreds(rem % 100_000) + " ";
  } else if (rupees >= 100_000) {
    words += wordifyHundreds(Math.floor(rupees / 100_000)) + " Lakh ";
    const rem = rupees % 100_000;
    if (rem > 0) words += wordifyHundreds(Math.floor(rem / 1000)) + " Thousand " + wordifyHundreds(rem % 1000) + " ";
  } else if (rupees >= 1000) {
    words += wordifyHundreds(Math.floor(rupees / 1000)) + " Thousand ";
    const rem = rupees % 1000;
    if (rem > 0) words += wordifyHundreds(rem) + " ";
  } else if (rupees > 0) {
    words += wordifyHundreds(rupees) + " ";
  }

  words = words.trim();

  if (cents > 0) {
    words += ` and ${wordifyHundreds(cents)} Cents`;
  }

  return words + " Only";
}

// ─── Cheque Print Templates ───────────────────────────────────────────────────

export type BankTemplate = "pan_asia" | "ntb";

interface ChequeData {
  payeeName: string;
  payeeAccountName?: string; // supplier's bank account name
  amount: number;
  chequeDate: string; // YYYY-MM-DD
  chequeNumber: string;
  accountName: string; // company account this cheque draws from
}

function formatChequeDate(dateStr: string): { dd: string; mm: string; yyyy: string } {
  const d = new Date(dateStr);
  return {
    dd:   String(d.getDate()).padStart(2, "0"),
    mm:   String(d.getMonth() + 1).padStart(2, "0"),
    yyyy: String(d.getFullYear()),
  };
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Shared print helper — opens an invisible iframe and triggers window.print()
function printHTML(html: string): void {
  const iframe = document.createElement("iframe");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
    visibility: "hidden",
  });
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  if (!win) return;
  iframe.srcdoc = html;
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 3000);
  };
}

// ─── Pan Asia Bank Template ───────────────────────────────────────────────────
// Cheque leaf: 200 mm wide × 85 mm tall

function buildPanAsiaHTML(data: ChequeData): string {
  const { dd, mm, yyyy } = formatChequeDate(data.chequeDate);
  const words = amountToWords(data.amount);
  const figures = formatAmount(data.amount);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page {
    size: 200mm 85mm;
    margin: 0;
  }
  body {
    width: 200mm;
    height: 85mm;
    position: relative;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9pt;
    overflow: hidden;
    background: transparent;
  }
  .date-block {
    position: absolute;
    top: 13mm;
    left: 137mm;
    display: flex;
    gap: 1mm;
    align-items: center;
    font-size: 9pt;
    font-weight: bold;
    letter-spacing: 1px;
  }
  .date-sep { font-weight: normal; font-size: 8pt; }
  .payee {
    position: absolute;
    top: 27mm;
    left: 28mm;
    width: 140mm;
    font-size: 10pt;
    font-weight: bold;
    white-space: nowrap;
    overflow: hidden;
  }
  .payee-account {
    position: absolute;
    top: 33mm;
    left: 28mm;
    width: 140mm;
    font-size: 8pt;
    color: #333;
    white-space: nowrap;
    overflow: hidden;
  }
  .words {
    position: absolute;
    top: 41mm;
    left: 20mm;
    width: 148mm;
    font-size: 9pt;
    line-height: 1.4;
    word-break: break-word;
  }
  .figures {
    position: absolute;
    top: 41mm;
    right: 12mm;
    width: 28mm;
    text-align: right;
    font-size: 10pt;
    font-weight: bold;
  }
</style>
</head>
<body>
  <div class="date-block">
    <span>${dd}</span><span class="date-sep">/</span><span>${mm}</span><span class="date-sep">/</span><span>${yyyy}</span>
  </div>
  <div class="payee">${data.payeeName}</div>
  ${data.payeeAccountName ? `<div class="payee-account">${data.payeeAccountName}</div>` : ""}
  <div class="words">${words}</div>
  <div class="figures">${figures}</div>
</body>
</html>`;
}

// ─── Nations Trust Bank Template ─────────────────────────────────────────────
// Cheque leaf: 200 mm wide × 85 mm tall

function buildNTBHTML(data: ChequeData): string {
  const { dd, mm, yyyy } = formatChequeDate(data.chequeDate);
  const words = amountToWords(data.amount);
  const figures = formatAmount(data.amount);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page {
    size: 200mm 85mm;
    margin: 0;
  }
  body {
    width: 200mm;
    height: 85mm;
    position: relative;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9pt;
    overflow: hidden;
    background: transparent;
  }
  .date-block {
    position: absolute;
    top: 15mm;
    left: 139mm;
    display: flex;
    gap: 1mm;
    align-items: center;
    font-size: 9pt;
    font-weight: bold;
    letter-spacing: 1px;
  }
  .date-sep { font-weight: normal; font-size: 8pt; }
  .payee {
    position: absolute;
    top: 29mm;
    left: 26mm;
    width: 142mm;
    font-size: 10pt;
    font-weight: bold;
    white-space: nowrap;
    overflow: hidden;
  }
  .payee-account {
    position: absolute;
    top: 35mm;
    left: 26mm;
    width: 142mm;
    font-size: 8pt;
    color: #333;
    white-space: nowrap;
    overflow: hidden;
  }
  .words {
    position: absolute;
    top: 43mm;
    left: 18mm;
    width: 150mm;
    font-size: 9pt;
    line-height: 1.4;
    word-break: break-word;
  }
  .figures {
    position: absolute;
    top: 43mm;
    right: 10mm;
    width: 28mm;
    text-align: right;
    font-size: 10pt;
    font-weight: bold;
  }
</style>
</head>
<body>
  <div class="date-block">
    <span>${dd}</span><span class="date-sep">/</span><span>${mm}</span><span class="date-sep">/</span><span>${yyyy}</span>
  </div>
  <div class="payee">${data.payeeName}</div>
  ${data.payeeAccountName ? `<div class="payee-account">${data.payeeAccountName}</div>` : ""}
  <div class="words">${words}</div>
  <div class="figures">${figures}</div>
</body>
</html>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function printCheque(template: BankTemplate, data: ChequeData): void {
  const html = template === "pan_asia" ? buildPanAsiaHTML(data) : buildNTBHTML(data);
  printHTML(html);
}
