import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

// Validation Schema
const createLoadSchema = z.object({
  lorryNumber: z.string().min(1, "Lorry number is required"),
  driverId: z.string().min(1, "Driver (Responsible Person) is required"), // Matches frontend
  helperName: z.string().optional().or(z.literal("")),
  date: z.string(), // Matches frontend 'date'
  orderIds: z.array(z.string()).min(1, "Select at least one order"),
});

export async function GET() {
  try {
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

    // Validate payload
    const val = createLoadSchema.parse(body);

    // Generate Load ID
    const { count } = await supabaseAdmin
      .from("loading_sheets")
      .select("*", { count: "exact", head: true });

    const nextId = (count || 0) + 1001;
    const loadIdStr = `LOAD-${new Date().getFullYear()}-${nextId}`;

    // Insert Loading Sheet
    const { data: loadData, error: loadError } = await supabaseAdmin
      .from("loading_sheets")
      .insert({
        load_id: loadIdStr,
        lorry_number: val.lorryNumber,
        driver_id: val.driverId,
        helper_name: val.helperName,
        loading_date: val.date,
        status: "In Transit",
      })
      .select()
      .single();

    if (loadError) throw loadError;

    // Update Orders
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        load_id: loadData.id,
        status: "Delivered",
      })
      .in("id", val.orderIds);

    if (updateError) throw updateError;

    return NextResponse.json(
      { message: "Load sheet created successfully", loadId: loadIdStr },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Load Creation Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation Error", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
