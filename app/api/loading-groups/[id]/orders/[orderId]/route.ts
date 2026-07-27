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
      .update({ load_id: null, status: "Pending" })
      .eq("id", orderId)
      .eq("load_id", id);

    if (error) throw error;

    // If this was the last order in a lorry-less folder, delete the now-empty folder
    const { data: sheet } = await supabaseAdmin
      .from("loading_sheets")
      .select("lorry_number")
      .eq("id", id)
      .single();

    if (sheet && !sheet.lorry_number) {
      const { count } = await supabaseAdmin
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("load_id", id);

      if (!count) {
        await supabaseAdmin.from("loading_sheets").delete().eq("id", id);
      }
    }

    return NextResponse.json({ message: "Order removed from group" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
