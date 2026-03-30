"use client";

import { useEffect } from "react";

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
  useEffect(() => {
    window.print();
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
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #f0f0f0; font-family: 'Inter', Arial, sans-serif; }

        .invoice-wrap {
          max-width: 720px;
          margin: 0 auto;
          background: #fff;
          padding: 20px 18px 24px;
        }

        /* ── Header ── */
        .inv-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }
        .inv-company-name { font-size: 18px; font-weight: 800; color: #000; line-height: 1.1; }
        .inv-company-sub  { font-size: 11px; color: #444; margin-top: 3px; line-height: 1.6; }
        .inv-meta         { text-align: right; }
        .inv-no           { font-size: 18px; font-weight: 700; color: #000; }
        .inv-meta-sub     { font-size: 11px; color: #444; margin-top: 3px; line-height: 1.6; }

        .inv-divider { border-top: 1.5px solid #bbb; margin: 8px 0; }

        /* ── Customer ── */
        .inv-customer      { margin-bottom: 10px; }
        .inv-customer-shop { font-size: 14px; font-weight: 700; color: #000; }
        .inv-customer-line { font-size: 12px; color: #444; margin-top: 2px; }

        /* ── Items table — desktop ── */
        .inv-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .inv-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 560px;
        }
        .inv-table thead tr { background: #1a1a1a; }
        .inv-table thead th {
          padding: 7px 7px;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: #fff;
          white-space: nowrap;
        }
        .inv-table tbody tr { border-bottom: 1px solid #e8e8e8; }
        .inv-table tbody td { padding: 7px 7px; font-size: 11px; color: #111; vertical-align: middle; }
        .inv-table tbody tr:last-child { border-bottom: none; }

        /* ── Mobile card view for items ── */
        .inv-card-list { display: none; }
        .inv-card {
          border: 1px solid #e5e5e5;
          border-radius: 6px;
          padding: 10px 12px;
          margin-bottom: 8px;
          background: #fafafa;
        }
        .inv-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 6px;
        }
        .inv-card-name  { font-size: 13px; font-weight: 700; color: #000; flex: 1; margin-right: 8px; }
        .inv-card-total { font-size: 13px; font-weight: 800; color: #000; white-space: nowrap; }
        .inv-card-row {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #555;
          margin-top: 3px;
        }
        .inv-card-row span:last-child { color: #111; font-weight: 600; }

        /* ── Totals ── */
        .inv-totals-wrap {
          display: flex;
          justify-content: flex-end;
          margin-top: 8px;
          margin-bottom: 12px;
        }
        .inv-totals-inner { width: 100%; max-width: 280px; }
        .inv-totals-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 4px 0;
          font-size: 13px;
          color: #333;
          border-bottom: 1px solid #f0f0f0;
        }
        .inv-totals-row:last-child { border-bottom: none; }
        .inv-totals-net {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0 4px;
          border-top: 2px solid #bbb;
          margin-top: 4px;
        }
        .inv-totals-net-label { font-size: 15px; font-weight: 700; color: #000; }
        .inv-totals-net-value { font-size: 16px; font-weight: 800; color: #000; }

        /* ── Signature ── */
        .inv-sig-wrap {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 12px;
        }
        .inv-sig-box {
          width: 220px;
          text-align: center;
          padding-top: 28px;
          border-top: 1px solid #aaa;
          font-size: 11px;
          color: #444;
          font-weight: 600;
        }

        /* ── Footer ── */
        .inv-footer {
          text-align: center;
          font-size: 11px;
          color: #777;
          border-top: 1px solid #e0e0e0;
          padding-top: 8px;
        }

        /* ── Print button ── */
        .print-bar {
          background: #111;
          padding: 10px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .print-bar-label { color: #fff; font-size: 13px; font-weight: 600; }
        .print-btn {
          background: #fff;
          color: #000;
          border: none;
          border-radius: 4px;
          padding: 7px 18px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        /* ── Responsive: mobile ── */
        @media (max-width: 600px) {
          .invoice-wrap { padding: 14px 12px 20px; }
          .inv-company-name { font-size: 15px; }
          .inv-no           { font-size: 15px; }
          .inv-table-wrap   { display: none; }
          .inv-card-list    { display: block; }
          .inv-totals-inner { max-width: 100%; }
          .inv-sig-box      { width: 100%; }
        }

        /* ── Print styles ── */
        @media print {
          @page { size: A4; margin: 0; }
          html, body { background: #fff; }
          .print-bar { display: none !important; }
          .invoice-wrap { max-width: 100%; padding: 5mm 8mm; }
          .inv-table-wrap { display: block !important; overflow: visible; }
          .inv-card-list  { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* Sticky print bar */}
      <div className="print-bar">
        <span className="print-bar-label">Invoice {invoice.invoiceNo}</span>
        <button className="print-btn" onClick={() => window.print()}>
          Save as PDF
        </button>
      </div>

      <div className="invoice-wrap">

        {/* HEADER */}
        <div className="inv-header">
          <div>
            <div className="inv-company-name">CHAMPIKA HARDWARE</div>
            <div className="inv-company-sub">
              Distribution Division<br />
              Pranawatta Road, Wallabada, Boossa<br />
              Tel: 0777681663
            </div>
          </div>
          <div className="inv-meta">
            <div className="inv-no">{invoice.invoiceNo || "-"}</div>
            <div className="inv-meta-sub">
              {formatDate(invoice.date)}<br />
              {invoice.salesRep}
            </div>
          </div>
        </div>

        <div className="inv-divider" />

        {/* CUSTOMER */}
        <div className="inv-customer">
          <div className="inv-customer-shop">{shopName}</div>
          {customerName !== shopName && <div className="inv-customer-line">{customerName}</div>}
          {invoice.customer?.address && <div className="inv-customer-line">{invoice.customer.address}</div>}
          {invoice.customer?.phone && <div className="inv-customer-line">{invoice.customer.phone}</div>}
        </div>

        {/* ITEMS — table (desktop / print) */}
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead>
              <tr>
                <th style={{ textAlign: "center", width: "4%" }}>#</th>
                <th style={{ textAlign: "left",   width: "14%" }}>Item Code</th>
                <th style={{ textAlign: "left",   width: "28%" }}>Description</th>
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

        {/* ITEMS — cards (mobile) */}
        <div className="inv-card-list">
          {(invoice.items || []).map((item: any, i: number) => (
            <div key={i} className="inv-card">
              <div className="inv-card-header">
                <div className="inv-card-name">{i + 1}. {item.productName || "-"}</div>
                <div className="inv-card-total">LKR {fmt(item.total)}</div>
              </div>
              <div className="inv-card-row"><span>SKU</span><span>{item.sku || "-"}</span></div>
              <div className="inv-card-row"><span>Price</span><span>LKR {fmt(item.unitPrice)}</span></div>
              <div className="inv-card-row"><span>Qty</span><span>{item.quantity} {item.unit || "Pcs"}</span></div>
              {(item.freeQuantity || 0) > 0 && <div className="inv-card-row"><span>Free</span><span>{item.freeQuantity}</span></div>}
              {item.discountPercent > 0 && <div className="inv-card-row"><span>Discount</span><span>-{item.discountPercent}%</span></div>}
            </div>
          ))}
        </div>

        {/* TOTALS */}
        <div className="inv-totals-wrap">
          <div className="inv-totals-inner">
            <div className="inv-totals-row">
              <span>Subtotal</span>
              <span>LKR {fmt(subTotal)}</span>
            </div>
            {extraDiscount > 1 && (
              <div className="inv-totals-row">
                <span>Extra Discount</span>
                <span>- LKR {fmt(extraDiscount)}</span>
              </div>
            )}
            <div className="inv-totals-net">
              <span className="inv-totals-net-label">Net Total</span>
              <span className="inv-totals-net-value">LKR {fmt(grandTotal)}</span>
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
