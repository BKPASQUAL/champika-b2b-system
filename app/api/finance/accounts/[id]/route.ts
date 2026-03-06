// app/api/finance/accounts/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const allowedFields: Record<string, unknown> = {};
    if (body.account_name !== undefined)
      allowedFields.account_name = body.account_name;
    if (body.allow_overdraft !== undefined)
      allowedFields.allow_overdraft = body.allow_overdraft;
    if (body.is_active !== undefined) allowedFields.is_active = body.is_active;
    if (body.branch !== undefined) allowedFields.branch = body.branch;

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
