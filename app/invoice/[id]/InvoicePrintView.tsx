"use client";

import { useEffect, useState } from "react";
import {
  generateInvoiceHTML,
  printInvoice,
  downloadInvoice,
} from "@/app/lib/invoice-print";
import { DocumentAttachments } from "@/components/ui/DocumentAttachments";
import { Camera } from "lucide-react";

const PDF_WIDTH = 794; // A4 at 96 dpi

export default function InvoicePrintView({ invoice }: { invoice: any }) {
  const [html, setHtml] = useState<string>("");
  const [scale, setScale] = useState(1);

  // Generate the HTML using the exact same function used by Print & Download
  useEffect(() => {
    generateInvoiceHTML(invoice, "distribution").then(setHtml);
  }, [invoice]);

  // Scale the preview to fit narrow screens (like a PDF viewer)
  useEffect(() => {
    const update = () => {
      const vw = window.innerWidth;
      setScale(vw < PDF_WIDTH ? vw / PDF_WIDTH : 1);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (invoice.isDraft) {
    return (
      <>
        <style>{`
          html, body {
            background-color: #f8fafc;
            min-height: 100vh;
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          }
        `}</style>
        <div className="max-w-md mx-auto p-4 space-y-5 min-h-screen flex flex-col justify-start pt-8">
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white p-6 rounded-2xl shadow-lg space-y-2.5 text-center">
            <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-bold tracking-tight">Mobile Photo Uploader</h1>
              <p className="text-xs text-violet-100/90 leading-relaxed">
                Take a photo or upload delivery proof images. Files uploaded here will sync to the office desktop instantly.
              </p>
            </div>
          </div>

          <DocumentAttachments
            entityType="invoice"
            entityId={invoice.id}
            title="Snap & Upload Proof"
            allowUpload={true}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #888; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; }

        .top-bar {
          position: sticky; top: 0; z-index: 20;
          background: #111; padding: 10px 16px;
          display: flex; justify-content: space-between; align-items: center;
          gap: 8px;
        }
        .top-bar-title { color: #fff; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .top-bar-actions { display: flex; gap: 8px; flex-shrink: 0; }
        .btn-dl {
          background: transparent; color: #fff;
          border: 1.5px solid #fff; border-radius: 4px;
          padding: 7px 16px; font-size: 13px; font-weight: 700; cursor: pointer;
          white-space: nowrap;
        }
        .btn-dl:hover { background: rgba(255,255,255,0.1); }
        .btn-print {
          background: #fff; color: #000;
          border: none; border-radius: 4px;
          padding: 7px 16px; font-size: 13px; font-weight: 700; cursor: pointer;
          white-space: nowrap;
        }
        .btn-print:hover { background: #e8e8e8; }

        .pdf-outer {
          display: flex;
          justify-content: center;
          padding: 24px 0 40px;
        }
        .pdf-scaler {
          transform-origin: top center;
          width: ${PDF_WIDTH}px;
          box-shadow: 0 4px 32px rgba(0,0,0,0.4);
        }

        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body { background: #fff !important; }
          .top-bar    { display: none !important; }
          .pdf-outer  { padding: 0 !important; display: block !important; }
          .pdf-scaler { transform: none !important; width: 210mm !important; box-shadow: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* ── Sticky action bar ─────────────────────────────────── */}
      <div className="top-bar">
        <span className="top-bar-title">Invoice {invoice.invoiceNo}</span>
        <div className="top-bar-actions">
          <button
            className="btn-dl"
            onClick={() => downloadInvoice(invoice, "distribution")}
          >
            Download PDF
          </button>
          <button
            className="btn-print"
            onClick={() => printInvoice(invoice, "distribution")}
          >
            Print
          </button>
        </div>
      </div>

      {/* ── Invoice preview — rendered from the shared HTML template ── */}
      <div className="pdf-outer">
        <div
          className="pdf-scaler"
          style={{
            transform: `scale(${scale})`,
            marginBottom: scale < 1 ? `${(scale - 1) * PDF_WIDTH * 1.414}px` : 0,
          }}
        >
          {html ? (
            <div dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <div
              style={{
                width: PDF_WIDTH,
                minHeight: 500,
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#aaa",
                fontSize: 14,
              }}
            >
              Loading invoice…
            </div>
          )}
        </div>
      </div>
    </>
  );
}
