// app/api/rep/stock/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const supplier = searchParams.get("supplier"); // ✅ Get supplier filter

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

    // 2. Build the Query
    // Use !inner on products to ensure we filter stocks based on product properties
    let query = supabaseAdmin
      .from("product_stocks")
      .select(
        `
        quantity,
        location_id,
        products!inner (
          id,
          sku,
          name,
          selling_price,
          mrp,
          unit_of_measure,
          category,
          brand,
          is_active,
          supplier_name
        )
      `
      )
      .in("location_id", locationIds)
      .gt("quantity", 0); // Only show items that are actually in stock

    // ✅ 3. Apply Supplier Filter if provided
    if (supplier) {
      query = query.eq("products.supplier_name", supplier);
    }

    const { data: stocks, error: stockError } = await query;

    if (stockError) throw stockError;

    // 4. Aggregate data
    // (In case a user is assigned to multiple locations, we sum the stock)
    const productMap = new Map();

    stocks?.forEach((item: any) => {
      const p = item.products;
      if (!p) return;

      // --- FILTER: Hide Inactive Products ---
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
          supplier: p.supplier_name, // Return supplier info
        });
      }
    });

    return NextResponse.json(Array.from(productMap.values()));
  } catch (error: any) {
    console.error("Rep Stock API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
