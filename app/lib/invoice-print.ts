/**
 * invoice-print.ts
 * Client-side print & download helpers.
 *
 * PDF generation is now done server-side via /api/invoices/[id]/pdf
 * (Puppeteer / headless Chromium) so the downloaded PDF is pixel-identical
 * to what the browser print engine produces — no more html2canvas differences.
 */
import { toast } from "sonner";
import {
  generateInvoiceHTML,
  getDocumentWrapper,
  DIVISIONS,
} from "./invoice-html";

export type { DivisionConfig } from "./invoice-html";
export { DIVISIONS };

// ── iframe print helper ─────────────────────────────────────────────────────
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

// ── Re-export so callers don't need to import from invoice-html directly ────
export { generateInvoiceHTML };

// ── Print ───────────────────────────────────────────────────────────────────
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
    printHTML(
      getDocumentWrapper(
        await generateInvoiceHTML(data, divisionKey),
        `Invoice ${data.invoiceNo}`
      )
    );
  } catch {
    toast.error("Failed to print invoice");
  }
};

// ── Bulk print ──────────────────────────────────────────────────────────────
export const printBulkInvoices = async (
  invoiceIds: string[],
  divisionKey: keyof typeof DIVISIONS = "distribution"
) => {
  if (!invoiceIds?.length) {
    toast.error("No invoices selected");
    return;
  }
  const tid = toast.loading(`Preparing ${invoiceIds.length} invoices...`);
  try {
    const invoices = await Promise.all(
      invoiceIds.map((id) =>
        fetch(`/api/invoices/${id}`).then((r) => {
          if (!r.ok) throw new Error();
          return r.json();
        })
      )
    );
    const allHtml = (
      await Promise.all(
        invoices.map((inv) => generateInvoiceHTML(inv, divisionKey))
      )
    ).join("");
    printHTML(getDocumentWrapper(allHtml, "Bulk Invoices"));
    toast.dismiss(tid);
    toast.success("Printing started");
  } catch {
    toast.dismiss(tid);
    toast.error("Failed to generate bulk print");
  }
};

// ── Generate PDF Blob (server-side, for uploading / WhatsApp sharing) ───────
// Calls the Puppeteer PDF API — identical output to Print.
export const generateInvoicePdfBlob = async (
  invoiceOrId: string | any,
  divisionKey: keyof typeof DIVISIONS = "admin"
): Promise<{ blob: Blob; filename: string }> => {
  const id =
    typeof invoiceOrId === "string"
      ? invoiceOrId
      : invoiceOrId.id || invoiceOrId._id;
  const invoiceNo =
    typeof invoiceOrId === "string"
      ? "Invoice"
      : invoiceOrId.invoiceNo || "Invoice";

  const res = await fetch(
    `/api/invoices/${id}/pdf?division=${divisionKey}`
  );
  if (!res.ok) throw new Error(`PDF API returned HTTP ${res.status}`);

  const blob = await res.blob();
  return { blob, filename: `${invoiceNo}.pdf` };
};

// ── Download — auto-saves PDF, pixel-identical to Print ────────────────────
export const downloadInvoice = async (
  invoiceOrId: string | any,
  divisionKey: keyof typeof DIVISIONS = "distribution"
) => {
  const tid = toast.loading("Generating PDF...");
  try {
    const { blob, filename } = await generateInvoicePdfBlob(
      invoiceOrId,
      divisionKey
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.dismiss(tid);
    toast.success(`${filename} downloaded`);
  } catch (err: any) {
    console.error("downloadInvoice error:", err);
    toast.dismiss(tid);
    toast.error("Failed to download invoice");
  }
};
