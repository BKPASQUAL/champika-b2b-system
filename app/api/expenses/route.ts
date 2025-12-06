import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false });

    if (error) throw error;

    const mapped = data.map((e) => ({
      id: e.id,
      description: e.description,
      amount: e.amount,
      category: e.category,
      expenseDate: e.expense_date,
      paymentMethod: e.payment_method,
      referenceNo: e.reference_no,
    }));

    return NextResponse.json(mapped);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { data, error } = await supabaseAdmin
      .from("expenses")
      .insert({
        description: body.description,
        amount: body.amount,
        category: body.category,
        expense_date: body.expenseDate,
        payment_method: body.paymentMethod,
        reference_no: body.referenceNo,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(
      { message: "Expense added", data },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
