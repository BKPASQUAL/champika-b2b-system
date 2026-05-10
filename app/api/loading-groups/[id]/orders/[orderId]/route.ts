import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// DELETE: remove a single order from the group
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  const { id, orderId } = await params;
  try {
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ load_id: null })
      .eq("id", orderId)
      .eq("load_id", id);

    if (error) throw error;
    return NextResponse.json({ message: "Order removed from group" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
