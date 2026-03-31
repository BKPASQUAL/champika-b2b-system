"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { downloadFromElement } from "@/app/lib/invoice-print";

const fmt = (amount: number) =>
  new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);

const formatDate = (dateString: string) => {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const PDF_WIDTH = 794; // A4 at 96dpi

export default function InvoicePrintView({ invoice }: { invoice: any }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [scale, setScale] = useState(1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  // Generate QR
  useEffect(() => {
    QRCode.toDataURL(window.location.href, { width: 80, margin: 1 }).then(setQrDataUrl);
  }, []);

  // Scale invoice to fit screen width — like a PDF viewer
  useEffect(() => {
    const update = () => {
      const vw = window.innerWidth;
      setScale(vw < PDF_WIDTH ? vw / PDF_WIDTH : 1);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const subTotal = (invoice.items || []).reduce(
    (sum: number, item: any) => sum + (item.total || 0),
    0
  );
  const grandTotal = invoice.grandTotal || 0;
  const extraDiscount = Math.max(0, subTotal - grandTotal);
  const shopName = invoice.customer?.shop || invoice.customer?.name || "";
  const customerName = invoice.customer?.name || "";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body {
          background: #888;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, Helvetica, sans-serif;
          min-height: 100vh;
        }
        .top-bar {
          position: sticky; top: 0; z-index: 20;
          background: #111; padding: 10px 16px;
          display: flex; justify-content: space-between; align-items: center;
        }
        .top-bar-title { color: #fff; font-size: 13px; font-weight: 600; }
        .top-bar-btn {
          background: #fff; color: #000; border: none; border-radius: 4px;
          padding: 7px 16px; font-size: 13px; font-weight: 700; cursor: pointer;
        }
        .top-bar-btn-outline {
          background: transparent; color: #fff; border: 1.5px solid #fff; border-radius: 4px;
          padding: 7px 16px; font-size: 13px; font-weight: 700; cursor: pointer;
        }
        .top-bar-actions { display: flex; gap: 8px; }
        .pdf-outer {
          display: flex;
          justify-content: center;
          padding: 16px 0 32px;
        }
        .pdf-scaler {
          transform-origin: top center;
          width: ${PDF_WIDTH}px;
        }
        .inv-page {
          width: ${PDF_WIDTH}px;
          background: #fff;
          padding: 28px 32px 36px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.35);
        }
        /* header */
        .inv-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0; }
        .inv-brand  { font-size: 20px; font-weight: 800; color: #000; letter-spacing: -0.3px; line-height: 1.1; }
        .inv-sub    { font-size: 11px; color: #333; margin-top: 4px; line-height: 1.7; }
        .inv-right  { display: flex; align-items: flex-start; gap: 10px; }
        .inv-no     { font-size: 20px; font-weight: 700; color: #000; letter-spacing: 0.5px; text-align: right; }
        .inv-meta   { font-size: 12px; color: #333; margin-top: 4px; line-height: 1.7; text-align: right; }
        .inv-divider { border-top: 1.5px solid #bbb; margin: 10px 0 12px; }
        /* customer */
        .inv-cust-shop { font-size: 13px; font-weight: 700; color: #000; }
        .inv-cust-line { font-size: 12px; color: #333; margin-top: 2px; }
        .inv-customer  { margin-bottom: 12px; }
        /* table */
        .inv-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
        .inv-table thead tr { background: #1a1a1a; }
        .inv-table thead th {
          padding: 7px 8px; font-size: 9px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.6px; color: #fff; white-space: nowrap;
        }
        .inv-table tbody tr  { border-bottom: 1px solid #e8e8e8; }
        .inv-table tbody td  { padding: 7px 8px; font-size: 11px; color: #111; vertical-align: middle; }
        .inv-table tbody tr:last-child { border-bottom: none; }
        /* totals */
        .inv-totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 16px; }
        .inv-totals      { width: 260px; }
        .inv-totals-row  { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; color: #333; }
        .inv-net         { display: flex; justify-content: space-between; padding: 7px 0 4px; border-top: 1.5px solid #bbb; margin-top: 4px; }
        .inv-net-label   { font-size: 13px; font-weight: 700; color: #000; }
        .inv-net-value   { font-size: 15px; font-weight: 800; color: #000; }
        /* signature */
        .inv-sig-wrap { display: flex; justify-content: flex-end; margin-top: 60px; margin-bottom: 14px; }
        .inv-sig-box  { width: 220px; text-align: center; padding-top: 6px; border-top: 1.5px solid #555; font-size: 11px; color: #333; font-weight: 600; margin-top: 3px; }
        /* footer */
        .inv-footer { border-top: 1px solid #ddd; padding-top: 8px; text-align: center; font-size: 11px; color: #777; }

        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body { background: #fff !important; width: 210mm; margin: 0; padding: 0; }
          .top-bar    { display: none !important; }
          .pdf-outer  { display: block !important; padding: 0 !important; margin: 0 !important; background: #fff !important; }
          .pdf-scaler { transform: none !important; width: 210mm !important; margin: 0 !important; padding: 0 !important; }
          .inv-page   { width: 210mm !important; max-width: 210mm !important; box-shadow: none !important; padding: 5mm 8mm !important; margin: 0 !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* Sticky bar */}
      <div className="top-bar">
        <span className="top-bar-title">Invoice {invoice.invoiceNo}</span>
        <div className="top-bar-actions">
          <button className="top-bar-btn-outline" onClick={() => pageRef.current && downloadFromElement(pageRef.current, `${invoice.invoiceNo || "Invoice"}.pdf`)}>Download PDF</button>
          <button className="top-bar-btn" onClick={() => window.print()}>Save as PDF</button>
        </div>
      </div>

      {/* PDF scaled container */}
      <div className="pdf-outer">
        <div
          ref={wrapRef}
          className="pdf-scaler"
          style={{ transform: `scale(${scale})`, marginBottom: scale < 1 ? `${(scale - 1) * 100}%` : 0 }}
        >
          <div className="inv-page" ref={pageRef}>

            {/* HEADER */}
            <div className="inv-header">
              <div>
                <div className="inv-brand">CHAMPIKA HARDWARE</div>
                <div className="inv-sub">
                  Distribution Division<br />
                  Pranawatta Road, Wallabada, Boossa<br />
                  Tel: 0777681663
                </div>
              </div>
              <div className="inv-right">
                {qrDataUrl && (
                  <img src={qrDataUrl} alt="QR" style={{ width: 70, height: 70, flexShrink: 0 }} />
                )}
                <div>
                  <div className="inv-no">{invoice.invoiceNo || "-"}</div>
                  <div className="inv-meta">
                    {formatDate(invoice.date)}<br />
                    {invoice.salesRep}
                  </div>
                </div>
              </div>
            </div>

            <div className="inv-divider" />

            {/* CUSTOMER */}
            <div className="inv-customer">
              <div className="inv-cust-shop">{shopName}</div>
              {customerName !== shopName && <div className="inv-cust-line">{customerName}</div>}
              {invoice.customer?.address && <div className="inv-cust-line">{invoice.customer.address}</div>}
              {invoice.customer?.phone && <div className="inv-cust-line">{invoice.customer.phone}</div>}
            </div>

            {/* ITEMS TABLE */}
            <table className="inv-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "center", width: "4%"  }}>#</th>
                  <th style={{ textAlign: "left",   width: "13%" }}>Item Code</th>
                  <th style={{ textAlign: "left",   width: "29%" }}>Description</th>
                  <th style={{ textAlign: "right",  width: "13%" }}>Price</th>
                  <th style={{ textAlign: "center", width: "7%"  }}>Qty</th>
                  <th style={{ textAlign: "center", width: "7%"  }}>Unit</th>
                  <th style={{ textAlign: "center", width: "7%"  }}>Free</th>
                  <th style={{ textAlign: "center", width: "7%"  }}>Disc.</th>
                  <th style={{ textAlign: "right",  width: "13%" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {(invoice.items || []).map((item: any, i: number) => (
                  <tr key={i}>
                    <td style={{ textAlign: "center", color: "#777" }}>{i + 1}</td>
                    <td style={{ color: "#555" }}>{item.sku || "-"}</td>
                    <td style={{ fontWeight: 600 }}>{item.productName || "-"}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>LKR {fmt(item.unitPrice)}</td>
                    <td style={{ textAlign: "center", fontWeight: 700 }}>{item.quantity}</td>
                    <td style={{ textAlign: "center", color: "#555" }}>{item.unit || "Pcs"}</td>
                    <td style={{ textAlign: "center" }}>{(item.freeQuantity || 0) > 0 ? item.freeQuantity : "-"}</td>
                    <td style={{ textAlign: "center", color: "#777" }}>{item.discountPercent > 0 ? `-${item.discountPercent}%` : "-"}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>LKR {fmt(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* TOTALS */}
            <div className="inv-totals-wrap">
              <div className="inv-totals">
                <div className="inv-totals-row">
                  <span>Subtotal</span><span>LKR {fmt(subTotal)}</span>
                </div>
                {extraDiscount > 1 && (
                  <div className="inv-totals-row">
                    <span>Extra Discount</span><span>- LKR {fmt(extraDiscount)}</span>
                  </div>
                )}
                <div className="inv-net">
                  <span className="inv-net-label">Net Total</span>
                  <span className="inv-net-value">LKR {fmt(grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* SIGNATURE */}
            <div className="inv-sig-wrap">
              <div className="inv-sig-box">Customer Signature &amp; Stamp</div>
            </div>

            {/* FOOTER */}
            <div className="inv-footer">Thank you for your business!</div>

          </div>
        </div>
      </div>
    </>
  );
}
