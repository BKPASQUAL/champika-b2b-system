// app/api/rep/stock/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }

    // 1. Get assigned location(s) for this user
    const { data: assignments, error: assignError } = await supabaseAdmin
      .from("location_assignments")
      .select("location_id")
      .eq("user_id", userId);

    if (assignError) throw assignError;

    // If no assignment found, return empty list (User has no stock access)
    if (!assignments || assignments.length === 0) {
      return NextResponse.json([]);
    }

    const locationIds = assignments.map((a) => a.location_id);

    // 2. Fetch stocks for these locations
    // We join with the products table to get product details
    const { data: stocks, error: stockError } = await supabaseAdmin
      .from("product_stocks")
      .select(
        `
        quantity,
        location_id,
        products (
          id,
          sku,
          name,
          selling_price,
          mrp,
          unit_of_measure,
          category,
          brand,
          is_active
        )
      `
      )
      .in("location_id", locationIds)
      .gt("quantity", 0); // Only show items that are actually in stock

    if (stockError) throw stockError;

    // 3. Aggregate data
    // (In case a user is assigned to multiple locations, we sum the stock)
    const productMap = new Map();

    stocks?.forEach((item: any) => {
      const p = item.products;
      if (!p) return;

      // --- FILTER: Hide Inactive Products ---
      // If is_active is explicitly false, skip this item.
      // (We treat null/undefined as true to be safe, or stricly check false)
      if (p.is_active === false) return;

      if (productMap.has(p.id)) {
        const existing = productMap.get(p.id);
        existing.stock_quantity += item.quantity;
      } else {
        productMap.set(p.id, {
          id: p.id,
          sku: p.sku,
          name: p.name,
          selling_price: p.selling_price,
          mrp: p.mrp,
          stock_quantity: item.quantity,
          unit_of_measure: p.unit_of_measure || "unit",
          category: p.category,
        });
      }
    });

    return NextResponse.json(Array.from(productMap.values()));
  } catch (error: any) {
    console.error("Rep Stock API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
