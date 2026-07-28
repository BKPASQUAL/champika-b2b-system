import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    const RE_DISPATCH_STATUSES = ["Processing", "Checking", "Loading"];

    // Fetch Draft sheets (for active loading groups)
    let draftQuery = supabaseAdmin
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
      draftQuery = draftQuery.eq("business_id", businessId);
    }

    const { data: draftGroups, error } = await draftQuery;
    if (error) throw error;

    // Also fetch Completed sheets that still have re-dispatch orders (lorry memory)
    let completedQuery = supabaseAdmin
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
      .filter("status::text", "eq", "Completed")
      .order("created_at", { ascending: false });

    if (businessId) {
      completedQuery = completedQuery.eq("business_id", businessId);
    }

    const { data: completedGroups } = await completedQuery;

    const groups = draftGroups ?? [];
    const allGroupIds = [
      ...(draftGroups ?? []).map((g: any) => g.id),
      ...(completedGroups ?? []).map((g: any) => g.id),
    ];

    let ordersMap: Record<string, any[]> = {};
    if (allGroupIds.length > 0) {
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
          invoices (invoice_no, status)
        `)
        .in("load_id", allGroupIds);

      if (ordErr) throw ordErr;

      // Auto-clear load_id for any orders that drifted back to Pending
      const staleIds = (orders ?? []).filter((o: any) => o.status === "Pending").map((o: any) => o.id);
      if (staleIds.length > 0) {
        await supabaseAdmin.from("orders").update({ load_id: null }).in("id", staleIds);
      }

      for (const o of (orders ?? []).filter((o: any) => o.status !== "Pending" && o.status !== "Cancelled")) {
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

    // Build result from Draft groups (shown as active loading groups)
    // Also add completed groups that still have re-dispatch orders (for lorry memory in lorryMap)
    const completedWithReDispatch = (completedGroups ?? []).filter(
      (g: any) => (ordersMap[g.id] ?? []).some((o: any) => RE_DISPATCH_STATUSES.includes(o.status))
    );

    // Folders (Draft sheets with no lorry assigned) that ended up with zero
    // orders (all removed/reassigned) are stale - delete them outright.
    const emptyFolderIds = (groups ?? [])
      .filter((g: any) => !g.lorry_number && (ordersMap[g.id] ?? []).length === 0)
      .map((g: any) => g.id);

    if (emptyFolderIds.length > 0) {
      await supabaseAdmin.from("loading_sheets").delete().in("id", emptyFolderIds);
    }

    // Remaining folders auto-disappear once every order inside them has been
    // Delivered - there's nothing left to act on.
    const activeDraftGroups = (groups ?? []).filter((g: any) => {
      if (emptyFolderIds.includes(g.id)) return false;
      if (g.lorry_number) return true;
      const groupOrders = ordersMap[g.id] ?? [];
      return !groupOrders.every((o: any) => o.status === "Delivered");
    });

    const result = [
      ...activeDraftGroups.map((g: any) => ({
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
      })),
      ...completedWithReDispatch.map((g: any) => ({
        id: g.id,
        loadId: g.load_id,
        lorryNumber: g.lorry_number,
        driverId: g.driver_id,
        driverName: g.profiles?.full_name || "Unknown",
        helperName: g.helper_name || "",
        orders: (ordersMap[g.id] ?? []).filter((o: any) => RE_DISPATCH_STATUSES.includes(o.status)),
        totalAmount: (ordersMap[g.id] ?? [])
          .filter((o: any) => RE_DISPATCH_STATUSES.includes(o.status))
          .reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0),
      })),
    ];

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

    if (!orderIds?.length) {
      return NextResponse.json(
        { error: "orderIds are required" },
        { status: 400 }
      );
    }

    // Derive the next number from the highest existing load_id suffix for this
    // year - a plain row count breaks once rows can be deleted (empty folders
    // are auto-removed), since count can drop below a number already in use.
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
    let sheet: any = null;
    let sheetErr: any = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const loadIdStr = `${prefix}${nextId}`;
      const res = await supabaseAdmin
        .from("loading_sheets")
        .insert({
          load_id: loadIdStr,
          lorry_number: lorryNumber || null,
          driver_id: driverId || null,
          helper_name: helperName || null,
          loading_date: new Date().toISOString().split("T")[0],
          status: "Draft",
          ...(businessId ? { business_id: businessId } : {}),
        })
        .select()
        .single();

      if (!res.error) {
        sheet = res.data;
        sheetErr = null;
        break;
      }

      if (res.error.code === "23505") {
        nextId += 1;
        sheetErr = res.error;
        continue;
      }

      sheetErr = res.error;
      break;
    }

    if (sheetErr || !sheet) throw sheetErr ?? new Error("Failed to create loading sheet");

    const { error: ordErr } = await supabaseAdmin
      .from("orders")
      .update({ load_id: sheet.id })
      .in("id", orderIds);

    if (ordErr) throw ordErr;

    return NextResponse.json(
      { id: sheet.id, loadId: sheet.load_id },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/loading-groups error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
