// app/api/wireman/claims/free-issues/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// GET: Fetch Remaining Unclaimed Free Items (Unchanged)
export async function GET(request: NextRequest) {
  try {
    const businessId = "094b649e-be59-4e2b-b709-7e36ad1ef280";

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
      .eq("orders.business_id", businessId)
      .gt("free_quantity", 0)
      .or("claim_status.is.null,claim_status.eq.Unclaimed")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(items);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create a "Free Purchase Bill" from selected items
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { itemIds, supplierId, note } = body;
    const businessId = "094b649e-be59-4e2b-b709-7e36ad1ef280";

    if (!itemIds || itemIds.length === 0) {
      return NextResponse.json({ error: "No items selected" }, { status: 400 });
    }

    // 1. Fetch details of the selected items to group them
    const { data: selectedItems, error: fetchError } = await supabaseAdmin
      .from("order_items")
      .select("id, product_id, free_quantity, products(cost_price)")
      .in("id", itemIds);

    if (fetchError) throw fetchError;

    // 2. Group items by Product ID (Sum quantities if multiple lines for same product)
    const groupedItems: Record<string, number> = {};

    selectedItems.forEach((item: any) => {
      const pid = item.product_id;
      const qty = Number(item.free_quantity);
      if (groupedItems[pid]) {
        groupedItems[pid] += qty;
      } else {
        groupedItems[pid] = qty;
      }
    });

    // 3. Generate a Bill Number
    const { count } = await supabaseAdmin
      .from("purchases")
      .select("*", { count: "exact", head: true });

    const billNumber = `FB-${new Date().getFullYear()}-${(count || 0) + 1001}`;

    // 4. Create the Purchase Record (Free Bill)
    // We mark it as 'Received' so it adds stock immediately, and 'Paid' because it cost 0.
    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from("purchases")
      .insert({
        purchase_id: billNumber,
        invoice_no: billNumber, // Using generated ID as invoice no
        supplier_id: supplierId,
        business_id: businessId,
        purchase_date: new Date().toISOString(),
        total_amount: 0,
        paid_amount: 0,
        payment_status: "Paid",
        status: "Received", // Automatically received to update stock
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (purchaseError) throw purchaseError;

    // 5. Create Purchase Items & Update Stock
    const purchaseItems = Object.keys(groupedItems).map((productId) => ({
      purchase_id: purchase.id,
      product_id: productId,
      quantity: groupedItems[productId],
      unit_cost: 0,
      total_cost: 0,
      selling_price: 0, // Not relevant for purchase history usually, or fetch from product if needed
      mrp: 0,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("purchase_items")
      .insert(purchaseItems);

    if (itemsError) throw itemsError;

    // 6. Update Stock for these products
    for (const item of purchaseItems) {
      // Fetch current stock
      const { data: prod } = await supabaseAdmin
        .from("products")
        .select("stock_quantity")
        .eq("id", item.product_id)
        .single();

      const currentStock = prod?.stock_quantity || 0;
      const newStock = currentStock + item.quantity;

      await supabaseAdmin
        .from("products")
        .update({ stock_quantity: newStock })
        .eq("id", item.product_id);
    }

    // 7. Mark original Order Items as 'Processed' (Claimed)
    const { error: updateError } = await supabaseAdmin
      .from("order_items")
      .update({
        claim_status: "Approved", // Using 'Approved' to signify it's done and dealt with
      })
      .in("id", itemIds);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, purchase });
  } catch (error: any) {
    console.error("Free Bill Creation Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
