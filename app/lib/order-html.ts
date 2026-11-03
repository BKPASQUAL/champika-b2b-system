/**
 * order-html.ts
 * Prints orders using the same invoice design (invoice-html.ts).
 */
import { generateInvoiceHTML, getDocumentWrapper } from "./invoice-html";
import { BUSINESS_IDS } from "@/app/config/business-constants";

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
  // Orange Agency orders print in the Orange invoice design. Use the saved
  // invoice when there is one (it carries rep phone, invoice time, book no).
  if (order.businessId === BUSINESS_IDS.ORANGE_AGENCY && order.invoiceId) {
    try {
      const res = await fetch(`/api/invoices/${order.invoiceId}`);
      if (res.ok) {
        const invoice = await res.json();
        const html = await generateInvoiceHTML(invoice, "orange");
        printHTML(getDocumentWrapper(html, invoice.invoiceNo || "Invoice"));
        return;
      }
    } catch {
      // fall through to printing from the order data below
    }
  }

  const invoiceData = {
    businessId: order.businessId || null,
    paymentMethod: order.paymentMethod || "",
    cashDiscountPercent: order.cashDiscountPercent || 0,
    cashDiscountAmount: order.cashDiscountAmount || 0,
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
      mrp: item.mrp || 0,
      unitPrice: item.price,
      quantity: item.qty,
      unit: item.unit,
      freeQuantity: item.free || 0,
      discountPercent: item.discountPercent || 0,
      total: item.total,
      serials: (item.serials || []).map((s: any) => (typeof s === "string" ? s : s.serialNo)),
    })),
  };

  const html = await generateInvoiceHTML(invoiceData, "distribution");
  printHTML(getDocumentWrapper(html, invoiceData.invoiceNo));
};
