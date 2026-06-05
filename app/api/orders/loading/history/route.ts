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
          invoice_no,
          total_amount,
          business_id
        )
      `
      )
      .order("created_at", { ascending: false });

    // ✅ Filter by Business ID (via the inner join on orders)
    if (businessId) {
      query = query.eq("orders.business_id", businessId);
    }

    const { data: loadingSheets, error } = await query;

    if (error) throw error;

    // A. Gather all order IDs across all fetched sheets
    const orderIds = loadingSheets?.flatMap((sheet: any) => sheet.orders?.map((o: any) => o.id) || []) || [];

    // B. Query matching invoices to retrieve their database IDs
    let invoicesMap: Record<string, { id: string; invoice_no: string }> = {};
    if (orderIds.length > 0) {
      const { data: invoices, error: invoiceError } = await supabaseAdmin
        .from("invoices")
        .select("id, invoice_no, order_id")
        .in("order_id", orderIds);

      if (!invoiceError && invoices) {
        invoices.forEach((inv: any) => {
          invoicesMap[inv.order_id] = {
            id: inv.id,
            invoice_no: inv.invoice_no,
          };
        });
      }
    }

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
      orders: sheet.orders?.map((o: any) => ({
        id: o.id,
        orderId: o.order_id,
        invoiceId: invoicesMap[o.id]?.id || null,
        invoiceNo: invoicesMap[o.id]?.invoice_no || o.invoice_no || null,
        totalAmount: o.total_amount || 0,
      })) || [],
      createdAt: sheet.created_at,
    }));

    return NextResponse.json(formattedHistory);
  } catch (error: any) {
    console.error("Error fetching loading history:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
