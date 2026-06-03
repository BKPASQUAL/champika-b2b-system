import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const VALID_STATUSES = ["Pending", "Approved", "Processing", "Checking", "Loading"];

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  const { orderId } = await params;
  const { searchParams } = new URL(request.url);
  const targetStatus = searchParams.get("status") ?? "Loading";

  if (!VALID_STATUSES.includes(targetStatus)) {
    return NextResponse.json({ error: "Invalid target status" }, { status: 400 });
  }

  try {
    // 1. Fetch previous status
    const { data: previousOrder } = await supabaseAdmin
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .single();

    // 2. Perform removal & status update
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ load_id: null, status: targetStatus })
      .eq("id", orderId);

    if (error) throw error;

    // 3. Log status transition to invoice_history
    if (previousOrder && previousOrder.status !== targetStatus) {
      const { data: invoice } = await supabaseAdmin
        .from("invoices")
        .select("id")
        .eq("order_id", orderId)
        .single();

      if (invoice) {
        const cookieStore = await cookies();
        const supabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            cookies: {
              getAll() {
                return cookieStore.getAll();
              },
              setAll() {},
            },
          }
        );
        const { data: { user } } = await supabase.auth.getUser();
        const activeUserId = user?.id || searchParams.get("userId") || null;

        await supabaseAdmin.from("invoice_history").insert({
          invoice_id: invoice.id,
          previous_data: {
            status: previousOrder.status,
            new_status: targetStatus,
          },
          changed_by: activeUserId,
          change_reason: `Removed from loading sheet and status reverted to ${targetStatus}`,
          changed_at: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({ message: "Order removed from loading sheet" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
