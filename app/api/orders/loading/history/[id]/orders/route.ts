import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

const addOrdersSchema = z.object({
  orderIds: z.array(z.string()).min(1, "Select at least one order"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { orderIds } = addOrdersSchema.parse(body);

    const { error } = await supabaseAdmin
      .from("orders")
      .update({ load_id: id, status: "In Transit" })
      .in("id", orderIds);

    if (error) throw error;
    return NextResponse.json({ message: "Orders added to loading sheet" });
  } catch (error: any) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: error.issues }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
