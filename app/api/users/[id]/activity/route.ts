// app/api/users/[id]/activity/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Fetch logs where 'changed_by' equals the user ID
    const { data: logs, error } = await supabaseAdmin
      .from("audit_logs")
      .select("*")
      .eq("changed_by", id)
      .order("changed_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(logs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
