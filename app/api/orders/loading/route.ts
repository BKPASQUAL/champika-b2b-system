// app/api/orders/loading/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Validation Schema
const createLoadSchema = z.object({
  lorryNumber: z.string().min(1, "Lorry number is required"),
  driverId: z.string().min(1, "Driver (Responsible Person) is required"),
  helperName: z.string().optional().or(z.literal("")),
  date: z.string(),
  orderIds: z.array(z.string()).min(1, "Select at least one order"),
  userId: z.string().optional(),
});


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    let query = supabaseAdmin
      .from("orders")
      .select(
        `
        id,
        order_id,
        invoice_no,
        status,
        total_amount,
        order_date,
        notes,
        customers (
          shop_name,
          route
        ),
        profiles!orders_sales_rep_id_fkey (
          full_name
        ),
        invoices (
          id,
          invoice_no,
          status
        )
      `
      )
    const statusParam = searchParams.get("status");
    if (statusParam) {
      const statuses = statusParam.split(",").map((s) => s.trim()).filter(Boolean);
      query = query.in("status", statuses);
    } else {
      query = query.in("status", ["Loading", "Checking"]);
    }

    // ✅ Filter by Business ID if provided
    if (businessId) {
      query = query.eq("business_id", businessId);
    }

    const { data: orders, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) throw error;

    // Filter out cancelled orders and pending cancellation requests
    const formattedOrders = (orders ?? [])
      .filter((order: any) => !order.notes?.includes("[CANCEL_REQUEST:"))
      .map((order: any) => ({
        id: order.id,
        orderId: order.order_id,
        invoiceId: order.invoices?.[0]?.id || null,
        invoiceNo: order.invoices?.[0]?.invoice_no || order.invoice_no || null,
        shopName: order.customers?.shop_name || "Unknown",
        route: order.customers?.route || "-",
        salesRepName: order.profiles?.full_name || "Unknown",
        totalAmount: order.total_amount,
        status: order.status,
        date: order.order_date,
      }));

    return NextResponse.json(formattedOrders);
  } catch (error: any) {
    console.error("GET /api/orders/loading error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate payload
    const val = createLoadSchema.parse(body);

    // Generate Load ID - derive from the highest existing suffix for this year
    // rather than a row count, since count can drop below a number already in
    // use once loading_sheets rows can be deleted (empty folders auto-remove).
    const year = new Date().getFullYear();
    const prefix = `LOAD-${year}-`;

    const { data: existingSheets } = await supabaseAdmin
      .from("loading_sheets")
      .select("load_id")
      .ilike("load_id", `${prefix}%`);

    const maxSuffix = (existingSheets ?? []).reduce((max: number, s: any) => {
      const n = parseInt(String(s.load_id).slice(prefix.length), 10);
      return Number.isFinite(n) && n > max ? n : max;
    }, 1000);

    let nextId = maxSuffix + 1;
    let loadData: any = null;
    let loadError: any = null;

    // Insert Loading Sheet (retry with the next number on a rare id collision)
    for (let attempt = 0; attempt < 5; attempt++) {
      const loadIdStr = `${prefix}${nextId}`;
      const res = await supabaseAdmin
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

      if (!res.error) {
        loadData = res.data;
        loadError = null;
        break;
      }

      if (res.error.code === "23505") {
        nextId += 1;
        loadError = res.error;
        continue;
      }

      loadError = res.error;
      break;
    }

    if (loadError || !loadData) throw loadError ?? new Error("Failed to create loading sheet");

    // Fetch previous statuses & associated invoices before updating
    const { data: previousOrders } = await supabaseAdmin
      .from("orders")
      .select("id, status")
      .in("id", val.orderIds);

    const { data: invoices } = await supabaseAdmin
      .from("invoices")
      .select("id, order_id")
      .in("order_id", val.orderIds);

    // Update Orders
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        load_id: loadData.id,
        status: "In Transit",
      })
      .in("id", val.orderIds);

    if (updateError) throw updateError;

    // Log status transitions to invoice_history
    if (invoices && previousOrders) {
      const cookieStore = await cookies();
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            },
          },
        }
      );
      const { data: { user } } = await supabase.auth.getUser();
      const activeUserId = user?.id || val.userId || null;

      for (const inv of invoices) {
        const prevOrder = previousOrders.find((o) => o.id === inv.order_id);
        const prevStatus = prevOrder ? prevOrder.status : "Pending";
        if (prevStatus !== "In Transit") {
          await supabaseAdmin.from("invoice_history").insert({
            invoice_id: inv.id,
            previous_data: {
              status: prevStatus,
              new_status: "In Transit",
            },
            changed_by: activeUserId,
            change_reason: `Assigned to loading sheet ${loadData.load_id} and status set to In Transit`,
            changed_at: new Date().toISOString(),
          });
        }
      }
    }

    return NextResponse.json(
      { message: "Load sheet created successfully", loadId: loadData.load_id },
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
