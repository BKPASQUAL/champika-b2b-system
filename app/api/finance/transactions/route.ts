// app/api/finance/transactions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const accountId = searchParams.get("accountId");

    let query = supabaseAdmin
      .from("account_transactions")
      .select(
        `
        *,
        from_account:from_account_id ( id, account_name, account_type ),
        to_account:to_account_id ( id, account_name, account_type )
      `
      )
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (type && type !== "all") {
      query = query.eq("transaction_type", type);
    }

    if (accountId && accountId !== "all") {
      query = query.or(
        `from_account_id.eq.${accountId},to_account_id.eq.${accountId}`
      );
    }

    const { data, error } = await query;

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
