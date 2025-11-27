// app/api/products/route.ts
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
  sizeSpec: z.string().optional(),
  supplier: z.string().min(1, "Supplier required"),
  stock: z.number().min(0),
  minStock: z.number().min(0),
  mrp: z.number().min(0),
  sellingPrice: z.number().min(0),
  costPrice: z.number().min(0),
  images: z.array(z.string()).optional(), // <--- ADDED THIS
});

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

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
      sizeSpec: p.size_spec,
      supplier: p.supplier_name,
      stock: p.stock_quantity || 0,
      minStock: p.min_stock_level || 0,
      mrp: p.mrp || 0,
      sellingPrice: p.selling_price || 0,
      costPrice: p.cost_price || 0,
      images: p.images || [], // <--- ADDED THIS
      unitOfMeasure: p.unit_of_measure || "unit",
      discountPercent:
        p.mrp > 0 ? ((p.mrp - p.selling_price) / p.mrp) * 100 : 0,
      totalValue: (p.stock_quantity || 0) * (p.selling_price || 0),
      totalCost: (p.stock_quantity || 0) * (p.cost_price || 0),
      profitMargin:
        p.selling_price > 0
          ? ((p.selling_price - p.cost_price) / p.selling_price) * 100
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
    if (!sku) {
      sku = `SKU-${Date.now().toString().slice(-6)}`;
    }

    const { data, error } = await supabaseAdmin
      .from("products")
      .insert({
        sku: sku,
        name: val.name,
        category: val.category,
        sub_category: val.subCategory,
        brand: val.brand,
        sub_brand: val.subBrand,
        model_type: val.modelType,
        size_spec: val.sizeSpec,
        supplier_name: val.supplier,
        stock_quantity: val.stock,
        min_stock_level: val.minStock,
        mrp: val.mrp,
        selling_price: val.sellingPrice,
        cost_price: val.costPrice,
        images: val.images || [], // <--- ADDED THIS
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(
      { message: "Product created", data },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
