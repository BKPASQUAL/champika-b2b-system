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
  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Safe Accessors
  const customerName =
    invoice.customer?.name || invoice.customerName || "Unknown Customer";
  const shopName = invoice.customer?.shop || invoice.shopName || customerName;
  const phone = invoice.customer?.phone || invoice.phone || "";
  const address = invoice.customer?.address || invoice.address || "";
  const items = invoice.items || [];

  const subTotal = items.reduce(
    (sum: number, item: any) => sum + (item.total || 0),
    0
  );
  const grandTotal = invoice.grandTotal || invoice.totalAmount || 0;
  const extraDiscount = Math.max(0, subTotal - grandTotal);
  const netTotal = grandTotal;

  return `
    <div class="invoice-page" style="page-break-after: always; max-width: 800px; margin: 0 auto; padding: 20px 30px; background: white; min-height: 95vh; position: relative;">
        <div class="header" style="display: flex; justify-content: space-between; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #cbd5e1;">
          <div class="company-logo">
            <h1 style="margin: 0; font-size: 20px; color: #000000; text-transform: uppercase; letter-spacing: -0.5px; font-weight: 700;">CHAMPIKA HARDWARE</h1>
            <div class="company-details" style="margin-top: 4px; font-size: 11px; color: #000000;">
              Distribution Division<br>
              45, Main Street, Galle<br>
              Tel: 077-1234567
            </div>
          </div>
          <div class="invoice-details-top" style="text-align: right;">
            <div class="invoice-no" style="font-size: 18px; font-weight: 700; color: #000000; margin-bottom: 4px;"> ${
              invoice.invoiceNo
            }</div>
            <div class="invoice-meta" style="font-size: 12px; color: #000000; line-height: 1.4;">
               ${formatDate(invoice.date || invoice.createdAt)}<br>
               ${invoice.salesRep || invoice.salesRepName || "-"}
            </div>
          </div>
        </div>

        <div class="info-grid" style="margin-bottom: 20px;">
          <div class="info-group">
            <p style="margin: 0; font-size: 15px; font-weight: 600; color: #000000;">${shopName}</p>
            <div class="sub-text" style="color: #000000; font-weight: 400; margin-top: 2px; font-size: 12px;">
              ${customerName !== shopName ? customerName + "<br>" : ""}
              ${address ? address + "<br>" : ""}
              ${phone || "No Phone Provided"}
            </div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
          <thead>
            <tr>
              <th style="text-align: left; padding: 8px 6px; background: #f1f1f1; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #000000; font-weight: 700; border-bottom: 1px solid #cbd5e1; width: 5%">#</th>
              <th style="text-align: left; padding: 8px 6px; background: #f1f1f1; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #000000; font-weight: 700; border-bottom: 1px solid #cbd5e1; width: 45%">Item Description</th>
              <th style="text-align: right; padding: 8px 6px; background: #f1f1f1; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #000000; font-weight: 700; border-bottom: 1px solid #cbd5e1; width: 15%">Price</th>
              <th style="text-align: center; padding: 8px 6px; background: #f1f1f1; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #000000; font-weight: 700; border-bottom: 1px solid #cbd5e1; width: 10%">Qty</th>
              <th style="text-align: center; padding: 8px 6px; background: #f1f1f1; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #000000; font-weight: 700; border-bottom: 1px solid #cbd5e1; width: 10%">Unit</th>
              <th style="text-align: center; padding: 8px 6px; background: #f1f1f1; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #000000; font-weight: 700; border-bottom: 1px solid #cbd5e1; width: 10%">Free</th>
              <th style="text-align: center; padding: 8px 6px; background: #f1f1f1; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #000000; font-weight: 700; border-bottom: 1px solid #cbd5e1; width: 5%">Disc.</th>
              <th style="text-align: right; padding: 8px 6px; background: #f1f1f1; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #000000; font-weight: 700; border-bottom: 1px solid #cbd5e1; width: 15%">Total</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map(
                (item: any, index: number) => `
              <tr>
                <td style="padding: 8px 6px; font-size: 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; color: #000000;">${
                  index + 1
                }</td>
                <td style="padding: 8px 6px; font-size: 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; color: #000000;">
                  <span style="font-weight: 600; font-size: 12px;">${
                    item.productName || item.name
                  }</span>
                </td>
                <td style="padding: 8px 6px; font-size: 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; color: #000000; text-align: right; font-family: 'Courier New', monospace;">${formatCurrency(
                  item.unitPrice || item.price
                )}</td>
                <td style="padding: 8px 6px; font-size: 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; color: #000000; text-align: center; font-weight: 600;">${
                  item.quantity
                }</td>
                <td style="padding: 8px 6px; font-size: 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; color: #000000; text-align: center; font-size: 11px;">${
                  item.unit || "-"
                }</td>
                <td style="padding: 8px 6px; font-size: 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; color: #000000; text-align: center;">${
                  item.freeQuantity > 0 ? item.freeQuantity : "-"
                }</td>
                <td style="padding: 8px 6px; font-size: 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; color: #000000; text-align: center; font-size: 10px;">
                    ${
                      item.discountPercent > 0
                        ? "-" + item.discountPercent + "%"
                        : "-"
                    }
                </td>
                <td style="padding: 8px 6px; font-size: 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; color: #000000; text-align: right; font-family: 'Courier New', monospace; font-weight: 700;">${formatCurrency(
                  item.total
                )}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>

        <div class="totals-section" style="display: flex; justify-content: flex-end; margin-top: 10px;">
          <div class="totals-box" style="width: 250px;">
            <div class="total-row" style="display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; color: #000000;">
              <span>Subtotal</span>
              <span>${formatCurrency(subTotal)}</span>
            </div>
            
            ${
              extraDiscount > 1
                ? `
            <div class="total-row" style="display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; color: #000000;">
              <span>Extra Discount</span>
              <span>- ${formatCurrency(extraDiscount)}</span>
            </div>
            `
                : ""
            }

            <div class="final-total" style="display: flex; justify-content: space-between; margin-top: 8px; padding-top: 8px; border-top: 2px solid #cbd5e1; font-size: 14px; font-weight: 700; color: #000000;">
              <span>Net Total</span>
              <span>${formatCurrency(netTotal)}</span>
            </div>
          </div>
        </div>
        
        <div class="signatures" style="margin-top: 50px; display: flex; justify-content: flex-end; font-size: 11px; color: #000000;">
            <div class="sig-line" style="border-top: 1px solid #cbd5e1; padding-top: 4px; width: 200px; text-align: center; font-weight: 600;">Customer Signature & Stamp</div>
        </div>

        <div class="footer" style="margin-top: 30px; padding-top: 10px; border-top: 1px solid #cbd5e1; text-align: center; font-size: 10px; color: #000000;">
           Thank you for your business!
        </div>
    </div>
  `;
};

// Base wrapper for the printable document
const getDocumentWrapper = (content: string, title: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body {
          font-family: 'Inter', sans-serif;
          margin: 0;
          padding: 0;
          background-color: white;
        }
        @media print {
          @page { margin: 0; }
          body { 
            -webkit-print-color-adjust: exact; 
            background-color: white;
          }
          /* Ensure breaks work */
          .invoice-page {
             page-break-after: always;
          }
          .invoice-page:last-child {
             page-break-after: auto;
          }
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
