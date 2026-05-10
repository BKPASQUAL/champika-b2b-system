import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    let query = supabaseAdmin
      .from("loading_sheets")
      .select(`
        id,
        load_id,
        lorry_number,
        driver_id,
        helper_name,
        loading_date,
        status,
        profiles!loading_sheets_driver_id_fkey (full_name)
      `)
      .filter("status::text", "eq", "Draft")
      .order("created_at", { ascending: false });

    if (businessId) {
      query = query.eq("business_id", businessId);
    }

    const { data: groups, error } = await query;
    if (error) throw error;

    const groupIds = (groups ?? []).map((g: any) => g.id);

    let ordersMap: Record<string, any[]> = {};
    if (groupIds.length > 0) {
      const { data: orders, error: ordErr } = await supabaseAdmin
        .from("orders")
        .select(`
          id,
          order_id,
          invoice_no,
          total_amount,
          load_id,
          status,
          customers (shop_name),
          invoices (invoice_no)
        `)
        .in("load_id", groupIds);

      if (ordErr) throw ordErr;

      // Auto-clear load_id for any orders that drifted back to Pending
      const staleIds = (orders ?? []).filter((o: any) => o.status === "Pending").map((o: any) => o.id);
      if (staleIds.length > 0) {
        await supabaseAdmin.from("orders").update({ load_id: null }).in("id", staleIds);
      }

      for (const o of (orders ?? []).filter((o: any) => o.status !== "Pending")) {
        const key = o.load_id;
        if (!ordersMap[key]) ordersMap[key] = [];
        ordersMap[key].push({
          id: o.id,
          orderId: o.order_id,
          invoiceNo: o.invoices?.[0]?.invoice_no || o.invoice_no || "N/A",
          shopName: (o.customers as any)?.[0]?.shop_name ?? (o.customers as any)?.shop_name ?? "Unknown",
          totalAmount: o.total_amount,
          status: o.status,
        });
      }
    }

    const result = (groups ?? []).map((g: any) => ({
      id: g.id,
      loadId: g.load_id,
      lorryNumber: g.lorry_number,
      driverId: g.driver_id,
      driverName: g.profiles?.full_name || "Unknown",
      helperName: g.helper_name || "",
      orders: ordersMap[g.id] ?? [],
      totalAmount: (ordersMap[g.id] ?? []).reduce(
        (sum: number, o: any) => sum + (o.totalAmount || 0),
        0
      ),
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("GET /api/loading-groups error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lorryNumber, driverId, helperName, orderIds, businessId } = body;

    if (!lorryNumber || !orderIds?.length) {
      return NextResponse.json(
        { error: "lorryNumber and orderIds are required" },
        { status: 400 }
      );
    }

    const { count } = await supabaseAdmin
      .from("loading_sheets")
      .select("*", { count: "exact", head: true });

    const nextId = (count || 0) + 1001;
    const loadIdStr = `LOAD-${new Date().getFullYear()}-${nextId}`;

    const { data: sheet, error: sheetErr } = await supabaseAdmin
      .from("loading_sheets")
      .insert({
        load_id: loadIdStr,
        lorry_number: lorryNumber,
        driver_id: driverId || null,
        helper_name: helperName || null,
        loading_date: new Date().toISOString().split("T")[0],
        status: "Draft",
        ...(businessId ? { business_id: businessId } : {}),
      })
      .select()
      .single();

    if (sheetErr) throw sheetErr;

    const { error: ordErr } = await supabaseAdmin
      .from("orders")
      .update({ load_id: sheet.id })
      .in("id", orderIds);

    if (ordErr) throw ordErr;

    return NextResponse.json(
      { id: sheet.id, loadId: loadIdStr },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/loading-groups error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
