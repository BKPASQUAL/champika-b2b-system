import QRCode from "qrcode";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// System font stack — always available, no network request, renders identically
// in both browser print engine and html2canvas capture.
const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, Helvetica, sans-serif";

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
    <tr style="${idx < items.length - 1 ? "border-bottom:1px solid #e8e8e8;" : ""}">
      <td style="padding:7px 8px;font-size:11px;color:#777;text-align:center;vertical-align:middle;">${idx + 1}</td>
      <td style="padding:7px 8px;font-size:11px;color:#555;vertical-align:middle;">${item.sku || "-"}</td>
      <td style="padding:7px 8px;font-size:11px;color:#111;font-weight:600;vertical-align:middle;">${item.productName || item.name || "-"}</td>
      <td style="padding:7px 8px;font-size:11px;color:#111;text-align:right;white-space:nowrap;vertical-align:middle;">LKR ${fmt(item.unitPrice || item.price)}</td>
      <td style="padding:7px 8px;font-size:11px;font-weight:700;color:#111;text-align:center;vertical-align:middle;">${item.quantity}</td>
      <td style="padding:7px 8px;font-size:11px;color:#555;text-align:center;vertical-align:middle;">${item.unit || "Pcs"}</td>
      <td style="padding:7px 8px;font-size:11px;text-align:center;color:#111;vertical-align:middle;">${(item.freeQuantity || item.free || 0) > 0 ? (item.freeQuantity || item.free) : "-"}</td>
      <td style="padding:7px 8px;font-size:11px;text-align:center;color:#777;vertical-align:middle;">${item.discountPercent > 0 ? "-" + item.discountPercent + "%" : "-"}</td>
      <td style="padding:7px 8px;font-size:11px;font-weight:700;color:#111;text-align:right;white-space:nowrap;vertical-align:middle;">LKR ${fmt(item.total)}</td>
    </tr>`).join("");

  return `
  <div class="invoice-page" style="page-break-after:always;width:100%;min-height:100vh;padding:28px 32px 36px;background:#fff;font-family:${FONT_STACK};color:#111;box-sizing:border-box;">

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
          <table style="margin-left:auto;border-collapse:collapse;">
            <tr>
              ${qrDataUrl ? `<td style="vertical-align:top;padding-right:10px;"><img src="${qrDataUrl}" style="width:70px;height:70px;display:block;" /></td>` : ""}
              <td style="vertical-align:top;text-align:right;">
                <div style="font-size:18px;font-weight:700;color:#000;letter-spacing:0.5px;">${invoice.invoiceNo || "-"}</div>
                <div style="font-size:11px;color:#333;margin-top:2px;line-height:1.5;">
                  ${formatDate(invoice.date || invoice.createdAt)}<br>
                  ${salesRep}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- DIVIDER -->
    <div style="border-top:1.5px solid #bbb;margin:10px 0 12px;"></div>

    <!-- CUSTOMER -->
    <div style="margin-bottom:12px;">
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
              <td style="padding:4px 0;font-size:15px;font-weight:800;color:#000;text-align:right;white-space:nowrap;">LKR ${fmt(grandTotal)}</td>
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
    <div style="border-top:1px solid #ddd;padding-top:8px;text-align:center;font-size:11px;color:#777;">
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
    <style>
      * { box-sizing: border-box; }
      body { font-family: ${FONT_STACK}; margin: 0; padding: 0; background: #fff; width: 794px; }
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

// ── Download from a rendered DOM element ───────────────────────────────────
// Captures the actual rendered element so the PDF is pixel-perfect identical
// to what the user sees on screen. Used by InvoicePrintView.
export const downloadFromElement = async (element: HTMLElement, filename: string) => {
  const tid = toast.loading("Generating PDF...");
  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      onclone: (clonedDoc) => {
        clonedDoc.querySelectorAll('link[rel="stylesheet"]').forEach((el) => el.remove());
      },
    });

    const A4_W   = 210;
    const A4_H   = 297;
    const pxToMm = A4_W / canvas.width;
    const imgH_mm = canvas.height * pxToMm;
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    if (imgH_mm <= A4_H) {
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, A4_W, imgH_mm);
    } else {
      const pageHpx = Math.floor((A4_H / A4_W) * canvas.width);
      let offset = 0, page = 0;
      while (offset < canvas.height) {
        const sliceH = Math.min(pageHpx, canvas.height - offset);
        const pc     = document.createElement("canvas");
        pc.width     = canvas.width;
        pc.height    = sliceH;
        pc.getContext("2d")!.drawImage(canvas, 0, offset, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        if (page > 0) pdf.addPage();
        pdf.addImage(pc.toDataURL("image/png"), "PNG", 0, 0, A4_W, sliceH * pxToMm);
        offset += pageHpx;
        page++;
      }
    }

    pdf.save(filename);
    toast.dismiss(tid);
    toast.success(`${filename} saved`);
  } catch (err) {
    console.error("downloadFromElement error:", err);
    toast.dismiss(tid);
    toast.error("Failed to download invoice");
  }
};

