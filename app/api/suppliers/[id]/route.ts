import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Fetch Supplier Details
    const { data: supplier, error: supError } = await supabaseAdmin
      .from("suppliers")
      .select("*")
      .eq("id", id)
      .single();

    if (supError || !supplier) {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404 }
      );
    }

    // 2. Fetch Recent Purchases
    const { data: purchases } = await supabaseAdmin
      .from("purchases")
      .select("*")
      .eq("supplier_id", id)
      .order("purchase_date", { ascending: false })
      .limit(50);

    const { data: allPurchases } = await supabaseAdmin
      .from("purchases")
      .select("total_amount, paid_amount")
      .eq("supplier_id", id);

    // 3. Fetch Payments
    const { data: payments } = await supabaseAdmin
      .from("supplier_payments")
      .select("*")
      .eq("supplier_id", id)
      .order("payment_date", { ascending: false })
      .limit(50);

    // 4. Fetch Products (Good & Damaged Stock)
    const { data: products } = await supabaseAdmin
      .from("products")
      .select(
        "id, name, sku, stock_quantity, damaged_quantity, cost_price, supplier_name"
      )
      .eq("supplier_name", supplier.name); // Matching by name

    // 5. NEW: Fetch Return History (Items sent back to this supplier)
    // Assuming you log supplier returns in 'inventory_returns' with a specific type or note,
    // OR if you have a 'supplier_returns' table.
    // For now, let's assume we filter 'inventory_returns' where metadata matches, or we just rely on current damaged stock.
    // If you don't have a specific table for "Sent back to supplier", we will build the feature to deduct from stock.

    // --- Calculations ---

    // A. Financials
    const totalPurchased =
      allPurchases?.reduce((sum, p) => sum + Number(p.total_amount || 0), 0) ||
      0;
    const totalPaid =
      allPurchases?.reduce((sum, p) => sum + Number(p.paid_amount || 0), 0) ||
      0;
    const totalPayable = totalPurchased - totalPaid;

    // B. Stock Values
    let availableStockValue = 0;
    let damagedStockValue = 0; // Value of damaged items currently in stock
    const damagedItems: any[] = [];

    (products || []).forEach((p) => {
      const cost = Number(p.cost_price || 0);
      const goodQty = Number(p.stock_quantity || 0);
      const badQty = Number(p.damaged_quantity || 0);

      availableStockValue += goodQty * cost;

      if (badQty > 0) {
        damagedStockValue += badQty * cost;
        damagedItems.push({
          ...p,
          value: badQty * cost,
        });
      }
    });

    const totalStockValue = availableStockValue + damagedStockValue;

    const stats = {
      totalPurchased,
      totalPayable,
      availableStockValue,
      damagedStockValue,
      totalStockValue,
      orderCount: allPurchases?.length || 0,
      productCount: products?.length || 0,
      damagedCount: damagedItems.length,
    };

    return NextResponse.json({
      supplier,
      purchases,
      payments,
      damagedItems, // List of products with damages
      stats,
    });
  } catch (error: any) {
    console.error("Supplier Detail API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
