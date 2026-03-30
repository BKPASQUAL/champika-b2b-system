import QRCode from "qrcode";
import { toast } from "sonner";

// Helper to calculate status if missing
const calculateStatus = (invoice: any) => {
  if (invoice.status) return invoice.status;

  const total = invoice.grandTotal || invoice.totalAmount || 0;
  const paid =
    invoice.payments?.reduce(
      (acc: number, p: any) => acc + Number(p.amount),
      0
    ) ||
    invoice.paidAmount ||
    0;

  if (paid >= total) return "Paid";
  if (paid > 0) return "Partial";
  return "Unpaid";
};

// Exporting this so we can reuse it for bulk generation
export const generateInvoiceHTML = async (invoice: any) => {
  const invoiceUrl = typeof window !== "undefined"
    ? `${window.location.origin}/invoice/${invoice._id || invoice.id}`
    : "";
  const qrDataUrl = invoiceUrl
    ? await QRCode.toDataURL(invoiceUrl, { width: 80, margin: 1 })
    : "";
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

  const customerName =
    invoice.customer?.name || invoice.customerName || "Unknown Customer";
  const shopName = invoice.customer?.shop || invoice.shopName || customerName;
  const phone = invoice.customer?.phone || invoice.phone || "";
  const address = invoice.customer?.address || invoice.address || "";
  const route = invoice.customer?.route || invoice.route || "";
  const items = invoice.items || [];
  const salesRep = invoice.salesRep || invoice.salesRepName || "-";

  const subTotal = items.reduce(
    (sum: number, item: any) => sum + (item.total || 0),
    0
  );
  const grandTotal = invoice.grandTotal || invoice.totalAmount || 0;
  const extraDiscount = Math.max(0, subTotal - grandTotal);

  return `
  <div class="invoice-page" style="page-break-after:always; width:100%; min-height:100vh; padding:5mm 8mm; background:#fff; font-family:'Inter',Arial,sans-serif; color:#111; box-sizing:border-box;">

    <!-- ══ HEADER ══ -->
    <table style="width:100%; border-collapse:collapse; margin-bottom:0;">
      <tr>
        <td style="vertical-align:top; width:60%;">
          <div style="font-size:18px; font-weight:800; color:#000; letter-spacing:-0.3px; line-height:1.1;">CHAMPIKA HARDWARE</div>
          <div style="font-size:10px; color:#333; margin-top:2px; line-height:1.5;">
            Distribution Division<br>
            Pranawatta Road, Wallabada, Boossa<br>
            Tel: 0777681663
          </div>
        </td>
        <td style="vertical-align:top; text-align:right; width:40%;">
          <div style="display:inline-flex; align-items:flex-start; gap:10px; justify-content:flex-end;">
            ${qrDataUrl ? `<img src="${qrDataUrl}" style="width:70px;height:70px;display:block;" />` : ""}
            <div>
              <div style="font-size:18px; font-weight:700; color:#000; letter-spacing:0.5px;">${invoice.invoiceNo || "-"}</div>
              <div style="font-size:11px; color:#333; margin-top:2px; line-height:1.5;">
                ${formatDate(invoice.date || invoice.createdAt)}<br>
                ${salesRep}
              </div>
            </div>
          </div>
        </td>
      </tr>
    </table>

    <!-- ══ DIVIDER ══ -->
    <div style="border-top:1.5px solid #bbb; margin:6px 0 8px;"></div>

    <!-- ══ CUSTOMER ══ -->
    <div style="margin-bottom:8px;">
      <div style="font-size:13px; font-weight:700; color:#000;">${shopName}</div>
      ${customerName !== shopName ? `<div style="font-size:12px; color:#333;">${customerName}</div>` : ""}
      ${address ? `<div style="font-size:12px; color:#333;">${address}${route ? ", " + route : ""}</div>` : route ? `<div style="font-size:12px; color:#333;">${route}</div>` : ""}
      ${phone ? `<div style="font-size:12px; color:#333;">${phone}</div>` : ""}
    </div>

    <!-- ══ ITEMS TABLE ══ -->
    <table style="width:100%; border-collapse:collapse; margin-bottom:6px;">
      <thead>
        <tr style="background:#1a1a1a;">
          <th style="padding:7px 8px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.6px; color:#fff; text-align:center; width:4%;">#</th>
          <th style="padding:7px 8px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.6px; color:#fff; text-align:left; width:14%;">Item Code</th>
          <th style="padding:7px 8px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.6px; color:#fff; text-align:left; width:30%;">Item Description</th>
          <th style="padding:7px 8px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.6px; color:#fff; text-align:right; width:13%;">Price</th>
          <th style="padding:7px 8px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.6px; color:#fff; text-align:center; width:7%;">Qty</th>
          <th style="padding:7px 8px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.6px; color:#fff; text-align:center; width:7%;">Unit</th>
          <th style="padding:7px 8px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.6px; color:#fff; text-align:center; width:7%;">Free</th>
          <th style="padding:7px 8px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.6px; color:#fff; text-align:center; width:7%;">Disc.</th>
          <th style="padding:7px 8px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.6px; color:#fff; text-align:right; width:11%;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (item: any, index: number) => `
          <tr style="border-bottom:1px solid #e5e5e5;">
            <td style="padding:7px 8px; font-size:11px; color:#555; text-align:center;">${index + 1}</td>
            <td style="padding:7px 8px; font-size:11px; color:#333;">${item.sku || "-"}</td>
            <td style="padding:7px 8px; font-size:12px; color:#000; font-weight:600;">${item.productName || item.name || "-"}</td>
            <td style="padding:7px 8px; font-size:11px; color:#333; text-align:right; white-space:nowrap;">LKR ${fmt(item.unitPrice || item.price)}</td>
            <td style="padding:7px 8px; font-size:12px; font-weight:700; color:#000; text-align:center;">${item.quantity}</td>
            <td style="padding:7px 8px; font-size:11px; color:#555; text-align:center;">${item.unit || "Pcs"}</td>
            <td style="padding:7px 8px; font-size:12px; text-align:center; color:#000;">${(item.freeQuantity || item.free || 0) > 0 ? (item.freeQuantity || item.free) : "-"}</td>
            <td style="padding:7px 8px; font-size:11px; text-align:center; color:#555;">${item.discountPercent > 0 ? "-" + item.discountPercent + "%" : "-"}</td>
            <td style="padding:7px 8px; font-size:12px; font-weight:700; color:#000; text-align:right; white-space:nowrap;">LKR ${fmt(item.total)}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>

    <!-- ══ TOTALS ══ -->
    <table style="width:100%; border-collapse:collapse; margin-bottom:10px;">
      <tr>
        <td style="width:55%;">
          ${invoice.notes ? `<div style="font-size:11px; color:#555; line-height:1.5;">${invoice.notes}</div>` : ""}
        </td>
        <td style="width:45%; vertical-align:top; padding-left:16px;">
          <table style="width:100%; border-collapse:collapse;">
            <tr>
              <td style="padding:5px 0; font-size:12px; color:#333;">Subtotal</td>
              <td style="padding:5px 0; font-size:12px; color:#000; text-align:right; white-space:nowrap;">LKR ${fmt(subTotal)}</td>
            </tr>
            ${
              extraDiscount > 1
                ? `<tr>
              <td style="padding:5px 0; font-size:12px; color:#333;">Extra Discount</td>
              <td style="padding:5px 0; font-size:12px; color:#000; text-align:right; white-space:nowrap;">- LKR ${fmt(extraDiscount)}</td>
            </tr>`
                : ""
            }
            <tr>
              <td style="padding:6px 0 0; border-top:1.5px solid #bbb;"></td>
              <td style="border-top:1.5px solid #bbb;"></td>
            </tr>
            <tr>
              <td style="padding:4px 0; font-size:13px; font-weight:700; color:#000;">Net Total</td>
              <td style="padding:4px 0; font-size:14px; font-weight:800; color:#000; text-align:right; white-space:nowrap;">LKR ${fmt(grandTotal)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- ══ SIGNATURE ══ -->
    <table style="width:100%; border-collapse:collapse; margin-bottom:8px;">
      <tr>
        <td style="width:55%;"></td>
        <td style="width:45%; text-align:center; padding-top:20px; border-top:1px solid #bbb;">
          <div style="font-size:11px; color:#333; font-weight:600;">Customer Signature &amp; Stamp</div>
        </td>
      </tr>
    </table>

    <!-- ══ FOOTER ══ -->
    <div style="border-top:1px solid #ddd; padding-top:8px; text-align:center; font-size:11px; color:#555;">
      Thank you for your business!
    </div>

  </div>`;
};

// Base wrapper for the printable document
const getDocumentWrapper = (content: string, title: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; }
        body {
          font-family: 'Inter', Arial, sans-serif;
          margin: 0;
          padding: 0;
          background: #fff;
        }
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background: white;
          }
          .invoice-page { page-break-after: always; }
          .invoice-page:last-child { page-break-after: auto; }
        }
      </style>
    </head>
    <body>
      ${content}
    </body>
    </html>
`;

/**
 * Print a single invoice
 */
export const printInvoice = async (invoiceOrId: string | any) => {
  try {
    let invoiceData = invoiceOrId;

    if (typeof invoiceOrId === "string") {
      const toastId = toast.loading("Loading invoice data...");
      try {
        const res = await fetch(`/api/invoices/${invoiceOrId}`);
        if (!res.ok) throw new Error("Failed to load");
        invoiceData = await res.json();
        toast.dismiss(toastId);
      } catch (err) {
        toast.dismiss(toastId);
        toast.error("Failed to load invoice for printing");
        return;
      }
    }

    if (!invoiceData) return;

    printHTML(
      getDocumentWrapper(
        await generateInvoiceHTML(invoiceData),
        `Invoice ${invoiceData.invoiceNo}`
      )
    );
  } catch (error) {
    console.error(error);
    toast.error("Failed to print invoice");
  }
};

/**
 * NEW: Print Multiple Invoices
 */
export const printBulkInvoices = async (invoiceIds: string[]) => {
  if (!invoiceIds || invoiceIds.length === 0) {
    toast.error("No invoices selected to print");
    return;
  }

  const toastId = toast.loading(`Preparing ${invoiceIds.length} invoices...`);

  try {
    // 1. Fetch all invoices concurrently
    const promises = invoiceIds.map((id) =>
      fetch(`/api/invoices/${id}`).then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${id}`);
        return res.json();
      })
    );

    const invoices = await Promise.all(promises);

    // 2. Generate HTML for all
    const allHtml = (await Promise.all(invoices.map((inv) => generateInvoiceHTML(inv)))).join("");

    // 3. Print
    printHTML(getDocumentWrapper(allHtml, "Bulk Invoices"));

    toast.dismiss(toastId);
    toast.success("Printing started");
  } catch (error) {
    console.error(error);
    toast.dismiss(toastId);
    toast.error("Failed to generate bulk print");
  }
};

/**
 * Helper to trigger print via iframe
 */
const printHTML = (htmlContent: string) => {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";

  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) return;

  iframeDoc.open();
  iframeDoc.write(htmlContent);
  iframeDoc.close();

  setTimeout(() => {
    if (iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 2000);
  }, 500);
};

export const downloadInvoice = async (invoiceOrId: string | any) => {
  await printInvoice(invoiceOrId);
};
