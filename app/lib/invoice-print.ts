import QRCode from "qrcode";
import { toast } from "sonner";

// ── Shared invoice HTML generator ──────────────────────────────────────────
// Used by every division's print-utils so all invoices look identical.

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

export const generateInvoiceHTML = async (
  invoice: any,
  divisionKey: keyof typeof DIVISIONS = "distribution"
): Promise<string> => {
  const cfg = DIVISIONS[divisionKey];

  const invoiceUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/invoice/${invoice._id || invoice.id}`
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

  const subTotal     = items.reduce((s: number, i: any) => s + (i.total || 0), 0);
  const grandTotal   = invoice.grandTotal || invoice.totalAmount || 0;
  const extraDiscount = Math.max(0, subTotal - grandTotal);

  const rows = items.map((item: any, idx: number) => `
    <tr style="border-bottom:1px solid #e5e5e5;">
      <td style="padding:7px 8px;font-size:11px;color:#555;text-align:center;">${idx + 1}</td>
      <td style="padding:7px 8px;font-size:11px;color:#333;">${item.sku || "-"}</td>
      <td style="padding:7px 8px;font-size:12px;color:#000;font-weight:600;">${item.productName || item.name || "-"}</td>
      <td style="padding:7px 8px;font-size:11px;color:#333;text-align:right;white-space:nowrap;">LKR ${fmt(item.unitPrice || item.price)}</td>
      <td style="padding:7px 8px;font-size:12px;font-weight:700;color:#000;text-align:center;">${item.quantity}</td>
      <td style="padding:7px 8px;font-size:11px;color:#555;text-align:center;">${item.unit || "Pcs"}</td>
      <td style="padding:7px 8px;font-size:12px;text-align:center;color:#000;">${(item.freeQuantity || item.free || 0) > 0 ? (item.freeQuantity || item.free) : "-"}</td>
      <td style="padding:7px 8px;font-size:11px;text-align:center;color:#555;">${item.discountPercent > 0 ? "-" + item.discountPercent + "%" : "-"}</td>
      <td style="padding:7px 8px;font-size:12px;font-weight:700;color:#000;text-align:right;white-space:nowrap;">LKR ${fmt(item.total)}</td>
    </tr>`).join("");

  return `
  <div class="invoice-page" style="page-break-after:always;width:100%;min-height:100vh;padding:5mm 8mm;background:#fff;font-family:'Inter',Arial,sans-serif;color:#111;box-sizing:border-box;">

    <!-- HEADER -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:0;">
      <tr>
        <td style="vertical-align:top;width:60%;">
          <div style="font-size:18px;font-weight:800;color:#000;letter-spacing:-0.3px;line-height:1.1;">CHAMPIKA HARDWARE</div>
          <div style="font-size:10px;color:#333;margin-top:2px;line-height:1.5;">
            ${cfg.division}<br>
            ${cfg.address}<br>
            Tel: ${cfg.tel}
          </div>
        </td>
        <td style="vertical-align:top;text-align:right;width:40%;">
          <div style="display:inline-flex;align-items:flex-start;gap:10px;justify-content:flex-end;">
            ${qrDataUrl ? `<img src="${qrDataUrl}" style="width:70px;height:70px;display:block;" />` : ""}
            <div>
              <div style="font-size:18px;font-weight:700;color:#000;letter-spacing:0.5px;">${invoice.invoiceNo || "-"}</div>
              <div style="font-size:11px;color:#333;margin-top:2px;line-height:1.5;">
                ${formatDate(invoice.date || invoice.createdAt)}<br>
                ${salesRep}
              </div>
            </div>
          </div>
        </td>
      </tr>
    </table>

    <!-- DIVIDER -->
    <div style="border-top:1.5px solid #bbb;margin:6px 0 8px;"></div>

    <!-- CUSTOMER -->
    <div style="margin-bottom:8px;">
      <div style="font-size:13px;font-weight:700;color:#000;">${shopName}</div>
      ${customerName !== shopName ? `<div style="font-size:12px;color:#333;">${customerName}</div>` : ""}
      ${address ? `<div style="font-size:12px;color:#333;">${address}${route ? ", " + route : ""}</div>` : ""}
      ${phone ? `<div style="font-size:12px;color:#333;">${phone}</div>` : ""}
    </div>

    <!-- ITEMS TABLE -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
      <thead>
        <tr style="background:#1a1a1a;">
          <th style="padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#fff;text-align:center;width:4%;">#</th>
          <th style="padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#fff;text-align:left;width:14%;">Item Code</th>
          <th style="padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#fff;text-align:left;width:29%;">Description</th>
          <th style="padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#fff;text-align:right;width:13%;">Price</th>
          <th style="padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#fff;text-align:center;width:7%;">Qty</th>
          <th style="padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#fff;text-align:center;width:7%;">Unit</th>
          <th style="padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#fff;text-align:center;width:7%;">Free</th>
          <th style="padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#fff;text-align:center;width:7%;">Disc.</th>
          <th style="padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#fff;text-align:right;width:12%;">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <!-- TOTALS -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
      <tr>
        <td style="width:55%;">
          ${invoice.notes ? `<div style="font-size:11px;color:#555;line-height:1.5;">${invoice.notes}</div>` : ""}
        </td>
        <td style="width:45%;vertical-align:top;padding-left:16px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:5px 0;font-size:12px;color:#333;">Subtotal</td>
              <td style="padding:5px 0;font-size:12px;color:#000;text-align:right;white-space:nowrap;">LKR ${fmt(subTotal)}</td>
            </tr>
            ${extraDiscount > 1 ? `
            <tr>
              <td style="padding:5px 0;font-size:12px;color:#333;">Extra Discount</td>
              <td style="padding:5px 0;font-size:12px;color:#000;text-align:right;white-space:nowrap;">- LKR ${fmt(extraDiscount)}</td>
            </tr>` : ""}
            <tr>
              <td style="padding:6px 0 0;border-top:1.5px solid #bbb;"></td>
              <td style="border-top:1.5px solid #bbb;"></td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-size:13px;font-weight:700;color:#000;">Net Total</td>
              <td style="padding:4px 0;font-size:14px;font-weight:800;color:#000;text-align:right;white-space:nowrap;">LKR ${fmt(grandTotal)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- SIGNATURE -->
    <table style="width:100%;border-collapse:collapse;margin-top:60px;margin-bottom:8px;">
      <tr>
        <td style="width:55%;"></td>
        <td style="width:45%;text-align:center;padding-top:6px;border-top:1.5px solid #555;">
          <div style="font-size:11px;color:#333;font-weight:600;margin-top:3px;">Customer Signature &amp; Stamp</div>
        </td>
      </tr>
    </table>

    <!-- FOOTER -->
    <div style="border-top:1px solid #ddd;padding-top:8px;text-align:center;font-size:11px;color:#555;">
      Thank you for your business!
    </div>

  </div>`;
};

// ── Document wrapper ────────────────────────────────────────────────────────
const getDocumentWrapper = (content: string, title: string) => `
  <!DOCTYPE html>
  <html>
  <head>
    <title>${title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
      * { box-sizing: border-box; }
      body { font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 0; background: #fff; }
      @media print {
        @page { size: A4 portrait; margin: 0; }
        html, body { width: 210mm; margin: 0; padding: 0; }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .invoice-page { page-break-after: always; width: 210mm !important; padding: 5mm 8mm !important; }
        .invoice-page:last-child { page-break-after: auto; }
      }
    </style>
  </head>
  <body>${content}</body>
  </html>`;

// ── iframe print helper ─────────────────────────────────────────────────────
const printHTML = (htmlContent: string) => {
  const iframe = document.createElement("iframe");
  Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open(); doc.write(htmlContent); doc.close();
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 2000);
  }, 500);
};

// ── Public helpers ──────────────────────────────────────────────────────────
export const printInvoice = async (
  invoiceOrId: string | any,
  divisionKey: keyof typeof DIVISIONS = "distribution"
) => {
  try {
    let data = invoiceOrId;
    if (typeof invoiceOrId === "string") {
      const tid = toast.loading("Loading invoice...");
      try {
        const res = await fetch(`/api/invoices/${invoiceOrId}`);
        if (!res.ok) throw new Error();
        data = await res.json();
        toast.dismiss(tid);
      } catch {
        toast.dismiss(tid);
        toast.error("Failed to load invoice for printing");
        return;
      }
    }
    if (!data) return;
    printHTML(getDocumentWrapper(await generateInvoiceHTML(data, divisionKey), `Invoice ${data.invoiceNo}`));
  } catch {
    toast.error("Failed to print invoice");
  }
};

export const printBulkInvoices = async (
  invoiceIds: string[],
  divisionKey: keyof typeof DIVISIONS = "distribution"
) => {
  if (!invoiceIds?.length) { toast.error("No invoices selected"); return; }
  const tid = toast.loading(`Preparing ${invoiceIds.length} invoices...`);
  try {
    const invoices = await Promise.all(
      invoiceIds.map((id) => fetch(`/api/invoices/${id}`).then((r) => { if (!r.ok) throw new Error(); return r.json(); }))
    );
    const allHtml = (await Promise.all(invoices.map((inv) => generateInvoiceHTML(inv, divisionKey)))).join("");
    printHTML(getDocumentWrapper(allHtml, "Bulk Invoices"));
    toast.dismiss(tid);
    toast.success("Printing started");
  } catch {
    toast.dismiss(tid);
    toast.error("Failed to generate bulk print");
  }
};

// downloadInvoice uses the exact same iframe + browser print renderer as
// printInvoice so the output is always pixel-perfect A4.
export const downloadInvoice = async (
  invoiceOrId: string | any,
  divisionKey: keyof typeof DIVISIONS = "distribution"
) => printInvoice(invoiceOrId, divisionKey);
