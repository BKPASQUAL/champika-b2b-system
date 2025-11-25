import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

const productSchema = z.object({
  sku: z.string().optional(),
  name: z.string().min(2, "Product name is required"),
  category: z.string().min(1, "Category is required"),
  supplier: z.string().min(1, "Supplier is required"),
  stock: z.number().min(0),
  minStock: z.number().min(0),
  mrp: z.number().min(0),
  sellingPrice: z.number().min(0),
  costPrice: z.number().min(0),
});

export async function GET() {
  try {
    const { data: products, error } = await supabaseAdmin
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Map DB fields to Frontend interface
    const mappedProducts = products.map((p) => {
      const stock = p.stock_quantity || 0;
      const cost = p.cost_price || 0;
      const selling = p.selling_price || 0;
      const mrp = p.mrp || 0;

      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        supplier: p.supplier_name, // Mapping from DB 'supplier_name'
        stock: stock,
        minStock: p.min_stock_level || 0,
        mrp: mrp,
        sellingPrice: selling,
        costPrice: cost,
        // Derived fields for display
        discountPercent: mrp > 0 ? ((mrp - selling) / mrp) * 100 : 0,
        totalValue: stock * selling,
        totalCost: stock * cost,
        profitMargin: selling > 0 ? ((selling - cost) / selling) * 100 : 0,
      };
    });

    return NextResponse.json(mappedProducts);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const val = productSchema.parse(body);

    // Auto-generate SKU if not provided
    let sku = val.sku;
    if (!sku) {
      const timestamp = Date.now().toString().slice(-6);
      sku = `SKU-${timestamp}`;
    }

    const { data, error } = await supabaseAdmin
      .from("products")
      .insert({
        sku: sku,
        name: val.name,
        category: val.category,
        supplier_name: val.supplier, // Store supplier name
        stock_quantity: val.stock,
        min_stock_level: val.minStock,
        mrp: val.mrp,
        selling_price: val.sellingPrice,
        cost_price: val.costPrice,
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
