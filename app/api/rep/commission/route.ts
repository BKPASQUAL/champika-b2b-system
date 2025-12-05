import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const repId = searchParams.get("repId");

  if (!repId) {
    return NextResponse.json({ error: "Rep ID required" }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("rep_commissions")
      .select(
        `
        id,
        total_commission_amount,
        status,
        created_at,
        orders (
          order_id,
          total_amount,
          customers (
            shop_name
          )
        )
      `
      )
      .eq("rep_id", repId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const formattedData = data.map((item: any) => ({
      id: item.id,
      orderRef: item.orders?.order_id || "N/A",
      shopName: item.orders?.customers?.shop_name || "Unknown",
      orderTotal: item.orders?.total_amount || 0,
      commission: item.total_commission_amount,
      status: item.status,
      date: item.created_at,
    }));

    return NextResponse.json(formattedData);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
