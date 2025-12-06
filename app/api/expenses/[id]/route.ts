import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { error } = await supabaseAdmin.from("expenses").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ message: "Expense deleted" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { error } = await supabaseAdmin
      .from("expenses")
      .update({
        description: body.description,
        amount: body.amount,
        category: body.category,
        expense_date: body.expenseDate,
        payment_method: body.paymentMethod,
        reference_no: body.referenceNo,
      })
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ message: "Expense updated" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}