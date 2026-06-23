const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

const fmtDate = (s: string) =>
  s ? new Date(s).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" }) : "-";

export function generateQuotationHTML(q: any): string {
  const items: any[] = q.items || [];
  const rows = items
    .map(
      (item: any, i: number) => `
      <tr>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;text-align:center;color:#6b7280">${i + 1}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb">
          <div style="font-weight:600">${item.productName || ""}</div>
          ${item.sku ? `<div style="font-size:10px;color:#9ca3af">SKU: ${item.sku}</div>` : ""}
        </td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;color:#374151">${item.brand || "-"}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;color:#374151">${item.sizeSpec || "-"}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;text-align:center">${item.qty}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;text-align:right">Rs. ${fmt(item.mrp)}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;text-align:right">Rs. ${fmt(item.unitPrice)}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">Rs. ${fmt(item.total)}</td>
      </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Quotation ${q.quotation_no || ""}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:${FONT}; font-size:12px; color:#111; background:#fff; }
  @page { margin:15mm 15mm 20mm; size:A4; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style>
</head>
<body>
<div style="padding:0 0 20px">
  <!-- Header -->
  <table style="width:100%;border-bottom:3px solid #1d4ed8;padding-bottom:14px;margin-bottom:14px">
    <tr>
      <td>
        <div style="font-size:22px;font-weight:800;color:#1d4ed8;letter-spacing:-0.5px">Champika Hardware</div>
        <div style="font-size:11px;color:#6b7280;margin-top:2px">Distribution Division</div>
        <div style="font-size:10px;color:#9ca3af">Pranawatta Road, Wallabada, Boossa &nbsp;|&nbsp; Tel: 0777 681 663</div>
      </td>
      <td style="text-align:right;vertical-align:top">
        <div style="font-size:18px;font-weight:800;color:#111;letter-spacing:1px">QUOTATION</div>
        <div style="font-size:13px;font-weight:700;color:#1d4ed8;margin-top:4px">${q.quotation_no || ""}</div>
        <div style="font-size:10px;color:#6b7280;margin-top:6px">Date: ${fmtDate(q.date)}</div>
        ${q.valid_until ? `<div style="font-size:10px;color:#dc2626">Valid Until: ${fmtDate(q.valid_until)}</div>` : ""}
        <div style="font-size:10px;color:#6b7280;margin-top:2px">
          Status: <span style="font-weight:600;color:${q.status === "Accepted" ? "#16a34a" : q.status === "Rejected" ? "#dc2626" : "#1d4ed8"}">${q.status}</span>
        </div>
      </td>
    </tr>
  </table>

  <!-- Bill To -->
  <table style="width:100%;margin-bottom:14px">
    <tr>
      <td style="width:50%;vertical-align:top">
        <div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Bill To</div>
        <div style="font-weight:700;font-size:13px">${q.customer_name || "-"}</div>
        ${q.customer_phone ? `<div style="color:#374151;margin-top:2px">${q.customer_phone}</div>` : ""}
        ${q.customer_address ? `<div style="color:#6b7280;font-size:11px;margin-top:2px">${q.customer_address}</div>` : ""}
      </td>
      ${q.prepared_by ? `
      <td style="width:50%;text-align:right;vertical-align:top">
        <div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Prepared By</div>
        <div style="font-weight:600">${q.prepared_by}</div>
      </td>` : ""}
    </tr>
  </table>

  <!-- Items Table -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
    <thead>
      <tr style="background:#1d4ed8;color:#fff">
        <th style="padding:8px 10px;text-align:center;font-size:10px;width:32px">#</th>
        <th style="padding:8px 10px;text-align:left;font-size:10px">Description</th>
        <th style="padding:8px 10px;text-align:left;font-size:10px">Brand</th>
        <th style="padding:8px 10px;text-align:left;font-size:10px">Spec</th>
        <th style="padding:8px 10px;text-align:center;font-size:10px">Qty</th>
        <th style="padding:8px 10px;text-align:right;font-size:10px">MRP</th>
        <th style="padding:8px 10px;text-align:right;font-size:10px">Unit Price</th>
        <th style="padding:8px 10px;text-align:right;font-size:10px">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <!-- Totals -->
  <table style="width:100%;margin-bottom:20px">
    <tr>
      <td style="width:60%">
        ${q.notes ? `
        <div style="padding:10px;background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb">
          <div style="font-size:10px;font-weight:700;color:#6b7280;margin-bottom:4px">NOTES</div>
          <div style="font-size:11px;color:#374151">${q.notes}</div>
        </div>` : ""}
      </td>
      <td style="width:40%;vertical-align:top">
        <table style="width:100%;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
          <tr style="background:#f9fafb">
            <td style="padding:7px 12px;font-size:11px;color:#6b7280">Sub Total</td>
            <td style="padding:7px 12px;text-align:right;font-size:11px">Rs. ${fmt(q.sub_total)}</td>
          </tr>
          ${q.discount > 0 ? `
          <tr>
            <td style="padding:7px 12px;font-size:11px;color:#dc2626">Discount</td>
            <td style="padding:7px 12px;text-align:right;font-size:11px;color:#dc2626">- Rs. ${fmt(q.discount)}</td>
          </tr>` : ""}
          <tr style="background:#1d4ed8;color:#fff">
            <td style="padding:10px 12px;font-weight:700;font-size:13px">Grand Total</td>
            <td style="padding:10px 12px;text-align:right;font-weight:800;font-size:14px">Rs. ${fmt(q.grand_total)}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- Footer -->
  <table style="width:100%;border-top:1px solid #e5e7eb;padding-top:14px;margin-top:10px">
    <tr>
      <td style="width:40%;text-align:center">
        <div style="border-top:1px solid #111;width:80%;margin:40px auto 0;padding-top:6px;font-size:10px;color:#6b7280">Customer Signature</div>
      </td>
      <td style="width:20%"></td>
      <td style="width:40%;text-align:center">
        <div style="border-top:1px solid #111;width:80%;margin:40px auto 0;padding-top:6px;font-size:10px;color:#6b7280">Authorised Signature</div>
      </td>
    </tr>
  </table>
  <div style="margin-top:16px;text-align:center;font-size:9px;color:#9ca3af">
    This quotation is valid until ${fmtDate(q.valid_until || "")} &nbsp;·&nbsp; Thank you for your business
  </div>
</div>
</body>
</html>`;
}

const printHTML = (html: string) => {
  const iframe = document.createElement("iframe");
  Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 2000);
  }, 500);
};

export const printQuotation = (quotation: any) => {
  printHTML(generateQuotationHTML(quotation));
};
