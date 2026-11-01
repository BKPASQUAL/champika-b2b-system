"use client";

import CreateInvoiceForm from "../_components/CreateInvoiceForm";

// Same as the normal create page, but the bill prints: MRP | Disc% | Unit Price | Total
export default function CreateMrpInvoicePage() {
  return <CreateInvoiceForm printFormat="MRP" />;
}
