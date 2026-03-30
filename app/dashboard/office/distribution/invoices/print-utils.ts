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
export const generateInvoiceHTML = (invoice: any) => {
  const fmt = (amount: number) =>
    new Intl.NumberFormat("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "short",
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
  const paymentStatus = calculateStatus(invoice);
  const salesRep = invoice.salesRep || invoice.salesRepName || "-";

  const subTotal = items.reduce(
    (sum: number, item: any) => sum + (item.total || 0),
    0
  );
  const grandTotal = invoice.grandTotal || invoice.totalAmount || 0;
  const extraDiscount = Math.max(0, subTotal - grandTotal);
  const paidAmount = invoice.paidAmount || 0;
  const dueAmount = grandTotal - paidAmount;

  const statusColor =
    paymentStatus === "Paid"
      ? "#16a34a"
      : paymentStatus === "Partial"
      ? "#d97706"
      : "#dc2626";
  const statusBg =
    paymentStatus === "Paid"
      ? "#f0fdf4"
      : paymentStatus === "Partial"
      ? "#fffbeb"
      : "#fef2f2";

  return `
  <div class="invoice-page" style="page-break-after:always; width:780px; margin:0 auto; padding:32px 36px; background:#fff; font-family:'Inter',sans-serif; color:#111; box-sizing:border-box;">

    <!-- ══ HEADER ══ -->
    <table style="width:100%; border-collapse:collapse; margin-bottom:0;">
      <tr>
        <td style="vertical-align:top; width:55%;">
          <div style="font-size:22px; font-weight:800; letter-spacing:-0.5px; color:#0f172a; line-height:1;">CHAMPIKA HARDWARE</div>
          <div style="font-size:10px; color:#475569; margin-top:5px; line-height:1.7;">
            Distribution Division<br>
            Pranawatta Road, Wallabada, Boossa<br>
            Tel: 0777681663
          </div>
        </td>
        <td style="vertical-align:top; text-align:right; width:45%;">
          <div style="font-size:28px; font-weight:800; color:#0f172a; letter-spacing:-1px; line-height:1;">INVOICE</div>
          <div style="font-size:14px; font-weight:700; color:#2563eb; margin-top:4px;">${invoice.invoiceNo || "-"}</div>
          <div style="font-size:10px; color:#64748b; margin-top:6px; line-height:1.8;">
            <b style="color:#0f172a;">Date:</b> ${formatDate(invoice.date || invoice.createdAt)}<br>
            <b style="color:#0f172a;">Sales Rep:</b> ${salesRep}
          </div>
        </td>
      </tr>
    </table>

    <!-- ══ DIVIDER ══ -->
    <div style="border-top:2.5px solid #0f172a; margin:14px 0 16px;"></div>

    <!-- ══ BILL TO + META ══ -->
    <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
      <tr>
        <td style="vertical-align:top; width:55%;">
          <div style="font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#94a3b8; margin-bottom:5px;">Bill To</div>
          <div style="font-size:14px; font-weight:700; color:#0f172a;">${shopName}</div>
          ${customerName !== shopName ? `<div style="font-size:11px; color:#475569; margin-top:1px;">${customerName}</div>` : ""}
          ${address ? `<div style="font-size:11px; color:#475569; margin-top:1px;">${address}</div>` : ""}
          ${route ? `<div style="font-size:11px; color:#475569; margin-top:1px;">Route: ${route}</div>` : ""}
          ${phone ? `<div style="font-size:11px; color:#475569; margin-top:1px;">Tel: ${phone}</div>` : ""}
        </td>
        <td style="vertical-align:top; text-align:right; width:45%;">
          <div style="display:inline-block; background:${statusBg}; color:${statusColor}; border:1.5px solid ${statusColor}; border-radius:4px; padding:3px 12px; font-size:11px; font-weight:700; letter-spacing:0.5px;">${paymentStatus.toUpperCase()}</div>
          ${
            paidAmount > 0
              ? `<div style="font-size:10px; color:#475569; margin-top:8px; line-height:1.8;">
              <b style="color:#0f172a;">Paid:</b> LKR ${fmt(paidAmount)}<br>
              <b style="color:#dc2626;">Balance Due:</b> LKR ${fmt(dueAmount)}
            </div>`
              : ""
          }
        </td>
      </tr>
    </table>

    <!-- ══ ITEMS TABLE ══ -->
    <table style="width:100%; border-collapse:collapse; margin-bottom:18px; border:1px solid #e2e8f0; border-radius:6px; overflow:hidden;">
      <thead>
        <tr style="background:#0f172a;">
          <th style="padding:9px 8px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:#fff; text-align:center; width:4%; border-right:1px solid #334155;">#</th>
          <th style="padding:9px 8px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:#fff; text-align:left; width:38%; border-right:1px solid #334155;">Item Description</th>
          <th style="padding:9px 8px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:#fff; text-align:center; width:8%; border-right:1px solid #334155;">Qty</th>
          <th style="padding:9px 8px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:#fff; text-align:center; width:8%; border-right:1px solid #334155;">Free</th>
          <th style="padding:9px 8px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:#fff; text-align:center; width:8%; border-right:1px solid #334155;">Disc.</th>
          <th style="padding:9px 8px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:#fff; text-align:right; width:17%; border-right:1px solid #334155;">Unit Price</th>
          <th style="padding:9px 8px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:#fff; text-align:right; width:17%;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (item: any, index: number) => `
          <tr style="background:${index % 2 === 0 ? "#fff" : "#f8fafc"};">
            <td style="padding:8px 8px; font-size:11px; color:#64748b; text-align:center; border-bottom:1px solid #f1f5f9; border-right:1px solid #f1f5f9;">${index + 1}</td>
            <td style="padding:8px 8px; font-size:12px; color:#0f172a; font-weight:600; border-bottom:1px solid #f1f5f9; border-right:1px solid #f1f5f9;">${item.productName || item.name || "-"}
              ${item.sku ? `<div style="font-size:9px; color:#94a3b8; font-weight:400; margin-top:1px;">${item.sku}</div>` : ""}
            </td>
            <td style="padding:8px 8px; font-size:12px; font-weight:700; color:#0f172a; text-align:center; border-bottom:1px solid #f1f5f9; border-right:1px solid #f1f5f9;">${item.quantity}</td>
            <td style="padding:8px 8px; font-size:12px; text-align:center; border-bottom:1px solid #f1f5f9; border-right:1px solid #f1f5f9; color:${item.freeQuantity > 0 ? "#16a34a" : "#94a3b8"}; font-weight:${item.freeQuantity > 0 ? "700" : "400"};">${item.freeQuantity > 0 ? item.freeQuantity : "-"}</td>
            <td style="padding:8px 8px; font-size:11px; text-align:center; border-bottom:1px solid #f1f5f9; border-right:1px solid #f1f5f9; color:${item.discountPercent > 0 ? "#d97706" : "#94a3b8"};">${item.discountPercent > 0 ? "-" + item.discountPercent + "%" : "-"}</td>
            <td style="padding:8px 8px; font-size:11px; color:#475569; text-align:right; border-bottom:1px solid #f1f5f9; border-right:1px solid #f1f5f9;">LKR ${fmt(item.unitPrice || item.price)}</td>
            <td style="padding:8px 8px; font-size:12px; font-weight:700; color:#0f172a; text-align:right; border-bottom:1px solid #f1f5f9;">LKR ${fmt(item.total)}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>

    <!-- ══ TOTALS ══ -->
    <table style="width:100%; border-collapse:collapse; margin-bottom:28px;">
      <tr>
        <td style="width:55%; vertical-align:bottom;">
          ${
            invoice.notes
              ? `<div style="font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#94a3b8; margin-bottom:4px;">Notes</div>
            <div style="font-size:11px; color:#475569; max-width:280px; line-height:1.5;">${invoice.notes}</div>`
              : ""
          }
        </td>
        <td style="width:45%; vertical-align:top;">
          <table style="width:100%; border-collapse:collapse; border:1px solid #e2e8f0; border-radius:6px; overflow:hidden;">
            <tr style="background:#f8fafc;">
              <td style="padding:7px 12px; font-size:11px; color:#475569; border-bottom:1px solid #e2e8f0;">Subtotal</td>
              <td style="padding:7px 12px; font-size:11px; color:#0f172a; text-align:right; border-bottom:1px solid #e2e8f0;">LKR ${fmt(subTotal)}</td>
            </tr>
            ${
              extraDiscount > 1
                ? `<tr style="background:#fffbeb;">
              <td style="padding:7px 12px; font-size:11px; color:#d97706; border-bottom:1px solid #e2e8f0;">Extra Discount</td>
              <td style="padding:7px 12px; font-size:11px; color:#d97706; text-align:right; border-bottom:1px solid #e2e8f0;">- LKR ${fmt(extraDiscount)}</td>
            </tr>`
                : ""
            }
            <tr style="background:#0f172a;">
              <td style="padding:10px 12px; font-size:13px; font-weight:700; color:#fff;">NET TOTAL</td>
              <td style="padding:10px 12px; font-size:13px; font-weight:800; color:#fff; text-align:right;">LKR ${fmt(grandTotal)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- ══ SIGNATURES ══ -->
    <table style="width:100%; border-collapse:collapse; margin-top:10px; margin-bottom:24px;">
      <tr>
        <td style="width:45%; text-align:center; padding-top:40px; border-top:1px solid #cbd5e1;">
          <div style="font-size:10px; color:#475569; font-weight:600;">Authorized Signature</div>
        </td>
        <td style="width:10%;"></td>
        <td style="width:45%; text-align:center; padding-top:40px; border-top:1px solid #cbd5e1;">
          <div style="font-size:10px; color:#475569; font-weight:600;">Customer Signature &amp; Stamp</div>
        </td>
      </tr>
    </table>

    <!-- ══ FOOTER ══ -->
    <div style="border-top:1px solid #e2e8f0; padding-top:10px; display:flex; justify-content:space-between; align-items:center;">
      <div style="font-size:9px; color:#94a3b8;">Champika Hardware — Distribution Division</div>
      <div style="font-size:10px; color:#475569; font-weight:600;">Thank you for your business!</div>
      <div style="font-size:9px; color:#94a3b8;">Tel: 0777681663</div>
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
          padding: 20px 0;
          background: #f1f5f9;
        }
        @media print {
          @page { margin: 10mm; size: A4; }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background: white;
            padding: 0;
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
        generateInvoiceHTML(invoiceData),
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
    const allHtml = invoices.map((inv) => generateInvoiceHTML(inv)).join("");

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
