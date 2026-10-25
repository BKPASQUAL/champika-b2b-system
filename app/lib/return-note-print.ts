import { generateInvoiceHTML, DIVISIONS } from "./invoice-html";

// Pull the return note number out of an order's notes, e.g. "[RETURN_NOTE: RET-524834-2]"
export function getReturnNoteNumber(notes?: string | null): string | null {
  const m = (notes || "").match(/\[(?:RETURN_NOTE|DAMAGE_EXCHANGE|DAMAGE_RETURN):\s*([^\]]+)\]/);
  return m ? m[1].trim() : null;
}

// Same print data the Return Note Details page uses, built from a return record
function toPrintData(ret: any) {
  const returnNo = ret.return_number;
  const returnType = ret.return_type || "Good";
  const reason: string = ret.reason || "";
  const invNo = reason.match(/\[INV:([^\]]+)\]/)?.[1]?.trim();
  const priceTag = parseFloat(reason.match(/\[PRICE:([\d.]+)\]/)?.[1] || "");
  const unitPrice = priceTag || Number(ret.products?.selling_price) || 0;
  const cleanReason = reason.replace(/\[[^\]]*\]/g, "").trim();
  const qty = Number(ret.quantity) || 0;

  const tag =
    returnType === "Exchange"
      ? `[DAMAGE_EXCHANGE: ${returnNo}]`
      : returnType === "Damage"
      ? `[DAMAGE_RETURN: ${returnNo}]`
      : `[RETURN_NOTE: ${returnNo}]`;

  return {
    invoiceNo: returnNo,
    manualInvoiceNo: null,
    date: ret.return_date || ret.created_at || new Date().toISOString(),
    salesRep: ret.profiles?.full_name || "Unknown",
    grandTotal: 0,
    totalAmount: 0,
    notes: `${tag} ${returnType} Return Note ${returnNo} (${qty} x ${ret.products?.name || "Product"}). Reason: ${
      invNo ? `[INV:${invNo}] ` : ""
    }[PRICE:${unitPrice}] ${cleanReason || "Customer return"}. Collect items from customer.`,
    customer: {
      shop: ret.customers?.shop_name || "Unknown Customer",
      name: ret.customers?.owner_name || ret.customers?.shop_name || "",
      address: ret.customers?.address || "",
      phone: ret.customers?.phone || "",
      route: ret.customers?.route || "",
    },
    items: [
      {
        sku: ret.products?.sku || "-",
        productName: ret.products?.name || "Product",
        unitPrice,
        quantity: qty,
        unit: ret.products?.unit_of_measure || "Pcs",
        freeQuantity: 0,
        discountPercent: 0,
        total: 0,
      },
    ],
  };
}

