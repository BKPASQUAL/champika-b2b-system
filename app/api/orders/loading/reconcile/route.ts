import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { loadId, updates, closeLoad } = body;

    if (!loadId || !updates) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    // 1. Process Each Order Update
    for (const update of updates) {
      const { orderId, status, finalAmount, paymentStatus } = update;

      // A. Update Order Status
      await supabaseAdmin
        .from("orders")
        .update({
          status: status === "Returned" ? "Cancelled" : status, // Map "Returned" to "Cancelled" or keep specific status
          // Note: You might want a specific 'Returned' status in your DB enum
        })
        .eq("id", orderId);

      // B. If Amount Changed (Partial Delivery)
      // We need to fetch the Invoice ID first
      const { data: invoice } = await supabaseAdmin
        .from("invoices")
        .select("id, total_amount")
        .eq("order_id", orderId)
        .single();

      if (invoice) {
        // If amount changed, update Invoice total
        if (invoice.total_amount !== finalAmount) {
          await supabaseAdmin
            .from("invoices")
            .update({ total_amount: finalAmount })
            .eq("id", invoice.id);
        }

        // C. If Marked Paid (Cash Collected)
        if (paymentStatus === "Paid") {
          await supabaseAdmin
            .from("invoices")
            .update({
              status: "Paid",
              paid_amount: finalAmount,
              due_amount: 0,
            })
            .eq("id", invoice.id);
        }
      }
    }

    // 2. Close the Load Sheet
    if (closeLoad) {
      const { error: loadError } = await supabaseAdmin
        .from("loading_sheets")
        .update({ status: "Completed" })
        .eq("id", loadId);

      if (loadError) throw loadError;
    }

    return NextResponse.json({ message: "Reconciliation successful" });
  } catch (error: any) {
    console.error("Reconciliation Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
