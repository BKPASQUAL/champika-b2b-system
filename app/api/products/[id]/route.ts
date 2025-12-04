import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().optional(),
  category: z.string().optional(),
  subCategory: z.string().optional(),
  brand: z.string().optional(),
  subBrand: z.string().optional(),
  modelType: z.string().optional(),
  subModel: z.string().optional(), // <--- Validation
  sizeSpec: z.string().optional(),
  supplier: z.string().optional(),
  stock: z.number().optional(),
  minStock: z.number().optional(),
  mrp: z.number().optional(),
  sellingPrice: z.number().optional(),
  costPrice: z.number().optional(),
  unitOfMeasure: z.string().optional(),
  images: z.array(z.string()).optional(),
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
    if (val.subCategory) dbUpdates.sub_category = val.subCategory;
    if (val.brand) dbUpdates.brand = val.brand;
    if (val.subBrand) dbUpdates.sub_brand = val.subBrand;
    if (val.modelType) dbUpdates.model_type = val.modelType;
    if (val.subModel) dbUpdates.sub_model = val.subModel; // <--- Update DB
    if (val.sizeSpec) dbUpdates.size_spec = val.sizeSpec;
    if (val.supplier) dbUpdates.supplier_name = val.supplier;
    if (val.stock !== undefined) dbUpdates.stock_quantity = val.stock;
    if (val.minStock !== undefined) dbUpdates.min_stock_level = val.minStock;
    if (val.mrp !== undefined) dbUpdates.mrp = val.mrp;
    if (val.sellingPrice !== undefined)
      dbUpdates.selling_price = val.sellingPrice;
    if (val.costPrice !== undefined) dbUpdates.cost_price = val.costPrice;
    if (val.unitOfMeasure) dbUpdates.unit_of_measure = val.unitOfMeasure;
    if (val.images) dbUpdates.images = val.images;

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
