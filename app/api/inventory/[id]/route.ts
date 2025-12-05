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

    // 2. Fetch Stocks for this Location
    const { data: stocks, error: stockError } = await supabaseAdmin
      .from("product_stocks")
      .select(`
        quantity,
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
      `)
      .eq("location_id", id)
      .gt("quantity", 0); // Only show items in stock

    if (stockError) throw stockError;

    // 3. Calculate Stats
    // Ensure we handle potential nulls safely with defaults
    const safeStocks = stocks || [];
    
    const totalItems = safeStocks.reduce((sum, item) => sum + Number(item.quantity), 0);
    const totalValue = safeStocks.reduce(
      (sum, item: any) => sum + Number(item.quantity) * (item.products?.selling_price || 0),
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
        lastUpdated: stockItem.last_updated,
        value: Number(stockItem.quantity) * (stockItem.products?.selling_price || 0),
      })),
      stats: {
        totalItems,
        totalValue,
      },
    });
  } catch (error: any) {
    console.error("Inventory API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
