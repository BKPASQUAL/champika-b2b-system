import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

// Schema for creating a load
const createLoadSchema = z.object({
  lorryNumber: z.string().min(1, "Lorry number is required"),
  driverId: z.string().min(1, "Driver is required"), // Assuming this is a profile ID
  helperName: z.string().optional(),
  loadingDate: z.string(),
  orderIds: z.array(z.string()).min(1, "Select at least one order"),
});

export async function GET() {
  try {
    // Fetch orders currently in the 'Loading' stage
    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select(
        `
        id,
        order_id,
        status,
        total_amount,
        created_at,
        customers (
          shop_name,
          route
        )
      `
      )
      .eq("status", "Loading")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Map to frontend format
    const formattedOrders = orders.map((order: any) => ({
      id: order.id,
      orderId: order.order_id,
      shopName: order.customers?.shop_name || "Unknown",
      route: order.customers?.route || "-",
      totalAmount: order.total_amount,
      status: order.status,
    }));

    return NextResponse.json(formattedOrders);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const val = createLoadSchema.parse(body);

    // 1. Generate Load ID (e.g., LOAD-2025-001)
    const { count } = await supabaseAdmin
      .from("loading_sheets")
      .select("*", { count: "exact", head: true });

    const nextId = (count || 0) + 1001;
    const loadIdStr = `LOAD-${new Date().getFullYear()}-${nextId}`;

    // 2. Insert into loading_sheets
    const { data: loadData, error: loadError } = await supabaseAdmin
      .from("loading_sheets")
      .insert({
        load_id: loadIdStr,
        lorry_number: val.lorryNumber,
        driver_id: val.driverId, // Ensure you pass the UUID of the driver/user
        helper_name: val.helperName,
        loading_date: val.loadingDate,
        status: "In Transit",
      })
      .select()
      .single();

    if (loadError) throw loadError;

    // 3. Update Orders (Link to Load & Update Status)
    // We update the status to 'Delivered' (assuming dispatching counts as process complete for warehouse)
    // OR keep it 'Loading' if you track transit separately.
    // Here we assume moving to 'Delivered' marks it as dispatched.
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        load_id: loadData.id,
        status: "Delivered", // Or 'In Transit' if you added that enum value
      })
      .in("id", val.orderIds);

    if (updateError) throw updateError;

    return NextResponse.json(
      { message: "Load sheet created successfully", loadId: loadIdStr },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Load creation failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
