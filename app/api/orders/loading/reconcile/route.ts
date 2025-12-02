// app/api/orders/loading/reconcile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Added userId to destructuring
    const { loadId, updates, closeLoad, userId } = body;

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
          status: status === "Returned" ? "Cancelled" : status,
        })
        .eq("id", orderId);

      // B. Handle Invoice Updates
      const { data: invoice } = await supabaseAdmin
        .from("invoices")
        .select("id, total_amount, customer_id, invoice_no")
        .eq("order_id", orderId)
        .single();

      if (invoice) {
        // Check if the amount passed from frontend differs from DB
        // (In the read-only UI flow, this likely won't trigger unless data changed mid-flight,
        // but it serves as a robust backend check)
        if (invoice.total_amount !== finalAmount) {
          // --- Audit Logging (If User ID Provided) ---
          if (userId) {
            await supabaseAdmin.from("invoice_history").insert({
              invoice_id: invoice.id,
              previous_data: {
                total_amount: invoice.total_amount,
                status: "Reconciling",
              },
              changed_by: userId, // Log the user
              change_reason: `Reconciliation: Amount adjusted from ${invoice.total_amount} to ${finalAmount}`,
              changed_at: new Date().toISOString(),
            });
          }

          // Update Invoice Table
          await supabaseAdmin
            .from("invoices")
            .update({ total_amount: finalAmount })
            .eq("id", invoice.id);

          // Update Customer Balance
          const diff = finalAmount - invoice.total_amount;
          if (diff !== 0) {
            const { data: customer } = await supabaseAdmin
              .from("customers")
              .select("outstanding_balance")
              .eq("id", invoice.customer_id)
              .single();

            if (customer) {
              await supabaseAdmin
                .from("customers")
                .update({
                  outstanding_balance:
                    (customer.outstanding_balance || 0) + diff,
                })
                .eq("id", invoice.customer_id);
            }
          }
        }

        // C. Update Payment Status (e.g. if marked Paid during recon)
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
