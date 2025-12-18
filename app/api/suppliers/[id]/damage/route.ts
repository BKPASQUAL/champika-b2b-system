import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Get Supplier Details (Include business_id)
    const { data: supplier, error: supError } = await supabaseAdmin
      .from("suppliers")
      .select("name, id, address, business_id")
      .eq("id", id)
      .single();

    if (supError || !supplier) {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404 }
      );
    }

    // 2. Find "Main Warehouse" Location ID
    const { data: mainLocation } = await supabaseAdmin
      .from("locations")
      .select("id")
      .eq("business_id", supplier.business_id)
      .eq("name", "Main Warehouse")
      .maybeSingle();

    // 3. Fetch "Warehouse" Items
    let query = supabaseAdmin
      .from("inventory_returns")
      .select(
        `
        id, return_number, quantity, reason, status, created_at, 
        products!inner (name, sku, supplier_name, cost_price),
        locations (name)
      `
      )
      .eq("return_type", "Damage")
      .eq("products.supplier_name", supplier.name)
      .is("return_batch_id", null) // Only items NOT in a batch
      .neq("status", "Returned") // Exclude items already sent
      .neq("status", "Business Loss"); // <--- ADDED: Exclude Business Losses

    // Apply Main Warehouse Filter if found
    if (mainLocation) {
      query = query.eq("location_id", mainLocation.id);
    } else {
      console.warn(
        "Main Warehouse location not found by ID, trying join filter"
      );
      // @ts-ignore
      query = query.filter("locations.name", "eq", "Main Warehouse");
    }

    const { data: warehouseItems, error: itemError } = await query.order(
      "created_at",
      { ascending: false }
    );

    if (itemError) throw itemError;

    // 4. Fetch Batches (Pending & History)
    const { data: batches, error: batchError } = await supabaseAdmin
      .from("supplier_return_batches")
      .select(
        `
        *,
        items:inventory_returns (
           id, return_number, quantity, reason, status, created_at,
           products (name, sku, cost_price)
        )
      `
      )
      .eq("supplier_id", id)
      .order("created_at", { ascending: false });

    if (batchError) throw batchError;

    return NextResponse.json({
      supplier,
      warehouseItems: warehouseItems || [],
      batches: batches || [],
    });
  } catch (error: any) {
    console.error("Supplier Damage API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
