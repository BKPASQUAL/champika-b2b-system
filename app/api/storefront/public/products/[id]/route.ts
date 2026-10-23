import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// GET /api/storefront/public/products/[id]
// Returns full product details, category path, specifications, and sidebar categories
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Product ID required" }, { status: 400 });
    }

    // 1. Fetch product base details
    const { data: product, error: pError } = await supabaseAdmin
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
      .eq("id", id)
      .single();

    if (pError || !product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // 2. Fetch storefront custom settings
    const { data: sf } = await supabaseAdmin
      .from("storefront_products")
      .select("*")
      .eq("product_id", id)
      .maybeSingle();

    const realStock = product.product_stocks && product.product_stocks.length > 0
      ? product.product_stocks.reduce((sum: number, s: any) => sum + (Number(s.quantity) || 0), 0)
      : Number(product.stock_quantity || 0);

    const buffer = sf?.stock_buffer ?? 5;
    const visibleStock = Math.max(0, realStock - buffer);
    const onlinePrice = sf?.online_price !== undefined && sf.online_price > 0
      ? Number(sf.online_price)
      : Number(product.selling_price || product.mrp || 0);

    const mrp = Number(product.mrp || onlinePrice);
    const discountPercent = mrp > onlinePrice ? Math.round(((mrp - onlinePrice) / mrp) * 100) : 0;

    const isStockAvailable = visibleStock > 0;
    const stockStatus = isStockAvailable
      ? (visibleStock > 15 ? "In Stock" : `Only ${visibleStock} Units Left`)
      : (sf?.allow_backorder !== false ? "Available on Order (2-3 Days)" : "Out of Stock");

    // Category hierarchy breadcrumb path
    // e.g. "Wiring Accessories > Cables & Wires > Household Cables & Wires"
    const rawCategoryPath = sf?.category_slug || product.category || "Wiring Accessories > Cables & Wires > Household Cables & Wires";
    const breadcrumbSegments = rawCategoryPath
      .split(">")
      .map((s: string) => s.trim())
      .filter(Boolean);

    // Parse specifications/bullet points from online_description
    const rawDesc = sf?.online_description || "";
    const bulletSpecs: string[] = [];
    let summaryText = "";

    if (rawDesc) {
      const lines = rawDesc.split("\n").map((l: string) => l.trim()).filter(Boolean);
      lines.forEach((line: string) => {
        if (line.startsWith("•") || line.startsWith("-") || line.startsWith("*") || line.includes(":")) {
          bulletSpecs.push(line.replace(/^[•\-\*]\s*/, ""));
        } else if (!summaryText) {
          summaryText = line;
        } else {
          bulletSpecs.push(line);
        }
      });
    }

    // If no custom specs entered yet, provide standard electrical specs based on brand and category
    if (bulletSpecs.length === 0) {
      bulletSpecs.push(`Brand & Series: Genuine ${product.brand || product.supplier_name || "Certified Brand"} Stock`);
      bulletSpecs.push(`Product Code / SKU: ${product.sku || "BK-ELEC"}`);
      bulletSpecs.push(`Safety Rating: SLS & IEC standard compliant building wire / accessory`);
      bulletSpecs.push(`Application: Residential lighting, ring mains & commercial power installations`);
      bulletSpecs.push(`Warranty: Manufacturer defect warranty included`);
    }

    if (!summaryText) {
      summaryText = `The ${sf?.online_title || product.name} is a high-grade electrical component manufactured by ${product.brand || product.supplier_name || "certified electrical manufacturers"}, engineered for optimal conductivity, heat resistance, and long-term durability.`;
    }

    // 3. Fetch Category Tree / Counts for the sidebar
    // We get all live published products to compute counts per category
    const { data: allSf } = await supabaseAdmin
      .from("storefront_products")
      .select("category_slug")
      .eq("is_published", true);

    const categoryCounts: Record<string, number> = {};
    const subCategoryCounts: Record<string, Record<string, number>> = {};

    (allSf || []).forEach((item: any) => {
      const catPath = item.category_slug || "Wiring Accessories > Cables & Wires";
      const parts = catPath.split(">").map((s: string) => s.trim()).filter(Boolean);
      const main = parts[0] || "General";
      const sub = parts[1] || (parts[0] ? `${parts[0]} Items` : "General");

      categoryCounts[main] = (categoryCounts[main] || 0) + 1;
      if (!subCategoryCounts[main]) subCategoryCounts[main] = {};
      subCategoryCounts[main][sub] = (subCategoryCounts[main][sub] || 0) + 1;
    });

    // 4. Fetch 4 related products in the same category
    const { data: relatedRaw } = await supabaseAdmin
      .from("products")
      .select("id, name, sku, brand, selling_price, mrp, images")
      .eq("category", product.category)
      .neq("id", id)
      .eq("is_active", true)
      .limit(4);

    return NextResponse.json({
      product: {
        id: product.id,
        sku: product.sku || "-",
        title: sf?.online_title || product.name,
        originalName: product.name,
        brand: product.brand || product.supplier_name || "Standard",
        supplierName: product.supplier_name || "",
        category: product.category,
        categoryPath: rawCategoryPath,
        breadcrumbSegments,
        price: onlinePrice,
        mrp: mrp,
        discountPercent,
        unit: product.unit_of_measure || "Coil",
        images: Array.isArray(product.images) && product.images.length > 0 ? product.images : [],
        stockQuantity: visibleStock,
        isStockAvailable,
        stockStatus,
        allowBackorder: sf?.allow_backorder ?? true,
        summaryText,
        specifications: bulletSpecs,
      },
      categorySidebar: {
        categories: categoryCounts,
        subCategories: subCategoryCounts,
      },
      relatedProducts: relatedRaw || [],
    });
  } catch (error: any) {
    console.error("Single product GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
