import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// GET /api/storefront/public/products
// Public catalog feed for BK Wiring Kade visitors (prices and live stocks visible without login)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const brand = searchParams.get("brand");
    const search = searchParams.get("search")?.toLowerCase();

    // 1. Fetch products published to storefront
    const { data: sfSettings, error: sfError } = await supabaseAdmin
      .from("storefront_products")
      .select("*")
      .eq("is_published", true);

    if (sfError && sfError.code !== "PGRST116" && !sfError.message.includes("does not exist") && !sfError.message.includes("schema cache")) {
      console.warn("Storefront settings query error:", sfError);
    }

    // If no published settings exist yet, let's gracefully fallback to active electrical products
    // so the visitor sees wiring cables, switches, etc.
    const publishedProductIds = (sfSettings || []).map((s: any) => s.product_id);

    let query = supabaseAdmin
      .from("products")
      .select(`
        id,
        sku,
        name,
        category,
        sub_category,
        brand,
        supplier_name,
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
      .eq("is_active", true);

    if (publishedProductIds.length > 0) {
      query = query.in("id", publishedProductIds);
    } else {
      // Temporary fallback until admin clicks publish on products: show up to 30 active items
      query = query.limit(40);
    }

    const { data: products, error: pError } = await query;
    if (pError) throw pError;

    const sfMap = new Map<string, any>();
    (sfSettings || []).forEach((s: any) => sfMap.set(s.product_id, s));

    const mapped = (products || []).map((p: any) => {
      const realStock = p.product_stocks && p.product_stocks.length > 0
        ? p.product_stocks.reduce((sum: number, s: any) => sum + (Number(s.quantity) || 0), 0)
        : Number(p.stock_quantity || 0);

      const sf = sfMap.get(p.id) || {};
      const buffer = sf.stock_buffer ?? 5;
      const visibleStock = Math.max(0, realStock - buffer);
      const onlinePrice = sf.online_price !== undefined && sf.online_price > 0
        ? Number(sf.online_price)
        : Number(p.selling_price || p.mrp || 0);

      const isStockAvailable = visibleStock > 0;
      const stockStatus = isStockAvailable
        ? (visibleStock > 15 ? "In Stock" : `Only ${visibleStock} Left`)
        : (sf.allow_backorder !== false ? "Available on Order (2-3 Days)" : "Out of Stock");

      return {
        id: p.id,
        sku: p.sku || "-",
        title: sf.online_title || p.name,
        category: sf.category_slug || p.category || "Wiring & Switches",
        subCategory: p.sub_category || "",
        brand: p.brand || p.supplier_name || "Quality Brand",
        price: onlinePrice,
        mrp: Number(p.mrp || onlinePrice),
        discountPercent: p.mrp > onlinePrice ? Math.round(((p.mrp - onlinePrice) / p.mrp) * 100) : 0,
        unit: p.unit_of_measure || "Pcs",
        images: Array.isArray(p.images) && p.images.length > 0 ? p.images : [],
        stockQuantity: visibleStock,
        isStockAvailable: isStockAvailable,
        stockStatus: stockStatus,
        allowBackorder: sf.allow_backorder ?? true,
        isFeatured: sf.is_featured ?? false,
        description: sf.online_description || "",
      };
    });

    let result = mapped;
    if (category && category !== "all") {
      result = result.filter(item => item.category.toLowerCase().includes(category.toLowerCase()));
    }
    if (brand && brand !== "all") {
      result = result.filter(item => item.brand.toLowerCase() === brand.toLowerCase());
    }
    if (search) {
      result = result.filter(item =>
        item.title.toLowerCase().includes(search) ||
        item.sku.toLowerCase().includes(search) ||
        item.brand.toLowerCase().includes(search)
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Public products GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
