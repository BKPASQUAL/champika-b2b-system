// Retail invoices for the Walk-in Sale "Good Returns" picker.
// GET            → latest retail invoices (searchable in the dropdown)
// GET ?id=<uuid> → that invoice's items, with how many can still be returned
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export const dynamic = "force-dynamic";

const RETAIL = BUSINESS_IDS.CHAMPIKA_RETAIL;

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      // ?search= matches the invoice number or manual number; empty → latest bills
      const search = (req.nextUrl.searchParams.get("search") || "").replace(/[%,()]/g, "").trim();
      let q = supabaseAdmin
        .from("invoices")
        .select("id, invoice_no, manual_invoice_no, total_amount, status, created_at, customers(shop_name), orders!inner(business_id, order_date, status)")
        .eq("orders.business_id", RETAIL)
        // cancelled bills: the order is "Cancelled" (invoice status is payment-only)
        .neq("orders.status", "Cancelled")
        .order("created_at", { ascending: false })
        .limit(search ? 30 : 15);
      if (search) q = q.or(`invoice_no.ilike.%${search}%,manual_invoice_no.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return NextResponse.json(
        (data || [])
          .filter((i: any) => i.orders?.status !== "Cancelled")
          .map((i: any) => ({
            id: i.id,
            invoiceNo: i.invoice_no,
            manualInvoiceNo: i.manual_invoice_no || null,
            date: i.orders?.order_date || i.created_at,
            customerName: i.customers?.shop_name || "",
            total: Number(i.total_amount || 0),
          }))
      );
    }

    const { data: inv, error } = await supabaseAdmin
      .from("invoices")
      .select("id, invoice_no, order_id, orders(business_id, extra_discount_percent)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    const order: any = Array.isArray(inv?.orders) ? inv?.orders[0] : inv?.orders;
    if (!inv || order?.business_id !== RETAIL) {
      return NextResponse.json({ error: "Retail invoice not found" }, { status: 404 });
    }
    const pct = Number(order?.extra_discount_percent || 0);

    const { data: lines } = await supabaseAdmin
      .from("order_items")
      .select("product_id, quantity, free_quantity, total_price, products(name, sku, unit_of_measure)")
      .eq("order_id", inv.order_id);

    // Already brought back from this invoice on earlier walk-in sales
    const { data: earlier } = await supabaseAdmin
      .from("inventory_returns")
      .select("product_id, quantity")
      .ilike("reason", `%[FROM_INV_ID:${inv.id}]%`);
    const returned: Record<string, number> = {};
    (earlier || []).forEach((r: any) => {
      returned[r.product_id] = (returned[r.product_id] || 0) + Number(r.quantity || 0);
    });

    // One row per product (a product can appear on more than one line)
    const byProduct = new Map<string, any>();
    for (const l of lines || []) {
      const p: any = Array.isArray(l.products) ? l.products[0] : l.products;
      const row = byProduct.get(l.product_id) || {
        productId: l.product_id,
        name: p?.name || "Unknown",
        sku: p?.sku || "",
        unit: p?.unit_of_measure || "unit",
        sold: 0,
        paidQty: 0,
        value: 0,
      };
      row.sold += Number(l.quantity || 0) + Number(l.free_quantity || 0);
      row.paidQty += Number(l.quantity || 0);
      row.value += Number(l.total_price || 0);
      byProduct.set(l.product_id, row);
    }

    return NextResponse.json({
      id: inv.id,
      invoiceNo: inv.invoice_no,
      lines: [...byProduct.values()].map((r) => ({
        productId: r.productId,
        name: r.name,
        sku: r.sku,
        unit: r.unit,
        sold: r.sold,
        returned: returned[r.productId] || 0,
        left: Math.max(0, r.sold - (returned[r.productId] || 0)),
        // price paid per unit after line discount and the bill's extra discount
        unitPrice: r.paidQty > 0 ? Math.round((r.value / r.paidQty) * (1 - pct / 100) * 100) / 100 : 0,
      })),
    });
  } catch (err: any) {
    console.error("[retail/invoice-lookup]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
