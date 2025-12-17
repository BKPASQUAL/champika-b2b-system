import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const invoiceNo = searchParams.get("invoiceNo");

    let targetOrderIds: string[] | null = null;

    // 1. If an invoice is selected, find the linked Order ID first
    if (invoiceNo && invoiceNo !== "all") {
      const { data: invoiceData, error: invoiceError } = await supabaseAdmin
        .from("invoices")
        .select("order_id")
        .eq("invoice_no", invoiceNo)
        .single();

      if (invoiceError || !invoiceData || !invoiceData.order_id) {
        // If invoice not found or has no order, return empty immediately
        return NextResponse.json([]);
      }
      targetOrderIds = [invoiceData.order_id];
    }

    // 2. Build the query for items
    let query = supabaseAdmin.from("order_items").select(`
        quantity,
        free_quantity,
        unit_price,
        product_id,
        products (
          id,
          sku,
          name,
          stock_quantity,
          selling_price
        ),
        orders!inner (
          customer_id,
          invoice_no
        )
      `);

    // 3. Apply Filters
    if (targetOrderIds) {
      // Filter by the specific order ID we found from the invoice
      query = query.in("order_id", targetOrderIds);
    } else {
      // Otherwise, show all items for this customer
      query = query.eq("orders.customer_id", id);
    }

    const { data, error } = await query;

    if (error) throw error;

    // 4. Aggregate products
    const uniqueProductsMap = new Map();

    data.forEach((item: any) => {
      if (item.products) {
        const pId = item.products.id;
        const billedQty = Number(item.quantity) || 0;
        const freeQty = Number(item.free_quantity) || 0;
        const totalItemQty = billedQty + freeQty;

        // Use the price from the order item (actual price paid)
        const paidPrice =
          Number(item.unit_price) || item.products.selling_price;

        if (uniqueProductsMap.has(pId)) {
          const existing = uniqueProductsMap.get(pId);
          existing.totalPurchased += totalItemQty;
        } else {
          uniqueProductsMap.set(pId, {
            id: item.products.id,
            sku: item.products.sku,
            name: item.products.name,
            stock: item.products.stock_quantity,
            sellingPrice: paidPrice,
            totalPurchased: totalItemQty,
          });
        }
      }
    });

    return NextResponse.json(Array.from(uniqueProductsMap.values()));
  } catch (error: any) {
    console.error("Error fetching purchased products:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
