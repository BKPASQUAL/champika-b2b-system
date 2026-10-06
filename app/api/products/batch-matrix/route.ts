import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { products: rawProducts, locationId, userId } = body;

    if (!Array.isArray(rawProducts) || rawProducts.length === 0) {
      return NextResponse.json(
        { error: "At least one product is required for matrix creation." },
        { status: 400 }
      );
    }

    // 1. Fetch all locations for stock initialization
    const { data: allLocations, error: locError } = await supabaseAdmin
      .from("locations")
      .select("id, business_id");

    if (locError) {
      console.error("Failed to load locations:", locError);
    }

    let targetLocationId = locationId || null;
    if (!targetLocationId && userId) {
      const { data: assignments } = await supabaseAdmin
        .from("location_assignments")
        .select("location_id")
        .eq("user_id", userId);
      if (assignments && assignments.length > 0) {
        targetLocationId = assignments[0].location_id;
      }
    }

    const primaryLocationId =
      targetLocationId || allLocations?.find((l) => l.business_id === null)?.id;

    // 2. Pre-fetch SKU prefixes to allocate sequential unique SKUs
    const skuCounters = new Map<string, number>();

    const getNextSku = async (supplierName: string): Promise<string> => {
      const prefix = (supplierName || "XX").substring(0, 2).toUpperCase();

      if (!skuCounters.has(prefix)) {
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
        skuCounters.set(prefix, maxNum);
      }

      const current = skuCounters.get(prefix) || 0;
      const nextNum = current + 1;
      skuCounters.set(prefix, nextNum);
      return `${prefix}-${nextNum.toString().padStart(4, "0")}`;
    };

    // 3. Process and insert each product safely
    const createdProducts: any[] = [];
    const errors: { index: number; name: string; error: string }[] = [];

    for (let i = 0; i < rawProducts.length; i++) {
      const p = rawProducts[i];
      try {
        if (!p.name || !p.category || !p.supplier) {
          errors.push({
            index: i,
            name: p.name || `Item #${i + 1}`,
            error: "Name, Category, and Supplier are required.",
          });
          continue;
        }

        const sku = p.sku?.trim() || (await getNextSku(p.supplier));
        const stockQty = Number(p.stock) || 0;
        const minStock = Number(p.minStock) || 0;
        const mrp = Number(p.mrp) || 0;
        const sellingPrice = Number(p.sellingPrice) || 0;
        const costPrice = Number(p.costPrice) || 0;
        const commissionVal = Number(p.commissionValue) || 0;
        const retailPrice = p.retailPrice !== undefined && p.retailPrice !== null && p.retailPrice !== ""
          ? Number(p.retailPrice)
          : (p.retailOnly ? sellingPrice : null);

        const existingId = p.existingProductId?.trim() || null;
        let insertedProduct: any = null;

        if (existingId) {
          // UPDATE / MERGE existing product safely (keeps existing ID, stock transactions and invoice history intact)
          const updatePayload: any = {
            name: p.name.trim(),
            category: p.category.trim(),
            sub_category: p.subCategory?.trim() || null,
            brand: p.brand?.trim() || null,
            sub_brand: p.subBrand?.trim() || null,
            model_type: p.modelType?.trim() || null,
            sub_model: p.subModel?.trim() || null,
            size_spec: p.sizeSpec?.trim() || null,
            supplier_name: p.supplier.trim(),
            min_stock_level: minStock,
            mrp,
            selling_price: sellingPrice,
            cost_price: costPrice,
            unit_of_measure: p.unitOfMeasure || "Pcs",
            commission_type: p.commissionType || "percentage",
            commission_value: commissionVal,
            is_active: p.isActive !== false,
            retail_only: !!p.retailOnly,
            retail_price: retailPrice,
          };

          if (Array.isArray(p.images) && p.images.length > 0) {
            updatePayload.images = p.images;
          }
          if (p.companyCode?.trim()) {
            updatePayload.company_code = p.companyCode.trim();
          }

          const { data: updated, error: updateError } = await supabaseAdmin
            .from("products")
            .update(updatePayload)
            .eq("id", existingId)
            .select()
            .single();

          if (updateError) {
            errors.push({
              index: i,
              name: p.name,
              error: updateError.message || "Update failed",
            });
            continue;
          }
          insertedProduct = updated;
        } else {
          // INSERT new product
          const sku = p.sku?.trim() || (await getNextSku(p.supplier));
          const { data: created, error: insertError } = await supabaseAdmin
            .from("products")
            .insert({
              sku,
              company_code: p.companyCode?.trim() || null,
              name: p.name.trim(),
              category: p.category.trim(),
              sub_category: p.subCategory?.trim() || null,
              brand: p.brand?.trim() || null,
              sub_brand: p.subBrand?.trim() || null,
              model_type: p.modelType?.trim() || null,
              sub_model: p.subModel?.trim() || null,
              size_spec: p.sizeSpec?.trim() || null,
              supplier_name: p.supplier.trim(),
              stock_quantity: stockQty,
              min_stock_level: minStock,
              mrp,
              selling_price: sellingPrice,
              cost_price: costPrice,
              images: Array.isArray(p.images) ? p.images : [],
              unit_of_measure: p.unitOfMeasure || "Pcs",
              commission_type: "percentage",
              commission_value: commissionVal,
              is_active: p.isActive !== false,
              retail_only: !!p.retailOnly,
              retail_price: retailPrice,
            })
            .select()
            .single();

          if (insertError) {
            errors.push({
              index: i,
              name: p.name,
              error: insertError.message || "Insert failed",
            });
            continue;
          }
          insertedProduct = created;

          // Initialize stock rows only for NEW products
          if (allLocations && allLocations.length > 0 && insertedProduct) {
            const supplier = (p.supplier || "").toLowerCase();
            const isOrange = supplier.includes("orange");
            const isWireman = supplier.includes("wireman");
            const isSierra = supplier.includes("sierra");

            const stockRows: any[] = [];
            for (const loc of allLocations) {
              const bId = loc.business_id;
              const isAgency =
                bId === BUSINESS_IDS.ORANGE_AGENCY ||
                bId === BUSINESS_IDS.WIREMAN_AGENCY ||
                bId === BUSINESS_IDS.SIERRA_AGENCY;

              let shouldInclude = false;
              if (!bId || bId === BUSINESS_IDS.CHAMPIKA_DISTRIBUTION || bId === BUSINESS_IDS.CHAMPIKA_RETAIL) {
                shouldInclude = true;
              } else if (bId === BUSINESS_IDS.ORANGE_AGENCY && isOrange) {
                shouldInclude = true;
              } else if (bId === BUSINESS_IDS.WIREMAN_AGENCY && isWireman) {
                shouldInclude = true;
              } else if (bId === BUSINESS_IDS.SIERRA_AGENCY && isSierra) {
                shouldInclude = true;
              } else if (!isAgency) {
                shouldInclude = true;
              }

              if (shouldInclude) {
                const isPrimary = loc.id === primaryLocationId;
                stockRows.push({
                  product_id: insertedProduct.id,
                  location_id: loc.id,
                  quantity: isPrimary ? stockQty : 0,
                  damaged_quantity: 0,
                });
              }
            }

            if (stockRows.length > 0) {
              await supabaseAdmin.from("product_stocks").insert(stockRows);
            }
          }
        }

        createdProducts.push(insertedProduct);
      } catch (err: any) {
        errors.push({
          index: i,
          name: p.name || `Item #${i + 1}`,
          error: err.message || "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: createdProducts.length > 0,
      totalRequested: rawProducts.length,
      createdCount: createdProducts.length,
      errorCount: errors.length,
      createdProducts,
      errors,
    });
  } catch (error: any) {
    console.error("Batch matrix generation error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
