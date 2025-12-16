// app/api/finance/transfer/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { from_account_id, to_account_id, amount, date, description } = body;

    if (!from_account_id || !to_account_id || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Create the Transaction Record
    const { data, error } = await supabaseAdmin
      .from("account_transactions")
      .insert({
        transaction_no: `TXN-${Date.now()}`,
        transaction_type: "Transfer",
        from_account_id,
        to_account_id,
        amount: parseFloat(amount),
        transaction_date: date || new Date().toISOString(),
        description: description || "Internal Transfer",
      })
      .select()
      .single();

    if (error) throw error;

    // Note: The Trigger 'trg_update_account_balance' in your SQL 
    // will automatically update the balances in 'bank_accounts'.

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}