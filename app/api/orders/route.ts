import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const businessId = searchParams.get("businessId"); // Get businessId from params

    let query = supabaseAdmin
      .from("orders")
      .select(
        `
        *,
        customers (
          shop_name,
          owner_name
        ),
        profiles!orders_sales_rep_id_fkey (
          full_name
        ),
        invoices (
          status,
          invoice_no
        ),
        order_items (
          id
        )
      `
      )
      .order("created_at", { ascending: false });

    // Apply Status Filter if provided
    if (status) {
      query = query.eq("status", status);
    }

    // Apply Business Filter if provided
    if (businessId) {
      query = query.eq("business_id", businessId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Map to Frontend Order Interface
    const formattedOrders = data.map((order: any) => {
      // Get payment status and invoice number from the related invoice
      const paymentStatus = order.invoices?.[0]?.status || "Unpaid";
      // Priority: Invoice table > Order table > Placeholder
      const invoiceNumber =
        order.invoices?.[0]?.invoice_no || order.invoice_no || "N/A";

      const repName = order.profiles?.full_name || "Unknown";
      const itemsCount = order.order_items?.length || 0;

      return {
        id: order.id,
        orderId: order.order_id,
        invoiceNo: invoiceNumber, // Mapped Invoice Number
        customerName: order.customers?.owner_name || "Unknown",
        shopName: order.customers?.shop_name || "Unknown Shop",
        date: order.order_date,
        totalAmount: order.total_amount,
        itemCount: itemsCount,
        status: order.status,
        paymentStatus: paymentStatus,
        salesRep: repName,
      };
    });

    return NextResponse.json(formattedOrders);
  } catch (error: any) {
    console.error("Error fetching orders:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
