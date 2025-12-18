import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Fetch Location Details
    const { data: location, error: locError } = await supabaseAdmin
      .from("locations")
      .select("*, businesses(name)")
      .eq("id", id)
      .single();

    if (locError) throw new Error("Location not found");

    // 2. Fetch Stocks for this Location (Good OR Damaged > 0)
    const { data: stocks, error: stockError } = await supabaseAdmin
      .from("product_stocks")
      .select(
        `
        quantity,
        damaged_quantity,
        last_updated,
        products (
          id,
          sku,
          name,
          category,
          unit_of_measure,
          selling_price,
          cost_price
        )
      `
      )
      .eq("location_id", id)
      .or("quantity.gt.0,damaged_quantity.gt.0"); // Fetch if EITHER good OR damaged stock exists

    if (stockError) throw stockError;

    // 3. Calculate Stats
    const safeStocks = stocks || [];

    // Total Items = Good + Damaged
    const totalItems = safeStocks.reduce(
      (sum, item) => sum + Number(item.quantity),
      0
    );
    const totalDamaged = safeStocks.reduce(
      (sum, item) => sum + Number(item.damaged_quantity || 0),
      0
    );

    const totalValue = safeStocks.reduce(
      (sum, item: any) =>
        sum + Number(item.quantity) * (item.products?.selling_price || 0),
      0
    );

    return NextResponse.json({
      location: {
        ...location,
        businessName: location.businesses?.name || "Main Warehouse",
      },
      stocks: safeStocks.map((stockItem: any) => ({
        ...stockItem.products, // Spread product details
        quantity: stockItem.quantity,
        damagedQuantity: stockItem.damaged_quantity || 0, // Map damage qty
        lastUpdated: stockItem.last_updated,
        value:
          Number(stockItem.quantity) * (stockItem.products?.selling_price || 0),
      })),
      stats: {
        totalItems,
        totalDamaged,
        totalValue,
      },
    });
  } catch (error: any) {
    console.error("Inventory API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
