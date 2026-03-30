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
        html, body { background: #fff; }
        @media print {
          @page { size: A4; margin: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Print button — hidden when printing */}
      <div className="no-print" style={{ padding: "12px 16px", background: "#f5f5f5", borderBottom: "1px solid #ddd", display: "flex", gap: 8 }}>
        <button
          onClick={() => window.print()}
          style={{ padding: "8px 20px", background: "#000", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
        >
          Print / Save as PDF
        </button>
      </div>

      {/* Invoice */}
      <div style={{ width: "100%", minHeight: "100vh", padding: "5mm 8mm", background: "#fff", fontFamily: "'Inter',Arial,sans-serif", color: "#111" }}>

        {/* HEADER */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
          <tbody>
            <tr>
              <td style={{ verticalAlign: "top", width: "60%" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#000", letterSpacing: -0.3, lineHeight: 1.1 }}>CHAMPIKA HARDWARE</div>
                <div style={{ fontSize: 10, color: "#333", marginTop: 2, lineHeight: 1.5 }}>
                  Distribution Division<br />
                  Pranawatta Road, Wallabada, Boossa<br />
                  Tel: 0777681663
                </div>
              </td>
              <td style={{ verticalAlign: "top", textAlign: "right", width: "40%" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#000", letterSpacing: 0.5 }}>{invoice.invoiceNo || "-"}</div>
                <div style={{ fontSize: 11, color: "#333", marginTop: 2, lineHeight: 1.5 }}>
                  {formatDate(invoice.date)}<br />
                  {invoice.salesRep}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* DIVIDER */}
        <div style={{ borderTop: "1.5px solid #bbb", margin: "6px 0 8px" }} />

        {/* CUSTOMER */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#000" }}>{shopName}</div>
          {customerName !== shopName && <div style={{ fontSize: 12, color: "#333" }}>{customerName}</div>}
          {invoice.customer?.address && <div style={{ fontSize: 12, color: "#333" }}>{invoice.customer.address}</div>}
          {invoice.customer?.phone && <div style={{ fontSize: 12, color: "#333" }}>{invoice.customer.phone}</div>}
        </div>

        {/* ITEMS TABLE */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 6 }}>
          <thead>
            <tr style={{ background: "#1a1a1a" }}>
              {["#", "Item Code", "Item Description", "Price", "Qty", "Unit", "Free", "Disc.", "Total"].map((h, i) => (
                <th key={i} style={{
                  padding: "7px 8px", fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: 0.6, color: "#fff",
                  textAlign: [0, 4, 5, 6, 7].includes(i) ? "center" : i >= 8 || i === 3 ? "right" : "left",
                  width: ["4%","14%","30%","13%","7%","7%","7%","7%","11%"][i],
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(invoice.items || []).map((item: any, index: number) => (
              <tr key={index} style={{ borderBottom: "1px solid #e5e5e5" }}>
                <td style={{ padding: "7px 8px", fontSize: 11, color: "#555", textAlign: "center" }}>{index + 1}</td>
                <td style={{ padding: "7px 8px", fontSize: 11, color: "#333" }}>{item.sku || "-"}</td>
                <td style={{ padding: "7px 8px", fontSize: 12, color: "#000", fontWeight: 600 }}>{item.productName || "-"}</td>
                <td style={{ padding: "7px 8px", fontSize: 11, color: "#333", textAlign: "right", whiteSpace: "nowrap" }}>LKR {fmt(item.unitPrice)}</td>
                <td style={{ padding: "7px 8px", fontSize: 12, fontWeight: 700, color: "#000", textAlign: "center" }}>{item.quantity}</td>
                <td style={{ padding: "7px 8px", fontSize: 11, color: "#555", textAlign: "center" }}>{item.unit || "Pcs"}</td>
                <td style={{ padding: "7px 8px", fontSize: 12, textAlign: "center", color: "#000" }}>{(item.freeQuantity || 0) > 0 ? item.freeQuantity : "-"}</td>
                <td style={{ padding: "7px 8px", fontSize: 11, textAlign: "center", color: "#555" }}>{item.discountPercent > 0 ? `-${item.discountPercent}%` : "-"}</td>
                <td style={{ padding: "7px 8px", fontSize: 12, fontWeight: 700, color: "#000", textAlign: "right", whiteSpace: "nowrap" }}>LKR {fmt(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* TOTALS */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 10 }}>
          <tbody>
            <tr>
              <td style={{ width: "55%" }}>
                {invoice.notes && <div style={{ fontSize: 11, color: "#555", lineHeight: 1.5 }}>{invoice.notes}</div>}
              </td>
              <td style={{ width: "45%", verticalAlign: "top", paddingLeft: 16 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: "5px 0", fontSize: 12, color: "#333" }}>Subtotal</td>
                      <td style={{ padding: "5px 0", fontSize: 12, color: "#000", textAlign: "right", whiteSpace: "nowrap" }}>LKR {fmt(subTotal)}</td>
                    </tr>
                    {extraDiscount > 1 && (
                      <tr>
                        <td style={{ padding: "5px 0", fontSize: 12, color: "#333" }}>Extra Discount</td>
                        <td style={{ padding: "5px 0", fontSize: 12, color: "#000", textAlign: "right", whiteSpace: "nowrap" }}>- LKR {fmt(extraDiscount)}</td>
                      </tr>
                    )}
                    <tr>
                      <td style={{ padding: "6px 0 0", borderTop: "1.5px solid #bbb" }} />
                      <td style={{ borderTop: "1.5px solid #bbb" }} />
                    </tr>
                    <tr>
                      <td style={{ padding: "4px 0", fontSize: 13, fontWeight: 700, color: "#000" }}>Net Total</td>
                      <td style={{ padding: "4px 0", fontSize: 14, fontWeight: 800, color: "#000", textAlign: "right", whiteSpace: "nowrap" }}>LKR {fmt(grandTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* SIGNATURE */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
          <tbody>
            <tr>
              <td style={{ width: "55%" }} />
              <td style={{ width: "45%", textAlign: "center", paddingTop: 20, borderTop: "1px solid #bbb" }}>
                <div style={{ fontSize: 11, color: "#333", fontWeight: 600 }}>Customer Signature &amp; Stamp</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* FOOTER */}
        <div style={{ borderTop: "1px solid #ddd", paddingTop: 8, textAlign: "center", fontSize: 11, color: "#555" }}>
          Thank you for your business!
        </div>
      </div>
    </>
  );
}
