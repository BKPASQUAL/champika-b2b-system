import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

const addSupplierSchema = z.object({
  supplierId: z.string().min(1, "Supplier ID is required"),
  costPrice: z.number().min(0).optional().nullable(),
  commissionValue: z.number().min(0).optional().nullable(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch secondary suppliers for this product
    const { data, error } = await supabaseAdmin
      .from("product_suppliers")
      .select(`
        id,
        supplier_id,
        supplier_name,
        cost_price,
        commission_value,
        created_at,
        suppliers (
          supplier_id,
          phone,
          email,
          status
        )
      `)
      .eq("product_id", id);

    if (error) {
      // If table doesn't exist yet, return empty list (might happen before running SQL migration)
      if (error.code === "42P01") {
        return NextResponse.json([]);
      }
      throw error;
    }

    // Format for frontend
    const mapped = (data || []).map((s: any) => ({
      id: s.id,
      supplierId: s.supplier_id,
      supplierCode: s.suppliers?.supplier_id || "",
      name: s.supplier_name,
      costPrice: s.cost_price,
      commissionValue: s.commission_value,
      phone: s.suppliers?.phone || "",
      email: s.suppliers?.email || "",
      status: s.suppliers?.status || "Active",
      createdAt: s.created_at,
    }));

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error("GET Product Suppliers Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const val = addSupplierSchema.parse(body);

    // 1. Fetch supplier details to get the correct name
    const { data: supplier, error: supError } = await supabaseAdmin
      .from("suppliers")
      .select("name")
      .eq("id", val.supplierId)
      .single();

    if (supError || !supplier) {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404 }
      );
    }

    // 2. Insert mapping into product_suppliers
    const { data, error } = await supabaseAdmin
      .from("product_suppliers")
      .insert({
        product_id: id,
        supplier_id: val.supplierId,
        supplier_name: supplier.name,
        cost_price: val.costPrice,
        commission_value: val.commissionValue,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This supplier is already associated with this product." },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ message: "Secondary supplier added", data }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("POST Product Supplier Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get("supplierId");

    if (!supplierId) {
      return NextResponse.json(
        { error: "Supplier ID parameter is required" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("product_suppliers")
      .delete()
      .eq("product_id", id)
      .eq("supplier_id", supplierId);

    if (error) throw error;

    return NextResponse.json({ message: "Secondary supplier removed" });
  } catch (error: any) {
    console.error("DELETE Product Supplier Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
