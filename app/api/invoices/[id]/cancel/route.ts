import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { userId, reason } = body as { userId?: string; reason?: string };

    // 1. Verify caller is admin or super_admin
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role, full_name")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (profile.role !== "admin" && profile.role !== "super_admin") {
      return NextResponse.json(
        { error: "Only admins can cancel invoices" },
        { status: 403 },
      );
    }

    // 2. Load invoice
    const { data: invoice, error: invError } = await supabaseAdmin
      .from("invoices")
      .select("id, order_id, customer_id, total_amount, paid_amount")
      .eq("id", id)
      .single();

    if (invError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // 3. Load order to check current status, rep ID, and inter-branch flag
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("status, sales_rep_id, is_inter_branch")
      .eq("id", invoice.order_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.status === "Cancelled") {
      return NextResponse.json(
        { error: "Invoice is already cancelled" },
        { status: 400 },
      );
    }

    // 4–6. Restock — skipped for inter-branch auto-bills (stock was never touched by them)
    if (!order.is_inter_branch) {
      const { data: orderItems } = await supabaseAdmin
        .from("order_items")
        .select("product_id, quantity, free_quantity")
        .eq("order_id", invoice.order_id);

      let locationIds: string[] = [];
      if (order.sales_rep_id) {
        const { data: assignments } = await supabaseAdmin
          .from("location_assignments")
          .select("location_id")
          .eq("user_id", order.sales_rep_id);
        locationIds = assignments?.map((a: any) => a.location_id) ?? [];
      }

      if (orderItems && orderItems.length > 0) {
        for (const item of orderItems) {
          const totalQty = (item.quantity || 0) + (item.free_quantity || 0);

          const { data: prod } = await supabaseAdmin
            .from("products")
            .select("stock_quantity")
            .eq("id", item.product_id)
            .single();

          if (prod) {
            await supabaseAdmin
              .from("products")
              .update({ stock_quantity: prod.stock_quantity + totalQty })
              .eq("id", item.product_id);
          }

          if (locationIds.length > 0) {
            const { data: locStocks } = await supabaseAdmin
              .from("product_stocks")
              .select("id, quantity")
              .eq("product_id", item.product_id)
              .in("location_id", locationIds)
              .order("quantity", { ascending: false });

            if (locStocks && locStocks.length > 0) {
              await supabaseAdmin
                .from("product_stocks")
                .update({ quantity: locStocks[0].quantity + totalQty })
                .eq("id", locStocks[0].id);
            }
          }
        }
      }
    }

    // 7. Reduce customer outstanding balance by the unpaid (due) amount
    const dueAmount =
      (invoice.total_amount || 0) - (invoice.paid_amount || 0);

    if (dueAmount > 0) {
      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("outstanding_balance")
        .eq("id", invoice.customer_id)
        .single();

      if (customer) {
        await supabaseAdmin
          .from("customers")
          .update({
            outstanding_balance: Math.max(
              0,
              (customer.outstanding_balance || 0) - dueAmount,
            ),
          })
          .eq("id", invoice.customer_id);
      }
    }

    // 8. Mark order as Cancelled
    await supabaseAdmin
      .from("orders")
      .update({ status: "Cancelled" })
      .eq("id", invoice.order_id);

    // 9. Save cancellation snapshot to history
    const { data: currentInvoice } = await supabaseAdmin
      .from("invoices")
      .select("*, orders(*)")
      .eq("id", id)
      .single();

    await supabaseAdmin.from("invoice_history").insert({
      invoice_id: id,
      previous_data: currentInvoice,
      changed_by: userId,
      change_reason: reason
        ? `Invoice Cancelled: ${reason}`
        : "Invoice Cancelled by Admin",
    });

    return NextResponse.json({ message: "Invoice cancelled successfully" });
  } catch (error: any) {
    console.error("Cancel Invoice Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
