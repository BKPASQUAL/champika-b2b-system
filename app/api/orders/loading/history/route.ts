// app/api/orders/loading/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    // Start Query
    let query = supabaseAdmin
      .from("loading_sheets")
      .select(
        `
        id,
        load_id,
        lorry_number,
        helper_name,
        loading_date,
        status,
        created_at,
        profiles!loading_sheets_driver_id_fkey (
          full_name
        ),
        orders!inner (
          id,
          order_id,
          total_amount,
          business_id
        )
      `
      )
      .order("loading_date", { ascending: false })
      .order("created_at", { ascending: false });

    // ✅ Filter by Business ID (via the inner join on orders)
    if (businessId) {
      query = query.eq("orders.business_id", businessId);
    }

    const { data: loadingSheets, error } = await query;

    if (error) throw error;

    // Format the response
    const formattedHistory = loadingSheets.map((sheet: any) => ({
      id: sheet.id,
      loadId: sheet.load_id,
      loadingDate: sheet.loading_date,
      lorryNumber: sheet.lorry_number,
      driverName: sheet.profiles?.full_name || "Unknown",
      helperName: sheet.helper_name || "",
      status: sheet.status,
      totalOrders: sheet.orders?.length || 0,
      totalAmount:
        sheet.orders?.reduce(
          (sum: number, order: any) => sum + (order.total_amount || 0),
          0
        ) || 0,
      orderIds: sheet.orders?.map((o: any) => o.order_id) || [],
      createdAt: sheet.created_at,
    }));

    return NextResponse.json(formattedHistory);
  } catch (error: any) {
    console.error("Error fetching loading history:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
