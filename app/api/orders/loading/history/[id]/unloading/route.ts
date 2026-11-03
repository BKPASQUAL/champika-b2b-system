// GET: what went onto the lorry for each order on a load, and what each
// invoice has now. Used by the Unloading Report on the Reconcile page.
//
// "Loaded" = the invoice items at the moment the order was assigned to this
// loading sheet. If the invoice was edited after that, the items saved just
// before the first such edit are the loaded items. Edits made before loading
// don't count.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

interface Line {
  productId: string;
  quantity: number; // paid + free
}

const sumByProduct = (rows: any[]): Line[] => {
  const map = new Map<string, number>();
  (rows || []).forEach((r: any) => {
    if (!r?.product_id) return;
    const qty = (Number(r.quantity) || 0) + (Number(r.free_quantity) || 0);
    map.set(r.product_id, (map.get(r.product_id) || 0) + qty);
  });
  return Array.from(map, ([productId, quantity]) => ({ productId, quantity }));
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: sheet, error } = await supabaseAdmin
      .from("loading_sheets")
      .select(
        `id, load_id, lorry_number, helper_name, loading_date, dispatched_at, created_at, status,
         profiles!loading_sheets_driver_id_fkey (full_name),
         orders (id, order_id, invoice_no, status, notes,
           customers (shop_name),
           order_items (product_id, quantity, free_quantity))`
      )
      .eq("id", id)
      .single();

    if (error || !sheet) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    const orders: any[] = (sheet as any).orders || [];
    const orderIds = orders.map((o) => o.id);

    // Invoices + their history (oldest first)
    const { data: invoices = [] } = orderIds.length
      ? await supabaseAdmin
          .from("invoices")
          .select("id, order_id, invoice_no, manual_invoice_no")
          .in("order_id", orderIds)
      : { data: [] as any[] };

    const invoiceByOrder = new Map<string, any>();
    (invoices || []).forEach((inv: any) => invoiceByOrder.set(inv.order_id, inv));

    const invoiceIds = (invoices || []).map((i: any) => i.id);
    const { data: history = [] } = invoiceIds.length
      ? await supabaseAdmin
          .from("invoice_history")
          .select("invoice_id, change_reason, changed_at, previous_data")
          .in("invoice_id", invoiceIds)
          .order("changed_at", { ascending: true })
      : { data: [] as any[] };

    const historyByInvoice = new Map<string, any[]>();
    (history || []).forEach((h: any) => {
      if (!historyByInvoice.has(h.invoice_id)) historyByInvoice.set(h.invoice_id, []);
      historyByInvoice.get(h.invoice_id)!.push(h);
    });

    const sheetStart = (sheet as any).dispatched_at || (sheet as any).created_at;
    const loadTag = String((sheet as any).load_id || "").toLowerCase();

    const result = orders.map((o) => {
      const inv = invoiceByOrder.get(o.id);
      const current = sumByProduct(o.order_items);
      let loaded = current;
      let editedAfterLoading = false;

      if (inv) {
        const hist = historyByInvoice.get(inv.id) || [];
        // When this order went onto this lorry
        const assigned = hist.find(
          (h) =>
            String(h.change_reason || "").toLowerCase().includes("loading sheet") &&
            (!loadTag || String(h.change_reason || "").toLowerCase().includes(loadTag))
        );
        const loadedAt = assigned?.changed_at || sheetStart;
        // First real edit (has items) after loading
        const firstEdit = hist.find(
          (h) =>
            h.changed_at > loadedAt &&
            Array.isArray(h.previous_data?.items) &&
            h.previous_data?.total_amount != null
        );
        if (firstEdit) {
          loaded = sumByProduct(firstEdit.previous_data.items);
          editedAfterLoading = true;
        }
      }

      const customer = Array.isArray(o.customers) ? o.customers[0] : o.customers;
      return {
        orderId: o.id,
        orderNo: o.order_id,
        invoiceNo: inv?.manual_invoice_no || inv?.invoice_no || o.invoice_no || "N/A",
        customer: customer?.shop_name || "Unknown",
        status: o.status,
        editedAfterLoading,
        loaded,
        current,
      };
    });

    // Product names
    const productIds = Array.from(
      new Set(result.flatMap((r) => [...r.loaded, ...r.current].map((l) => l.productId)))
    );
    const { data: products = [] } = productIds.length
      ? await supabaseAdmin
          .from("products")
          .select("id, name, sku, unit_of_measure")
          .in("id", productIds)
      : { data: [] as any[] };

    const productMap: Record<string, { name: string; sku: string; unit: string }> = {};
    (products || []).forEach((p: any) => {
      productMap[p.id] = { name: p.name, sku: p.sku || "", unit: p.unit_of_measure || "Pcs" };
    });

    const driver: any = Array.isArray((sheet as any).profiles)
      ? (sheet as any).profiles[0]
      : (sheet as any).profiles;

    return NextResponse.json({
      load: {
        id: sheet.id,
        loadId: (sheet as any).load_id,
        lorryNumber: (sheet as any).lorry_number,
        driverName: driver?.full_name || "",
        helperName: (sheet as any).helper_name || "",
        loadingDate: (sheet as any).loading_date,
        status: (sheet as any).status,
      },
      products: productMap,
      orders: result,
    });
  } catch (error: any) {
    console.error("Unloading report error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
