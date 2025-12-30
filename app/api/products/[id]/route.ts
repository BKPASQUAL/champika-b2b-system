import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

const updateSchema = z.object({
  sku: z.string().optional(), // ✅ Added SKU to schema
  name: z.string().optional(),
  category: z.string().optional(),
  subCategory: z.string().optional(),
  brand: z.string().optional(),
  subBrand: z.string().optional(),
  modelType: z.string().optional(),
  subModel: z.string().optional(),
  sizeSpec: z.string().optional(),
  supplier: z.string().optional(),
  stock: z.number().optional(),
  minStock: z.number().optional(),
  mrp: z.number().optional(),
  sellingPrice: z.number().optional(),
  costPrice: z.number().optional(),
  unitOfMeasure: z.string().optional(),
  images: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
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

    // ✅ Handle SKU Update with Duplicate Check
    if (val.sku) {
      // Check if another product has this SKU
      const { data: duplicate } = await supabaseAdmin
        .from("products")
        .select("id")
        .eq("sku", val.sku)
        .neq("id", id) // exclude self
        .maybeSingle();

      if (duplicate) {
        return NextResponse.json(
          { error: `SKU '${val.sku}' is already taken by another product.` },
          { status: 409 }
        );
      }
      dbUpdates.sku = val.sku;
    }

    if (val.name) dbUpdates.name = val.name;
    if (val.category) dbUpdates.category = val.category;
    if (val.subCategory !== undefined)
      dbUpdates.sub_category = val.subCategory || null;
    if (val.brand !== undefined) dbUpdates.brand = val.brand || null;
    if (val.subBrand !== undefined) dbUpdates.sub_brand = val.subBrand || null;
    if (val.modelType !== undefined)
      dbUpdates.model_type = val.modelType || null;
    if (val.subModel !== undefined) dbUpdates.sub_model = val.subModel || null;
    if (val.sizeSpec !== undefined) dbUpdates.size_spec = val.sizeSpec || null;
    if (val.supplier) dbUpdates.supplier_name = val.supplier;
    if (val.stock !== undefined) dbUpdates.stock_quantity = val.stock;
    if (val.minStock !== undefined) dbUpdates.min_stock_level = val.minStock;
    if (val.mrp !== undefined) dbUpdates.mrp = val.mrp;
    if (val.sellingPrice !== undefined)
      dbUpdates.selling_price = val.sellingPrice;
    if (val.costPrice !== undefined) dbUpdates.cost_price = val.costPrice;
    if (val.unitOfMeasure) dbUpdates.unit_of_measure = val.unitOfMeasure;
    if (val.images) dbUpdates.images = val.images;
    if (val.isActive !== undefined) dbUpdates.is_active = val.isActive;

    // Recalculate Commission if critical fields change
    if (val.supplier || val.category) {
      const { data: currentProduct } = await supabaseAdmin
        .from("products")
        .select("supplier_name, category")
        .eq("id", id)
        .single();

      if (currentProduct) {
        const targetSupplier = val.supplier || currentProduct.supplier_name;
        const targetCategory = val.category || currentProduct.category;

        const { data: rules } = await supabaseAdmin
          .from("commission_rules")
          .select("category, rate")
          .eq("supplier_name", targetSupplier);

        let newRate = 0;
        if (rules && rules.length > 0) {
          const specificRule = rules.find((r) => r.category === targetCategory);
          const generalRule = rules.find((r) => r.category === "ALL");
          if (specificRule) newRate = specificRule.rate;
          else if (generalRule) newRate = generalRule.rate;
        }

        dbUpdates.commission_value = newRate;
        dbUpdates.commission_type = "percentage";
      }
    }

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    const product = {
      id: data.id,
      sku: data.sku,
      name: data.name,
      category: data.category,
      subCategory: data.sub_category,
      brand: data.brand,
      subBrand: data.sub_brand,
      modelType: data.model_type,
      subModel: data.sub_model,
      sizeSpec: data.size_spec,
      supplier: data.supplier_name,
      stock: data.stock_quantity || 0,
      minStock: data.min_stock_level || 0,
      mrp: data.mrp || 0,
      sellingPrice: data.selling_price || 0,
      costPrice: data.cost_price || 0,
      actualCostPrice: data.actual_cost_price || 0,
      unitOfMeasure: data.unit_of_measure || "Pcs",
      images: data.images || [],
      commissionType: data.commission_type,
      commissionValue: data.commission_value,
      isActive: data.is_active ?? true,
    };

    return NextResponse.json(product);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
