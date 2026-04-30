/**
 * cheque-print.ts
 * Prints supplier payment cheques directly onto physical cheque leaves.
 * Designed for Epson L380 with rear manual feed.
 * Supports Pan Asia Bank and Nations Trust Bank Sri Lanka layouts.
 *
 * Cheque leaf size: 200mm × 85mm (landscape)
 * All positions are in millimetres from top-left corner.
 */

// ─── Amount to Words (Sri Lanka cheque-English standard) ─────────────────────

const ones = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const tensWords = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

// 1–99: compounds 21–99 are hyphenated (Twenty-One, Forty-Five, Ninety-Nine)
function wordifyTens(n: number): string {
  if (n < 20) return ones[n];
  const o = n % 10;
  return o ? `${tensWords[Math.floor(n / 10)]}-${ones[o]}` : tensWords[Math.floor(n / 10)];
}

// 1–999: "One Hundred and Twenty-Five", "Three Hundred"
function wordifyHundreds(n: number): string {
  if (n === 0) return "";
  if (n < 100) return wordifyTens(n);
  const rem = n % 100;
  return rem
    ? `${ones[Math.floor(n / 100)]} Hundred and ${wordifyTens(rem)}`
    : `${ones[Math.floor(n / 100)]} Hundred`;
}

// 1–99,999: inserts "and" before a sub-100 remainder after thousands
// e.g. 1050 → "One Thousand and Fifty", 1250 → "One Thousand Two Hundred and Fifty"
function wordifyBelowLakh(n: number): string {
  if (n === 0) return "";
  if (n < 1000) return wordifyHundreds(n);
  const th = Math.floor(n / 1000);
  const rem = n % 1000;
  const base = `${wordifyHundreds(th)} Thousand`;
  if (rem === 0) return base;
  return rem < 100 ? `${base} and ${wordifyHundreds(rem)}` : `${base} ${wordifyHundreds(rem)}`;
}

export function amountToWords(amount: number): string {
  const fixed = Math.round(amount * 100);
  const rupees = Math.floor(fixed / 100);
  const cents = fixed % 100;

  if (rupees === 0 && cents === 0) return "Zero Only";

  const groups: string[] = [];

  if (rupees >= 10_000_000) {
    groups.push(`${wordifyHundreds(Math.floor(rupees / 10_000_000))} Crore`);
    const rem1 = rupees % 10_000_000;
    if (rem1 >= 100_000) {
      groups.push(`${wordifyHundreds(Math.floor(rem1 / 100_000))} Lakh`);
      const rem2 = rem1 % 100_000;
      if (rem2 > 0) groups.push(wordifyBelowLakh(rem2));
    } else if (rem1 > 0) {
      groups.push(wordifyBelowLakh(rem1));
    }
  } else if (rupees >= 100_000) {
    groups.push(`${wordifyHundreds(Math.floor(rupees / 100_000))} Lakh`);
    const rem = rupees % 100_000;
    if (rem > 0) groups.push(wordifyBelowLakh(rem));
  } else if (rupees > 0) {
    groups.push(wordifyBelowLakh(rupees));
  }

  let result = groups.join(" ");

  if (cents > 0) {
    result += ` and Cents ${wordifyTens(cents)}`;
  }

  return result.trim() + " Only";
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

// Pad amount figures with asterisks on both sides (fraud prevention)
function starPad(amt: string, target = 16): string {
  if (amt.length >= target - 2) return `***${amt}***`;
  const pad = target - amt.length;
  const right = 3;
  const left  = pad - right;
  return "*".repeat(left) + amt + "*".repeat(right);
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
  const figures = starPad(formatAmount(data.amount));
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
    width: 174mm;
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
    top: 31mm;
    left: 18mm;
    font-size: 9pt;
    white-space: nowrap;
  }
  .words-2 {
    position: absolute;
    top: 37mm;
    left: 18mm;
    font-size: 9pt;
    white-space: nowrap;
  }
  .figures {
    position: absolute;
    top: 40mm;
    right: 16mm;
    width: 40mm;
    text-align: right;
    font-size: 9pt;
    font-weight: bold;
    font-family: "Courier New", Courier, monospace;
    letter-spacing: 0.5px;
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
