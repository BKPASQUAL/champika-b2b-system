import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { locationId, reason = "Bulk reconciliation of negative stock to zero" } = body;

    // Build query to select all negative stocks
    let query = supabaseAdmin
      .from("product_stocks")
      .select("id, location_id, product_id, quantity")
      .lt("quantity", 0);

    if (locationId) {
      query = query.eq("location_id", locationId);
    }

    const { data: negativeStocks, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching negative stocks:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch negative stock records" },
        { status: 500 }
      );
    }

    if (!negativeStocks || negativeStocks.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: "No negative stock records found to reconcile.",
      });
    }

    const now = new Date().toISOString();
    let reconciledCount = 0;

    for (const stock of negativeStocks) {
      // 1. Reset stock to 0
      const { error: updateError } = await supabaseAdmin
        .from("product_stocks")
        .update({ quantity: 0, last_updated: now })
        .eq("id", stock.id);

      if (updateError) {
        console.error(`Error resetting stock ID ${stock.id}:`, updateError);
        continue;
      }

      reconciledCount++;

      // 2. Audit log entry
      await supabaseAdmin.from("audit_logs").insert({
        table_name: "product_stocks",
        record_id: stock.product_id,
        action: "RECONCILE_NEGATIVE_TO_ZERO",
        old_data: { quantity: stock.quantity, location_id: stock.location_id },
        new_data: {
          quantity: 0,
          location_id: stock.location_id,
          reason,
        },
        changed_at: now,
      });
    }

    return NextResponse.json({
      success: true,
      count: reconciledCount,
      message: `Successfully reconciled ${reconciledCount} negative stock items to 0.`,
    });
  } catch (error: any) {
    console.error("Reconcile Negative Stock Error:", error);
    return NextResponse.json(
      { error: error.message || "Server error during reconciliation" },
      { status: 500 }
    );
  }
}
