"use client";

import { useEffect, useState } from "react";
import {
  generateInvoiceHTML,
  printInvoice,
  downloadInvoice,
} from "@/app/lib/invoice-print";

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
