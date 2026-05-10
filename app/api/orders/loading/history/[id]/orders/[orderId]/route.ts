import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const VALID_STATUSES = ["Pending", "Approved", "Processing", "Checking", "Loading"];

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  const { orderId } = await params;
  const { searchParams } = new URL(request.url);
  const targetStatus = searchParams.get("status") ?? "Loading";

  if (!VALID_STATUSES.includes(targetStatus)) {
    return NextResponse.json({ error: "Invalid target status" }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ load_id: null, status: targetStatus })
      .eq("id", orderId);

    if (error) throw error;
    return NextResponse.json({ message: "Order removed from loading sheet" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
