import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Supplier Info
    const { data: supplier, error: supError } = await supabaseAdmin
      .from("suppliers")
      .select("name, id, address")
      .eq("id", id)
      .single();

    if (supError || !supplier) {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404 }
      );
    }

    // 2. Fetch "Warehouse" Items (Not yet sent/batched)
    // FIX: Removed .neq("status", "Completed") to show new items
    const { data: warehouseItems, error: itemError } = await supabaseAdmin
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
      .neq("status", "Returned") // Exclude items already sent to supplier
      .order("created_at", { ascending: false });

    if (itemError) throw itemError;

    // 3. Fetch Batches (Pending & History)
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
      warehouseItems,
      batches,
    });
  } catch (error: any) {
    console.error("Supplier Damage API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
