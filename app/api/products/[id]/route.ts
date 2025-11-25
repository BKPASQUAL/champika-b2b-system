import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().optional(),
  category: z.string().optional(),
  supplier: z.string().optional(),
  stock: z.number().optional(),
  minStock: z.number().optional(),
  mrp: z.number().optional(),
  sellingPrice: z.number().optional(),
  costPrice: z.number().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const val = updateSchema.parse(body);

    const dbUpdates: any = {};
    if (val.name) dbUpdates.name = val.name;
    if (val.category) dbUpdates.category = val.category;
    if (val.supplier) dbUpdates.supplier_name = val.supplier;
    if (val.stock !== undefined) dbUpdates.stock_quantity = val.stock;
    if (val.minStock !== undefined) dbUpdates.min_stock_level = val.minStock;
    if (val.mrp !== undefined) dbUpdates.mrp = val.mrp;
    if (val.sellingPrice !== undefined)
      dbUpdates.selling_price = val.sellingPrice;
    if (val.costPrice !== undefined) dbUpdates.cost_price = val.costPrice;

    dbUpdates.updated_at = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from("products")
      .update(dbUpdates)
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ message: "Product updated" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { error } = await supabaseAdmin
      .from("products")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return NextResponse.json({ message: "Product deleted" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
