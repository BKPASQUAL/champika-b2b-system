// app/api/finance/accounts/[id]/transactions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // Type definition updated
) {
  try {
    const { id } = await params; // Await the params here

    const { data, error } = await supabaseAdmin
      .from("account_transactions")
      .select(
        `
        *,
        from_account:from_account_id ( account_name ),
        to_account:to_account_id ( account_name )
      `
      )
      .or(`from_account_id.eq.${id},to_account_id.eq.${id}`)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
