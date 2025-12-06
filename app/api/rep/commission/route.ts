import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const repId = searchParams.get("repId");

  if (!repId) {
    return NextResponse.json({ error: "Rep ID required" }, { status: 400 });
  }

  try {
    // We fetch from 'orders' to ensure we can filter by Order Status (Delivered/Completed)
    // and calculate commissions dynamically from the latest order items (handling edits).
    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select(
        `
        id,
        order_id,
        total_amount,
        status,
        created_at,
        sales_rep_id,
        customers (
          shop_name
        ),
        order_items (
          commission_earned
        ),
        rep_commissions (
          status
        )
      `
      )
      .eq("sales_rep_id", repId)
      .in("status", ["Delivered", "Completed"]) // Only show commission for finalized orders
      .order("created_at", { ascending: false });

    if (error) throw error;

    const formattedData = orders.map((order: any) => {
      // Dynamic Calculation: Sum commission from current order items
      // This ensures that if an order was edited, the commission updates automatically.
      const totalCommission = order.order_items?.reduce(
        (sum: number, item: any) => sum + (Number(item.commission_earned) || 0),
        0
      );

      // Status Check: Check if a payout record exists and is marked as Paid
      // Defaults to 'Pending' if no payout record exists yet.
      const payoutStatus = order.rep_commissions?.[0]?.status || "Pending";

      return {
        id: order.id,
        orderRef: order.order_id || "N/A",
        shopName: order.customers?.shop_name || "Unknown",
        orderTotal: order.total_amount || 0,
        commission: totalCommission,
        status: payoutStatus,
        date: order.created_at,
      };
    });

    return NextResponse.json(formattedData);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
