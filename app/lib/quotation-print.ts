/**
 * quotation-print.ts
 * Client-side print & download helpers for quotations.
 */
import { toast } from "sonner";
import {
  generateQuotationHTML,
  generateHalfPageQuotationHTML,
} from "./quotation-html";
import { getDocumentWrapper, getHalfPageDocumentWrapper, DIVISIONS } from "./invoice-html";

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

// ── Print A4 ───────────────────────────────────────────────────────────────────
export const printQuotation = async (
  quotationOrId: string | any,
  divisionKey: keyof typeof DIVISIONS = "retail"
) => {
  try {
    let data = quotationOrId;
    if (typeof quotationOrId === "string") {
      const tid = toast.loading("Loading quotation...");
      try {
        const res = await fetch(`/api/quotations/${quotationOrId}`);
        if (!res.ok) throw new Error();
        data = await res.json();
        toast.dismiss(tid);
      } catch {
        toast.dismiss(tid);
        toast.error("Failed to load quotation for printing");
        return;
      }
    }
    if (!data) return;
    printHTML(
      getDocumentWrapper(
        await generateQuotationHTML(data, divisionKey),
        data.quotationNo || "Quotation"
      )
    );
  } catch {
    toast.error("Failed to print quotation");
  }
};

// ── Print A5 (Half-page) ────────────────────────────────────────────────────
export const printHalfPageQuotation = async (
  quotationOrId: string | any,
  divisionKey: keyof typeof DIVISIONS = "retail"
) => {
  try {
    let data = quotationOrId;
    if (typeof quotationOrId === "string") {
      const tid = toast.loading("Loading quotation...");
      try {
        const res = await fetch(`/api/quotations/${quotationOrId}`);
        if (!res.ok) throw new Error();
        data = await res.json();
        toast.dismiss(tid);
      } catch {
        toast.dismiss(tid);
        toast.error("Failed to load quotation for printing");
        return;
      }
    }
    if (!data) return;
    printHTML(
      getHalfPageDocumentWrapper(
        await generateHalfPageQuotationHTML(data, divisionKey),
        data.quotationNo || "Quotation"
      )
    );
  } catch {
    toast.error("Failed to print quotation");
  }
};

// ── Generate PDF Blob ───────────────────────────────────────────────────────
export const generateQuotationPdfBlob = async (
  quotationOrId: string | any,
  divisionKey: keyof typeof DIVISIONS = "retail"
): Promise<{ blob: Blob; filename: string }> => {
  const id =
    typeof quotationOrId === "string"
      ? quotationOrId
      : quotationOrId.id || quotationOrId._id;

  // Try server-side Puppeteer first
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(
        `/api/quotations/${id}/pdf?division=${divisionKey}`,
        { signal: controller.signal }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : `${id}.pdf`;
      const blob = await res.blob();
      return { blob, filename };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Fallback to client-side
  }

  // Client-side fallback: html2canvas + jsPDF
  let data: any;
  if (typeof quotationOrId === "string") {
    const res = await fetch(`/api/quotations/${id}`);
    if (!res.ok) throw new Error("Failed to load quotation");
    data = await res.json();
  } else {
    data = quotationOrId;
  }

  const quotationNo = data.quotationNo || data.quotation_no || id;
  const filename = `${quotationNo}.pdf`;
  const html = await generateQuotationHTML(data, divisionKey);
  const fullHtml = getDocumentWrapper(html, quotationNo);

  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;left:-9999px;top:0;width:794px;height:1123px;border:none;visibility:hidden;";
  document.body.appendChild(iframe);

  try {
    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
      iframe.contentDocument!.open();
      iframe.contentDocument!.write(fullHtml);
      iframe.contentDocument!.close();
    });
    await new Promise((r) => setTimeout(r, 400));

    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const body = iframe.contentDocument!.body;
    body.style.margin = "0";
    const canvas = await html2canvas(body, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: 794,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pageW) / canvas.width;

    let yOffset = 0;
    while (yOffset < imgH) {
      if (yOffset > 0) pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, -yOffset, pageW, imgH);
      yOffset += pageH;
    }

    return { blob: pdf.output("blob"), filename };
  } finally {
    document.body.removeChild(iframe);
  }
};

// ── Share Quotation PDF ─────────────────────────────────────────────────────
export const shareQuotation = async (
  id: string,
  divisionKey: keyof typeof DIVISIONS = "retail",
  quotationNo: string,
  onLoadingChange?: (loading: boolean) => void
) => {
  onLoadingChange?.(true);
  const tid = toast.loading("Generating PDF…");
  try {
    const { blob, filename } = await generateQuotationPdfBlob(id, divisionKey);
    toast.dismiss(tid);

    // Desktop fallback
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
        await navigator.share({ title: filename, text: `Quotation ${quotationNo}` });
      }
    } catch (shareErr: any) {
      if (shareErr?.name === "AbortError") return;
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

// ── Download PDF ────────────────────────────────────────────────────────────
export const downloadQuotation = async (
  quotationOrId: string | any,
  divisionKey: keyof typeof DIVISIONS = "retail"
) => {
  const tid = toast.loading("Generating PDF...");
  try {
    const { blob, filename } = await generateQuotationPdfBlob(
      quotationOrId,
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
    console.error("downloadQuotation error:", err);
    toast.dismiss(tid);
    toast.error("Failed to download quotation");
  }
};
