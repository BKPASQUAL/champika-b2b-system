import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { lorryNumber, driverId, helperName } = body;

    const update: Record<string, any> = {};
    if (lorryNumber !== undefined) update.lorry_number = lorryNumber;
    if (driverId !== undefined) update.driver_id = driverId;
    if (helperName !== undefined) update.helper_name = helperName || null;

    const { error } = await supabaseAdmin
      .from("loading_sheets")
      .update(update)
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ message: "Group updated" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Unlink all orders from this group
    const { error: unlinkErr } = await supabaseAdmin
      .from("orders")
      .update({ load_id: null })
      .eq("load_id", id);

    if (unlinkErr) throw unlinkErr;

    const { error } = await supabaseAdmin
      .from("loading_sheets")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ message: "Group deleted" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
