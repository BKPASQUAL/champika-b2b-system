import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const addOrdersSchema = z.object({
  orderIds: z.array(z.string()).min(1, "Select at least one order"),
  userId: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { orderIds, userId } = addOrdersSchema.parse(body);

    // 1. Fetch previous statuses
    const { data: previousOrders } = await supabaseAdmin
      .from("orders")
      .select("id, status")
      .in("id", orderIds);

    // 2. Fetch associated invoices
    const { data: invoices } = await supabaseAdmin
      .from("invoices")
      .select("id, order_id")
      .in("order_id", orderIds);

    // 3. Update orders to In Transit
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ load_id: id, status: "In Transit" })
      .in("id", orderIds);

    if (error) throw error;

    // 4. Log status transitions to invoice_history
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
            setAll() {},
          },
        }
      );
      const { data: { user } } = await supabase.auth.getUser();
      const activeUserId = user?.id || userId || null;

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
            change_reason: `Assigned to loading sheet and status set to In Transit`,
            changed_at: new Date().toISOString(),
          });
        }
      }
    }

    return NextResponse.json({ message: "Orders added to loading sheet" });
  } catch (error: any) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: error.issues }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