// ── Direct download — no dialog ────────────────────────────────────────────
// Renders the exact same print HTML in a hidden iframe, captures with
// html2canvas, then saves directly via jsPDF. Same design as print.
export const downloadInvoice = async (
  invoiceOrId: string | any,
  divisionKey: keyof typeof DIVISIONS = "distribution"
) => {
  const tid = toast.loading("Generating PDF...");
  let iframe: HTMLIFrameElement | null = null;
  try {
    // 1. Fetch data
    let data = invoiceOrId;
    if (typeof invoiceOrId === "string") {
      const res = await fetch(`/api/invoices/${invoiceOrId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    }
    if (!data) throw new Error("No data");

    // 2. Build exact same HTML as print (same function, same wrapper)
    const invoiceHtml = await generateInvoiceHTML(data, divisionKey);
    const fullHtml    = getDocumentWrapper(invoiceHtml, data.invoiceNo);

    // 3. Mount iframe — opacity:0.01 keeps it invisible to the user
    //    but the browser still fully renders it (unlike opacity:0 or visibility:hidden)
    iframe = document.createElement("iframe");
    Object.assign(iframe.style, {
      position: "fixed",
      top:      "0",
      left:     "0",
      width:    "794px",
      height:   "1123px",
      border:   "none",
      opacity:  "0.01",
      zIndex:   "-9999",
      pointerEvents: "none",
    });
    document.body.appendChild(iframe);

    // 4. Write full document and wait for load
    await new Promise<void>((resolve) => {
      iframe!.onload = () => resolve();
      iframe!.contentDocument!.open();
      iframe!.contentDocument!.write(fullHtml);
      iframe!.contentDocument!.close();
    });

    // 5. Short wait for iframe to finish layout
    await new Promise((r) => setTimeout(r, 300));

    // 6. Capture — strip Tailwind/app stylesheets (lab() colors crash html2canvas).
    //    The inline <style> from getDocumentWrapper is kept — layout is identical to print.
    const body   = iframe.contentDocument!.body;
    const canvas = await html2canvas(body, {
      scale:           2,
      useCORS:         true,
      allowTaint:      true,
      backgroundColor: "#ffffff",
      width:           794,
      windowWidth:     794,
      onclone: (clonedDoc) => {
        clonedDoc.querySelectorAll('link[rel="stylesheet"]').forEach((el) => el.remove());
      },
    });

    document.body.removeChild(iframe);
    iframe = null;

    // 7. Build A4 PDF — paginate if invoice is taller than one page
    const A4_W    = 210;
    const A4_H    = 297;
    const pxToMm  = A4_W / canvas.width;
    const imgH_mm = canvas.height * pxToMm;
    const pdf     = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    if (imgH_mm <= A4_H) {
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, A4_W, imgH_mm);
    } else {
      const pageHpx = Math.floor((A4_H / A4_W) * canvas.width);
      let offset = 0, page = 0;
      while (offset < canvas.height) {
        const sliceH  = Math.min(pageHpx, canvas.height - offset);
        const pc      = document.createElement("canvas");
        pc.width      = canvas.width;
        pc.height     = sliceH;
        pc.getContext("2d")!.drawImage(canvas, 0, offset, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        if (page > 0) pdf.addPage();
        pdf.addImage(pc.toDataURL("image/png"), "PNG", 0, 0, A4_W, sliceH * pxToMm);
        offset += pageHpx;
        page++;
      }
    }

    // 8. Save directly to Downloads
    pdf.save(`${data.invoiceNo || "Invoice"}.pdf`);
    toast.dismiss(tid);
    toast.success(`${data.invoiceNo} saved`);
  } catch (err) {
    console.error("downloadInvoice error:", err);
    if (iframe && document.body.contains(iframe)) document.body.removeChild(iframe);
    toast.dismiss(tid);
    toast.error("Failed to download invoice");
  }
};
