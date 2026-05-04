import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const businessId = searchParams.get("businessId"); // Get businessId from params

    const sortByParam = searchParams.get("sortBy") || "created_at";
    const sortOrderParam = searchParams.get("sortOrder") || "desc";
    const ascending = sortOrderParam === "asc";

    const DB_SORT_COLUMN: Record<string, string> = {
      date: "order_date",
      invoiceNo: "invoice_no",
      totalAmount: "total_amount",
      status: "status",
      created_at: "created_at",
    };
    const dbSortColumn = DB_SORT_COLUMN[sortByParam] ?? "created_at";

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
          invoice_no,
          paid_amount,
          due_amount,
          total_amount
        ),
        order_items (
          id
        )
      `
      )
      .order(dbSortColumn, { ascending });

    // Apply Status Filter if provided
    if (status) {
      query = query.filter("status::text", "eq", status);
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

      const invoice = order.invoices?.[0];
      const invoicePaidAmount = invoice?.paid_amount ?? 0;
      const invoiceTotalAmount = invoice?.total_amount ?? order.total_amount ?? 0;
      const invoiceDueAmount = invoice?.due_amount ?? (invoiceTotalAmount - invoicePaidAmount);

      return {
        id: order.id,
        orderId: order.order_id,
        invoiceNo: invoiceNumber, // Mapped Invoice Number
        customerId: order.customer_id,
        customerName: order.customers?.owner_name || "Unknown",
        shopName: order.customers?.shop_name || "Unknown Shop",
        date: order.order_date,
        totalAmount: invoiceTotalAmount,
        paidAmount: invoicePaidAmount,
        dueAmount: invoiceDueAmount,
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
