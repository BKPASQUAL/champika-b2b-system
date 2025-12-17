import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  try {
    // 1. Get the Invoice
    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .select("id, order_id, total_amount, paid_amount, customer_id")
      .eq("id", id)
      .single();

    if (invError || !invoice)
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    // 2. Recalculate Totals from Order Items
    const { data: items } = await supabase
      .from("order_items")
      .select("total_price, commission_earned")
      .eq("order_id", invoice.order_id);

    if (!items)
      return NextResponse.json({ error: "No items found" }, { status: 400 });

    const newGrandTotal = items.reduce(
      (sum, item) => sum + Number(item.total_price),
      0
    );
    const newCommissionTotal = items.reduce(
      (sum, item) => sum + Number(item.commission_earned || 0),
      0
    );
    const newDue = newGrandTotal - Number(invoice.paid_amount || 0);

    // 3. Update Invoice
    await supabase
      .from("invoices")
      .update({ total_amount: newGrandTotal, due_amount: newDue })
      .eq("id", id);

    // 4. Update Order
    await supabase
      .from("orders")
      .update({ total_amount: newGrandTotal })
      .eq("id", invoice.order_id);

    // 5. Update Rep Commission
    // Check if record exists first
    const { data: repComm } = await supabase
      .from("rep_commissions")
      .select("id")
      .eq("order_id", invoice.order_id)
      .single();
    if (repComm) {
      await supabase
        .from("rep_commissions")
        .update({ total_commission_amount: newCommissionTotal })
        .eq("id", repComm.id);
    }

    // 6. Fix Customer Balance
    const diff = Number(invoice.total_amount) - newGrandTotal;
    if (invoice.customer_id && diff !== 0) {
      const { data: customer } = await supabase
        .from("customers")
        .select("outstanding_balance")
        .eq("id", invoice.customer_id)
        .single();
      if (customer) {
        await supabase
          .from("customers")
          .update({
            outstanding_balance: Number(customer.outstanding_balance) - diff,
          })
          .eq("id", invoice.customer_id);
      }
    }

    return NextResponse.json({ success: true, newTotal: newGrandTotal });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
