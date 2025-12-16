// app/api/finance/accounts/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // Type definition updated
) {
  try {
    const { id } = await params; // Await the params here

    const { data, error } = await supabaseAdmin
      .from("bank_accounts")
      .select(
        `
        *,
        bank_codes ( bank_code, bank_name )
      `
      )
      .eq("id", id)
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
