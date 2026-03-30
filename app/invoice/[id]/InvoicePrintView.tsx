"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

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

export default function InvoicePrintView({ invoice }: { invoice: any }) {
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    QRCode.toDataURL(window.location.href, { width: 80, margin: 1 }).then(setQrDataUrl);
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
        html, body { background: #e8e8e8; font-family: 'Inter', Arial, sans-serif; }

        .inv-page {
          max-width: 794px;
          margin: 16px auto;
          background: #fff;
          padding: 18px 20px 24px;
          box-shadow: 0 2px 16px rgba(0,0,0,0.12);
        }

        /* header */
        .inv-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 0; }
        .inv-brand  { font-size: 20px; font-weight: 800; color: #000; letter-spacing: -0.3px; line-height: 1.1; }
        .inv-sub    { font-size: 11px; color: #333; margin-top: 3px; line-height: 1.7; }
        .inv-right  { display: flex; align-items: flex-start; gap: 10px; }
        .inv-no     { font-size: 20px; font-weight: 700; color: #000; letter-spacing: 0.5px; text-align: right; }
        .inv-meta   { font-size: 12px; color: #333; margin-top: 3px; line-height: 1.7; text-align: right; }

        .inv-divider { border-top: 1.5px solid #bbb; margin: 8px 0 10px; }

        /* customer */
        .inv-customer      { margin-bottom: 10px; }
        .inv-cust-shop     { font-size: 13px; font-weight: 700; color: #000; }
        .inv-cust-line     { font-size: 12px; color: #333; margin-top: 1px; }

        /* items table */
        .inv-table-wrap    { overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 8px; }
        .inv-table         { width: 100%; border-collapse: collapse; min-width: 520px; }
        .inv-table thead tr { background: #1a1a1a; }
        .inv-table thead th {
          padding: 7px 7px; font-size: 9px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.6px; color: #fff; white-space: nowrap;
        }
        .inv-table tbody tr  { border-bottom: 1px solid #e8e8e8; }
        .inv-table tbody td  { padding: 7px 7px; font-size: 11px; color: #111; vertical-align: middle; }
        .inv-table tbody tr:last-child { border-bottom: none; }

        /* mobile cards */
        .inv-cards { display: none; margin-bottom: 8px; }
        .inv-card  {
          border: 1px solid #e5e5e5; border-radius: 6px;
          padding: 10px 12px; margin-bottom: 8px; background: #fafafa;
        }
        .inv-card-top   { display: flex; justify-content: space-between; margin-bottom: 6px; }
        .inv-card-name  { font-size: 13px; font-weight: 700; color: #000; flex: 1; margin-right: 8px; }
        .inv-card-total { font-size: 13px; font-weight: 800; color: #000; white-space: nowrap; }
        .inv-card-row   { display: flex; justify-content: space-between; font-size: 11px; color: #555; margin-top: 3px; }
        .inv-card-row span:last-child { color: #111; font-weight: 600; }

        /* totals */
        .inv-totals-wrap  { display: flex; justify-content: flex-end; margin-bottom: 14px; }
        .inv-totals       { width: 260px; }
        .inv-totals-row   { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; color: #333; border-bottom: 1px solid #f0f0f0; }
        .inv-totals-row:last-child { border: none; }
        .inv-net          { display: flex; justify-content: space-between; align-items: center; padding: 7px 0 4px; border-top: 1.5px solid #bbb; margin-top: 4px; }
        .inv-net-label    { font-size: 13px; font-weight: 700; color: #000; }
        .inv-net-value    { font-size: 15px; font-weight: 800; color: #000; }

        /* signature */
        .inv-sig-wrap { display: flex; justify-content: flex-end; margin-bottom: 12px; }
        .inv-sig-box  { width: 220px; text-align: center; padding-top: 26px; border-top: 1px solid #aaa; font-size: 11px; color: #333; font-weight: 600; }

        /* footer */
        .inv-footer { border-top: 1px solid #ddd; padding-top: 8px; text-align: center; font-size: 11px; color: #666; }

        /* sticky top bar */
        .top-bar {
          position: sticky; top: 0; z-index: 20;
          background: #111; padding: 10px 16px;
          display: flex; justify-content: space-between; align-items: center;
        }
        .top-bar-title { color: #fff; font-size: 13px; font-weight: 600; }
        .top-bar-btn   {
          background: #fff; color: #000; border: none; border-radius: 4px;
          padding: 7px 16px; font-size: 13px; font-weight: 700; cursor: pointer;
        }

        /* ── mobile ── */
        @media (max-width: 600px) {
          .inv-page      { margin: 0; box-shadow: none; padding: 14px 12px 20px; }
          .inv-brand     { font-size: 15px; }
          .inv-no        { font-size: 15px; }
          .inv-table-wrap{ display: none; }
          .inv-cards     { display: block; }
          .inv-totals    { width: 100%; }
          .inv-sig-box   { width: 100%; }
          .inv-right img { width: 52px !important; height: 52px !important; }
        }

        /* ── print ── */
        @media print {
          @page { size: A4; margin: 0; }
          html, body { background: #fff; }
          .top-bar       { display: none !important; }
          .inv-page      { margin: 0; box-shadow: none; max-width: 100%; padding: 5mm 8mm; }
          .inv-table-wrap{ display: block !important; overflow: visible; }
          .inv-cards     { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* sticky bar */}
      <div className="top-bar">
        <span className="top-bar-title">Invoice {invoice.invoiceNo}</span>
        <button className="top-bar-btn" onClick={() => window.print()}>Save as PDF</button>
      </div>

      <div className="inv-page">

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
              <img src={qrDataUrl} alt="Invoice QR" style={{ width: 70, height: 70, display: "block", flexShrink: 0 }} />
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

        {/* ITEMS TABLE — desktop / print */}
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead>
              <tr>
                <th style={{ textAlign: "center", width: "4%" }}>#</th>
                <th style={{ textAlign: "left",   width: "13%" }}>Item Code</th>
                <th style={{ textAlign: "left",   width: "29%" }}>Description</th>
                <th style={{ textAlign: "right",  width: "13%" }}>Price</th>
                <th style={{ textAlign: "center", width: "7%" }}>Qty</th>
                <th style={{ textAlign: "center", width: "7%" }}>Unit</th>
                <th style={{ textAlign: "center", width: "7%" }}>Free</th>
                <th style={{ textAlign: "center", width: "7%" }}>Disc.</th>
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
        </div>

        {/* ITEMS CARDS — mobile only */}
        <div className="inv-cards">
          {(invoice.items || []).map((item: any, i: number) => (
            <div key={i} className="inv-card">
              <div className="inv-card-top">
                <div className="inv-card-name">{i + 1}. {item.productName || "-"}</div>
                <div className="inv-card-total">LKR {fmt(item.total)}</div>
              </div>
              <div className="inv-card-row"><span>SKU</span><span>{item.sku || "-"}</span></div>
              <div className="inv-card-row"><span>Price</span><span>LKR {fmt(item.unitPrice)}</span></div>
              <div className="inv-card-row"><span>Qty</span><span>{item.quantity} {item.unit || "Pcs"}</span></div>
              {(item.freeQuantity || 0) > 0 && (
                <div className="inv-card-row"><span>Free</span><span>{item.freeQuantity}</span></div>
              )}
              {item.discountPercent > 0 && (
                <div className="inv-card-row"><span>Discount</span><span>-{item.discountPercent}%</span></div>
              )}
            </div>
          ))}
        </div>

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
    </>
  );
}
