import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceLocationId, destLocationId, items, reason } = body;

    // Validate generic fields
    if (
      !sourceLocationId ||
      !destLocationId ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return NextResponse.json(
        { error: "Missing required fields or items list" },
        { status: 400 }
      );
    }

    // Process each item sequentially
    // In a real production app, this should be a stored procedure or transaction
    const results = [];
    const errors = [];

    for (const item of items) {
      const { productId, quantity } = item;

      if (!productId || quantity <= 0) {
        errors.push(`Invalid data for product ${productId}`);
        continue;
      }

      // 1. Check Source Stock
      const { data: sourceStock, error: sourceError } = await supabaseAdmin
        .from("product_stocks")
        .select("quantity")
        .eq("location_id", sourceLocationId)
        .eq("product_id", productId)
        .single();

      if (sourceError || !sourceStock || sourceStock.quantity < quantity) {
        errors.push(`Insufficient stock for product ${productId}`);
        continue;
      }

      // 2. Deduct from Source
      const { error: deductError } = await supabaseAdmin
        .from("product_stocks")
        .update({ quantity: sourceStock.quantity - quantity })
        .eq("location_id", sourceLocationId)
        .eq("product_id", productId);

      if (deductError) {
        errors.push(`Failed to deduct stock for product ${productId}`);
        continue;
      }

      // 3. Add to Destination
      const { data: destStock, error: destFetchError } = await supabaseAdmin
        .from("product_stocks")
        .select("quantity")
        .eq("location_id", destLocationId)
        .eq("product_id", productId)
        .single();

      // Ignore 'row not found' error
      if (destFetchError && destFetchError.code !== "PGRST116") {
        errors.push(`Error checking destination for product ${productId}`);
        // NOTE: Stock is already deducted! In production, use transaction to rollback.
        continue;
      }

      const currentDestQty = destStock ? destStock.quantity : 0;

      if (destStock) {
        // Update existing record
        await supabaseAdmin
          .from("product_stocks")
          .update({ quantity: currentDestQty + quantity })
          .eq("location_id", destLocationId)
          .eq("product_id", productId);
      } else {
        // Insert new record
        await supabaseAdmin.from("product_stocks").insert({
          location_id: destLocationId,
          product_id: productId,
          quantity: quantity,
        });
      }

      results.push(productId);
    }

    if (errors.length > 0 && results.length === 0) {
      // All failed
      return NextResponse.json({ error: errors.join(", ") }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Transferred ${results.length} items.`,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("Transfer Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
