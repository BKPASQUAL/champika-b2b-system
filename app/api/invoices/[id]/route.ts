// app/api/invoices/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // 1. Fetch Invoice with Customer and Order info
    const { data: invoice, error: invError } = await supabaseAdmin
      .from("invoices")
      .select(
        `
        *,
        customers (
          shop_name,
          owner_name,
          phone,
          address
        ),
        orders (
          sales_rep_id,
          profiles!orders_sales_rep_id_fkey (
            full_name
          )
        )
      `
      )
      .eq("id", id)
      .single();

    if (invError || !invoice) {
      throw new Error("Invoice not found");
    }

    // 2. Fetch Items for the linked Order
    const { data: items, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select(
        `
        *,
        products (
          name,
          sku,
          unit_of_measure
        )
      `
      )
      .eq("order_id", invoice.order_id);

    if (itemsError) throw itemsError;

    // 3. Structure the response
    const fullInvoice = {
      id: invoice.id,
      invoiceNo: invoice.invoice_no,
      date: invoice.created_at.split("T")[0],
      dueDate: invoice.due_date,
      status: invoice.status,

      customer: {
        name: invoice.customers?.owner_name || "N/A",
        shop: invoice.customers?.shop_name || "Unknown Shop",
        phone: invoice.customers?.phone || "",
        address: invoice.customers?.address || "",
      },

      salesRep: invoice.orders?.profiles?.full_name || "General",

      totals: {
        subTotal: invoice.total_amount, // Assuming logic handles discounts elsewhere
        paid: invoice.paid_amount,
        due: invoice.due_amount,
        grandTotal: invoice.total_amount,
      },

      items: items.map((item: any) => ({
        id: item.id,
        sku: item.products?.sku || "-",
        name: item.products?.name || "Unknown Item",
        unit: item.products?.unit_of_measure || "unit",
        quantity: item.quantity,
        free: item.free_quantity,
        price: item.unit_price,
        total: item.total_price,
      })),
    };

    return NextResponse.json(fullInvoice);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
