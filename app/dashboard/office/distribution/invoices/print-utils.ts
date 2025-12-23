// app/dashboard/office/distribution/invoices/print-utils.ts
import { toast } from "sonner";

// Helper to calculate status if missing (logic kept but hidden in UI)
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

const generateInvoiceHTML = (invoice: any) => {
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
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice #${invoice.invoiceNo}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        body {
          font-family: 'Inter', sans-serif;
          color: #000000;
          line-height: 1.25;
          margin: 0;
          padding: 0;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          background-color: white; /* Changed to white for iframe blending */
        }

        .invoice-container {
          max-width: 800px;
          margin: 0 auto; /* Removed auto margin for iframe view */
          padding: 20px 30px;
          background: white;
        }

        /* Header */
        .header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 2px solid #cbd5e1;
        }

        .company-logo h1 {
          margin: 0;
          font-size: 20px;
          color: #000000;
          text-transform: uppercase;
          letter-spacing: -0.5px;
        }
        
        .company-details {
          margin-top: 4px;
          font-size: 11px;
          color: #000000;
        }

        /* Top Right Details */
        .invoice-details-top {
          text-align: right;
        }
        
        .invoice-no {
          font-size: 18px;
          font-weight: 700;
          color: #000000;
          margin-bottom: 4px;
        }
        
        .invoice-meta {
          font-size: 12px;
          color: #000000;
          line-height: 1.4;
        }

        /* Info Grid */
        .info-grid {
          margin-bottom: 20px;
        }

        .info-group h3 {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #000000;
          margin-bottom: 2px;
          font-weight: 700;
        }

        .info-group p {
          margin: 0;
          font-size: 15px;
          font-weight: 600;
          color: #000000;
        }

        .info-group .sub-text {
          color: #000000;
          font-weight: 400;
          margin-top: 2px;
          font-size: 12px;
        }

        /* Items Table */
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
        }

        th {
          text-align: left;
          padding: 8px 6px;
          background: #f1f1f1;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #000000;
          font-weight: 700;
          border-bottom: 1px solid #cbd5e1;
        }

        td {
          padding: 8px 6px;
          font-size: 12px;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: top;
          color: #000000;
        }

        tr:last-child td {
          border-bottom: 1px solid #cbd5e1;
        }

        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-mono { font-family: 'Courier New', monospace; }

        /* Totals Section */
        .totals-section {
          display: flex;
          justify-content: flex-end;
          margin-top: 10px;
        }

        .totals-box {
          width: 250px;
        }

        .total-row {
          display: flex;
          justify-content: space-between;
          padding: 3px 0;
          font-size: 12px;
          color: #000000;
        }

        .final-total {
          display: flex;
          justify-content: space-between;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 2px solid #cbd5e1;
          font-size: 14px;
          font-weight: 700;
          color: #000000;
        }

        /* Signatures */
        .signatures {
            margin-top: 50px;
            display: flex;
            justify-content: flex-end;
            font-size: 11px;
            color: #000000;
        }
        
        .sig-line {
            border-top: 1px solid #cbd5e1;
            padding-top: 4px;
            width: 200px;
            text-align: center;
            font-weight: 600;
        }

        /* Footer */
        .footer {
          margin-top: 30px;
          padding-top: 10px;
          border-top: 1px solid #cbd5e1;
          text-align: center;
          font-size: 10px;
          color: #000000;
        }

        @media print {
          body { 
            -webkit-print-color-adjust: exact; 
            background-color: white;
            color: black;
          }
          .invoice-container { 
            width: 100%; 
            max-width: none; 
            padding: 0; 
            margin: 0;
            box-shadow: none;
          }
          @page { margin: 10mm; }
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        
        <div class="header">
          <div class="company-logo">
            <h1 style="font-size: 30px; font-weight: 700;">CHAMPIKA HARDWARE</h1>
            <div class="company-details">
              Distribution Division<br>
              45, Main Street, Galle<br>
              Tel: 077-1234567
            </div>
          </div>
          <div class="invoice-details-top">
            <div class="invoice-no"> ${invoice.invoiceNo}</div>
            <div class="invoice-meta">
               ${formatDate(invoice.date || invoice.createdAt)}<br>
               ${invoice.salesRep || invoice.salesRepName || "-"}
            </div>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-group">
            <p>${shopName}</p>
            <div class="sub-text">
              ${customerName !== shopName ? customerName + "<br>" : ""}
              ${address ? address + "<br>" : ""}
              ${phone || "No Phone Provided"}
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 5%">#</th>
              <th style="width: 45%">Item Description</th>
              <th class="text-right" style="width: 15%">Price</th>
              <th class="text-center" style="width: 10%">Qty</th>
              <th class="text-center" style="width: 10%">Unit</th>
              <th class="text-center" style="width: 10%">Free</th>
              <th class="text-center" style="width: 5%">Disc.</th>
              <th class="text-right" style="width: 15%">Total</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map(
                (item: any, index: number) => `
              <tr>
                <td>${index + 1}</td>
                <td>
                  <span style="font-weight: 600;font-size: 12px ">${
                    item.productName || item.name
                  }</span>
                </td>
                <td class="text-right font-mono">${formatCurrency(
                  item.unitPrice || item.price
                )}</td>
                <td class="text-center" style="font-weight: 600;">${
                  item.quantity
                }</td>
                <td class="text-center" style="font-size: 11px;">${
                  item.unit || "-"
                }</td>
                <td class="text-center">${
                  item.freeQuantity > 0 ? item.freeQuantity : "-"
                }</td>
                <td class="text-center" style="font-size: 10px;">
                    ${
                      item.discountPercent > 0
                        ? "-" + item.discountPercent + "%"
                        : "-"
                    }
                </td>
                <td class="text-right font-mono" style="font-weight: 700;">${formatCurrency(
                  item.total
                )}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>

        <div class="totals-section">
          <div class="totals-box">
            <div class="total-row">
              <span>Subtotal</span>
              <span>${formatCurrency(subTotal)}</span>
            </div>
            
            ${
              extraDiscount > 1
                ? `
            <div class="total-row">
              <span>Extra Discount</span>
              <span>- ${formatCurrency(extraDiscount)}</span>
            </div>
            `
                : ""
            }

            <div class="final-total">
              <span>Net Total</span>
              <span>${formatCurrency(netTotal)}</span>
            </div>
          </div>
        </div>
        
        <div class="signatures">
            <div class="sig-line">Customer Signature & Stamp</div>
        </div>

        <div class="footer">
         

      </div>
      <script>
        // No auto-print on load because we handle it via iframe controller
      </script>
    </body>
    </html>
  `;
};

/**
 * Main print function
 * Uses a hidden iframe to print on the same page.
 */
export const printInvoice = async (invoiceOrId: string | any) => {
  try {
    let invoiceData = invoiceOrId;

    // If ID is passed, fetch the data first
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

    // Create a hidden iframe
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";

    // Append to body
    document.body.appendChild(iframe);

    // Get the iframe's document
    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) return;

    // Generate content
    const htmlContent = generateInvoiceHTML(invoiceData);

    // Write content
    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    // Wait slightly for rendering then print
    setTimeout(() => {
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }

      // Remove iframe after a delay to ensure print dialog has opened
      // (Removing immediately can sometimes block the print dialog in some browsers)
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 2000);
    }, 500);
  } catch (error) {
    console.error(error);
    toast.error("Failed to print invoice");
  }
};

/**
 * Download alias (Uses print view for now, as it allows 'Save as PDF')
 */
export const downloadInvoice = async (invoiceOrId: string | any) => {
  await printInvoice(invoiceOrId);
};
