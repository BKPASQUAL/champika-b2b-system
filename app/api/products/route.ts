import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

const productSchema = z.object({
  sku: z.string().optional(),
  name: z.string().min(2, "Name required"),
  category: z.string().min(1, "Category required"),
  subCategory: z.string().optional(),
  brand: z.string().optional(),
  subBrand: z.string().optional(),
  modelType: z.string().optional(),
  subModel: z.string().optional(),
  sizeSpec: z.string().optional(),
  supplier: z.string().min(1, "Supplier required"),
  stock: z.number().min(0),
  minStock: z.number().min(0),
  mrp: z.number().min(0),
  sellingPrice: z.number().min(0),
  costPrice: z.number().min(0),
  images: z.array(z.string()).optional(),
  unitOfMeasure: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const onlyActive = searchParams.get("active") === "true";

    let query = supabaseAdmin
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (onlyActive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) throw error;

    const mapped = data.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      subCategory: p.sub_category,
      brand: p.brand,
      subBrand: p.sub_brand,
      modelType: p.model_type,
      subModel: p.sub_model,
      sizeSpec: p.size_spec,
      supplier: p.supplier_name,
      stock: p.stock_quantity || 0,
      minStock: p.min_stock_level || 0,
      mrp: p.mrp || 0,
      sellingPrice: p.selling_price || 0,
      costPrice: p.cost_price || 0,
      unitOfMeasure: p.unit_of_measure || "Pcs",
      images: p.images || [],
      commissionType: p.commission_type || "percentage",
      commissionValue: p.commission_value || 0,
      isActive: p.is_active ?? true,
      discountPercent:
        p.mrp > 0 ? ((p.mrp - (p.selling_price || 0)) / p.mrp) * 100 : 0,
      totalValue: (p.stock_quantity || 0) * (p.selling_price || 0),
      totalCost: (p.stock_quantity || 0) * (p.cost_price || 0),
      profitMargin:
        (p.selling_price || 0) > 0
          ? (((p.selling_price || 0) - (p.cost_price || 0)) /
              (p.selling_price || 0)) *
            100
          : 0,
    }));

    return NextResponse.json(mapped);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const val = productSchema.parse(body);

    let sku = val.sku;

    // ✅ 1. ROBUST SKU AUTO-GENERATION
    if (!sku) {
      const supplierName = val.supplier.trim();
      const prefix = (
        supplierName.length >= 2 ? supplierName.substring(0, 2) : supplierName
      ).toUpperCase();

      // Find the "highest" string SKU to guess the next number
      const { data: lastProducts } = await supabaseAdmin
        .from("products")
        .select("sku")
        .ilike("sku", `${prefix}-%`)
        .order("sku", { ascending: false })
        .limit(1);

      let nextSequence = 1;

      if (lastProducts && lastProducts.length > 0) {
        const lastSku = lastProducts[0].sku;
        const parts = lastSku.split("-");
        if (parts.length === 2 && parts[0] === prefix) {
          const numberPart = parseInt(parts[1], 10);
          if (!isNaN(numberPart)) {
            nextSequence = numberPart + 1;
          }
        }
      }

      // 🛡️ COLLISION CHECK LOOP
      // If the calculated SKU exists (e.g. because OR-99 hid OR-100 in sort),
      // keep incrementing until we find a free spot.
      while (true) {
        const candidateSku = `${prefix}-${nextSequence
          .toString()
          .padStart(4, "0")}`;

        const { data: existing } = await supabaseAdmin
          .from("products")
          .select("id")
          .eq("sku", candidateSku)
          .maybeSingle();

        if (!existing) {
          sku = candidateSku; // Found a free one!
          break;
        }
        // If exists, try next number
        nextSequence++;
      }
    }

    // ✅ 2. COMMISSION LOGIC
    const { data: rules } = await supabaseAdmin
      .from("commission_rules")
      .select("category, sub_category, rate")
      .eq("supplier_name", val.supplier);

    let commissionRate = 0;

    if (rules && rules.length > 0) {
      // Priority 1: Sub Category
      const subCatRule = val.subCategory
        ? rules.find(
            (r) =>
              r.category === val.category && r.sub_category === val.subCategory
          )
        : null;
      // Priority 2: Main Category
      const catRule = rules.find(
        (r) => r.category === val.category && !r.sub_category
      );
      // Priority 3: Global "ALL"
      const globalRule = rules.find((r) => r.category === "ALL");

      if (subCatRule) commissionRate = subCatRule.rate;
      else if (catRule) commissionRate = catRule.rate;
      else if (globalRule) commissionRate = globalRule.rate;
    }

    // ✅ 3. INSERT PRODUCT
    const { data: product, error: productError } = await supabaseAdmin
      .from("products")
      .insert({
        sku: sku,
        name: val.name,
        category: val.category,
        sub_category: val.subCategory,
        brand: val.brand,
        sub_brand: val.subBrand,
        model_type: val.modelType,
        sub_model: val.subModel,
        size_spec: val.sizeSpec,
        supplier_name: val.supplier,
        stock_quantity: val.stock,
        min_stock_level: val.minStock,
        mrp: val.mrp,
        selling_price: val.sellingPrice,
        cost_price: val.costPrice,
        images: val.images || [],
        unit_of_measure: val.unitOfMeasure || "Pcs",
        commission_type: "percentage",
        commission_value: commissionRate,
        is_active: val.isActive ?? true,
      })
      .select()
      .single();

    if (productError) throw productError;

    // ✅ 4. INITIAL STOCK (MAIN WAREHOUSE)
    const { data: mainWarehouse } = await supabaseAdmin
      .from("locations")
      .select("id")
      .is("business_id", null)
      .maybeSingle();

    if (mainWarehouse) {
      await supabaseAdmin.from("product_stocks").insert({
        product_id: product.id,
        location_id: mainWarehouse.id,
        quantity: val.stock,
        damaged_quantity: 0,
      });
    }

    return NextResponse.json(
      { message: "Product created", data: product },
      { status: 201 }
    );
  } catch (error: any) {
    // 🛡️ Final fallback for duplicates
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A product with this SKU already exists. Please try again." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
