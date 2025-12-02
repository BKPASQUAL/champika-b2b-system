// app/api/orders/loading/history/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

const updateLoadingSheetSchema = z.object({
  lorryNumber: z.string().min(1, "Lorry number is required").optional(),
  driverId: z.string().min(1, "Driver is required").optional(),
  helperName: z.string().optional().or(z.literal("")),
  loadingDate: z.string().optional(),
  status: z.enum(["In Transit", "Completed"]).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // 1. Fetch Loading Sheet & Orders
    const { data: loadingSheet, error } = await supabaseAdmin
      .from("loading_sheets")
      .select(
        `
        id,
        load_id,
        lorry_number,
        driver_id,
        helper_name,
        loading_date,
        status,
        created_at,
        profiles!loading_sheets_driver_id_fkey (
          id,
          full_name,
          email,
          phone_number
        ),
        orders (
          id,
          order_id,
          invoice_no,
          total_amount,
          status,
          created_at,
          customers (
            shop_name,
            owner_name,
            phone,
            address,
            route
          ),
          profiles!orders_sales_rep_id_fkey (
            full_name
          ),
          order_items (
            id,
            quantity,
            free_quantity,
            products (
              name,
              sku
            )
          )
        )
      `
      )
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!loadingSheet) {
      return NextResponse.json(
        { error: "Loading sheet not found" },
        { status: 404 }
      );
    }

    const driverProfile = Array.isArray(loadingSheet.profiles)
      ? loadingSheet.profiles[0]
      : loadingSheet.profiles;

    const orderIds = loadingSheet.orders?.map((o: any) => o.id) || [];

    // 2. Fetch Invoices & History
    let invoicesMap: Record<
      string,
      { id: string; invoice_no: string; original_amount?: number }
    > = {};

    if (orderIds.length > 0) {
      // A. Get Invoices
      const { data: invoices, error: invoiceError } = await supabaseAdmin
        .from("invoices")
        .select("id, invoice_no, order_id, total_amount")
        .in("order_id", orderIds);

      if (!invoiceError && invoices) {
        const invoiceIds = invoices.map((inv) => inv.id);

        // B. Get History for these invoices to find "Original" amount
        const { data: history } = await supabaseAdmin
          .from("invoice_history")
          .select("invoice_id, previous_data, changed_at")
          .in("invoice_id", invoiceIds)
          .order("changed_at", { ascending: true }); // Oldest first

        invoices.forEach((inv: any) => {
          let originalAmount = inv.total_amount;

          // If there's history, the *first* recorded 'previous_data.total_amount'
          // is likely what it was before reconciliation edits.
          if (history) {
            const invHistory = history.find((h) => h.invoice_id === inv.id);
            if (invHistory && invHistory.previous_data?.total_amount) {
              originalAmount = invHistory.previous_data.total_amount;
            }
          }

          invoicesMap[inv.order_id] = {
            id: inv.id,
            invoice_no: inv.invoice_no,
            original_amount: originalAmount,
          };
        });
      }
    }

    // 3. Format Response
    const formattedResponse = {
      id: loadingSheet.id,
      loadId: loadingSheet.load_id,
      lorryNumber: loadingSheet.lorry_number,
      driverId: loadingSheet.driver_id,
      driverName: driverProfile?.full_name || "Unknown",
      driverEmail: driverProfile?.email || "",
      driverPhone: driverProfile?.phone_number || "",
      helperName: loadingSheet.helper_name || "",
      loadingDate: loadingSheet.loading_date,
      status: loadingSheet.status,
      createdAt: loadingSheet.created_at,

      totalOrders: loadingSheet.orders?.length || 0,
      totalAmount:
        loadingSheet.orders?.reduce(
          (sum: number, order: any) => sum + (order.total_amount || 0),
          0
        ) || 0,
      totalItems:
        loadingSheet.orders?.reduce(
          (sum: number, order: any) =>
            sum +
            (order.order_items?.reduce(
              (itemSum: number, item: any) =>
                itemSum + item.quantity + item.free_quantity,
              0
            ) || 0),
          0
        ) || 0,

      orders:
        loadingSheet.orders?.map((order: any) => {
          const salesRepProfile = Array.isArray(order.profiles)
            ? order.profiles[0]
            : order.profiles;

          const invoiceDetails = invoicesMap[order.id];
          const currentTotal = order.total_amount || 0;
          const originalTotal = invoiceDetails?.original_amount ?? currentTotal;

          return {
            id: order.id,
            orderId: order.order_id,
            invoiceId: invoiceDetails?.id || null,
            invoiceNo: invoiceDetails?.invoice_no || order.invoice_no || "N/A",

            // Amount Logic
            totalAmount: currentTotal, // Final/Current Amount
            originalAmount: originalTotal, // Amount at Dispatch
            isModified: currentTotal !== originalTotal,

            status: order.status,
            createdAt: order.created_at,
            customer: {
              shopName: order.customers?.shop_name || "Unknown",
              ownerName: order.customers?.owner_name || "",
              phone: order.customers?.phone || "",
              address: order.customers?.address || "",
              route: order.customers?.route || "",
            },
            salesRep: {
              name: salesRepProfile?.full_name || "Not Assigned",
            },
            items:
              order.order_items?.map((item: any) => ({
                id: item.id,
                quantity: item.quantity,
                freeQuantity: item.free_quantity,
                productName: item.products?.name || "Unknown Product",
                sku: item.products?.sku || "",
              })) || [],
          };
        }) || [],
    };

    return NextResponse.json(formattedResponse);
  } catch (error: any) {
    console.error("Error fetching loading sheet details:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const validatedData = updateLoadingSheetSchema.parse(body);
    const updateData: any = {};
    if (validatedData.lorryNumber)
      updateData.lorry_number = validatedData.lorryNumber;
    if (validatedData.driverId) updateData.driver_id = validatedData.driverId;
    if (validatedData.helperName !== undefined)
      updateData.helper_name = validatedData.helperName;
    if (validatedData.loadingDate)
      updateData.loading_date = validatedData.loadingDate;
    if (validatedData.status) updateData.status = validatedData.status;

    const { data, error } = await supabaseAdmin
      .from("loading_sheets")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({
      message: "Loading sheet updated successfully",
      data,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
