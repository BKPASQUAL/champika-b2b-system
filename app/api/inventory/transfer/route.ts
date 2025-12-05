import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceLocationId, destLocationId, items, reason, transferDate } =
      body;

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

    // 1. Generate a Transfer Number (Simple timestamp based or Sequence)
    // Ideally use a database sequence, but for simplicity we use a timestamp here
    const transferNo = `TR-${Date.now().toString().slice(-6)}`;

    // 2. Create the Master Transfer Record
    const { data: transferData, error: transferError } = await supabaseAdmin
      .from("stock_transfers")
      .insert({
        transfer_no: transferNo,
        source_location_id: sourceLocationId,
        dest_location_id: destLocationId,
        transfer_date: transferDate || new Date().toISOString(), // Use selected date or today
        reason: reason,
        status: "Completed",
        // created_by: User ID (If you have auth context here, pass it)
      })
      .select()
      .single();

    if (transferError) {
      console.error("Transfer Create Error", transferError);
      return NextResponse.json(
        { error: "Failed to create transfer record" },
        { status: 500 }
      );
    }

    const transferId = transferData.id;
    const results = [];
    const errors = [];

    // 3. Process each item
    for (const item of items) {
      const { productId, quantity } = item;

      if (!productId || quantity <= 0) {
        errors.push(`Invalid data for product ${productId}`);
        continue;
      }

      // --- A. Check Source Stock ---
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

      // --- B. Deduct from Source ---
      const { error: deductError } = await supabaseAdmin
        .from("product_stocks")
        .update({ quantity: sourceStock.quantity - quantity })
        .eq("location_id", sourceLocationId)
        .eq("product_id", productId);

      if (deductError) {
        errors.push(`Failed to deduct stock for product ${productId}`);
        continue;
      }

      // --- C. Add to Destination ---
      const { data: destStock, error: destFetchError } = await supabaseAdmin
        .from("product_stocks")
        .select("quantity")
        .eq("location_id", destLocationId)
        .eq("product_id", productId)
        .single();

      // Ignore 'row not found' (PGRST116) as we will insert if missing
      if (destFetchError && destFetchError.code !== "PGRST116") {
        errors.push(`Error checking destination for product ${productId}`);
        continue;
      }

      const currentDestQty = destStock ? destStock.quantity : 0;

      if (destStock) {
        await supabaseAdmin
          .from("product_stocks")
          .update({ quantity: currentDestQty + quantity })
          .eq("location_id", destLocationId)
          .eq("product_id", productId);
      } else {
        await supabaseAdmin.from("product_stocks").insert({
          location_id: destLocationId,
          product_id: productId,
          quantity: quantity,
        });
      }

      // --- D. Record Item in History Table ---
      await supabaseAdmin.from("stock_transfer_items").insert({
        transfer_id: transferId,
        product_id: productId,
        quantity: quantity,
      });

      results.push(productId);
    }

    if (errors.length > 0 && results.length === 0) {
      // If complete failure, try to delete the master record (optional cleanup)
      await supabaseAdmin.from("stock_transfers").delete().eq("id", transferId);
      return NextResponse.json({ error: errors.join(", ") }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Transferred ${results.length} items successfully.`,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("Transfer API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
