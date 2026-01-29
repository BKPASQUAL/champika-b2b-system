import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

const productSchema = z.object({
  sku: z.string().optional(),
  companyCode: z.string().optional(),
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
      .select(
        `
        *,
        product_stocks (
          quantity,
          damaged_quantity
        )
      `,
      )
      .order("created_at", { ascending: false });

    if (onlyActive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) throw error;

    const mapped = data.map((p) => {
      const realStock =
        p.product_stocks && p.product_stocks.length > 0
          ? p.product_stocks.reduce(
              (sum: number, s: any) => sum + (Number(s.quantity) || 0),
              0,
            )
          : p.stock_quantity || 0;

      return {
        id: p.id,
        sku: p.sku,
        companyCode: p.company_code || "",
        name: p.name,
        category: p.category,
        subCategory: p.sub_category,
        brand: p.brand,
        subBrand: p.sub_brand,
        modelType: p.model_type,
        subModel: p.sub_model,
        sizeSpec: p.size_spec,
        supplier: p.supplier_name,
        stock: realStock,
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
        totalValue: realStock * (p.selling_price || 0),
        totalCost: realStock * (p.cost_price || 0),
        profitMargin:
          (p.selling_price || 0) > 0
            ? (((p.selling_price || 0) - (p.cost_price || 0)) /
                (p.selling_price || 0)) *
              100
            : 0,
      };
    });

    return NextResponse.json(mapped);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const val = productSchema.parse(body);

    // ✅ 1. Check for Duplicate Product Name
    const { data: existingName } = await supabaseAdmin
      .from("products")
      .select("id")
      .ilike("name", val.name.trim()) // Case-insensitive check
      .maybeSingle();

    if (existingName) {
      return NextResponse.json(
        { error: "A product with this name already exists." },
        { status: 400 },
      );
    }

    // ✅ 2. Check for Duplicate Company Code (only if provided)
    if (val.companyCode && val.companyCode.trim() !== "") {
      const { data: existingCode } = await supabaseAdmin
        .from("products")
        .select("id")
        .eq("company_code", val.companyCode.trim())
        .maybeSingle();

      if (existingCode) {
        return NextResponse.json(
          { error: "This Company Code is already in use." },
          { status: 400 },
        );
      }
    }

    let sku = val.sku;

    // Auto-Generate SKU if not provided
    if (!sku) {
      const prefix = (val.supplier || "XX").substring(0, 2).toUpperCase();
      const { data: existingSkus } = await supabaseAdmin
        .from("products")
        .select("sku")
        .ilike("sku", `${prefix}-%`);

      let maxNum = 0;
      if (existingSkus && existingSkus.length > 0) {
        existingSkus.forEach((item) => {
          if (item.sku) {
            const parts = item.sku.split("-");
            const numPart = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(numPart) && numPart > maxNum) {
              maxNum = numPart;
            }
          }
        });
      }
      sku = `${prefix}-${(maxNum + 1).toString().padStart(4, "0")}`;
    }

    // Fetch Commission Rules
    const { data: rules } = await supabaseAdmin
      .from("commission_rules")
      .select("category, rate")
      .eq("supplier_name", val.supplier);

    let commissionRate = 0;
    if (rules && rules.length > 0) {
      const specificRule = rules.find((r) => r.category === val.category);
      const generalRule = rules.find((r) => r.category === "ALL");
      if (specificRule) {
        commissionRate = specificRule.rate;
      } else if (generalRule) {
        commissionRate = generalRule.rate;
      }
    }

    // Insert Product
    const { data: product, error: productError } = await supabaseAdmin
      .from("products")
      .insert({
        sku: sku,
        company_code: val.companyCode || null,
        name: val.name.trim(),
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

    // Create Initial Stock Entry in Main Warehouse
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
      { status: 201 },
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
