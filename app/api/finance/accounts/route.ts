// app/api/finance/accounts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from("bank_accounts")
      .select(
        `
        *,
        bank_codes ( bank_code, bank_name )
      `
      )
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.account_name || !body.account_type) {
      return NextResponse.json(
        { error: "Account Name and Type are required" },
        { status: 400 }
      );
    }

    const initialBalance = parseFloat(body.current_balance) || 0;

    // 1. Create Account with 0 Balance initially
    // We let the transaction trigger update the balance to ensure consistency
    const { data: account, error: accError } = await supabaseAdmin
      .from("bank_accounts")
      .insert({
        account_name: body.account_name,
        account_type: body.account_type,
        bank_code_id:
          body.account_type === "Cash on Hand" ? null : body.bank_code_id,
        account_number:
          body.account_type === "Cash on Hand" ? null : body.account_number,
        current_balance: 0,
        allow_overdraft: body.account_type === "Current" ? true : false,
      })
      .select()
      .single();

    if (accError) throw accError;

    // 2. Record "Opening Balance" Transaction if not 0
    // If Positive: Credit the account (to_account_id = account.id)
    // If Negative: Debit the account (from_account_id = account.id)
    if (initialBalance !== 0) {
      const isNegative = initialBalance < 0;

      const { error: txError } = await supabaseAdmin
        .from("account_transactions")
        .insert({
          transaction_no: `OP-${Date.now()}`,
          transaction_type: "Opening Balance",
          from_account_id: isNegative ? account.id : null,
          to_account_id: isNegative ? null : account.id,
          amount: Math.abs(initialBalance),
          description: "Initial Opening Balance",
          transaction_date: new Date().toISOString(),
        });

      if (txError) {
        console.error("Error creating opening transaction:", txError);
      }
    }

    return NextResponse.json(account, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
