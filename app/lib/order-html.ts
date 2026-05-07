/**
 * order-html.ts
 * Prints orders using the same invoice design (invoice-html.ts).
 */
import { generateInvoiceHTML, getDocumentWrapper } from "./invoice-html";

const printHTML = (htmlContent: string) => {
  const iframe = document.createElement("iframe");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
  });
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(htmlContent);
  doc.close();
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 2000);
  }, 500);
};

export const printOrder = async (order: any, items: any[]) => {
  const invoiceData = {
    // Use invoice number as the primary reference if available, else order ID
    invoiceNo: order.invoiceNo || order.orderId || "-",
    manualInvoiceNo: null,
    // Use invoice UUID for QR code; null means no QR code is rendered
    _id: order.invoiceId || null,
    id: order.invoiceId || null,
    date: order.date || order.createdAt,
    salesRep: order.salesRep || "-",
    grandTotal: order.totalAmount || 0,
    notes: order.notes || "",
    customer: {
      shop: order.customer?.shopName || order.customer?.name,
      name: order.customer?.name,
      address: order.customer?.address,
      phone: order.customer?.phone,
      route: order.customer?.route,
    },
    items: items.map((item) => ({
      sku: item.sku,
      productName: item.name,
      unitPrice: item.price,
      quantity: item.qty,
      unit: item.unit,
      freeQuantity: item.free || 0,
      discountPercent: item.discountPercent || 0,
      total: item.total,
    })),
  };

  const html = await generateInvoiceHTML(invoiceData, "distribution");
  printHTML(getDocumentWrapper(html, invoiceData.invoiceNo));
};
