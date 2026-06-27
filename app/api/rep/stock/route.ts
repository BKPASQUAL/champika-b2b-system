// app/api/rep/stock/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const supplier = searchParams.get("supplier"); // ✅ Get supplier filter
    const supplierLike = searchParams.get("supplierLike");
    const includeOutOfStock = searchParams.get("includeOutOfStock") === "true";

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }

    // 1. Get assigned location(s) for this user
    const { data: assignments, error: assignError } = await supabaseAdmin
      .from("location_assignments")
      .select("location_id")
      .eq("user_id", userId);

    if (assignError) throw assignError;

    // If no assignment found, return empty list (User has no stock access)
    if (!assignments || assignments.length === 0) {
      return NextResponse.json([]);
    }

    const locationIds = assignments.map((a) => a.location_id);

    // 2. Build the Query & Aggregate Data
    if (includeOutOfStock) {
      // Out-of-stock mode: Fetch ALL active products (left-joining stocks for the rep's locations)
      const productsData: any[] = [];
      let page = 0;
      const pageSize = 1000;

      while (true) {
        let query = supabaseAdmin
          .from("products")
          .select(
            `
            id,
            sku,
            name,
            selling_price,
            cost_price,
            retail_price,
            mrp,
            unit_of_measure,
            category,
            sub_category,
            brand,
            is_active,
            supplier_name,
            company_code,
            retail_only,
            product_stocks (
              quantity,
              location_id
            )
          `
          )
          .eq("is_active", true)
          .in("product_stocks.location_id", locationIds)
          .range(page * pageSize, (page + 1) * pageSize - 1);

        // Apply Supplier Filter if provided
        if (supplier) {
          query = query.eq("supplier_name", supplier);
        }
        if (supplierLike) {
          query = query.ilike("supplier_name", `%${supplierLike}%`);
        }

        const { data: pageData, error: productsError } = await query;
        if (productsError) throw productsError;
        if (!pageData || pageData.length === 0) break;

        productsData.push(...pageData);
        if (pageData.length < pageSize) break;
        page++;
      }

      const productList = productsData.map((p: any) => {
        let stock_quantity = 0;
        if (p.product_stocks) {
          p.product_stocks.forEach((item: any) => {
            stock_quantity += item.quantity;
          });
        }
        return {
          id: p.id,
          sku: p.sku,
          name: p.name,
          selling_price: p.selling_price,
          retail_price: p.retail_price ?? null,
          retail_only: p.retail_only ?? false,
          mrp: p.mrp,
          stock_quantity,
          unit_of_measure: p.unit_of_measure || "unit",
          category: p.category,
          subCategory: p.sub_category,
          supplier: p.supplier_name,
          company_code: p.company_code,
        };
      });

      return NextResponse.json(productList);
    } else {
      // Normal mode: Fetch only products with active stock > 0 in rep's locations
      const stocks: any[] = [];
      let page = 0;
      const pageSize = 1000;

      while (true) {
        let query = supabaseAdmin
          .from("product_stocks")
          .select(
            `
            quantity,
            location_id,
            products!inner (
              id,
              sku,
              name,
              selling_price,
              cost_price,
              retail_price,
              mrp,
              unit_of_measure,
              category,
              sub_category,
              brand,
              is_active,
              supplier_name,
              company_code,
              retail_only
            )
          `
          )
          .in("location_id", locationIds)
          .gt("quantity", 0)
          .range(page * pageSize, (page + 1) * pageSize - 1);

        // Apply Supplier Filter if provided
        if (supplier) {
          query = query.eq("products.supplier_name", supplier);
        }
        if (supplierLike) {
          query = query.ilike("products.supplier_name", `%${supplierLike}%`);
        }

        const { data: pageData, error: stockError } = await query;
        if (stockError) throw stockError;
        if (!pageData || pageData.length === 0) break;

        stocks.push(...pageData);
        if (pageData.length < pageSize) break;
        page++;
      }

      const productMap = new Map();
      stocks.forEach((item: any) => {
        const p = item.products;
        if (!p) return;

        // --- FILTER: Hide Inactive Products ---
        if (p.is_active === false) return;

        if (productMap.has(p.id)) {
          const existing = productMap.get(p.id);
          existing.stock_quantity += item.quantity;
        } else {
          productMap.set(p.id, {
            id: p.id,
            sku: p.sku,
            name: p.name,
            selling_price: p.selling_price,
            retail_price: p.retail_price ?? null,
            retail_only: p.retail_only ?? false,
            mrp: p.mrp,
            stock_quantity: item.quantity,
            unit_of_measure: p.unit_of_measure || "unit",
            category: p.category,
            subCategory: p.sub_category,
            supplier: p.supplier_name,
            company_code: p.company_code,
          });
        }
      });

      return NextResponse.json(Array.from(productMap.values()));
    }
  } catch (error: any) {
    console.error("Rep Stock API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
