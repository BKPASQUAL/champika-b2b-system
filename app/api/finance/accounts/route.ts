// app/api/finance/accounts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const TYPES_NEEDING_BANK = ["Bank", "Savings", "Current"];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active");

    let query = supabaseAdmin
      .from("bank_accounts")
      .select(
        `
        *,
        bank_codes ( bank_code, bank_name )
      `
      )
      .order("created_at", { ascending: false });

    if (activeOnly === "true") {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) throw error;
    return NextResponse.json(data || []);
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

    const needsBank = TYPES_NEEDING_BANK.includes(body.account_type);
    const initialBalance = parseFloat(body.current_balance) || 0;

    // 1. Create Account with 0 Balance initially
    const { data: account, error: accError } = await supabaseAdmin
      .from("bank_accounts")
      .insert({
        account_name: body.account_name,
        account_type: body.account_type,
        bank_code_id: needsBank ? body.bank_code_id || null : null,
        account_number: needsBank ? body.account_number || null : null,
        branch: needsBank ? body.branch || null : null,
        current_balance: 0,
        allow_overdraft:
          body.allow_overdraft !== undefined
            ? body.allow_overdraft
            : body.account_type === "Current",
        is_active: true,
      })
      .select()
      .single();

    if (accError) throw accError;

    // 2. Record "Opening Balance" Transaction if not 0
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
          transaction_date: new Date().toISOString().split("T")[0],
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

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Account ID is required" },
        { status: 400 }
      );
    }

    const allowedFields: Record<string, unknown> = {};
    if (updates.account_name !== undefined)
      allowedFields.account_name = updates.account_name;
    if (updates.allow_overdraft !== undefined)
      allowedFields.allow_overdraft = updates.allow_overdraft;
    if (updates.is_active !== undefined)
      allowedFields.is_active = updates.is_active;
    if (updates.branch !== undefined) allowedFields.branch = updates.branch;

    allowedFields.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("bank_accounts")
      .update(allowedFields)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
