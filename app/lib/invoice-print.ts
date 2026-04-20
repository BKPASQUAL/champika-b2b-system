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
        data.invoiceNo || "Invoice"
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
// Retries up to 2 times because Puppeteer/Chromium cold-start can cause
// the first attempt to fail on slow or serverless environments.
export const generateInvoicePdfBlob = async (
  invoiceOrId: string | any,
  divisionKey: keyof typeof DIVISIONS = "admin"
): Promise<{ blob: Blob; filename: string }> => {
  const id =
    typeof invoiceOrId === "string"
      ? invoiceOrId
      : invoiceOrId.id || invoiceOrId._id;

  const MAX_ATTEMPTS = 3;
  let lastError: Error = new Error("PDF generation failed");

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(
        `/api/invoices/${id}/pdf?division=${divisionKey}`
      );
      if (!res.ok) throw new Error(`PDF API returned HTTP ${res.status}`);

      // Read the invoice number from the Content-Disposition header so the
      // filename is always correct even when called with just an ID string.
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : `${id}.pdf`;

      const blob = await res.blob();
      return { blob, filename };
    } catch (err: any) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        // Brief delay before retry — gives Chromium time to settle
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
  }

  throw lastError;
};

// ── Share Invoice PDF ───────────────────────────────────────────────────────
// Handles iOS PWA (user-gesture loss after async), Android Chrome, and desktop.
// Strategy:
//   1. Try Web Share API with the PDF file
//   2. If share throws (iOS PWA gesture loss), open the blob URL in a new tab
//      so the user can share from the browser's native UI
//   3. On desktop (no share API), trigger download
export const shareInvoice = async (
  id: string,
  divisionKey: keyof typeof DIVISIONS,
  invoiceNo: string,
  onLoadingChange?: (loading: boolean) => void
) => {
  onLoadingChange?.(true);
  const tid = toast.loading("Generating PDF…");
  try {
    const { blob, filename } = await generateInvoicePdfBlob(id, divisionKey);
    toast.dismiss(tid);

    // Desktop fallback — no Share API
    if (!navigator.share) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success("PDF downloaded");
      return;
    }

    const file = new File([blob], filename, { type: "application/pdf" });
    const canShareFile = navigator.canShare?.({ files: [file] }) ?? false;

    try {
      if (canShareFile) {
        await navigator.share({ files: [file], title: filename });
      } else {
        await navigator.share({ title: filename, text: `Invoice ${invoiceNo}` });
      }
    } catch (shareErr: any) {
      if (shareErr?.name === "AbortError") return; // User cancelled — not an error

      // iOS PWA: gesture context lost after async PDF fetch — open PDF in new tab
      // so the user can share from Safari's native share button
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
      toast.info("PDF opened — use your browser's share button to send it");
    }
  } catch (err: any) {
    toast.dismiss(tid);
    toast.error("Failed to generate PDF");
  } finally {
    onLoadingChange?.(false);
  }
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
