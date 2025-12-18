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

    // 2. Fetch Purchases (Recent 50 for table)
    const { data: recentPurchases, error: purchError } = await supabaseAdmin
      .from("purchases")
      .select("*")
      .eq("supplier_id", id)
      .order("purchase_date", { ascending: false })
      .limit(50);

    if (purchError) throw purchError;

    // 3. Fetch All Purchases (For Totals Calculation)
    const { data: allPurchases, error: allPurchError } = await supabaseAdmin
      .from("purchases")
      .select("total_amount, paid_amount")
      .eq("supplier_id", id);

    if (allPurchError) throw allPurchError;

    // 4. Fetch Payments (Recent 50)
    const { data: payments, error: payError } = await supabaseAdmin
      .from("supplier_payments")
      .select("*")
      .eq("supplier_id", id)
      .order("payment_date", { ascending: false })
      .limit(50);

    if (payError) throw payError;

    // 5. Fetch Products (Matching by Supplier Name)
    // Note: This relies on exact name match.
    const { data: products, error: prodError } = await supabaseAdmin
      .from("products")
      .select("stock_quantity, damaged_quantity, cost_price, supplier_name")
      .eq("supplier_name", supplier.name);

    if (prodError) throw prodError;

    // --- Calculations ---

    // A. Total Purchased (Lifetime)
    const totalPurchased = allPurchases.reduce(
      (sum, p) => sum + Number(p.total_amount || 0),
      0
    );

    // B. Total Payable (Outstanding Balance)
    const totalPayable = allPurchases.reduce(
      (sum, p) =>
        sum + (Number(p.total_amount || 0) - Number(p.paid_amount || 0)),
      0
    );

    // C. Stock Values (at Cost)
    let availableStockValue = 0;
    let damagedStockValue = 0;

    (products || []).forEach((p) => {
      const cost = Number(p.cost_price || 0);
      const goodQty = Number(p.stock_quantity || 0);
      const badQty = Number(p.damaged_quantity || 0);

      availableStockValue += goodQty * cost;
      damagedStockValue += badQty * cost;
    });

    const totalStockValue = availableStockValue + damagedStockValue;

    const stats = {
      totalPurchased,
      totalPayable,
      availableStockValue, // Good Stock Value
      damagedStockValue, // Damaged Stock Value
      totalStockValue, // Combined Value
      orderCount: allPurchases.length,
      productCount: products?.length || 0,
    };

    return NextResponse.json({
      supplier,
      purchases: recentPurchases,
      payments,
      stats,
    });
  } catch (error: any) {
    console.error("Supplier Detail API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
