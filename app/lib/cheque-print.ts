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
  acPayeeOnly?: boolean; // print A/C Payee Only crossing lines
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

// Split amount-in-words into lines at word boundaries (max ~55 chars per line)
function splitWordLines(text: string, maxChars = 55): [string, string] {
  if (text.length <= maxChars) return [text, ""];
  const ws = text.split(" ");
  let line1 = "";
  for (const w of ws) {
    const next = line1 ? `${line1} ${w}` : w;
    if (next.length > maxChars && line1) break;
    line1 = next;
  }
  const line2 = text.slice(line1.length).trim();
  return [line1, line2];
}

// ─── Pan Asia Bank Template ───────────────────────────────────────────────────
// Cheque leaf: 200 mm wide × 85 mm tall

function buildPanAsiaHTML(data: ChequeData): string {
  const { dd, mm, yyyy } = formatChequeDate(data.chequeDate);
  const yy = yyyy.slice(2); // "20" is pre-printed on the cheque
  const words = amountToWords(data.amount);
  const figures = formatAmount(data.amount);
  const [line1, line2] = splitWordLines(words);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: 178mm 90mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: transparent; }
  .page {
    width: 178mm;
    height: 90mm;
    overflow: hidden;
    position: relative;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9pt;
  }
  /* A/C Payee Only crossing — two solid parallel lines with text between them */
  .crossing {
    position: absolute;
    top: 9mm;
    left: 80mm;
    width: 32mm;
    border-top: 1.5px solid #000;
    border-bottom: 1.5px solid #000;
    padding: 2mm 3mm;
    text-align: center;
    font-size: 6.5pt;
    font-weight: bold;
    letter-spacing: 0.4px;
  }
  /* Date — "20" is pre-printed; we print DD MM YY only.
     Each pair sits in its own box column — adjust left values after test print. */
  .date-dd {
    position: absolute;
    top: 8.5mm;
    left: 122mm;
    font-size: 9pt;
    font-weight: bold;
    letter-spacing: 5mm;
  }
  .date-mm {
    position: absolute;
    top: 8.5mm;
    left: 134mm;
    font-size: 9pt;
    font-weight: bold;
    letter-spacing: 5mm;
  }
  .date-yy {
    position: absolute;
    top: 8.5mm;
    left: 160mm;
    font-size: 9pt;
    font-weight: bold;
    letter-spacing: 5mm;
  }
  .payee {
    position: absolute;
    top: 20mm;
    left: 18mm;
    width: 128mm;
    font-size: 10pt;
    font-weight: bold;
    white-space: nowrap;
    overflow: hidden;
  }
  .words-1 {
    position: absolute;
    top: 32mm;
    left: 18mm;
    font-size: 9pt;
    white-space: nowrap;
  }
  .words-2 {
    position: absolute;
    top: 38mm;
    left: 18mm;
    font-size: 9pt;
    white-space: nowrap;
  }
  .figures {
    position: absolute;
    top: 42mm;
    right: 16mm;
    width: 30mm;
    text-align: right;
    font-size: 10pt;
    font-weight: bold;
  }
</style>
</head>
<body>
<div class="page">
  ${data.acPayeeOnly ? '<div class="crossing">A/C PAYEE ONLY</div>' : ''}
  <div class="date-dd">${dd}</div>
  <div class="date-mm">${mm}</div>
  <div class="date-yy">${yy}</div>
  <div class="payee">${data.payeeName}</div>
  <div class="words-1">${line1}</div>
  ${line2 ? `<div class="words-2">${line2}</div>` : ''}
  <div class="figures">${figures}</div>
</div>
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
  @page { size: 200mm 85mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: transparent; }
  .page {
    width: 200mm;
    height: 85mm;
    overflow: hidden;
    position: relative;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9pt;
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
<div class="page">
  <div class="date-block">
    <span>${dd}</span><span class="date-sep">/</span><span>${mm}</span><span class="date-sep">/</span><span>${yyyy}</span>
  </div>
  <div class="payee">${data.payeeName}</div>
  ${data.payeeAccountName ? `<div class="payee-account">${data.payeeAccountName}</div>` : ""}
  <div class="words">${words}</div>
  <div class="figures">${figures}</div>
</div>
</body>
</html>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function printCheque(template: BankTemplate, data: ChequeData): void {
  const html = template === "pan_asia" ? buildPanAsiaHTML(data) : buildNTBHTML(data);
  printHTML(html);
}
