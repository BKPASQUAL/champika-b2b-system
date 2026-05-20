import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// GET /api/inventory/cost-layers?businessId=xxx
// Returns per-product FIFO cost layer breakdown for stock value & profit analysis
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    // Fetch all products with their cost layers
    // Query cost layers joined to products — single query, no is_active / stock_quantity
    // restrictions so every batch with remaining stock is included.
    const { data: rawLayers, error: layerError } = await supabaseAdmin
      .from("product_cost_layers")
      .select(`
        id, product_id, cost_price, original_quantity, remaining_quantity, created_at, purchase_id,
        product:products!inner (id, name, sku, category, stock_quantity, selling_price, cost_price, actual_cost_price)
      `)
      .gt("remaining_quantity", 0)
      .order("created_at", { ascending: true });

    if (layerError) throw layerError;

    if (!rawLayers || rawLayers.length === 0) {
      return NextResponse.json({ products: [], summary: { totalOldCostValue: 0, totalNewCostValue: 0, totalSellingValue: 0, totalProducts: 0, productsWithMultipleLevels: 0, totalCostValue: 0, totalPotentialProfit: 0 } });
    }

    // Group layers by product
    const layersByProduct: Record<string, any[]> = {};
    const productMeta: Record<string, any> = {};
    rawLayers.forEach((layer: any) => {
      const pid = layer.product_id;
      if (!layersByProduct[pid]) layersByProduct[pid] = [];
      layersByProduct[pid].push(layer);
      if (!productMeta[pid]) productMeta[pid] = layer.product;
    });

    // Build result per product
    let totalOldCostValue = 0;
    let totalNewCostValue = 0;
    let totalSellingValue = 0;

    const result = Object.entries(layersByProduct).map(([productId, productLayers]) => {
      const product = productMeta[productId];
      const sellingPrice = Number(product?.selling_price) || 0;

      // Calculate values per layer
      const layerDetails = productLayers.map((layer: any, idx: number) => {
        const qty = Number(layer.remaining_quantity);
        const costVal = qty * Number(layer.cost_price);
        const sellVal = qty * sellingPrice;
        return {
          layerIndex: idx + 1,
          costPrice: Number(layer.cost_price),
          originalQuantity: Number(layer.original_quantity),
          remainingQuantity: qty,
          costValue: costVal,
          sellingValue: sellVal,
          potentialProfit: sellVal - costVal,
          purchaseId: layer.purchase_id,
          purchaseDate: layer.created_at,
        };
      });

      const totalLayerQty = layerDetails.reduce((s: number, l: any) => s + l.remainingQuantity, 0);
      const totalCostValue = layerDetails.reduce((s: number, l: any) => s + l.costValue, 0);
      const totalSellValue = totalLayerQty * sellingPrice;

      // "Old cost" = first (oldest) layer; "New cost" = most recent layer
      const oldLayer = layerDetails[0];
      const newLayer = layerDetails[layerDetails.length - 1];

      const hasMultipleCostLevels = layerDetails.length > 1 &&
        layerDetails.some((l: any) => l.costPrice !== oldLayer?.costPrice);

      totalOldCostValue += oldLayer ? oldLayer.costValue : totalCostValue;
      totalNewCostValue += newLayer && hasMultipleCostLevels ? newLayer.costValue : 0;
      totalSellingValue += totalSellValue;

      return {
        productId: productId,
        productName: product?.name || "Unknown",
        sku: product?.sku || "",
        category: product?.category || "",
        totalStock: totalLayerQty,
        sellingPrice,
        currentCostPrice: Number(product?.actual_cost_price || product?.cost_price || 0),
        hasMultipleCostLevels,
        layers: layerDetails,
        totals: {
          costValue: totalCostValue,
          sellingValue: totalSellValue,
          potentialProfit: totalSellValue - totalCostValue,
        },
      };
    });

    // Sort: products with multiple cost levels first (most interesting)
    result.sort((a: any, b: any) => {
      if (a.hasMultipleCostLevels && !b.hasMultipleCostLevels) return -1;
      if (!a.hasMultipleCostLevels && b.hasMultipleCostLevels) return 1;
      return b.totals.costValue - a.totals.costValue;
    });

    return NextResponse.json({
      products: result,
      summary: {
        totalProducts: result.length,
        productsWithMultipleLevels: result.filter((p: any) => p.hasMultipleCostLevels).length,
        totalCostValue: result.reduce((s: number, p: any) => s + p.totals.costValue, 0),
        totalSellingValue,
        totalPotentialProfit: totalSellingValue - result.reduce((s: number, p: any) => s + p.totals.costValue, 0),
      },
    });
  } catch (error: any) {
    console.error("Cost layers API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
