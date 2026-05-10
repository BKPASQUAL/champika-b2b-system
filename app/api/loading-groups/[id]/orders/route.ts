import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// POST: add orders to an existing group
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { orderIds } = await request.json();
    if (!orderIds?.length) {
      return NextResponse.json({ error: "No orderIds provided" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("orders")
      .update({ load_id: id })
      .in("id", orderIds);

    if (error) throw error;
    return NextResponse.json({ message: "Orders added to group" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
