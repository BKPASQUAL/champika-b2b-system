// app/api/orange/claims/free-issues/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const ORANGE_BUSINESS_ID = "50a514e1-ee70-4e6d-a698-1630d8ed04e2";

export async function GET(request: NextRequest) {
  try {
    const { data: items, error } = await supabaseAdmin
      .from("order_items")
      .select(
        `
        id,
        product_id,
        free_quantity,
        unit_price,
        claim_status,
        created_at,
        products (
          id,
          name,
          sku,
          stock_quantity
        ),
        orders!inner (
          id,
          invoice_no,
          order_date,
          customer_id,
          business_id,
          customers (
            shop_name
          )
        )
      `,
      )
      .eq("orders.business_id", ORANGE_BUSINESS_ID)
      .gt("free_quantity", 0)
      .or("claim_status.is.null,claim_status.eq.Unclaimed")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(items);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { itemIds, supplierId, note } = body;

    if (!itemIds || itemIds.length === 0) {
      return NextResponse.json({ error: "No items selected" }, { status: 400 });
    }

    const { data: selectedItems, error: fetchError } = await supabaseAdmin
      .from("order_items")
      .select("id, product_id, free_quantity, products(cost_price)")
      .in("id", itemIds);

    if (fetchError) throw fetchError;

    const groupedItems: Record<string, number> = {};
    selectedItems.forEach((item: any) => {
      const pid = item.product_id;
      const qty = Number(item.free_quantity);
      groupedItems[pid] = (groupedItems[pid] || 0) + qty;
    });

    const { count } = await supabaseAdmin
      .from("purchases")
      .select("*", { count: "exact", head: true });

    const billNumber = `OFB-${new Date().getFullYear()}-${(count || 0) + 1001}`;

    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from("purchases")
      .insert({
        purchase_id: billNumber,
        invoice_no: billNumber,
        supplier_id: supplierId,
        business_id: ORANGE_BUSINESS_ID,
        purchase_date: new Date().toISOString(),
        total_amount: 0,
        paid_amount: 0,
        payment_status: "Paid",
        status: "Received",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (purchaseError) throw purchaseError;

    const purchaseItems = Object.keys(groupedItems).map((productId) => ({
      purchase_id: purchase.id,
      product_id: productId,
      quantity: groupedItems[productId],
      unit_cost: 0,
      total_cost: 0,
      selling_price: 0,
      mrp: 0,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("purchase_items")
      .insert(purchaseItems);

    if (itemsError) throw itemsError;

    for (const item of purchaseItems) {
      const { data: prod } = await supabaseAdmin
        .from("products")
        .select("stock_quantity")
        .eq("id", item.product_id)
        .single();

      const currentStock = prod?.stock_quantity || 0;
      await supabaseAdmin
        .from("products")
        .update({ stock_quantity: currentStock + item.quantity })
        .eq("id", item.product_id);
    }

    await supabaseAdmin
      .from("order_items")
      .update({ claim_status: "Approved" })
      .in("id", itemIds);

    return NextResponse.json({ success: true, purchase });
  } catch (error: any) {
    console.error("Orange Free Bill Creation Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
