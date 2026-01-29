import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().optional(),
  companyCode: z.string().optional(),
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
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const val = updateSchema.parse(body);

    // ✅ 1. Check for Duplicate Name (Excluding current product)
    if (val.name) {
      const { data: existingName } = await supabaseAdmin
        .from("products")
        .select("id")
        .ilike("name", val.name.trim())
        .neq("id", id) // Exclude self
        .maybeSingle();

      if (existingName) {
        return NextResponse.json(
          { error: "Product name already exists." },
          { status: 400 },
        );
      }
    }

    // ✅ 2. Check for Duplicate Company Code (Excluding current product)
    if (val.companyCode && val.companyCode.trim() !== "") {
      const { data: existingCode } = await supabaseAdmin
        .from("products")
        .select("id")
        .eq("company_code", val.companyCode.trim())
        .neq("id", id) // Exclude self
        .maybeSingle();

      if (existingCode) {
        return NextResponse.json(
          { error: "Company Code already exists." },
          { status: 400 },
        );
      }
    }

    // Fetch current data
    const { data: currentProduct, error: fetchError } = await supabaseAdmin
      .from("products")
      .select(
        "price_history, cost_price, selling_price, mrp, supplier_name, category",
      )
      .eq("id", id)
      .single();

    if (fetchError) throw fetchError;

    const dbUpdates: any = {};

    // Price History Logic
    const isPriceChanged =
      (val.costPrice !== undefined &&
        val.costPrice !== currentProduct.cost_price) ||
      (val.sellingPrice !== undefined &&
        val.sellingPrice !== currentProduct.selling_price) ||
      (val.mrp !== undefined && val.mrp !== currentProduct.mrp);

    if (isPriceChanged) {
      const historyEntry = {
        date: new Date().toISOString(),
        costPrice: currentProduct.cost_price,
        sellingPrice: currentProduct.selling_price,
        mrp: currentProduct.mrp,
      };

      const currentHistory = Array.isArray(currentProduct.price_history)
        ? currentProduct.price_history
        : [];

      dbUpdates.price_history = [historyEntry, ...currentHistory];
    }

    if (val.name) dbUpdates.name = val.name.trim();
    if (val.companyCode !== undefined)
      dbUpdates.company_code = val.companyCode.trim();
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

    // Commission Recalculation
    if (val.supplier || val.category) {
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
  { params }: { params: Promise<{ id: string }> },
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
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const { data: productData, error: productError } = await supabaseAdmin
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

    if (productError) throw productError;

    const { data: stocks, error: stockError } = await supabaseAdmin
      .from("product_stocks")
      .select(
        `
        id,
        quantity,
        damaged_quantity,
        last_updated,
        locations ( name, business_id )
      `,
      )
      .eq("product_id", id);

    if (stockError) console.error("Error fetching stocks:", stockError);

    const safeStocks = stocks || [];
    const totalGoodStock = safeStocks.reduce(
      (sum, s) => sum + (Number(s.quantity) || 0),
      0,
    );
    const totalDamagedStock = safeStocks.reduce(
      (sum, s) => sum + (Number(s.damaged_quantity) || 0),
      0,
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
      companyCode: productData.company_code,
      name: productData.name,
      category: productData.category,
      subCategory: productData.sub_category,
      brand: productData.brand,
      subBrand: productData.sub_brand,
      modelType: productData.model_type,
      subModel: productData.sub_model,
      sizeSpec: productData.size_spec,
      supplier: productData.supplier_name,
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
      priceHistory: productData.price_history || [],
      stocks: formattedStocks,
    };

    return NextResponse.json(product);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
