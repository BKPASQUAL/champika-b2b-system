import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");

    // 1. Get Supplier Details
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
    // Logic: Look for Main Warehouse. It might have business_id = null (Global) or specific.
    let locationQuery = supabaseAdmin
      .from("locations")
      .select("id")
      .eq("name", "Main Warehouse");

    // If we have a business context, we prefer Main Warehouse for that business OR global
    if (businessId) {
      locationQuery = locationQuery.or(
        `business_id.eq.${businessId},business_id.is.null`
      );
    } else {
      // Fallback to supplier's business if no context passed (Admin view behavior)
      locationQuery = locationQuery.eq("business_id", supplier.business_id);
    }

    const { data: mainLocations } = await locationQuery;
    const mainLocation = mainLocations?.[0]; // Take the first match

    // 3. Fetch "Warehouse" Items (Damaged items pending return)
    let query = supabaseAdmin
      .from("inventory_returns")
      .select(
        `
        id, return_number, quantity, reason, status, created_at, business_id,
        products!inner (name, sku, supplier_name, cost_price),
        locations (name)
      `
      )
      .eq("return_type", "Damage")
      .eq("products.supplier_name", supplier.name)
      .is("return_batch_id", null) // Only items NOT in a batch
      .neq("status", "Returned") // Exclude items already sent
      .neq("status", "Business Loss"); // Exclude Business Losses

    // Filter by Business Context if provided
    if (businessId) {
      query = query.eq("business_id", businessId);
    }

    // Filter by Location (Main Warehouse)
    if (mainLocation) {
      query = query.eq("location_id", mainLocation.id);
    } else {
      // Fallback: Filter by name if ID lookup failed/ambiguous
      // @ts-ignore
      query = query.filter("locations.name", "eq", "Main Warehouse");
    }

    const { data: warehouseItems, error: itemError } = await query.order(
      "created_at",
      { ascending: false }
    );

    if (itemError) throw itemError;

    // 4. Fetch Batches (Pending & History)
    let batchesQuery = supabaseAdmin
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
      .eq("supplier_id", id);

    // Note: If supplier_return_batches had a business_id column, we would filter it here too.
    // For now, assuming batches are tied to supplier + items which are filtered above.

    const { data: batches, error: batchError } = await batchesQuery.order(
      "created_at",
      { ascending: false }
    );

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