/** True when an order is an item-for-item exchange (no invoice, no payment). */
export function isExchangeOrder(notes?: string | null): boolean {
  return /\[DAMAGE_EXCHANGE:/.test(notes || "");
}

const esc = (v: any) =>
  String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/**
 * One-page "Customer Exchange Summary": per customer, the items to hand over
 * (good replacement) and collect back (damaged). Used instead of an invoice.
 */
export async function buildExchangeSummaryHtml(returnNumbers: string[], title = "Customer Exchange Summary"): Promise<string> {
  const records = (
    await Promise.all(
      returnNumbers.map((no) =>
        fetch(`/api/inventory/returns/${encodeURIComponent(no)}`).then((r) => (r.ok ? r.json() : null))
      )
    )
  ).filter(Boolean);
  if (records.length === 0) return "";

  // Group by customer
  const byCustomer = new Map<string, { name: string; owner: string; phone: string; rows: any[] }>();
  records.forEach((ret: any) => {
    const key = ret.customer_id || ret.customers?.shop_name || "unknown";
    if (!byCustomer.has(key)) {
      byCustomer.set(key, {
        name: ret.customers?.shop_name || "Unknown Customer",
        owner: ret.customers?.owner_name || "",
        phone: ret.customers?.phone || "",
        rows: [],
      });
    }
    byCustomer.get(key)!.rows.push(ret);
  });

  const th = (label: string, w: string, align = "center") =>
    `<th style="padding:5px 6px;font-size:10px;font-weight:700;text-transform:uppercase;text-align:${align};width:${w};border:1px solid #000;">${label}</th>`;
  const td = (v: string, align = "center", bold = false) =>
    `<td style="padding:6px;font-size:12px;text-align:${align};${bold ? "font-weight:700;" : ""}border:1px solid #000;vertical-align:middle;">${v}</td>`;

  let totalQty = 0;
  const sections = [...byCustomer.values()]
    .map((c, idx) => {
      const rows = c.rows
        .map((ret: any, i: number) => {
          const qty = Number(ret.quantity) || 0;
          totalQty += qty;
          const inv = (ret.reason || "").match(/\[INV:([^\]]+)\]/)?.[1] || "-";
          const unit = ret.products?.unit_of_measure || "Pcs";
          return `<tr>
            ${td(String(i + 1))}
            ${td(esc(ret.return_number), "center", true)}
            ${td(esc(inv))}
            ${td(esc(ret.products?.name || "-"), "left", true)}
            ${td(esc(ret.products?.sku || "-"))}
            ${td(`${qty} ${esc(unit)}`, "center", true)}
            ${td("&#9744;")}
            ${td("&#9744;")}
          </tr>`;
        })
        .join("");
      return `
      <div style="margin:10px 0 14px;page-break-inside:avoid;">
        <div style="font-size:13px;font-weight:800;margin-bottom:2px;">Customer (${idx + 1}): ${esc(c.name)}</div>
        <div style="font-size:11px;color:#333;margin-bottom:4px;">${esc(c.owner)}${c.phone ? ` · ${esc(c.phone)}` : ""}</div>
        <table style="width:100%;border-collapse:collapse;border:1.5px solid #000;">
          <thead><tr style="background:#f0f0f0;">
            ${th("#", "5%")}${th("Exchange Note", "16%")}${th("Bill Ref", "12%")}${th("Item Name", "33%", "left")}
            ${th("SKU", "11%")}${th("Qty", "9%")}${th("Given", "7%")}${th("Collected", "7%")}
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    })
    .join("");

  const today = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });

  return `
  <div class="invoice-page" style="page-break-before:always;page-break-after:always;width:100%;min-height:277mm;padding:12px 20px 20px;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#000;box-sizing:border-box;display:flex;flex-direction:column;">
    <div style="display:flex;justify-content:space-between;align-items:flex-end;">
      <div>
        <div style="font-size:22px;font-weight:900;">CHAMPIKA HARDWARE</div>
        <div style="font-size:16px;font-weight:800;color:#1d4ed8;margin-top:2px;">${esc(title)}</div>
      </div>
      <div style="text-align:right;font-size:11px;line-height:1.5;">
        <strong>Date:</strong> ${today}<br>
        ${byCustomer.size} customer(s) · ${records.length} exchange item(s) · ${totalQty} unit(s)
      </div>
    </div>
    <div style="font-size:11px;color:#333;margin-top:6px;">
      Item-for-item exchange — no invoice and no payment. Hand over the good replacement and collect the damaged item.
    </div>
    <div style="border-top:1.5px solid #000;margin:8px 0;"></div>
    ${sections}
    <div style="flex:1;"></div>
    <table style="width:100%;border-collapse:collapse;margin-top:50px;">
      <tr>
        <td style="width:45%;text-align:center;padding-top:6px;border-top:1.5px solid #000;font-size:11px;font-weight:700;">Prepared By (Store)</td>
        <td style="width:10%;"></td>
        <td style="width:45%;text-align:center;padding-top:6px;border-top:1.5px solid #000;font-size:11px;font-weight:700;">Checked By (Driver / Rep)</td>
      </tr>
    </table>
    <div style="border-top:1px solid #000;margin-top:16px;padding-top:6px;text-align:center;font-size:10px;">
      Customer Exchange Summary — Champika Hardware
    </div>
  </div>`;
}

/** Build print HTML for a list of return notes (by return number). */
export async function buildReturnNotesHtml(
  returnNumbers: string[],
  divisionKey: keyof typeof DIVISIONS = "distribution"
): Promise<string> {
  const records = await Promise.all(
    returnNumbers.map((no) =>
      fetch(`/api/inventory/returns/${encodeURIComponent(no)}`).then((r) => (r.ok ? r.json() : null))
    )
  );
  const pages = await Promise.all(
    records.filter(Boolean).map((ret) => generateInvoiceHTML(toPrintData(ret) as any, divisionKey))
  );
  return pages.join("");
}
