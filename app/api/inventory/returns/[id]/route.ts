// app/api/inventory/returns/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { return_type } = body;

    if (!return_type || !["Good", "Damage"].includes(return_type)) {
      return NextResponse.json({ error: "Invalid return_type" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("inventory_returns")
      .update({ return_type })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("PATCH /api/inventory/returns/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
