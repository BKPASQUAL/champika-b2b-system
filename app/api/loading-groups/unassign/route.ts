import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const { orderIds } = await request.json();
    if (!orderIds?.length) {
      return NextResponse.json({ error: "No orderIds provided" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("orders")
      .update({ load_id: null })
      .in("id", orderIds);

    if (error) throw error;
    return NextResponse.json({ message: "Orders unassigned from folder/lorry" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
