import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Fetch Order with all relations
    // UPDATED: Added 'images' to the products selection
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(
        `
        *,
        customers (
          shop_name,
          owner_name,
          phone,
          route,
          address
        ),
        profiles!orders_sales_rep_id_fkey (
          full_name
        ),
        invoices (
          status
        ),
        order_items (
          id,
          quantity,
          free_quantity,
          unit_price,
          total_price,
          products (
            sku,
            name,
            unit_of_measure,
            images
          )
        )
      `
      )
      .eq("id", id)
      .single();

    if (error) throw error;

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Map DB structure to Frontend structure
    const response = {
      id: order.id,
      orderId: order.order_id,
      date: order.order_date,
      status: order.status,
      paymentStatus: order.invoices?.[0]?.status || "Unpaid",
      salesRep: order.profiles?.full_name || "Unknown",

      // Customer Details
      customer: {
        name: order.customers?.owner_name,
        shopName: order.customers?.shop_name,
        phone: order.customers?.phone,
        route: order.customers?.route,
        address: order.customers?.address,
      },

      // Items
      items: order.order_items.map((item: any) => ({
        id: item.id,
        sku: item.products?.sku,
        name: item.products?.name,
        unit: item.products?.unit_of_measure || "unit",
        // UPDATED: Map the first image from the array if it exists
        image: item.products?.images?.[0] || null,
        price: item.unit_price,
        qty: item.quantity,
        free: item.free_quantity,
        disc: 0, // Default to 0 since column is missing in DB
        total: item.total_price,
      })),

      // Total
      totalAmount: order.total_amount,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Error fetching order:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH: Approve or Reject Order
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      );
    }

    // Update Order Status
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ status })
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ message: "Order updated successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
