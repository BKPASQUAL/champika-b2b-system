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

          if (specificRule) {
            newRate = specificRule.rate;
          } else if (generalRule) {
            newRate = generalRule.rate;
          }
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
    // 1. Fetch Product Basics
    const { data: productData, error: productError } = await supabaseAdmin
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

    if (productError) throw productError;

    // 2. Fetch Stock Breakdown from Locations
    // ✅ This enables showing stock per location (Store, Warehouse, etc.)
    const { data: stocks, error: stockError } = await supabaseAdmin
      .from("product_stocks")
      .select(
        `
        id,
        quantity,
        damaged_quantity,
        last_updated,
        locations ( name, business_id )
      `
      )
      .eq("product_id", id);

    if (stockError) console.error("Error fetching stocks:", stockError);

    // 3. Calculate Real-Time Totals
    const safeStocks = stocks || [];
    const totalGoodStock = safeStocks.reduce(
      (sum, s) => sum + (Number(s.quantity) || 0),
      0
    );
    const totalDamagedStock = safeStocks.reduce(
      (sum, s) => sum + (Number(s.damaged_quantity) || 0),
      0
    );

    const formattedStocks = safeStocks.map((s: any) => ({
      locationName: s.locations?.name || "Unknown Location",
      isMainWarehouse: s.locations?.business_id === null,
      quantity: Number(s.quantity) || 0,
      damaged: Number(s.damaged_quantity) || 0,
      lastUpdated: s.last_updated,
    }));

    const product = {
      id: productData.id,
      sku: productData.sku,
      name: productData.name,
      category: productData.category,
      subCategory: productData.sub_category,
      brand: productData.brand,
      subBrand: productData.sub_brand,
      modelType: productData.model_type,
      subModel: productData.sub_model,
      sizeSpec: productData.size_spec,
      supplier: productData.supplier_name,

      // ✅ Use calculated total from locations if available, else fallback
      stock:
        safeStocks.length > 0
          ? totalGoodStock
          : productData.stock_quantity || 0,
      damagedStock: totalDamagedStock,

      minStock: productData.min_stock_level || 0,
      mrp: productData.mrp || 0,
      sellingPrice: productData.selling_price || 0,
      costPrice: productData.cost_price || 0,
      actualCostPrice: productData.actual_cost_price || 0,
      unitOfMeasure: productData.unit_of_measure || "Pcs",
      images: productData.images || [],
      commissionType: productData.commission_type,
      commissionValue: productData.commission_value,
      isActive: productData.is_active ?? true,

      // ✅ Return the breakdown
      stocks: formattedStocks,
    };

    return NextResponse.json(product);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
