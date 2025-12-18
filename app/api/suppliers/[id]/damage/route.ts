import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Get Supplier Details (Name is needed to filter products)
    const { data: supplier, error: supError } = await supabaseAdmin
      .from("suppliers")
      .select("name, id")
      .eq("id", id)
      .single();

    if (supError || !supplier) {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404 }
      );
    }

    // 2. Fetch "Damage" records for products belonging to this supplier
    // We select 'cost_price' to calculate the value of damages
    const { data: damages, error: damageError } = await supabaseAdmin
      .from("inventory_returns")
      .select(
        `
        id, 
        return_number, 
        quantity, 
        reason, 
        created_at, 
        return_type,
        customer_id,
        products!inner (name, sku, supplier_name, cost_price),
        locations (name),
        profiles (full_name)
      `
      )
      .eq("return_type", "Damage") // Filter only Damage records
      .eq("products.supplier_name", supplier.name) // Filter by Supplier Name
      .order("created_at", { ascending: false });

    if (damageError) throw damageError;

    return NextResponse.json({
      supplier,
      damages,
    });
  } catch (error: any) {
    console.error("Supplier Damage API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
