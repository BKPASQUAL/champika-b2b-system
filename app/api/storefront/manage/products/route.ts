import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// GET /api/storefront/manage/products
// Returns products merged with storefront settings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.toLowerCase();
    const supplier = searchParams.get("supplier");
    const publishedOnly = searchParams.get("published") === "true";

    // 1. Fetch active products with stocks and suppliers
    const { data: products, error: pError } = await supabaseAdmin
      .from("products")
      .select(`
        id,
        sku,
        name,
        category,
        sub_category,
        brand,
        supplier_name,
        cost_price,
        selling_price,
        mrp,
        unit_of_measure,
        images,
        is_active,
        stock_quantity,
        product_stocks (
          quantity
        )
      `)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (pError) throw pError;

    // 2. Fetch storefront settings
    const { data: sfSettings, error: sfError } = await supabaseAdmin
      .from("storefront_products")
      .select("*");

    if (sfError && sfError.code !== "PGRST116" && !sfError.message.includes("does not exist") && !sfError.message.includes("schema cache")) {
      console.warn("Storefront settings query warning:", sfError.message);
    }

    const settingsMap = new Map<string, any>();
    if (sfSettings) {
      sfSettings.forEach((s: any) => settingsMap.set(s.product_id, s));
    }

    // 3. Merge products with their storefront settings
    const mapped = (products || []).map((p: any) => {
      const realStock = p.product_stocks && p.product_stocks.length > 0
        ? p.product_stocks.reduce((sum: number, s: any) => sum + (Number(s.quantity) || 0), 0)
        : Number(p.stock_quantity || 0);

      const sf = settingsMap.get(p.id) || {};
      const buffer = sf.stock_buffer ?? 5;
      const visibleStock = Math.max(0, realStock - buffer);
      const onlinePrice = sf.online_price !== undefined && sf.online_price > 0 ? Number(sf.online_price) : Number(p.selling_price || p.mrp || 0);

      return {
        id: p.id,
        sku: p.sku || "-",
        name: p.name,
        category: p.category || "General",
        subCategory: p.sub_category || "",
        brand: p.brand || p.supplier_name || "Generic",
        supplier: p.supplier_name || "",
        costPrice: Number(p.cost_price || 0),
        wholesalePrice: Number(p.selling_price || 0),
        mrp: Number(p.mrp || 0),
        unit: p.unit_of_measure || "Pcs",
        images: p.images || [],
        warehouseStock: realStock,
        
        // Storefront custom settings
        isPublished: sf.is_published ?? false,
        isFeatured: sf.is_featured ?? false,
        onlinePrice: onlinePrice,
        stockBuffer: buffer,
        visibleOnlineStock: visibleStock,
        allowBackorder: sf.allow_backorder ?? true,
        leadTimeDays: sf.lead_time_days ?? 2,
        onlineTitle: sf.online_title || p.name,
        onlineDescription: sf.online_description || "",
      };
    });

    // 4. Apply optional query filters
    let result = mapped;
    if (publishedOnly) {
      result = result.filter(item => item.isPublished);
    }
    if (supplier && supplier !== "all") {
      result = result.filter(item => item.supplier.toLowerCase() === supplier.toLowerCase() || item.brand.toLowerCase() === supplier.toLowerCase());
    }
    if (search) {
      result = result.filter(item => 
        item.name.toLowerCase().includes(search) || 
        item.sku.toLowerCase().includes(search) ||
        item.brand.toLowerCase().includes(search)
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Storefront products GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/storefront/manage/products
// Upserts storefront settings for a specific product
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      productId,
      isPublished,
      isFeatured,
      onlinePrice,
      stockBuffer,
      allowBackorder,
      leadTimeDays,
      onlineTitle,
      onlineDescription,
    } = body;

    if (!productId) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    const payload = {
      product_id: productId,
      is_published: isPublished ?? false,
      is_featured: isFeatured ?? false,
      online_price: Number(onlinePrice || 0),
      stock_buffer: Number(stockBuffer ?? 5),
      allow_backorder: allowBackorder ?? true,
      lead_time_days: Number(leadTimeDays ?? 2),
      online_title: onlineTitle || null,
      online_description: onlineDescription || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("storefront_products")
      .upsert(payload, { onConflict: "product_id" })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Storefront products POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
